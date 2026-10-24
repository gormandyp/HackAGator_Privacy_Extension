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
- Put a source tag right after each fact, copied exactly from the evidence line it came from: [Seen on your visit], [Tracker Radar], [Privacy policy], [HIBP], [CA Broker Registry], [Cookie Database], [RegTrack], [State Media Monitor] or [Government list]. Never invent other tags.
- When asked what a site collects, list the cookies by purpose, name 2 or 3 advertising cookies with their company and how long they last, say which ones the site doesn't need to work, and mention device fingerprinting if present.
- If a site had a data breach [HIBP], say when, how many accounts and what kind of data, and tell the person to change that password. No backticks, no markdown, no lists with symbols.
- When cookies or cookie banners come up, you may quote one RegTrack fact. RegTrack only compared doing nothing with clicking accept-all, so never say rejecting removes a number of trackers.
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
- The Pentagon's Section 1260H list (updated June 8, 2026) names Chinese military companies. Baidu, Alibaba and Tencent are on it; ByteDance (TikTok) and Yandex are not. Being listed is a government designation about the company; it doesn't show what happened to your data. [Government list]

- Every request to a tracker sends your IP address (which shows your rough location), the address of the page you're on, and your browser and device details. Cookies let the tracker recognize you again next time.
- Cookies marked "advertising and profiling" or "measures your visits" are not needed for a site to work. Advertising cookies build a profile of your interests that ad companies use to target you; registered data brokers sell profiles like these.

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

  // 1260H entry for a tracker's company, from shared/flagged-companies.json (hand-checked).
  function listedCompany(company, extra) {
    const list = extra && extra.flagged && extra.flagged.companies;
    return (list && company && list.find(c => c.atlasCompany.toLowerCase() === String(company).toLowerCase())) || null;
  }
  function listedText(entry) {
    return `, on the Pentagon's Section 1260H list of Chinese military companies (June 2026)` +
      (/sued|contest/i.test(entry.note || "") ? `, and ${entry.atlasCompany} is contesting this in court` : "") + ` [Government list]`;
  }

  // RegTrack findings, from shared/regtrack-facts.json (each with its page number).
  function regtrackLines(extra) {
    const r = extra && extra.regtrack;
    if (!r || !r.facts) return "";
    const lines = r.facts.filter(f => f.id !== "limits").map(f => `- ${f.text} (RegTrack, ${r.venue.includes("MADWeb") ? "MADWeb 2026" : "2026"}, p. ${f.page}) [RegTrack]`);
    return `\n\nResearch on cookie consent (RegTrack, a 2026 study of 743 websites; it did not measure rejecting, only doing nothing versus clicking accept-all):\n${lines.join("\n")}`;
  }

  // What the site's privacy policy says (filled by background/policy-reader.js). Unknown answers are left out, never stated.
  const POLICY_FACTS = [
    ["optOut", "explains how to opt out of sale or sharing", "gives no way to opt out of sale or sharing"],
    ["gpc", "says it honors Global Privacy Control", "says it ignores browser opt-out signals like Global Privacy Control"],
    ["retention", "gives a time limit for keeping your data", "has no time limit for keeping your data"],
    ["preciseLocation", "collects your precise location", "uses only your rough location"],
    ["sensitive", "collects sensitive information such as health, biometric or financial details", "says it doesn't collect sensitive information"],
    ["otherSources", "gets data about you from other companies such as data brokers or ad partners", "says it only collects data directly from you"]
  ];
  function policyText(p) {
    const quote = (f) => (p.quotes && p.quotes[f] ? ` ("${String(p.quotes[f]).slice(0, 200)}")` : "");
    let main;
    if (p.sells === true) main = `says it sells personal info${quote("sells")} [Privacy policy]`;
    else if (p.shares === true) main = `says it shares with partners${p.checkedAt ? " for advertising" : ""}${quote("shares")} [Privacy policy]`;
    else if (p.sells === false && p.shares === false) main = `says it doesn't sell or share${quote("sells")} [Privacy policy]`;
    else if (p.checkedAt) main = `read on ${String(p.checkedAt).slice(0, 10)}, no clear answer about selling or sharing [Privacy policy]`;
    else return "not reviewed yet";
    const more = POLICY_FACTS.filter(([f]) => p[f] === true || p[f] === false)
      .map(([f, yes, no]) => `${p[f] ? yes : no}${quote(f)} [Privacy policy]`);
    return [main, ...more].join("; it ");
  }

  // F2: the site itself is a state-run outlet (shared/state-media.json, via background/tracking.js).
  const COUNTRY_NAMES = { CN: "China", RU: "Russia", IR: "Iran", CU: "Cuba", KP: "North Korea", VE: "Venezuela" };
  function stateMediaText(owner) {
    const sm = owner && owner.stateMedia;
    if (!sm) return "";
    const kind = { SC: "State-Controlled", CaPu: "Captured Public (state-managed)" }[sm.classification] || "state media";
    return `; the site itself is state-run media: ${owner.company} (${COUNTRY_NAMES[owner.country] || owner.country}), classified ${kind} by State Media Monitor (${String(sm.updated || "").slice(0, 4) || "2026"}) [State Media Monitor]`;
  }

  function siteLine(s, extra) {
    const t = (s.trackers || []).map(x => {
      const listed = listedCompany(x.company, extra);
      return `${x.company} (${x.category}, based in ${x.country || "unknown country"}) [Tracker Radar]` +
        (listed ? listedText(listed) : "") +
        (x.broker ? `, registered California data broker [CA Broker Registry]` : "");
    }).join("; ") || "none";
    const p = s.policy || {};
    const pol = policyText(p);
    const day = s.lastVisit ? String(s.lastVisit).slice(0, 10) : "unknown date";
    const br = s.breach ? `; ${breachText(s.breach)}` : "";
    const C = (typeof window !== "undefined" ? window : self).PrivaCCookies;
    let ck = "";
    if (s.cookies && s.cookies.length && C) {
      const sum = C.summarize(s.cookies);
      const parts = Object.entries(sum.byCategory).map(([k, n]) => `${n} ${C.KIND[k] ? C.KIND[k].label : "purpose unknown"}`);
      const ads = sum.marketing.slice(0, 4).map(c => `${c.name} (${c.company || c.domain}, kept ${C.lifetime(c.days)}${c.firstParty ? "" : ", third-party"})`).join(", ");
      ck = `; cookies stored: ${sum.total} (${parts.join(", ")}) [Seen on your visit] [Cookie Database]` +
        (ads ? `; advertising cookies: ${ads} [Cookie Database]` : "") +
        `; ${sum.unneededCount} of them aren't needed for the site to work [Cookie Database]`;
    }
    const fp = (s.trackers || []).filter(x => (x.fingerprinting || 0) >= 2).map(x => x.company);
    const smText = stateMediaText(s.owner);
    const fpText = fp.length ? `; trackers that read device details to recognize you without cookies (fingerprinting): ${[...new Set(fp)].join(", ")} [Tracker Radar]` : "";
    return `- ${s.domain}, visited ${day}: grade ${s.grade}, exposure ${s.score}/100, cookies ${s.cookieChoice || "none"} [Seen on your visit]; trackers seen [Seen on your visit]: ${t}; privacy policy ${pol}${br}${ck}${fpText}${smText}`;
  }

  // Tracker Radar totals per company (domains, main category, country, biggest reach). Built once per Atlas.
  const COMPANIES = new WeakMap();
  function companiesOf(atlas) {
    let byCo = COMPANIES.get(atlas);
    if (byCo) return byCo;
    byCo = {};
    for (const [d, [co, cat, ctry, prev]] of Object.entries(atlas.domains)) {
      const x = byCo[co] || (byCo[co] = { n: 0, cats: {}, ctry, prev: 0, top: d });
      x.n++; x.cats[cat] = (x.cats[cat] || 0) + 1; if (prev > x.prev) { x.prev = prev; x.top = d; }
    }
    COMPANIES.set(atlas, byCo);
    return byCo;
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
      const byCo = companiesOf(atlas);
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

  // extra = { flagged, regtrack }: the checked fact files (optional; context still builds without them).
  function buildContext(data, today, facts, extra) {
    const sites = [...((data && data.sites) || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    const date = `Today is ${today || new Date().toISOString().slice(0, 10)}.` +
      (facts && facts.length ? `\n\nFacts about what you asked:\n${facts.join("\n")}` : "");
    const bg = BACKGROUND + regtrackLines(extra);
    if (!sites.length) return `${date}\n${bg}\n\nThe person hasn't visited any sites with PrivaC on yet.`;
    return `${date}\n${bg}\n\nSites you visited, riskiest first (${sites.length}):\n${sites.map(s => siteLine(s, extra)).join("\n")}`;
  }

  // In the extension, load the checked fact files once. Tests pass them in through deps.facts instead.
  let FACT_FILES = null;
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL && typeof fetch === "function") {
    Promise.all(["shared/flagged-companies.json", "shared/regtrack-facts.json"].map(p => fetch(chrome.runtime.getURL(p)).then(r => r.json())))
      .then(([flagged, regtrack]) => { FACT_FILES = { flagged, regtrack }; })
      .catch(e => console.warn("PrivaC: fact files didn't load; C answers without them", e));
  }

  const TAGS = ["Seen on your visit", "Tracker Radar", "CA Broker Registry", "HIBP", "RegTrack", "Privacy policy", "Government list", "Cookie Database", "State Media Monitor"];
  const TAG_ALIASES = {
    "sites visited": "Seen on your visit", "your browsing": "Seen on your visit", "browsing": "Seen on your visit",
    "seen during your visit": "Seen on your visit", "observed": "Seen on your visit", "sample data": "Seen on your visit",
    "policy": "Privacy policy", "tracker radar data": "Tracker Radar", "government": "Government list",
    "government lists": "Government list", "background facts": "Government list", "15 cfr 7.4": "Government list",
    "open cookie database": "Cookie Database", "cookies": "Cookie Database", "cookie db": "Cookie Database"
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
    const extra = deps.facts ? await deps.facts() : FACT_FILES;
    const trace = [{ tool: "get_site_report", label: "Your browsing" }];
    try {
      const raw = await deps.ask(q, { system: SYSTEM_PROMPT, context: buildContext(data, null, facts, extra), options: { temperature: 0.2 } });
      const text = cleanAnswer(raw);
      if (/\[Government list\]/.test(text)) trace.push({ tool: "background_facts", label: "Government lists" });
      if (/\[Tracker Radar\]/.test(text)) trace.push({ tool: "lookup_company", label: "Tracker Radar" });
      if (/\[Cookie Database\]/.test(text)) trace.push({ tool: "cookies", label: "Cookie Database" });
      if (/\[HIBP\]/.test(text)) trace.push({ tool: "breaches", label: "Have I Been Pwned" });
      if (/\[CA Broker Registry\]/.test(text)) trace.push({ tool: "brokers", label: "CA Broker Registry" });
      if (/\[State Media Monitor\]/.test(text)) trace.push({ tool: "state_media", label: "State Media Monitor" });
      if (/\[RegTrack\]/.test(text)) trace.push({ tool: "regtrack_compare", label: "RegTrack" });
      return { answer: text, trace };
    } catch (e) {
      return { error: e.message || "I couldn't reach Gemma. Is Ollama running?", trace };
    }
  }

  (typeof window !== "undefined" ? window : self).PrivaCAskC = { answer, buildContext, cleanAnswer, lookupFacts, SYSTEM_PROMPT };
})();
