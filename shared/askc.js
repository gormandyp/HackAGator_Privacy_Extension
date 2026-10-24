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
- Put a source tag right after each fact, copied exactly from the evidence line it came from: [Seen on your visit], [Tracker Radar], [Privacy policy], [HIBP], [CA Broker Registry] or [Government list]. Never invent other tags.
- If a site had a data breach [HIBP], say when, how many accounts and what kind of data, and tell the person to change that password. No backticks, no markdown, no lists with symbols.
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

  function fmtCount(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : n >= 1e3 ? `${Math.round(n / 1e3)} thousand` : String(n); }
  function breachText(b) {
    return `data breach on ${b.breachDate} (added to Have I Been Pwned ${b.addedDate}): ${fmtCount(b.pwnCount)} accounts; exposed ${b.dataClasses.join(", ").toLowerCase()} [HIBP]`;
  }

  function siteLine(s) {
    const t = (s.trackers || []).map(x => `${x.company} (${x.category}, based in ${x.country || "unknown country"}) [Tracker Radar]` +
      (x.broker ? `, registered California data broker [CA Broker Registry]` : "")).join("; ") || "none";
    const p = s.policy || {};
    const pol = p.sells === true ? "says it sells personal info [Privacy policy]" : p.shares === true ? "says it shares with partners [Privacy policy]"
      : (p.sells === false && p.shares === false) ? "says it doesn't sell or share [Privacy policy]" : "not reviewed yet";
    const day = s.lastVisit ? String(s.lastVisit).slice(0, 10) : "unknown date";
    const br = s.breach ? `; ${breachText(s.breach)}` : "";
    return `- ${s.domain}, visited ${day}: grade ${s.grade}, exposure ${s.score}/100, cookies ${s.cookieChoice || "none"} [Seen on your visit]; trackers seen [Seen on your visit]: ${t}; privacy policy ${pol}${br}`;
  }

  // Facts about companies or sites named in the question, looked up in the local lists.
  function lookupFacts(question, lists, atlas) {
    const L = (typeof window !== "undefined" ? window : self).PrivaCLists;
    if (!L) return [];
    const q = " " + L.norm(question) + " ";
    const has = (name) => { const n = L.norm(name); return n.length >= 4 && q.includes(" " + n + " "); };
    const facts = [];
    const seen = new Set();

    if (atlas && atlas.domains) {
      const byCo = {};
      for (const [d, [co, cat, ctry, prev]] of Object.entries(atlas.domains)) {
        const x = byCo[co] || (byCo[co] = { n: 0, cats: {}, ctry, prev: 0, top: d });
        x.n++; x.cats[cat] = (x.cats[cat] || 0) + 1; if (prev > x.prev) { x.prev = prev; x.top = d; }
      }
      for (const [co, x] of Object.entries(byCo)) {
        if (facts.length >= 6 || !has(co)) continue;
        seen.add(L.norm(co));
        const cat = Object.entries(x.cats).sort((a, b) => b[1] - a[1])[0][0];
        facts.push(`- ${co} runs ${x.n} tracker domain${x.n > 1 ? "s" : ""} (mostly ${cat}), the biggest on about ${x.prev}% of popular websites${x.ctry ? `; based in ${x.ctry}` : ""} [Tracker Radar]`);
        const b = L.brokerFor(co, x.top, lists, atlas.entities && atlas.entities[co]);
        if (b) facts.push(`- ${co} is registered as a data broker in California (as "${b.name}") [CA Broker Registry]`);
      }
    }
    for (const b of (lists && lists.brokers && lists.brokers.list) || []) {
      if (facts.length >= 8) break;
      const hit = [b.name, b.dba].find(n => n && has(n) && !seen.has(L.norm(n)));
      if (hit) { seen.add(L.norm(hit)); facts.push(`- ${b.name} is registered as a data broker in California [CA Broker Registry]`); }
    }
    const by = (lists && lists.hibp && lists.hibp.byDomain) || {};
    const mentioned = (question.toLowerCase().match(/[a-z0-9-]+(\.[a-z0-9-]+)+/g) || []).map(d => d.replace(/^www\./, ""));
    for (const [d, b] of Object.entries(by)) {
      if (facts.length >= 10) break;
      if (mentioned.includes(d) || has(b.name) || has(b.title)) facts.push(`- ${b.title} (${d}) had a ${breachText(b)}`);
    }
    return facts;
  }

  function buildContext(data, today, facts) {
    const sites = [...((data && data.sites) || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    const date = `Today is ${today || new Date().toISOString().slice(0, 10)}.` +
      (facts && facts.length ? `\n\nFacts about what you asked:\n${facts.join("\n")}` : "");
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
    const lists = deps.lists ? await deps.lists() : null;
    const atlas = deps.atlas ? deps.atlas() : null;
    const facts = lookupFacts(q, lists, atlas);
    const trace = [{ tool: "get_site_report", label: "Your browsing" }];
    try {
      const raw = await deps.ask(q, { system: SYSTEM_PROMPT, context: buildContext(data, null, facts), options: { temperature: 0.2 } });
      const text = cleanAnswer(raw);
      if (/\[Government list\]/.test(text)) trace.push({ tool: "background_facts", label: "Government lists" });
      if (/\[Tracker Radar\]/.test(text)) trace.push({ tool: "lookup_company", label: "Tracker Radar" });
      if (/\[HIBP\]/.test(text)) trace.push({ tool: "breaches", label: "Have I Been Pwned" });
      if (/\[CA Broker Registry\]/.test(text)) trace.push({ tool: "brokers", label: "CA Broker Registry" });
      return { answer: text, trace };
    } catch (e) {
      return { error: e.message || "I couldn't reach Gemma. Is Ollama running?", trace };
    }
  }

  (typeof window !== "undefined" ? window : self).PrivaCAskC = { answer, buildContext, cleanAnswer, lookupFacts, SYSTEM_PROMPT };
})();
