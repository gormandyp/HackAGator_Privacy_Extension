// Run with: node --test
// Which brain answers (shared/ai.js): Gemma in the browser by default, Ollama as the fallback or by choice.
// Fake Chrome: an offscreen "brain page" that answers like offscreen/brain.js would.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function load({ brain, ollamaUp = false, use } = {}) {
  const listeners = [];
  const sent = [];
  const local = use ? { privacAI: { use } } : {};
  let pageOpen = false;
  const chrome = {
    storage: {
      local: { get: async (k) => ({ [k]: local[k] }), set: async (o) => Object.assign(local, o) },
      session: { set: async () => {} }
    },
    offscreen: { createDocument: async () => { pageOpen = true; } },
    runtime: {
      getContexts: async () => (pageOpen ? [{}] : []),
      onMessage: { addListener: (f) => listeners.push(f) },
      sendMessage: async (msg) => { sent.push(msg); return brain(msg, (m) => listeners.forEach((f) => f(m))); }
    }
  };
  const ctx = { chrome, console, setTimeout, clearTimeout, AbortController, AbortSignal, URL, Promise, TextDecoder, Response,
    fetch: async (url) => { if (/11434\/api\/version/.test(url) && ollamaUp) return { ok: true }; throw new TypeError("Failed to fetch"); } };
  ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../shared/gemma.js", "utf8"), ctx);
  const ollamaCalls = [];
  ctx.PrivaCGemma.ask = async (q, o) => { ollamaCalls.push({ q, o }); return "from Ollama"; };
  ctx.PrivaCGemma.warm = async () => { ollamaCalls.push({ warm: true }); return true; };
  vm.runInContext(fs.readFileSync(__dirname + "/../shared/ai.js", "utf8"), ctx);
  return { AI: ctx.PrivaCAI, sent, ollamaCalls, local };
}

// A fake brain page: answers "generate" after streaming two pieces; status says ready.
const readyBrain = (opts = {}) => async (msg, broadcast) => {
  if (msg.target !== "privac-brain") return undefined;
  if (msg.cmd === "status" || msg.cmd === "warm") return { state: opts.state || "ready" };
  if (msg.cmd === "generate") {
    if (opts.notReady) return { error: "C's brain isn't downloaded yet.", code: "NOT_READY" };
    broadcast({ type: "privac-brain-token", id: msg.id, text: "Criteo is" });
    broadcast({ type: "privac-brain-token", id: msg.id, text: "Criteo is an ad company." });
    return { text: msg.json ? '```json\n{"answers": []}\n```' : "Criteo is an ad company." };
  }
  return { state: "ready" };
};

test("by default Gemma in the browser answers, streaming its words", async () => {
  const { AI, sent, ollamaCalls } = load({ brain: readyBrain() });
  const pieces = [];
  const text = await AI.ask("Who is Criteo?", { system: "You are C.", context: "Evidence", onToken: (p, all) => pieces.push(all) });
  assert.strictEqual(text, "Criteo is an ad company.");
  assert.deepStrictEqual(pieces, ["Criteo is", "Criteo is an ad company."]);
  const gen = sent.find((m) => m.cmd === "generate");
  assert.strictEqual(gen.system, "You are C.");
  assert.match(gen.user, /^Evidence:\nEvidence\n\nQuestion: Who is Criteo\?$/);
  assert.strictEqual(ollamaCalls.length, 0);
});

test("policy answers (JSON) are parsed even when wrapped in ``` fences", async () => {
  const { AI } = load({ brain: readyBrain() });
  const plain = (x) => JSON.parse(JSON.stringify(x));   // (the answer object comes from the test's sandbox)
  assert.deepStrictEqual(plain(await AI.ask("Sells?", { json: true, priority: "low" })), { answers: [] });
});

test("not downloaded yet: Ollama answers if it's running", async () => {
  const { AI, ollamaCalls } = load({ brain: readyBrain({ notReady: true }), ollamaUp: true });
  assert.strictEqual(await AI.ask("Hi", {}), "from Ollama");
  assert.strictEqual(ollamaCalls.length, 1);
});

test("not downloaded and no Ollama: C says how to get its brain", async () => {
  const { AI } = load({ brain: readyBrain({ notReady: true }), ollamaUp: false });
  await assert.rejects(AI.ask("Hi", {}), /Download C's brain/);
});

test("choosing Ollama in the dashboard sends questions to Ollama only", async () => {
  const { AI, sent, ollamaCalls } = load({ brain: readyBrain(), use: "ollama" });
  assert.strictEqual(await AI.ask("Hi", {}), "from Ollama");
  assert.ok(!sent.some((m) => m.cmd === "generate"));
  const r = await AI.command({ cmd: "use", use: "browser" });
  assert.strictEqual(r.use, "browser");
  assert.strictEqual(await AI.ask("Hi", {}), "Criteo is an ad company.");
  assert.strictEqual(ollamaCalls.length, 1);
});

test("warming never starts the 2 GB download by itself", async () => {
  const { AI, sent } = load({ brain: readyBrain({ state: "none" }) });
  await AI.warm("You are C.");
  assert.ok(!sent.some((m) => m.cmd === "download" || m.cmd === "warm"));
  const ready = load({ brain: readyBrain({ state: "downloaded" }) });
  await ready.AI.warm("You are C.");
  assert.ok(ready.sent.some((m) => m.cmd === "warm" && m.system === "You are C."));
});

test("Ask C goes first: a running policy question is stopped and asked again after", async () => {
  let release;
  const cancelled = [];
  const brain = async (msg, broadcast) => {
    if (msg.cmd === "cancel") { cancelled.push(msg.id); if (release) release({ error: "Cancelled", code: "CANCELLED" }); return { cancelled: true }; }
    if (msg.cmd === "generate" && msg.json && !cancelled.length) return new Promise((r) => { release = r; });
    return readyBrain()(msg, broadcast);
  };
  const { AI } = load({ brain });
  const policy = AI.ask("policy", { json: true, priority: "low" });
  await new Promise((r) => setTimeout(r, 5));
  assert.strictEqual(await AI.ask("question", {}), "Criteo is an ad company.");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await policy)), { answers: [] });
  assert.strictEqual(cancelled.length, 1);
});

test("hanging up stops the in-browser answer too", async () => {
  const cancelled = [];
  const brain = async (msg) => {
    if (msg.cmd === "cancel") { cancelled.push(msg.id); return { cancelled: true }; }
    if (msg.cmd === "generate") return new Promise(() => {});   // never finishes on its own
    return { state: "ready" };
  };
  const { AI } = load({ brain });
  const hangUp = new AbortController();
  const p = AI.ask("Hi", { signal: hangUp.signal });
  await new Promise((r) => setTimeout(r, 5));
  hangUp.abort();
  await assert.rejects(p);
  await new Promise((r) => setTimeout(r, 5));
  assert.strictEqual(cancelled.length, 1);
});
