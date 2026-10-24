// Run with: node --test
// Gemma speed settings (measured on the demo Mac, Ollama 0.40, gemma4:e4b):
//  - Gemma 4 "thinks" first by default: a one-sentence answer cost ~220 hidden tokens, and with a 512-token cap
//    a real Ask C question came back EMPTY after 10 s. think:false answered the same question in ~4.5 s.
//  - Ollama unloads the model after 5 idle minutes (reload ~4 s); keep_alive keeps it ready.
//  - One context size for every call, so Ollama never reloads to switch sizes.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/gemma.js");
const G = window.PrivaCGemma;

test("every request turns thinking off, keeps Gemma loaded, and uses one context size", () => {
  const b = G.buildRequest("Hi", { system: "You are C." });
  assert.strictEqual(b.think, false);
  assert.strictEqual(b.keep_alive, G.KEEP_ALIVE);
  assert.strictEqual(b.options.num_ctx, G.NUM_CTX);
  assert.ok(b.options.num_predict > 0);
  const j = G.buildRequest("Sells?", { json: true, options: { temperature: 0 } });
  assert.strictEqual(j.options.num_ctx, G.NUM_CTX);       // same size for the policy reader
  assert.strictEqual(j.options.temperature, 0);           // caller options still apply
  assert.strictEqual(j.think, false);
});

// A fake Ollama that streams NDJSON lines, split at awkward places like a real network.
function streamingFetch(pieces, { delayMs = 0, log } = {}) {
  return async (url, init) => {
    if (log) log.push(JSON.parse(init.body));
    const lines = pieces.map((p) => JSON.stringify({ message: { role: "assistant", content: p }, done: false }) + "\n")
      .concat(JSON.stringify({ message: { role: "assistant", content: "" }, done: true }) + "\n").join("");
    const bytes = new TextEncoder().encode(lines);
    let i = 0;
    return {
      ok: true, status: 200,
      body: { getReader: () => ({ read: async () => {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        if (init.signal && init.signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
        if (i >= bytes.length) return { done: true };
        const n = Math.min(7, bytes.length - i);                 // 7-byte chunks cut JSON lines in half
        const value = bytes.slice(i, i + n); i += n;
        return { done: false, value };
      } }) }
    };
  };
}

test("streaming hands each piece to onToken as Gemma writes and returns the whole answer", async () => {
  const seen = [];
  const log = [];
  const text = await G.ask("Who is Criteo?", { fetch: streamingFetch(["Criteo is ", "an ad ", "company. [Tracker Radar]"], { log }), onToken: (piece, sofar) => seen.push(sofar) });
  assert.strictEqual(text, "Criteo is an ad company. [Tracker Radar]");
  assert.deepStrictEqual(seen, ["Criteo is ", "Criteo is an ad ", "Criteo is an ad company. [Tracker Radar]"]);
  assert.strictEqual(log[0].stream, true);
});

test("warm() loads Gemma without asking anything", async () => {
  let body;
  await G.warm({ fetch: async (url, init) => { body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.deepStrictEqual(body.messages, []);
  assert.strictEqual(body.keep_alive, G.KEEP_ALIVE);
  assert.strictEqual(body.options.num_ctx, G.NUM_CTX);
});

test("warm() never throws when Ollama is off", async () => {
  assert.strictEqual(await G.warm({ fetch: async () => { throw new TypeError("Failed to fetch"); } }), false);
});

test("Ask C goes first: a background policy read pauses, then finishes after the answer", async () => {
  const order = [];
  const slowFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const who = body.messages[body.messages.length - 1].content;
    order.push("start " + who);
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, 60);
      if (init.signal) init.signal.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
    });
    order.push("end " + who);
    return { ok: true, status: 200, json: async () => ({ message: { content: who === "policy" ? '{"answers":[]}' : "answer" } }) };
  };
  const policy = G.ask("policy", { json: true, priority: "low", fetch: slowFetch });
  await new Promise((r) => setTimeout(r, 10));            // the policy read is running...
  const askC = G.ask("question", { fetch: slowFetch });    // ...when someone asks C
  assert.strictEqual(await askC, "answer");
  assert.deepStrictEqual(await policy, { answers: [] });
  assert.deepStrictEqual(order, ["start policy", "start question", "end question", "start policy", "end policy"]);
});
