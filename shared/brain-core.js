/*
  C's in-browser brain: Gemma 4 E2B running on this computer's graphics chip (WebGPU) with Google's
  LiteRT-LM web runtime (vendor/litert-lm). Runs inside the offscreen page (offscreen/brain.html); the
  background talks to it through shared/ai.js. Nothing about your browsing leaves the computer: the only
  network use is the one-time download of the model file itself (the same file for everyone).

  Kept as plain functions with every browser API passed in (create(deps)), so tests can run it in Node
  with a fake engine (tests/brain-core.test.js).

  Messages it answers (msg.cmd):
    status                 -> current status (below)
    download               -> starts the one-time download (progress arrives as status messages); answers at once
    cancel-download        -> stops a download
    warm { system }        -> loads Gemma into GPU memory and readies a conversation for that system prompt
    generate { id, system, user, json, temperature, maxTokens, stream } -> { text } (or { error, code })
    cancel { id }          -> stops that generation (it answers { error, code: "CANCELLED" })
    remove                 -> unloads Gemma and deletes the downloaded file
  Status: { state: "unsupported" | "none" | "downloading" | "downloaded" | "loading" | "ready" | "error",
            model, loaded, total, error, reason, loadMs }
*/
(function () {
  // Pinned to the exact file PrivaC was tested with (Hugging Face commit), Apache 2.0, not gated.
  const MODEL = {
    id: "gemma-4-E2B-it",
    name: "Gemma 4 E2B",
    file: "gemma-4-E2B-it-web.litertlm",
    url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/1caa527c1e88b55f046fcd8d2b4265606680663d/gemma-4-E2B-it-web.litertlm",
    bytes: 2008432640
  };
  const CACHE = "privac-brain";
  const CONTEXT_TOKENS = 6144;          // Ask C's summary is ~4,000 tokens; policy questions ~2,000
  const IDLE_UNLOAD_MS = 20 * 60000;    // free the ~2 GB of GPU memory after 20 idle minutes
  const POST_EVERY_MS = 60;             // streamed text is sent at most this often

  const REASONS = {
    "no-webgpu": "This browser can't run C's brain: it needs WebGPU (Chrome 113 or newer on a computer with a graphics chip).",
    "no-gpu": "This computer's graphics chip isn't available to Chrome, so C's brain can't run here.",
    "old-browser": "C's brain needs a newer Chrome (version 137 or later). Update Chrome and try again."
  };

  function friendly(e) {
    const m = String((e && e.message) || e || "");
    if (/quota|space/i.test(m)) return "Not enough free disk space for C's brain (it needs about 2 GB).";
    if (/abort/i.test(m)) return "The download was stopped.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "The download couldn't reach the internet. Check your connection and try again.";
    if (/device.*lost|out of memory|OOM/i.test(m)) return "C's brain ran out of graphics memory. Close a few tabs and try again.";
    return m || "Something went wrong.";
  }

  function textOf(chunk) {
    const c = chunk && chunk.content;
    if (typeof c === "string") return c;
    return Array.isArray(c) ? c.map((p) => (p && p.type === "text" ? p.text || "" : "")).join("") : "";
  }

  function create(d) {
    // d: { lm, wasmUrl, bundledModelUrl, caches, fetch, gpu, jspi, post, model, now, setTimeout, clearTimeout }
    const M = d.model || MODEL;           // (the tests use a small stand-in file)
    const now = d.now || (() => Date.now());
    const later = d.setTimeout || setTimeout, cancelLater = d.clearTimeout || clearTimeout;
    let status = { state: "unknown", model: M.id, name: M.name, loaded: 0, total: M.bytes, error: null, reason: null };
    let engine = null, loading = null, downloading = null, stopDownload = null, runtimeReady = null;
    let removing = null;                  // a Delete in progress: nothing new loads or answers meanwhile
    let gpuOk = false;                    // the graphics chip worked once: no need to ask Chrome again
    let bundled = undefined;              // true/false once checked: is the model file packed inside the extension?
    let prepared = null;                  // { key, conv: Promise } a conversation with its system prompt already read
    let queue = Promise.resolve();        // one generation at a time
    const running = new Map();            // generation id -> { conv, cancelled }
    const cancelledEarly = new Set();     // cancelled before their turn came (still waiting in the queue)
    let idleTimer = null;

    function set(patch) {
      status = { ...status, ...patch };
      try { d.post({ type: "privac-brain-status", status }); } catch (e) { /* nobody listening */ }
      return status;
    }

    async function unsupportedReason() {
      if (!d.gpu) return "no-webgpu";
      if (!d.jspi) return "old-browser";
      if (gpuOk) return null;
      try {
        const a = await d.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!a || (a.info && a.info.isFallbackAdapter)) return "no-gpu";
      } catch (e) { return "no-gpu"; }
      gpuOk = true;
      return null;
    }

    async function hasBundled() {
      if (bundled !== undefined) return bundled;
      try {
        const r = await d.fetch(d.bundledModelUrl);
        bundled = !!(r && r.ok);
        if (r && r.body) r.body.cancel().catch(() => {});   // only checking that it's there
      } catch (e) { bundled = false; }
      return bundled;
    }

    async function cached() {
      const cache = await d.caches.open(CACHE);
      return cache.match(M.url);
    }

    const notReady = () => Object.assign(new Error("C's brain isn't downloaded yet."), { code: "NOT_READY" });

    // What's true right now: can this browser run Gemma, and is the model here (packed in, or downloaded)?
    async function check() {
      const why = await unsupportedReason();
      if (why) return { state: "unsupported", reason: why, error: REASONS[why] };
      const where = engine ? null : (await hasBundled()) ? "bundled" : (await cached()) ? "downloaded" : null;
      if (engine) return { state: "ready", error: null };   // looked at last: Gemma may have finished loading meanwhile
      return { state: where ? "downloaded" : "none", where, error: null, loaded: where ? M.bytes : 0 };
    }

    async function refresh() {
      if (downloading || removing) return status;   // they keep the status up to date themselves
      if (loading) return set({ state: "loading" });
      const seen = await check();
      if (downloading || loading || removing) return status;   // one of them started while we looked
      return set(seen);
    }

    // ---------- one-time download (whole file, same for everyone; nothing about you is sent) ----------
    function download() {
      if (downloading) return downloading;
      if (removing) return Promise.resolve(status);
      let stopped = false;
      downloading = (async () => {
        const seen = await check();
        if (seen.state !== "none") return set(seen);   // unsupported, already here, or loaded
        const controller = new AbortController();
        stopDownload = () => { stopped = true; controller.abort(); };
        set({ state: "downloading", loaded: 0, total: M.bytes, error: null });
        const res = await d.fetch(M.url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`);
        const told = Number(res.headers.get("content-length"));
        if (told && told !== M.bytes && !res.headers.get("content-encoding")) {   // e.g. a Wi-Fi sign-in page instead
          controller.abort();
          throw new Error("The download wasn't C's brain file. Check your internet connection and try again.");
        }
        let loaded = 0, lastPost = 0;
        const counter = new TransformStream({
          transform(chunk, out) {
            loaded += chunk.byteLength;
            const t = now();
            if (t - lastPost > 400) { lastPost = t; set({ loaded, total: M.bytes }); }
            out.enqueue(chunk);
          }
        });
        const cache = await d.caches.open(CACHE);
        try {
          await cache.put(M.url, new Response(res.body.pipeThrough(counter), {
            headers: { "content-type": "application/octet-stream", "content-length": String(M.bytes) }
          }));
          if (loaded !== M.bytes) throw new Error("The download was incomplete. Try again.");   // exact size of the pinned file
        } catch (e) {
          await cache.delete(M.url).catch(() => {});   // never keep part of the file
          throw e;
        }
        return set({ state: "downloaded", where: "downloaded", loaded, total: M.bytes, error: null });
      })().catch((e) => (stopped ? set({ state: "none", loaded: 0, error: null }) : set({ state: "error", error: friendly(e) })))
        .finally(() => { downloading = null; stopDownload = null; });
      return downloading;
    }

    // ---------- loading Gemma into GPU memory ----------
    function load() {
      if (engine) return Promise.resolve(engine);
      if (loading) return loading;
      if (removing) return Promise.reject(notReady());
      loading = (async () => {
        const why = await unsupportedReason();
        if (why) { set({ state: "unsupported", reason: why, error: REASONS[why] }); throw Object.assign(new Error(REASONS[why]), { code: "UNSUPPORTED" }); }
        let stream = null, where = null;
        if (await hasBundled()) { const r = await d.fetch(d.bundledModelUrl); if (r.ok) { stream = r.body; where = "bundled"; } }
        if (!stream) { const hit = await cached(); if (hit) { stream = hit.body; where = "downloaded"; } }
        if (!stream) { set({ state: "none" }); throw notReady(); }
        set({ state: "loading", error: null });
        const t0 = now();
        if (!runtimeReady) runtimeReady = d.lm.getOrLoadGlobalLiteRtLm(d.wasmUrl);   // our own copy, never a CDN
        await runtimeReady;
        engine = await d.lm.Engine.create({ model: stream, mainExecutorSettings: { maxNumTokens: CONTEXT_TOKENS } });
        set({ state: "ready", where, loadMs: now() - t0, error: null });
        return engine;
      })().catch((e) => {
        engine = null;
        if (!e.code) set({ state: "error", error: friendly(e) });
        throw e;
      }).finally(() => { loading = null; });
      return loading;
    }

    async function unload() {
      const p = prepared, e = engine;
      prepared = null; engine = null;        // first, so nothing picks them up while they're being freed
      if (p) { try { const c = await p.conv; if (c) await c.delete(); } catch (err) { /* gone */ } }
      if (e) { try { await e.delete(); } catch (err) { /* gone */ } }
    }

    function touch() {
      if (idleTimer) cancelLater(idleTimer);
      idleTimer = later(() => { idleTimer = null; if (!running.size) unload().then(refresh); }, IDLE_UNLOAD_MS);
      if (idleTimer && idleTimer.unref) idleTimer.unref();   // (Node tests: don't keep the process alive)
    }

    // ---------- conversations ----------
    // Gemma reads the system prompt ahead of time (prefillPrefaceOnInit), so a question only costs its own words.
    function settingsFor(req) {
      const greedy = req.json || !req.temperature;
      const samplerParams = greedy ? { type: d.lm.SamplerType.GREEDY }
        : { type: d.lm.SamplerType.TOP_P, k: 40, p: 0.95, temperature: req.temperature };
      return {
        key: `${greedy ? "g" : req.temperature}|${req.maxTokens || 600}|${req.system || ""}`,
        config: {
          preface: { messages: req.system ? [{ role: "system", content: req.system }] : [], extra_context: { enable_thinking: false } },
          sessionConfig: { samplerParams, maxOutputTokens: req.maxTokens || 600 },
          prefillPrefaceOnInit: true
        }
      };
    }

    function prepare(req) {
      const s = settingsFor(req);
      if (!engine || removing || (prepared && prepared.key === s.key)) return;
      const old = prepared;
      prepared = { key: s.key, conv: engine.createConversation(s.config).catch(() => null) };
      if (old) old.conv.then((c) => c && c.delete()).catch(() => {});
    }

    async function conversationFor(req) {
      const s = settingsFor(req);
      if (prepared && prepared.key === s.key) {
        const p = prepared; prepared = null;
        const conv = await p.conv;
        if (conv) return conv;
      }
      return engine.createConversation(s.config);
    }

    function generate(req) {
      const job = queue.then(() => run(req));
      queue = job.catch(() => {});
      return job;
    }

    async function run(req) {
      if (cancelledEarly.delete(req.id)) return { error: "Cancelled", code: "CANCELLED" };
      if (removing) return { error: notReady().message, code: "NOT_READY" };
      const mine = { conv: null, cancelled: false };
      running.set(req.id, mine);
      try {
        await load();
        touch();
        if (mine.cancelled) return { error: "Cancelled", code: "CANCELLED" };
        mine.conv = await conversationFor(req);
        if (mine.cancelled) return { error: "Cancelled", code: "CANCELLED" };
        let text = "", lastPost = 0;
        try {
          for await (const chunk of mine.conv.sendMessageStreaming({ role: "user", content: req.user })) {
            const piece = textOf(chunk);
            if (!piece) continue;
            text += piece;
            const t = now();
            if (req.stream && t - lastPost >= POST_EVERY_MS) { lastPost = t; try { d.post({ type: "privac-brain-token", id: req.id, text }); } catch (e) { /* ignore */ } }
          }
        } catch (e) {
          if (mine.cancelled) return { error: "Cancelled", code: "CANCELLED" };
          throw e;
        }
        if (mine.cancelled) return { error: "Cancelled", code: "CANCELLED" };
        if (req.stream) { try { d.post({ type: "privac-brain-token", id: req.id, text }); } catch (e) { /* ignore */ } }
        return { text };
      } catch (e) {
        if (e && e.code) return { error: e.message, code: e.code };
        // A failed generation can leave the GPU engine unusable: start fresh next time.
        await unload();
        set({ state: "error", error: friendly(e) });
        return { error: friendly(e), code: "FAILED" };
      } finally {
        running.delete(req.id);
        if (mine.conv) mine.conv.delete().catch(() => {});
        if (req.keepReady !== false && !req.json) { try { prepare(req); } catch (e) { /* next time */ } }
        touch();
      }
    }

    function cancel(id) {
      const r = running.get(id);
      if (!r) {   // not started yet (or not arrived yet): skip it when its turn comes
        cancelledEarly.add(id);
        if (cancelledEarly.size > 200) cancelledEarly.delete(cancelledEarly.values().next().value);
        return false;
      }
      r.cancelled = true;
      if (r.conv) { try { r.conv.cancel(); } catch (e) { /* already done */ } }
      return true;
    }

    async function warm(req) {
      try {
        await load();
        if (req && req.system) prepare({ ...req, json: false });
        touch();
      } catch (e) { /* status already says why */ }
      return status;
    }

    // Delete: stop whatever is using the file first (an answer, the download, loading), then free and delete it.
    async function remove() {
      if (!removing) {
        removing = (async () => {
          for (const id of running.keys()) cancel(id);
          if (stopDownload) stopDownload();
          await Promise.all([downloading, loading, queue].map((p) => p && p.catch(() => {})));
          await unload();
          await (await d.caches.open(CACHE)).delete(M.url);
        })().finally(() => { removing = null; });
      }
      await removing;
      return refresh();
    }

    async function handle(msg) {
      switch (msg && msg.cmd) {
        case "status": return refresh();
        case "download": download(); return status;
        case "cancel-download": if (stopDownload) stopDownload(); return downloading || status;
        case "warm": return warm(msg);
        case "generate": return generate(msg);
        case "cancel": return { cancelled: cancel(msg.id) };
        case "remove": return remove();
        default: return { error: "Unknown request" };
      }
    }

    return { handle, status: () => status, _internal: { load, download, unload } };
  }

  (typeof window !== "undefined" ? window : self).PrivaCBrainCore = { create, MODEL, CACHE, CONTEXT_TOKENS, REASONS, textOf };
})();
