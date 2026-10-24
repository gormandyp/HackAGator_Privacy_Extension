// Run with: node --test
// C's in-browser brain (shared/brain-core.js) with a fake LiteRT-LM engine, fake Cache Storage and fake downloads.
// The real engine runs Gemma 4 on WebGPU in Chrome; these tests check everything around it.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/brain-core.js");
const { create, MODEL, REASONS } = window.PrivaCBrainCore;

function fakeLM({ failCreate, chunks = ["Criteo is ", "an ad company."], delay = 0 } = {}) {
  const calls = { engines: 0, convs: [], deleted: 0, wasm: null, settings: null };
  class Conv {
    constructor(cfg) { this.cfg = cfg; this.cancelled = false; calls.convs.push(this); }
    sendMessageStreaming(msg) {
      this.msg = msg;
      const self = this;
      return (async function* () {
        for (const text of chunks) {
          await new Promise((r) => setTimeout(r, delay));
          if (self.cancelled) throw new Error("CANCELLED");
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
    getOrLoadGlobalLiteRtLm: async (url) => { calls.wasm = url; },
    Engine: {
      create: async (settings) => {
        calls.engines++; calls.settings = settings;
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

// A download of `size` bytes in 7 pieces; `breakAt` makes the connection drop part-way.
function download(size, { breakAt } = {}) {
  let sent = 0;
  const body = new ReadableStream({
    pull(c) {
      if (breakAt && sent >= breakAt) { c.error(new TypeError("network error")); return; }
      const n = Math.min(Math.ceil(size / 7), size - sent);
      if (n <= 0) { c.close(); return; }
      sent += n; c.enqueue(new Uint8Array(n));
    }
  });
  return new Response(body, { headers: { "content-length": String(size) } });
}

function brainWith(opts = {}) {
  const posts = [];
  const lm = opts.lm || fakeLM(opts);
  const caches = opts.caches || fakeCaches();
  const brain = create({
    lm, caches,
    wasmUrl: "chrome-extension://x/vendor/litert-lm/wasm/litertlm_wasm_internal.js",
    bundledModelUrl: "chrome-extension://x/models/" + MODEL.file,
    fetch: opts.fetch || (async (url) => { if (url === MODEL.url) return download(1000); throw new TypeError("Failed to fetch"); }),
    gpu: "gpu" in opts ? opts.gpu : { requestAdapter: async () => ({ info: {} }) },
    jspi: "jspi" in opts ? opts.jspi : true,
    post: (m) => posts.push(m)
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
