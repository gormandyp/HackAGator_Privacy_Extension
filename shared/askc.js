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
    "For general questions (for example why foreign-adversary links matter), explain using the Background facts, tagged [Government list], then point to what the user's own browsing shows.",
    "Use no other source tags and no backticks or markdown.",
    "Grades: A is safest, F is riskiest. The exposure score is 0-100 where higher means more exposure."
  ].join(" ");

  // Short, checked facts Gemma may use for general questions. Keep each one sourced.
  const BACKGROUND = [
    "Background facts:",
    "- The U.S. Commerce Department lists 'foreign adversary' countries in 15 CFR 7.4: China (including Hong Kong), Cuba, Iran, North Korea, Russia and Venezuela. [Government list]",
    "- China's 2017 National Intelligence Law (Article 7) says organizations must support and cooperate with state intelligence work, so Chinese companies may be legally unable to refuse a government request for data they hold. [Government list]",
    "- The Pentagon's 1260H list (updated June 2026) names Chinese military companies; Baidu and Alibaba are on it. [Government list]",
    "- A tracker loading means the company could collect data from that visit. It does not show the data was handed to any government."
  ].join("\n");

  const TAGS = ["Seen on your visit", "Tracker Radar", "CA Broker Registry", "HIBP", "RegTrack", "Privacy policy", "Government list"];
  const TAG_ALIASES = {
    "sites visited": "Seen on your visit", "your browsing": "Seen on your visit", "browsing": "Seen on your visit",
    "seen during your visit": "Seen on your visit", "observed": "Seen on your visit", "sample data": "Seen on your visit",
    "policy": "Privacy policy", "tracker radar data": "Tracker Radar", "government": "Government list", "15 cfr 7.4": "Government list"
  };

  // Fix Gemma's small formatting slips so the panel shows clean labels.
  function cleanAnswer(text) {
    let t = String(text || "").replace(/`/g, "").replace(/\*\*/g, "");
    t = t.replace(/\[([^\]]{1,40})\]/g, (m, name) => {
      const n = name.trim();
      const exact = TAGS.find(x => x.toLowerCase() === n.toLowerCase());
      if (exact) return `[${exact}]`;
      const alias = TAG_ALIASES[n.toLowerCase()];
      return alias ? `[${alias}]` : "";
    });
    // Same tag twice in a row -> once.
    t = t.replace(/(\[[^\]]+\])(\s*\1)+/g, "$1");
    return t.replace(/\s+([.,;])/g, "$1").replace(/ {2,}/g, " ").trim();
  }

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
    return `${head}${BACKGROUND}\n\nThe user's browsing, sites visited (${sites.length}):\n${sites.map(siteLine).join("\n")}`;
  }

  async function answer(question, deps) {
    const q = String(question || "").trim();
    if (!q) return { error: "Type a question for C first." };
    const data = await deps.load();
    const trace = [{ tool: "get_site_report", label: "Your browsing" }];
    try {
      const text = await deps.ask(q, { system: SYSTEM_PROMPT, context: buildContext(data) });
      const usedGov = /\[Government list\]/.test(cleanAnswer(text));
      return { answer: cleanAnswer(text), trace: usedGov ? trace.concat({ tool: "background_facts", label: "Government lists" }) : trace };
    } catch (e) {
      return { error: e.message || "I couldn't reach Gemma. Is Ollama running?", trace };
    }
  }

  (typeof window !== "undefined" ? window : self).PrivaCAskC = { answer, buildContext, cleanAnswer, SYSTEM_PROMPT };
})();
