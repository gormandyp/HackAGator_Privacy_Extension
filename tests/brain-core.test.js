// Run with: node --test
// C's in-browser brain (shared/brain-core.js) with a fake LiteRT-LM engine, fake Cache Storage and fake downloads.
// The real engine runs Gemma 4 on WebGPU in Chrome; these tests check everything around it.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/brain-core.js");
const { create, MODEL, REASONS } = window.PrivaCBrainCore;

const SIZE = 1000;   // the tests' stand-in for the 2 GB model file (create({ model }) below)

function fakeLM({ failCreate, chunks = ["Criteo is ", "an ad company."], delay = 0, createDelay = 0, streamError, runtimeFails = 0 } = {}) {
  const calls = { engines: 0, convs: [], deleted: 0, wasm: null, settings: null, runtimeStarts: 0 };
  class Conv {
    constructor(cfg) { this.cfg = cfg; this.cancelled = false; calls.convs.push(this); }
    sendMessageStreaming(msg) {
      this.msg = msg;
      const self = this;
      return (async function* () {
        for (const text of chunks) {
          await new Promise((r) => setTimeout(r, delay));
          if (self.cancelled) throw new Error("CANCELLED");
          if (streamError) throw new Error(streamError);
          yield { role: "assistant", content: [{ type: "text", text }] };
        }
      })();
    }
    cancel() { this.cancelled = true; }
    async delete() { calls.deleted++; }
  }
  return {
    calls,
    SamplerType: { TOP_P: 2, GREEDY: 3 },
    getOrLoadGlobalLiteRtLm: async (url) => { calls.wasm = url; if (++calls.runtimeStarts <= runtimeFails) throw new Error("Aborted(OOM)"); },
    Engine: {
      create: async (settings) => {
        calls.engines++; calls.settings = settings;
        if (createDelay) await new Promise((r) => setTimeout(r, createDelay));
        if (failCreate) throw new Error(failCreate);
        return { createConversation: async (cfg) => new Conv(cfg), delete: async () => { calls.engineDeleted = true; } };
      }
    }
  };
}

function fakeCaches() {
  const store = new Map();
  return {
    store,
    open: async () => ({
      match: async (url) => (store.has(url) ? new Response(new Uint8Array(4), { headers: { "content-length": String(store.get(url)) } }) : undefined),
      put: async (url, res) => { const buf = await res.arrayBuffer(); store.set(url, buf.byteLength); },
      delete: async (url) => store.delete(url)
    })
  };
}

// A download of `size` bytes in 7 pieces; `breakAt` makes the connection drop part-way; `pause` (ms) slows each
// piece. Like a real fetch, it stops with an AbortError when its signal is aborted (Cancel).
function download(size, { breakAt, pause = 0, signal, claim } = {}) {
  let sent = 0;
  const body = new ReadableStream({
    start(c) { if (signal) signal.addEventListener("abort", () => { try { c.error(new DOMException("The user aborted a request.", "AbortError")); } catch (e) { /* closed */ } }); },
    async pull(c) {
      if (pause) await new Promise((r) => setTimeout(r, pause));
      if (signal && signal.aborted) return;
      if (breakAt && sent >= breakAt) { c.error(new TypeError("network error")); return; }
      const n = Math.min(Math.ceil(size / 7), size - sent);
      if (n <= 0) { c.close(); return; }
      sent += n; c.enqueue(new Uint8Array(n));
    }
  });
  return new Response(body, { headers: { "content-length": String(claim || size) } });
}

