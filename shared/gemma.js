/*
  PrivaC -> Gemma bridge. Talks to Ollama running on this computer.

  Setup (once per computer): see docs/OLLAMA.md.
  Use from an extension page (popup or dashboard), after loading this file:

    const answer = await PrivaCGemma.ask("Why did this site get a D?", {
      system: "You are C, a friendly privacy guide. Use only the evidence given.",
      context: "Trackers: Google Ads, Meta, Criteo. Cookies: accepted."
    });

  For yes/no/unknown answers from a privacy policy, pass { json: true }
  and ask Gemma to reply with JSON; you get back a parsed object.
  To show the answer while Gemma writes it, pass { onToken: (piece, textSoFar) => ... }.
  Background work that nobody is waiting for passes { priority: "low" } (see "Ask C goes first" below).

  Content scripts can't call this directly (the web page's origin is used);
  send a message to the popup/background instead.
*/
(function () {
  const OLLAMA_URL = "http://localhost:11434/api/chat";
  const MODEL = "gemma4:e4b";          // use "gemma4:e2b" on an 8 GB laptop
  const TIMEOUT_MS = 60000;            // give up if Ollama sends nothing for this long

  // Speed settings, measured on the demo Mac (Ollama 0.40, gemma4:e4b):
  // - Gemma 4 "thinks" before answering unless told not to: ~220 hidden tokens for a one-sentence answer, and a
  //   real Ask C question spent all 512 tokens thinking (10 s, empty answer). think:false: ~4.5 s, full answer.
  // - Ollama unloads a model after 5 idle minutes and reloading takes ~4 s: keep it loaded for 30.
  // - One context size for every call (Ask C and the policy reader), so Ollama never reloads to switch sizes.
  //   8,192 tokens fits Ask C's summary (~4,000) with room to spare.
  const KEEP_ALIVE = "30m";
  const NUM_CTX = 8192;
  const MAX_TOKENS = 600;              // an answer (2-4 sentences + steps) is ~100-250 tokens

  function buildRequest(question, opts = {}) {
    const messages = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    const user = opts.context ? `Evidence:\n${opts.context}\n\nQuestion: ${question}` : question;
    messages.push({ role: "user", content: user });
    const body = {
      model: opts.model || MODEL, messages, stream: !!opts.onToken,
      think: !!opts.think, keep_alive: KEEP_ALIVE,
      options: { num_ctx: NUM_CTX, num_predict: MAX_TOKENS, ...(opts.options || {}) }   // e.g. { temperature: 0.2 }
    };
    if (opts.json) body.format = "json";
    return body;
  }

  // ---------- Ask C goes first ----------
  // Someone waiting for an answer beats background policy reading: "low" calls wait while an answer is being
  // written, and a low call already running is stopped and started again right after (Ollama stops when we hang up).
  let urgent = 0;
  let waiting = [];
  const lowRunning = new Set();
  function whenFree() { return urgent ? new Promise((r) => waiting.push(r)) : Promise.resolve(); }
  function urgentStart() { urgent++; for (const c of lowRunning) { c.preempted = true; c.abort(); } }
  function urgentEnd() { if (--urgent === 0) { const w = waiting; waiting = []; w.forEach((r) => r()); } }

  async function ask(question, opts = {}) {
    if (opts.priority === "low") {
      for (let attempt = 0; ; attempt++) {
        await whenFree();
        const controller = new AbortController();
        lowRunning.add(controller);
        try { return await send(question, opts, controller); }
        catch (e) { if (!controller.preempted || attempt >= 5) throw e; }
        finally { lowRunning.delete(controller); }
      }
    }
    urgentStart();
    try { return await send(question, opts, new AbortController()); }
    finally { urgentEnd(); }
  }

  async function send(question, opts, controller) {
    const fetchFn = opts.fetch || globalThis.fetch;
    const wait = opts.timeoutMs || TIMEOUT_MS;
    let timer = setTimeout(() => controller.abort(), wait);
    const stillAlive = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), wait); };
    try {
      let res;
      try {
        res = await fetchFn(OLLAMA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRequest(question, opts)),
          signal: controller.signal
        });
      } catch (e) {
        if (controller.preempted) throw e;
        throw new Error("C can't reach Gemma. Is the Ollama app running? (see docs/OLLAMA.md)");
      }
      if (res.status === 403) throw new Error("Ollama blocked the extension. Set OLLAMA_ORIGINS (see docs/OLLAMA.md).");
      if (!res.ok) throw new Error(`Gemma error ${res.status}`);
      let text;
      if (opts.onToken && res.body && res.body.getReader) text = await readStream(res.body, opts.onToken, stillAlive);
      else { const data = await res.json(); text = (data.message && data.message.content) || ""; }
      text = text.trim();
      if (!opts.json) return text;
      try { return JSON.parse(text); } catch (e) { throw new Error("Gemma did not return valid JSON"); }
    } finally {
      clearTimeout(timer);
    }
  }

  // Ollama streams one JSON object per line: {"message":{"content":"piece"},"done":false} ... {"done":true}.
  async function readStream(body, onToken, onChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "", text = "";
    const line = (raw) => {
      const s = raw.trim();
      if (!s) return;
      const msg = JSON.parse(s);
      if (msg.error) throw new Error(`Gemma error: ${msg.error}`);
      const piece = (msg.message && msg.message.content) || "";
      if (!piece) return;
      text += piece;
      try { onToken(piece, text); } catch (e) { /* a display problem must not stop the answer */ }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk();
      buf += decoder.decode(value, { stream: true });
      for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) { line(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
    }
    line(buf + decoder.decode());
    return text;
  }

  // Load Gemma into memory ahead of time (no question asked), e.g. when the dashboard opens, so the first
  // answer doesn't wait ~4 s for the model to load. Never throws; resolves true when Ollama answered.
  async function warm(opts = {}) {
    const fetchFn = opts.fetch || globalThis.fetch;
    try {
      const res = await fetchFn(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: opts.model || MODEL, messages: [], keep_alive: KEEP_ALIVE, options: { num_ctx: NUM_CTX } })
      });
      return !!(res && res.ok);
    } catch (e) { return false; }
  }

  (typeof window !== "undefined" ? window : self).PrivaCGemma = { ask, warm, buildRequest, MODEL, OLLAMA_URL, KEEP_ALIVE, NUM_CTX };
})();
