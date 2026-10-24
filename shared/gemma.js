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

  Content scripts can't call this directly (the web page's origin is used);
  send a message to the popup/background instead.
*/
(function () {
  const OLLAMA_URL = "http://localhost:11434/api/chat";
  const MODEL = "gemma4:e4b";          // use "gemma4:e2b" on an 8 GB laptop
  const TIMEOUT_MS = 60000;

  function buildRequest(question, opts = {}) {
    const messages = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    const user = opts.context ? `Evidence:\n${opts.context}\n\nQuestion: ${question}` : question;
    messages.push({ role: "user", content: user });
    const body = { model: opts.model || MODEL, messages, stream: false };
    if (opts.json) body.format = "json";
    if (opts.options) body.options = opts.options;   // e.g. { temperature: 0.2 } for steadier answers
    return body;
  }

  async function ask(question, opts = {}) {
    const fetchFn = opts.fetch || globalThis.fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || TIMEOUT_MS);
    let res;
    try {
      res = await fetchFn(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest(question, opts)),
        signal: controller.signal
      });
    } catch (e) {
      throw new Error("C can't reach Gemma. Is the Ollama app running? (see docs/OLLAMA.md)");
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 403) throw new Error("Ollama blocked the extension. Set OLLAMA_ORIGINS (see docs/OLLAMA.md).");
    if (!res.ok) throw new Error(`Gemma error ${res.status}`);
    const data = await res.json();
    const text = (data.message && data.message.content || "").trim();
    if (!opts.json) return text;
    try { return JSON.parse(text); } catch (e) { throw new Error("Gemma did not return valid JSON"); }
  }

  (typeof window !== "undefined" ? window : self).PrivaCGemma = { ask, buildRequest, MODEL, OLLAMA_URL };
})();