function brainWith(opts = {}) {
  const posts = [];
  const lm = opts.lm || fakeLM(opts);
  const caches = opts.caches || fakeCaches();
  const brain = create({
    lm, caches,
    model: { ...MODEL, bytes: SIZE },
    wasmUrl: "chrome-extension://x/vendor/litert-lm/wasm/litertlm_wasm_internal.js",
    bundledModelUrl: "chrome-extension://x/models/" + MODEL.file,
    fetch: opts.fetch || (async (url, init) => { if (url === MODEL.url) return download(SIZE, { signal: init && init.signal }); throw new TypeError("Failed to fetch"); }),
    gpu: "gpu" in opts ? opts.gpu : { requestAdapter: async () => ({ info: {} }) },
    jspi: "jspi" in opts ? opts.jspi : true,
    post: (m) => posts.push(m),
    now: opts.now,
    setTimeout: opts.setTimeout
  });
  return { brain, lm, caches, posts };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

test("no WebGPU or an old Chrome: says why, plainly", async () => {
  assert.strictEqual((await brainWith({ gpu: null }).brain.handle({ cmd: "status" })).state, "unsupported");
  const old = await brainWith({ jspi: false }).brain.handle({ cmd: "status" });
  assert.strictEqual(old.reason, "old-browser");
  assert.strictEqual(old.error, REASONS["old-browser"]);
  const noAdapter = await brainWith({ gpu: { requestAdapter: async () => null } }).brain.handle({ cmd: "status" });
  assert.strictEqual(noAdapter.reason, "no-gpu");
});

test("the one-time download is stored, reports progress, and then C's brain is 'downloaded'", async () => {
  const { brain, caches, posts } = brainWith();
  assert.strictEqual((await brain.handle({ cmd: "status" })).state, "none");
  await brain.handle({ cmd: "download" });
  for (let i = 0; i < 50 && brain.status().state !== "downloaded"; i++) await flush();
  assert.strictEqual(brain.status().state, "downloaded");
  assert.strictEqual(caches.store.get(MODEL.url), 1000);
  assert.ok(posts.some((m) => m.type === "privac-brain-status" && m.status.state === "downloading"));
});

test("a dropped download leaves nothing behind and says what happened", async () => {
  const { brain, caches } = brainWith({ fetch: async (url) => { if (url === MODEL.url) return download(1000, { breakAt: 400 }); throw new TypeError("Failed to fetch"); } });
  await brain.handle({ cmd: "download" });
  for (let i = 0; i < 50 && !["error", "downloaded"].includes(brain.status().state); i++) await flush();
  assert.strictEqual(brain.status().state, "error");
  assert.match(brain.status().error, /internet|download/i);
  assert.strictEqual(caches.store.size, 0);
});

test("before the download, a question says C's brain isn't ready (the background then tries Ollama)", async () => {
  const r = await brainWith().brain.handle({ cmd: "generate", id: "a", system: "s", user: "u" });
  assert.strictEqual(r.code, "NOT_READY");
});

test("answers stream in; Gemma runs from our own copy of the runtime with thinking off", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain, lm, posts } = brainWith({ caches });
  const r = await brain.handle({ cmd: "generate", id: "q1", system: "You are C.", user: "Who is Criteo?", temperature: 0.2, stream: true });
  assert.strictEqual(r.text, "Criteo is an ad company.");
  assert.strictEqual(lm.calls.wasm, "chrome-extension://x/vendor/litert-lm/wasm/litertlm_wasm_internal.js");
  const conv = lm.calls.convs[0];
  assert.deepStrictEqual(conv.cfg.preface.extra_context, { enable_thinking: false });
  assert.strictEqual(conv.cfg.preface.messages[0].content, "You are C.");
  assert.strictEqual(conv.msg.content, "Who is Criteo?");
  assert.ok(posts.some((m) => m.type === "privac-brain-token" && m.id === "q1" && m.text === "Criteo is an ad company."));
  assert.strictEqual(brain.status().state, "ready");
});

test("policy questions (JSON) use steady, greedy answers", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain, lm } = brainWith({ caches });
  await brain.handle({ cmd: "generate", id: "p1", system: "Policy reader", user: "Sells?", json: true });
  assert.strictEqual(lm.calls.convs[0].cfg.sessionConfig.samplerParams.type, lm.SamplerType.GREEDY);
});

