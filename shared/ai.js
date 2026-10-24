/*
  Which brain answers Ask C and reads privacy policies (in-browser AI version of PrivaC).

  PrivaCAI.ask(question, opts) has the same shape as PrivaCGemma.ask (shared/gemma.js), so shared/askc.js and
  background/policy-reader.js don't change:
    - "browser" (default): Gemma 4 E2B running in Chrome on this computer's graphics chip (offscreen/brain.html).
      If it isn't downloaded yet (or the browser can't run it) and Ollama is running, Ollama answers instead.
    - "ollama": Gemma through the Ollama app, exactly like the main version.
  Chosen in the dashboard (Ask C), stored as chrome.storage.local.privacAI = { use: "browser" | "ollama" }.

  Like shared/gemma.js, Ask C goes first: background policy reading ({ priority: "low" }) waits while C answers
  someone, and a policy question already running is stopped and asked again right after.
*/
(function () {
  const root = typeof window !== "undefined" ? window : self;
  const ANSWER_TIMEOUT_MS = 120000;     // includes loading Gemma the first time (shader set-up can take ~20 s)
  const MAX_TOKENS = 600;
  const OLLAMA_CHECK_MS = 30000;

  let seq = 0;
  const pending = new Map();            // generation id -> { onToken, text }
  let lastStatus = null;

  // ---------- settings ----------
  async function use() {
    try {
      const v = (await chrome.storage.local.get("privacAI")).privacAI;
      return v && v.use === "ollama" ? "ollama" : "browser";
    } catch (e) { return "browser"; }
  }
  async function setUse(value) {
    await chrome.storage.local.set({ privacAI: { use: value === "ollama" ? "ollama" : "browser" } });
    return use();
  }

  // ---------- the offscreen page that holds Gemma ----------
  let creating = null;
  async function ensureBrainPage() {
    if (!chrome.offscreen) throw Object.assign(new Error("This Chrome can't run C's in-browser brain."), { code: "UNSUPPORTED" });
    if (chrome.runtime.getContexts) {
      const pages = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
      if (pages.length) return;
    }
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: "offscreen/brain.html",
        reasons: ["WORKERS"],
        justification: "Runs Gemma, PrivaC's AI, on this computer's graphics chip (WebGPU), so questions and browsing never leave the computer."
      }).catch((e) => { if (!/single offscreen|only a single|already/i.test(String(e && e.message))) throw e; })
        .finally(() => { creating = null; });
    }
    await creating;
  }

  async function brain(msg) {
    await ensureBrainPage();
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await chrome.runtime.sendMessage({ target: "privac-brain", ...msg });
        if (res && res.state) remember(res);
        return res;
      } catch (e) {
        // The page was just created and its script isn't listening yet: try again shortly (up to ~3 s).
        if (attempt >= 30 || !/Receiving end does not exist|Could not establish connection/i.test(String(e && e.message))) throw e;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  function remember(status) {
    lastStatus = status;
    try { if (chrome.storage.session) chrome.storage.session.set({ privacBrain: status }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.type === "privac-brain-status" && msg.status) remember(msg.status);
      if (msg.type === "privac-brain-token" && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        const piece = String(msg.text || "").slice(p.text.length);
        p.text = String(msg.text || "");
        if (piece && p.onToken) { try { p.onToken(piece, p.text); } catch (e) { /* display only */ } }
      }
    });
  }

  // ---------- Ask C goes first (same rule as shared/gemma.js) ----------
  let urgent = 0;
  let waiting = [];
  const lowRunning = new Map();         // id -> { preempted }
  function whenFree() { return urgent ? new Promise((r) => waiting.push(r)) : Promise.resolve(); }
  function urgentStart() {
    urgent++;
    for (const [id, job] of lowRunning) { job.preempted = true; brain({ cmd: "cancel", id }).catch(() => {}); }
  }
  function urgentEnd() { if (--urgent === 0) { const w = waiting; waiting = []; w.forEach((r) => r()); } }

  async function brainAsk(question, opts, job) {
    const id = `q${++seq}-${Date.now()}`;
    const user = opts.context ? `Evidence:\n${opts.context}\n\nQuestion: ${question}` : question;
    const temperature = opts.options && typeof opts.options.temperature === "number" ? opts.options.temperature : 0.2;
    pending.set(id, { onToken: opts.onToken, text: "" });
    if (job) lowRunning.set(id, job);
    let timer, onAbort;
    try {
      const res = await Promise.race([
        brain({ cmd: "generate", id, system: opts.system || "", user, json: !!opts.json, temperature, maxTokens: MAX_TOKENS, stream: !!opts.onToken }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("C took too long to answer. Try again in a moment."), { code: "TIMEOUT" })), ANSWER_TIMEOUT_MS); }),
        new Promise((_, reject) => {   // whoever asked hung up (e.g. the Ask C tab closed): stop Gemma
          if (!opts.signal) return;
          onAbort = () => reject(Object.assign(new Error("Stopped."), { code: "TIMEOUT" }));
          if (opts.signal.aborted) onAbort(); else opts.signal.addEventListener("abort", onAbort, { once: true });
        })
      ]);
      if (!res) throw Object.assign(new Error("C's brain didn't answer."), { code: "FAILED" });
      if (res.error) throw Object.assign(new Error(res.error), { code: res.code || "FAILED" });
        const text = String(res.text || "").trim();
      if (!text && !opts.json) throw Object.assign(new Error("C's brain sent back an empty answer. Try asking again."), { code: "FAILED" });
      return opts.json ? root.PrivaCGemma.parseJsonReply(text) : text;
    } catch (e) {
      if (e.code === "TIMEOUT") brain({ cmd: "cancel", id }).catch(() => {});
      throw e;
    } finally {
      clearTimeout(timer);
      if (onAbort && opts.signal) opts.signal.removeEventListener("abort", onAbort);
      pending.delete(id);
      lowRunning.delete(id);
    }
  }

  // Is Ollama answering on this computer? (checked at most every 30 s)
  let ollamaSeen = { at: 0, up: false };
  async function ollamaUp() {
    if (Date.now() - ollamaSeen.at < OLLAMA_CHECK_MS) return ollamaSeen.up;
    let up = false;
    try {
      const r = await fetch(root.PrivaCGemma.OLLAMA_URL.replace("/api/chat", "/api/version"), { signal: AbortSignal.timeout(1500) });
      up = !!(r && r.ok);
    } catch (e) { up = false; }
    ollamaSeen = { at: Date.now(), up };
    return up;
  }

  const NOT_READY_TEXT = "C's brain isn't downloaded yet. Open the dashboard, go to Ask C and click \"Download C's brain\" (about 2 GB, one time).";

  async function viaBrain(question, opts) {
    if (opts.priority === "low") {
      for (let attempt = 0; ; attempt++) {
        while (urgent) await whenFree();      // re-check: an answer may have started while we were waking up
        const job = { preempted: false };
        try { return await brainAsk(question, opts, job); }
        catch (e) { if (!(job.preempted && e.code === "CANCELLED") || attempt >= 5) throw e; }
      }
    }
    urgentStart();
    try { return await brainAsk(question, opts, null); }
    finally { urgentEnd(); }
  }

  async function ask(question, opts = {}) {
    if ((await use()) === "ollama") return root.PrivaCGemma.ask(question, opts);
    try {
      return await viaBrain(question, opts);
    } catch (e) {
      if ((e.code === "NOT_READY" || e.code === "UNSUPPORTED") && (await ollamaUp())) return root.PrivaCGemma.ask(question, opts);
      if (e.code === "NOT_READY") throw new Error(NOT_READY_TEXT);
      if (e.code === "UNSUPPORTED") throw new Error(`${e.message} Ask C can use Ollama instead (docs/OLLAMA.md); everything else in PrivaC still works.`);
      throw e;
    }
  }

  // Load Gemma ahead of the first question (dashboard or popup opened). Never starts the download by itself.
  async function warm(system) {
    try {
      if ((await use()) === "ollama") return root.PrivaCGemma.warm();
      const s = await brain({ cmd: "status" });
      if (s && (s.state === "downloaded" || s.state === "ready")) await brain({ cmd: "warm", system });
      else if (await ollamaUp()) root.PrivaCGemma.warm();
    } catch (e) { /* warming is only a head start */ }
  }

  // Dashboard requests: { cmd: "status" | "download" | "cancel-download" | "remove" | "use", use }
  async function command(msg) {
    const choice = msg.cmd === "use" ? await setUse(msg.use) : await use();
    let status = null;
    try {
      if (msg.cmd === "download" || msg.cmd === "cancel-download" || msg.cmd === "remove") status = await brain({ cmd: msg.cmd });
      else status = await brain({ cmd: "status" });
    } catch (e) {
      status = { state: "unsupported", error: String((e && e.message) || e) };
    }
    return { use: choice, status, ollama: await ollamaUp() };
  }

  root.PrivaCAI = { ask, warm, command, use, setUse, lastStatus: () => lastStatus, NOT_READY_TEXT };
})();
