/*
  Ask C brain: turns the user's browsing data into evidence for Gemma,
  then returns the reply in the shape dashboard/ask-c.js expects:
    { answer, trace: [{ tool, label }], error? }
  Used by background.js. Pure functions, so tests can run it with a fake Gemma.
*/
(function () {
  const SYSTEM_PROMPT = [
    "You are C, a friendly privacy guide inside the PrivaC browser extension.",
    "Answer in plain English for a non-technical person, in 2 to 4 short sentences, then one line starting with 'What you can do:'.",
    "Use ONLY the evidence you are given. If the evidence doesn't answer the question, say you don't know yet.",
    "After each fact, add its source tag exactly as written: [Seen on your visit] for anything from the user's browsing (sites, trackers seen, cookie choices, grades), [Tracker Radar] for what a company is (category, country), [Privacy policy] for what a site's policy says.",
    "Never say data was sent to a government. A tracker loading is not proof that data was sold; say so when it matters.",
    "Grades: A is safest, F is riskiest. The exposure score is 0-100 where higher means more exposure."
  ].join(" ");

  function siteLine(s) {
    const t = (s.trackers || []).map(x => `${x.company} (${x.category}, ${x.country})`).join("; ") || "none";
    const p = s.policy || {};
    const pol = p.sells === true ? "says it sells personal info" : p.shares === true ? "says it shares with partners"
      : (p.sells === false && p.shares === false) ? "says it doesn't sell or share" : "not reviewed";
    return `- ${s.domain}: grade ${s.grade}, exposure ${s.score}/100; cookies ${s.cookieChoice || "none"}; policy ${pol}; trackers: ${t}`;
  }

  function buildContext(data) {
    const sites = (data && data.sites) || [];
    if (!sites.length) return "The user hasn't visited any sites with PrivaC yet.";
    const head = data.sample ? "NOTE: this is SAMPLE data, not the user's real browsing. Mention that once.\n" : "";
    return `${head}Sites visited (${sites.length}):\n${sites.map(siteLine).join("\n")}`;
  }

  async function answer(question, deps) {
    const q = String(question || "").trim();
    if (!q) return { error: "Type a question for C first." };
    const data = await deps.load();
    const trace = [{ tool: "get_site_report", label: "Your browsing" }];
    try {
      const text = await deps.ask(q, { system: SYSTEM_PROMPT, context: buildContext(data) });
      return { answer: text, trace };
    } catch (e) {
      return { error: e.message || "I couldn't reach Gemma. Is Ollama running?", trace };
    }
  }

  (typeof window !== "undefined" ? window : self).PrivaCAskC = { answer, buildContext, SYSTEM_PROMPT };
})();