test("speed: after an answer, the next Ask C conversation is already prepared (system prompt read ahead)", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain, lm } = brainWith({ caches });
  await brain.handle({ cmd: "generate", id: "1", system: "You are C.", user: "first", temperature: 0.2 });
  await flush();
  const before = lm.calls.convs.length;            // the answer's conversation + one prepared for next time
  await brain.handle({ cmd: "generate", id: "2", system: "You are C.", user: "second", temperature: 0.2 });
  const used = lm.calls.convs.find((c) => c.msg && c.msg.content === "second");
  assert.ok(lm.calls.convs.indexOf(used) < before, "the second question used the conversation prepared earlier");
  assert.ok(used.cfg.prefillPrefaceOnInit);
});

test("warm() loads Gemma and prepares Ask C before the first question", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain, lm } = brainWith({ caches });
  await brain.handle({ cmd: "warm", system: "You are C." });
  assert.strictEqual(lm.calls.engines, 1);
  assert.strictEqual(lm.calls.convs.length, 1);
  assert.strictEqual(brain.status().state, "ready");
});

test("Ask C can stop a policy question that's running, or one still waiting its turn", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain } = brainWith({ caches, delay: 15 });
  const running = brain.handle({ cmd: "generate", id: "low1", system: "p", user: "u", json: true });
  const waiting = brain.handle({ cmd: "generate", id: "low2", system: "p", user: "u", json: true });
  await new Promise((r) => setTimeout(r, 5));
  await brain.handle({ cmd: "cancel", id: "low1" });
  await brain.handle({ cmd: "cancel", id: "low2" });
  assert.strictEqual((await running).code, "CANCELLED");
  assert.strictEqual((await waiting).code, "CANCELLED");
});

test("a model file packed inside the extension is used without downloading anything", async () => {
  const fetched = [];
  const { brain, lm } = brainWith({ fetch: async (url) => { fetched.push(url); if (url.endsWith(MODEL.file) && url.startsWith("chrome-extension://")) return new Response(new Uint8Array(8)); throw new TypeError("Failed to fetch"); } });
  assert.strictEqual((await brain.handle({ cmd: "status" })).state, "downloaded");
  const r = await brain.handle({ cmd: "generate", id: "b", system: "s", user: "u" });
  assert.ok(r.text);
  assert.ok(!fetched.includes(MODEL.url), "never went to the internet");
  assert.strictEqual(brain.status().where, "bundled");
  assert.strictEqual(lm.calls.engines, 1);
});

test("if Gemma fails on the GPU, C says so and starts fresh next time", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain } = brainWith({ caches, failCreate: "WebGPU device was lost" });
  const r = await brain.handle({ cmd: "generate", id: "x", system: "s", user: "u" });
  assert.match(r.error, /graphics memory/);
  assert.strictEqual(brain.status().state, "error");
});

test("Remove deletes the downloaded file and frees the GPU", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, MODEL.bytes);
  const { brain, lm } = brainWith({ caches });
  await brain.handle({ cmd: "warm", system: "s" });
  const s = await brain.handle({ cmd: "remove" });
  assert.strictEqual(s.state, "none");
  assert.strictEqual(caches.store.size, 0);
  assert.ok(lm.calls.engineDeleted);
});

// ---------- review fixes (second opinions from ChatGPT and a fresh Claude review) ----------

