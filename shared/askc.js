/*
  Ask C brain: turns the user's browsing data into evidence for Gemma,
  then returns the reply in the shape dashboard/ask-c.js expects:
    { answer, trace: [{ tool, label }], error? }
  Used by background.js. Pure functions, so tests can run it with a fake Gemma.
*/
(function () {
  const SYSTEM_PROMPT = `You are C, the friendly privacy guide inside the PrivaC browser extension.

How to answer:
- Talk to the person as "you". Never say "the user".
- Plain English, no jargon. 2 to 4 short sentences, then a line starting "What you can do:" with 2 or 3 concrete steps from the Steps list.
- Answer the question that was asked first. Then connect it to their own browsing if something there is relevant.
- Use ONLY the evidence you are given. If it doesn't answer the question, say you don't know yet.
- Put a source tag right after each fact, copied exactly from the evidence line it came from: [Seen on your visit], [Tracker Radar], [Privacy policy] or [Government list]. Never invent other tags. No backticks, no markdown, no lists with symbols.
- Never say data was sent to a government. A tracker loading means the company could collect data; it doesn't prove the data was sold or shared.
- Don't mention sample data; the dashboard already says so.
- You don't know which site the person has open right now. Don't say "you are currently visiting".

Example
Question: Who is Criteo?
Answer: Criteo is an advertising company based in France. [Tracker Radar] Its tracker loaded on 3 of the sites you visited, including dailynews.example. [Seen on your visit] That lets it recognize you across those sites to show you ads. What you can do: decline extra cookies when C offers, and turn on "Block third-party cookies" in Chrome settings.`;

  // Short, checked facts Gemma may use for general questions. Each one carries its source tag.
  const BACKGROUND = `Background facts:
- The U.S. Commerce Department lists 'foreign adversary' countries in 15 CFR 7.4: China (including Hong Kong), Cuba, Iran, North Korea, Russia and Venezuela. [Government list]
- China's 2017 National Intelligence Law (Article 7) says organizations must support and cooperate with state intelligence work, so Chinese companies may be legally unable to refuse a government request for data they hold. [Government list]
- Russia's 2016 "Yarovaya" laws require internet and phone companies to store users' data and hand it to security services on request, and a 2015 law requires Russians' personal data to be stored inside Russia. [Government list]
- The Pentagon's 1260H list names Chinese military companies; Baidu and Alibaba are on it. [Government list]

Steps the person can take (no tag needed):
- Let C decline non-essential cookies, or click "Reject all" on the site's cookie banner.
- In Chrome, Settings > Privacy and security > Third-party cookies > Block third-party cookies.
- Avoid entering personal details (name, email, phone, payment) on sites with an F grade or a foreign-adversary flag.
- Use a tracker-blocking browser extension.
- Clear a site's cookies after visiting: click the icon left of the address bar > Cookies and site data.
- Check the site's privacy policy for "sell" or "share" before creating an account.`;

  function siteLine(s) {
    const t = (s.trackers || []).map(x => `${x.company} (${x.category}, based in ${x.country}) [Tracker Radar]`).join("; ") || "none";
    const p = s.policy || {};
    const pol = p.sells === true ? "says it sells personal info [Privacy policy]" : p.shares === true ? "says it shares with partners [Privacy policy]"
      : (p.sells === false && p.shares === false) ? "says it doesn't sell or share [Privacy policy]" : "not reviewed yet";
    const day = s.lastVisit ? String(s.lastVisit).slice(0, 10) : "unknown date";
    return `- ${s.domain}, visited ${day}: grade ${s.grade}, exposure ${s.score}/100, cookies ${s.cookieChoice || "none"} [Seen on your visit]; trackers seen [Seen on your visit]: ${t}; privacy policy ${pol}`;
  }

  function buildContext(data, today) {
    const sites = [...((data && data.sites) || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    const date = `Today is ${today || new Date().toISOString().slice(0, 10)}.`;
    if (!sites.length) return `${date}\n${BACKGROUND}\n\nThe person hasn't visited any sites with PrivaC on yet.`;
    return `${date}\n${BACKGROUND}\n\nSites you visited, riskiest first (${sites.length}):\n${sites.map(siteLine).join("\n")}`;
  }

  const TAGS = ["Seen on your visit", "Tracker Radar", "CA Broker Registry", "HIBP", "RegTrack", "Privacy policy", "Government list"];
  const TAG_ALIASES = {
    "sites visited": "Seen on your visit", "your browsing": "Seen on your visit", "browsing": "Seen on your visit",
    "seen during your visit": "Seen on your visit", "observed": "Seen on your visit", "sample data": "Seen on your visit",
    "policy": "Privacy policy", "tracker radar data": "Tracker Radar", "government": "Government list",
    "government lists": "Government list", "background facts": "Government list", "15 cfr 7.4": "Government list"
  };

  // Fix Gemma's small formatting slips so the panel shows clean labels and "you".
  function cleanAnswer(text) {
    let t = String(text || "").replace(/`/g, "").replace(/\*\*/g, "");
    t = t.replace(/^(please )?note:? (that )?(this|the data provided) is (a )?sample[^.]*\.\s*/i, "");
    t = t.replace(/\bthe user's\b/gi, "your").replace(/\bthe user\b/gi, "you");
    t = t.replace(/(^|[.!?]\s+)(you|your)\b/g, (m, pre, w) => pre + w[0].toUpperCase() + w.slice(1));
    t = t.replace(/\[([^\]]{1,40})\]/g, (m, name) => {
      const n = name.trim();
      const exact = TAGS.find(x => x.toLowerCase() === n.toLowerCase());
      if (exact) return `[${exact}]`;
      const alias = TAG_ALIASES[n.toLowerCase()];
      return alias ? `[${alias}]` : "";
    });
    t = t.replace(/(\[[^\]]+\])(\s*\1)+/g, "$1");           // same tag twice in a row
    t = t.replace(/\s*(What you can do:)/i, "\n\n$1");       // steps on their own line
    return t.replace(/[ \t]+([.,;])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  }

  async function answer(question, deps) {
    const q = String(question || "").trim();
    if (!q) return { error: "Type a question for C first." };
    const data = await deps.load();
    const trace = [{ tool: "get_site_report", label: "Your browsing" }];
    try {
      const raw = await deps.ask(q, { system: SYSTEM_PROMPT, context: buildContext(data), options: { temperature: 0.2 } });
      const text = cleanAnswer(raw);
      if (/\[Government list\]/.test(text)) trace.push({ tool: "background_facts", label: "Government lists" });
      if (/\[Tracker Radar\]/.test(text)) trace.push({ tool: "lookup_company", label: "Tracker Radar" });
      return { answer: text, trace };
    } catch (e) {
      return { error: e.message || "I couldn't reach Gemma. Is Ollama running?", trace };
    }
  }

  (typeof window !== "undefined" ? window : self).PrivaCAskC = { answer, buildContext, cleanAnswer, SYSTEM_PROMPT };
})();
