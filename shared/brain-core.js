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
    cancel-download        -> stops a download (back to "none", nothing kept)
    warm { system, temperature, seed, maxTokens } -> loads Gemma into GPU memory and readies a conversation like that
    generate { id, system, user, json, temperature, seed, maxTokens, stream } -> { text } (or { error, code })
                              codes: NOT_READY, DOWNLOADING, UNSUPPORTED, CANCELLED, FAILED
    cancel { id }          -> stops that generation (it answers { error, code: "CANCELLED" })
    unload                 -> frees the graphics memory now (keeps the download)
    remove                 -> unloads Gemma and deletes the downloaded file
  Status: { state: "unsupported" | "none" | "downloading" | "downloaded" | "loading" | "ready" | "error",
            model, loaded, total, error, reason, where, loadMs }
  Also posted: { type: "privac-brain-token", id, text } while answering, and { type: "privac-brain-busy" } every
  10 s during a job, so Chrome keeps the background awake.
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
  const AWAKE_EVERY_MS = 10000;         // Chrome stops an idle background after ~30 s: a message keeps it listening
  const RETRY_AFTER_MS = 10 * 60000;    // after Gemma fails to load, background work waits this long to try again

  const REASONS = {
    "no-webgpu": "This browser can't run C's brain: it needs WebGPU (Chrome 113 or newer on a computer with a graphics chip).",
    "no-gpu": "This computer's graphics chip isn't available to Chrome, so C's brain can't run here.",
    "old-browser": "C's brain needs a newer Chrome (version 137 or later). Update Chrome and try again."
  };

  function friendly(e) {
    const m = String((e && e.message) || e || ""), name = e && e.name;
    if (/device.*lost|out of memory|OOM/i.test(m)) return "C's brain ran out of graphics memory. Close a few tabs and try again.";
    if (/context window/i.test(m)) return "That was more text than C's in-browser brain can read at once.";
    if (name === "QuotaExceededError" || /quota|disk/i.test(m)) return "Not enough free disk space for C's brain (it needs about 2 GB).";
    if (name === "AbortError") return "The download was stopped.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "The download couldn't reach the internet. Check your connection and try again.";
    return m || "Something went wrong.";
  }

  // The runtime prints all its lines with console.error, so chrome://extensions listed routine start-up lines
  // ("INFO: Creating LiteRT environment") as errors. Its warnings ("no NPU" on a laptop) are plain logs too:
  // none is something you can act on, and C's status already says when Gemma can't load. Which method each line gets:
  function logLevel(line) {
    const m = /^(?:(INFO|WARNING|ERROR|FATAL):|([IWEF])\d{4} )/.exec(String(line || ""));
    const kind = m && (m[1] || m[2])[0];
    return kind === "I" || kind === "W" ? "log" : "error";
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
    let engine = null, loading = null, downloading = null, stopDownload = null;
    let removing = null;                  // a Delete in progress: nothing new loads or answers meanwhile
    let failedAt = 0;                     // when Gemma last failed to load or answer (0: it didn't)
    let gpuOk = false;                    // the graphics chip worked once: no need to ask Chrome again
    let programsReady = false;            // Gemma's graphics-chip programs were compiled without blocking (see warmUpPrograms)
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
    const stillDownloading = () => Object.assign(new Error("C's brain is still downloading. Ask again when it's done."), { code: "DOWNLOADING" });
    const failedRecently = () => failedAt && now() - failedAt < RETRY_AFTER_MS;

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
    // The model file: packed inside the extension, or downloaded. Each call opens it again (a stream is read once).
    async function openModel() {
      if (await hasBundled()) { const r = await d.fetch(d.bundledModelUrl); if (r.ok) return { stream: r.body, where: "bundled" }; }
      const hit = await cached();
      return hit ? { stream: hit.body, where: "downloaded" } : null;
    }

    // While Gemma loads, the runtime compiles ~150 small programs for the graphics chip with WebGPU's blocking call.
    // Chrome compiles those on the same thread that draws every tab: when the graphics driver didn't have them yet (the
    // first load after the download, and sometimes after Chrome restarts), all of Chrome froze for 15-20 s, every tab
    // and every window. Fix: a warm-up pass loads Gemma once with
    // stand-in programs, only to learn which programs it needs, then compiles those with the non-blocking call
    // (createComputePipelineAsync). The real load then finds them already compiled. Measured on the demo Mac: Chrome
    // kept drawing at full speed and loading took ~6 s instead of ~2 s plus the freeze. Once per page is enough: while
    // Chrome stays open the graphics driver keeps the compiled programs, so a reload after 20 idle minutes doesn't freeze.
    // Returns true if it read the model file (the real load then opens it again).
    async function warmUpPrograms(model) {
      if (programsReady || !d.lm.setupDefaultWebGpuDevice || !d.lm.getGlobalLiteRtLm) return false;
      programsReady = true;   // (if it fails, the usual load still works; don't try again)
      let device = null, blocking = null;
      try {
        await d.lm.setupDefaultWebGpuDevice();   // the same device Gemma uses
        device = d.lm.getGlobalLiteRtLm().liteRtLmWasm.preinitializedWebGPUDevice;
        blocking = device.createComputePipeline;
        const wanted = [];
        const standIn = device.createShaderModule({ code: "@compute @workgroup_size(1) fn standIn() {}" });
        device.createComputePipeline = (desc) => { wanted.push(desc); return blocking.call(device, { layout: desc.layout, compute: { module: standIn, entryPoint: "standIn" } }); };
        const trial = await d.lm.Engine.create({ model: model.stream, mainExecutorSettings: { maxNumTokens: CONTEXT_TOKENS } });
        device.createComputePipeline = blocking;
        await trial.delete();
        await Promise.all(wanted.map((desc) => device.createComputePipelineAsync(desc).catch(() => {})));
      } catch (e) {
        /* the usual load below still works (it may freeze Chrome for a while, as before) */
      } finally {
        if (device && blocking) device.createComputePipeline = blocking;
      }
      return !!blocking;
    }

    function load() {
      if (engine) return Promise.resolve(engine);
      if (loading) return loading;
      if (removing) return Promise.reject(notReady());
      if (downloading) return Promise.reject(stillDownloading());   // (and leave the download's progress on screen)
      loading = (async () => {
        const why = await unsupportedReason();
        if (why) { set({ state: "unsupported", reason: why, error: REASONS[why] }); throw Object.assign(new Error(REASONS[why]), { code: "UNSUPPORTED" }); }
        let model = await openModel();
        if (!model) { set({ state: "none" }); throw notReady(); }
        set({ state: "loading", error: null });
        const t0 = now();
        await d.lm.getOrLoadGlobalLiteRtLm(d.wasmUrl);   // our own copy, never a CDN (the library retries after a failure)
        if (await warmUpPrograms(model)) model = await openModel();
        if (!model) { set({ state: "none" }); throw notReady(); }
        const { where } = model;
        engine = await d.lm.Engine.create({ model: model.stream, mainExecutorSettings: { maxNumTokens: CONTEXT_TOKENS } });
        failedAt = 0;
        set({ state: "ready", where, loadMs: now() - t0, error: null });
        return engine;
      })().catch((e) => {
        engine = null;
        if (!e.code) { failedAt = now(); set({ state: "error", error: friendly(e) }); }
        throw e;
      }).finally(() => { loading = null; });
      return loading;
    }

    // Chrome stops an idle background page after ~30 s. While a job runs (a slow first load, or a long answer on a
    // weaker computer), a small message every 10 s keeps it listening for the answer.
    function keepAwake(id) {
      let timer = null;
      const beat = () => {
        timer = later(() => { try { d.post({ type: "privac-brain-busy", id }); } catch (e) { /* ignore */ } beat(); }, AWAKE_EVERY_MS);
        if (timer && timer.unref) timer.unref();
      };
      beat();
      return () => cancelLater(timer);
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
        : { type: d.lm.SamplerType.TOP_P, k: 40, p: 0.95, temperature: req.temperature,
            ...(typeof req.seed === "number" ? { seed: req.seed } : {}) };   // a fixed seed: the same question, the same answer
      return {
        key: `${greedy ? "g" : `${req.temperature}/${req.seed}`}|${req.maxTokens || 600}|${req.system || ""}`,
        config: {
          preface: { messages: req.system ? [{ role: "system", content: req.system }] : [], extra_context: { enable_thinking: false } },
          // Text only: with the audio reader on, the runtime set it up (mel_filterbank.cc) for every conversation.
          sessionConfig: { samplerParams, maxOutputTokens: req.maxTokens || 600, audioModalityEnabled: false, visionModalityEnabled: false },
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
      // Background reading (json) doesn't reload 2 GB again and again after a failure; a question someone asked still tries.
      if (req.json && !engine && failedRecently()) return { error: status.error || "C's brain had a problem a moment ago.", code: "FAILED" };
      const mine = { conv: null, cancelled: false };
      running.set(req.id, mine);
      const stopBeat = keepAwake(req.id);
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
        failedAt = now();
        await unload();
        set({ state: "error", error: friendly(e) });
        return { error: friendly(e), code: "FAILED" };
      } finally {
        stopBeat();
        running.delete(req.id);
        if (mine.conv) mine.conv.delete().catch(() => {});
        if (!req.json) { try { prepare(req); } catch (e) { /* next time */ } }   // ready for the next Ask C question
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
      if (!engine && failedRecently()) return status;   // don't keep reloading 2 GB after a failure
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

    // "Use Ollama instead": give the graphics memory back now instead of after 20 idle minutes (keeps the download).
    async function release() {
      for (const id of running.keys()) cancel(id);
      await Promise.all([loading, queue].map((p) => p && p.catch(() => {})));
      await unload();
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
        case "unload": return release();
        case "remove": return remove();
        default: return { error: "Unknown request" };
      }
    }

    return { handle, status: () => status };
  }

  (typeof window !== "undefined" ? window : self).PrivaCBrainCore = { create, MODEL, CACHE, CONTEXT_TOKENS, REASONS, textOf, logLevel };
})();