test("a download of the wrong size (e.g. a Wi-Fi sign-in page) is refused before it fills the disk", async () => {
  let pulled = 0;
  const { brain, caches } = brainWith({ fetch: async (url) => {
    if (url !== MODEL.url) throw new TypeError("Failed to fetch");
    const r = download(SIZE, { claim: 4321 });
    return new Response(r.body.pipeThrough(new TransformStream({ transform(c, o) { pulled += c.byteLength; o.enqueue(c); } })), { headers: r.headers });
  } });
  await brain.handle({ cmd: "download" });
  for (let i = 0; i < 50 && brain.status().state !== "error"; i++) await flush();
  assert.strictEqual(brain.status().state, "error");
  assert.match(brain.status().error, /C's brain file/);
  assert.strictEqual(caches.store.size, 0);
  assert.ok(pulled < SIZE, "stopped before reading the whole thing");
});

test("Cancel stops the download and goes back to the offer, with nothing stored", async () => {
  const { brain, caches } = brainWith({ fetch: async (url, init) => { if (url === MODEL.url) return download(SIZE, { pause: 15, signal: init.signal }); throw new TypeError("Failed to fetch"); } });
  await brain.handle({ cmd: "download" });
  await new Promise((r) => setTimeout(r, 40));
  assert.strictEqual(brain.status().state, "downloading");
  await brain.handle({ cmd: "cancel-download" });
  for (let i = 0; i < 50 && brain.status().state === "downloading"; i++) await flush();
  assert.strictEqual(brain.status().state, "none");
  assert.strictEqual(brain.status().error, null);
  assert.strictEqual(caches.store.size, 0);
});

test("Delete while C is answering: the answer stops, the file is deleted and the graphics memory is freed", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  const { brain, lm } = brainWith({ caches, delay: 20 });
  const answering = brain.handle({ cmd: "generate", id: "a1", system: "s", user: "u", temperature: 0.2 });
  await new Promise((r) => setTimeout(r, 10));
  const s = await brain.handle({ cmd: "remove" });
  assert.strictEqual((await answering).code, "CANCELLED");
  await flush();
  assert.strictEqual(s.state, "none");
  assert.strictEqual(brain.status().state, "none");
  assert.strictEqual(caches.store.size, 0);
  assert.ok(lm.calls.engineDeleted);
});

test("Delete while Gemma is still loading: it doesn't come back afterwards", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  const { brain, lm } = brainWith({ caches, createDelay: 30 });
  const warming = brain.handle({ cmd: "warm", system: "s" });
  await new Promise((r) => setTimeout(r, 5));
  await brain.handle({ cmd: "remove" });
  await warming;
  await flush();
  assert.strictEqual(brain.status().state, "none");
  assert.ok(lm.calls.engineDeleted, "the engine that finished loading was freed");
  const r = await brain.handle({ cmd: "generate", id: "after", system: "s", user: "u" });
  assert.strictEqual(r.code, "NOT_READY");
});

test("a status check that started before Gemma finished loading doesn't overwrite 'ready'", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  const open = caches.open;
  let slowOnce = true;
  caches.open = async () => {   // the first look into the cache is slow (busy disk)
    const c = await open();
    if (slowOnce) { slowOnce = false; const match = c.match; c.match = async (u) => { await new Promise((r) => setTimeout(r, 40)); return match(u); }; }
    return c;
  };
  const { brain } = brainWith({ caches });
  const looking = brain.handle({ cmd: "status" });
  await new Promise((r) => setTimeout(r, 5));
  await brain.handle({ cmd: "warm", system: "s" });
  assert.strictEqual(brain.status().state, "ready");
  await looking;
  assert.strictEqual(brain.status().state, "ready");
});

test("speed: whether the graphics chip works is checked once, not on every status check", async () => {
  let asked = 0;
  const { brain } = brainWith({ gpu: { requestAdapter: async () => { asked++; return { info: {} }; } } });
  await brain.handle({ cmd: "status" });
  await brain.handle({ cmd: "status" });
  await brain.handle({ cmd: "status" });
  assert.strictEqual(asked, 1);
});

// ---------- fixes from the independent Claude review ----------

test("while C's brain is downloading, a question says so and the download's progress stays on screen", async () => {
  const { brain } = brainWith({ fetch: async (url, init) => { if (url === MODEL.url) return download(SIZE, { pause: 15, signal: init.signal }); throw new TypeError("Failed to fetch"); } });
  await brain.handle({ cmd: "download" });
  await new Promise((r) => setTimeout(r, 30));
  const r = await brain.handle({ cmd: "generate", id: "p", system: "s", user: "u", json: true });
  assert.strictEqual(r.code, "DOWNLOADING");
  assert.match(r.error, /still downloading/);
  assert.strictEqual(brain.status().state, "downloading");
  await brain.handle({ cmd: "cancel-download" });
});

test("if the runtime fails to start once, the next question tries again (not stuck until a reload)", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  const { brain, lm } = brainWith({ caches, runtimeFails: 1 });
  const first = await brain.handle({ cmd: "generate", id: "1", system: "s", user: "u" });
  assert.strictEqual(first.code, "FAILED");
  const second = await brain.handle({ cmd: "generate", id: "2", system: "s", user: "u" });
  assert.strictEqual(second.text, "Criteo is an ad company.");
  assert.strictEqual(lm.calls.runtimeStarts, 2);
});

test("after Gemma fails to load, background reading doesn't reload 2 GB for 10 minutes; Ask C still tries", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  let t = 1000;
  const { brain, lm } = brainWith({ caches, failCreate: "WebGPU device was lost", now: () => t });
  await brain.handle({ cmd: "generate", id: "a", system: "p", user: "u", json: true });
  assert.strictEqual(lm.calls.engines, 1);
  const again = await brain.handle({ cmd: "generate", id: "b", system: "p", user: "u", json: true });
  assert.strictEqual(again.code, "FAILED");
  await brain.handle({ cmd: "warm", system: "s" });
  assert.strictEqual(lm.calls.engines, 1, "no reload for policy reading or warm-ups");
  await brain.handle({ cmd: "generate", id: "c", system: "s", user: "q", temperature: 0.2 });
  assert.strictEqual(lm.calls.engines, 2, "a question someone asked still tries");
  t += 11 * 60000;
  await brain.handle({ cmd: "generate", id: "d", system: "p", user: "u", json: true });
  assert.strictEqual(lm.calls.engines, 3);
});

test("error messages tell the truth: graphics memory and too much text aren't called download or disk problems", async () => {
  const c1 = fakeCaches(); c1.store.set(MODEL.url, SIZE);
  const oom = await brainWith({ caches: c1, streamError: "Aborted(OOM)" }).brain.handle({ cmd: "generate", id: "1", system: "s", user: "u" });
  assert.match(oom.error, /graphics memory/);
  const c2 = fakeCaches(); c2.store.set(MODEL.url, SIZE);
  const long = await brainWith({ caches: c2, streamError: "Not enough space left in the context window" }).brain.handle({ cmd: "generate", id: "2", system: "s", user: "u" });
  assert.match(long.error, /more text than/);
  assert.doesNotMatch(long.error, /disk/);
});

test("'Use Ollama instead' gives the graphics memory back right away and keeps the download", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  const { brain, lm } = brainWith({ caches });
  await brain.handle({ cmd: "warm", system: "s" });
  const s = await brain.handle({ cmd: "unload" });
  assert.ok(lm.calls.engineDeleted);
  assert.strictEqual(s.state, "downloaded");
  assert.strictEqual(caches.store.size, 1);
});

test("a slow first load or answer keeps the background listening (a message at least every 10 s)", async () => {
  const caches = fakeCaches(); caches.store.set(MODEL.url, SIZE);
  const fast = (f, ms) => setTimeout(f, ms === 10000 ? 5 : ms);   // in this test, "10 s" passes every 5 ms
  const { brain, posts } = brainWith({ caches, delay: 30, setTimeout: fast });
  await brain.handle({ cmd: "generate", id: "slow", system: "p", user: "u", json: true });
  assert.ok(posts.filter((m) => m.type === "privac-brain-busy").length >= 3);
});
