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
- Plain English, no jargon. 2 to 4 short sentences.
- Add a last line starting "What you can do:" with only the 2 or 3 steps that fit the question, from the Steps list, only when the person asks for advice or about a risk (should I worry, is it safe, how do I protect myself, was it hacked). Leave it out of explanations, definitions and follow-up questions.
- You are only PrivaC's privacy guide, not a general assistant. Don't write poems, stories, jokes, code or homework. Questions about hacks, breaches, security, companies, websites, trackers, cookies and data are always on topic: answer them. Only for a request that has nothing to do with privacy, say in one sentence that you only help with privacy.
- If the evidence has nothing about what the person asked, say plainly that PrivaC has no record of it, then answer what you can from the evidence.
- "Earlier in this conversation" shows the last questions and your answers. Use it to understand follow-ups like "what about its cookies?", but answer only the new question.
- Answer the question that was asked first. Then connect it to their own browsing if something there is relevant.
- Use ONLY the evidence you are given. If it doesn't answer the question, say you don't know yet.
- Put a source tag right after each fact, copied exactly from the evidence line it came from: [Seen on your visit], [Tracker Radar], [Privacy policy], [HIBP], [CA Broker Registry], [Cookie Database], [RegTrack], [State Media Monitor] or [Government list]. Never invent other tags.
- Write button and menu names in quotes ("Reject all"), never in square brackets: square brackets are only for the source tags above.
- When asked what a site collects, list the cookies by purpose, name 2 or 3 advertising cookies with their company and how long they last, say which ones the site doesn't need to work, and mention device fingerprinting if present.
- If a site had a data breach [HIBP], say when, how many accounts and what kind of data, and tell the person to change that password. Scraped or leaked data listed with [HIBP] counts as a breach too: never say you have no information about it.
- If the person says yes to something you offered earlier, give it now from the evidence. Never claim you already told them something that isn't in your earlier answer. No backticks, no markdown, no lists with symbols.
- When cookies or cookie banners come up, you may quote one RegTrack fact. RegTrack only compared doing nothing with clicking accept-all, so never say rejecting removes a number of trackers.
- Never say data was sent to a government. A tracker loading means the company could collect data; it doesn't prove the data was sold or shared.
- Don't mention sample data; the dashboard already says so.
- You don't know which site the person has open right now. Don't say "you are currently visiting".

Examples
Question: What is a tracker?
Answer: A tracker is a piece of code from another company that a site loads, so that company can see your visit and recognize you on other sites. [Tracker Radar] On your visits, 3 of the sites you visited loaded trackers from Criteo. [Seen on your visit]

Question: Who tracked me the most this week?
Answer: Google did: its trackers were on 7 of your 9 sites. [Seen on your visit] Next were Facebook on 5 of your 9 sites and Criteo on 3. [Seen on your visit]

Question: Who is Criteo and should I worry?
Answer: Criteo is an advertising company based in France. [Tracker Radar] Its tracker loaded on 3 of the sites you visited, including dailynews.example. [Seen on your visit] That lets it recognize you across those sites to show you ads. What you can do: decline extra cookies when C offers, and turn on "Block third-party cookies" in Chrome settings.`;

  // Short, checked facts Gemma may use for general questions. Each one carries its source tag.
  const BACKGROUND = `Background facts:
- About you, C: your answers are written by Gemma 4 (Google's open AI model, released March 31, 2026), running on the person's own computer, inside Chrome or in the Ollama app. Their questions and browsing never leave the computer. If asked, say so; never say you aren't made with Gemma.
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
- Check the site's privacy policy for "sell" or "share" before creating an account.
- After a site's data breach: change that password, and the same password anywhere else you used it; turn on two-step sign-in; watch for emails that pretend to be that site.`;

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
    // The reader answers each question on its own, so one "no" with the other unknown is common: keep the quoted "no".
    else if (p.sells === false) main = `says it doesn't sell personal info${quote("sells")}; it doesn't say clearly whether it shares [Privacy policy]`;
    else if (p.shares === false) main = `says it doesn't share with partners${quote("shares")}; it doesn't say clearly whether it sells [Privacy policy]`;
    else if (p.checkedAt) main = `read on ${String(p.checkedAt).slice(0, 10)}, no clear answer about selling or sharing [Privacy policy]`;
    else return "not reviewed yet";
    const more = POLICY_FACTS.filter(([f]) => p[f] === true || p[f] === false)
      .map(([f, yes, no]) => `${p[f] ? yes : no}${quote(f)} [Privacy policy]`);
    return [main, ...more].join("; it ");
  }

  // F2: the site itself is a state-run outlet (shared/state-media.json, via background/tracking.js).
  const COUNTRY_NAMES = { CN: "China", RU: "Russia", IR: "Iran", CU: "Cuba", KP: "North Korea", VE: "Venezuela" };
  // Every other code (US, FR, GB...) by its English name, so Gemma never answers "based in RU" (docs/ASKC-FIXES.md Fix 4).
  let REGIONS = null;
  try { REGIONS = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { /* very old browser: codes stay */ }
  function countryName(c) {
    if (!c) return c;
    if (COUNTRY_NAMES[c]) return COUNTRY_NAMES[c];
    if (c === "HK") return "Hong Kong (China)";
    try { return (REGIONS && REGIONS.of(c)) || c; } catch (e) { return c; }
  }
  function stateMediaText(owner) {
    const sm = owner && owner.stateMedia;
    if (!sm) return "";
    const kind = { SC: "State-Controlled", CaPu: "Captured Public (state-managed)" }[sm.classification] || "state media";
    return `; the site itself is state-run media: ${owner.company} (${COUNTRY_NAMES[owner.country] || owner.country}), classified ${kind} by State Media Monitor (${String(sm.updated || "").slice(0, 4) || "2026"}) [State Media Monitor]`;
  }

  const TRACKERS_SHOWN = 12;   // tracker companies listed per site in full detail

  function siteLine(s, extra) {
    // The same company often loads several tracker addresses on one page: say it once, with how many.
    const count = new Map();
    for (const x of s.trackers || []) {
      const listed = listedCompany(x.company, extra);
      const text = `${x.company} (${x.category}, based in ${x.country ? countryName(x.country) : "unknown country"}) [Tracker Radar]` +
        (listed ? listedText(listed) : "") +
        (x.broker ? `, registered California data broker [CA Broker Registry]` : "");
      count.set(text, (count.get(text) || 0) + 1);
    }
    // Long lists are cut to the ones that matter most (foreign-adversary or 1260H links, brokers, advertising first).
    const rank = (text) => (/1260H|based in (China|Hong Kong \(China\)|Russia|Iran|Cuba|North Korea|Venezuela)\)/.test(text) ? 0
      : /data broker|\((High-risk|Malware),/i.test(text) ? 1 : /\((Advertising|Data broker|Session recording),/.test(text) ? 2 : 3);
    const entries = [...count].map(([text, n], i) => ({ text: n > 1 ? `${text} (${n} tracker addresses)` : text, co: text.slice(0, text.indexOf(" (")), r: rank(text), i }));
    const kept = entries.length > TRACKERS_SHOWN ? [...entries].sort((a, b) => a.r - b.r || a.i - b.i).slice(0, TRACKERS_SHOWN).sort((a, b) => a.i - b.i) : entries;
    const keptCos = new Set(kept.map(e => e.co));
    const leftOut = new Set(entries.filter(e => !keptCos.has(e.co)).map(e => e.co)).size;
    const t = kept.map(e => e.text).join("; ") + (leftOut ? `; and ${leftOut} more tracker compan${leftOut === 1 ? "y" : "ies"}` : "") || "none";
    const p = s.policy || {};
    const pol = policyText(p);
    const day = s.lastVisit ? String(s.lastVisit).slice(0, 10) : "unknown date";
    const br = s.breach ? `; ${breachText(s.breach)}` : "";
    const C = (typeof window !== "undefined" ? window : self).PrivaCCookies;
    let ck = "";
    if (s.cookies && s.cookies.length && C) {
      const sum = C.summarize(s.cookies);
      const byLabel = new Map();   // "Functional" and "Necessary" share a label: count them together
      for (const [k, n] of Object.entries(sum.byCategory)) { const label = C.KIND[k] ? C.KIND[k].label : "purpose unknown"; byLabel.set(label, (byLabel.get(label) || 0) + n); }
      const parts = [...byLabel].map(([label, n]) => `${n} ${label}`);
      const ads = sum.marketing.slice(0, 4).map(c => `${c.name} (${c.company || c.domain}, kept ${C.lifetime(c.days)}${c.firstParty ? "" : ", third-party"})`).join(", ");
      ck = `; cookies stored: ${sum.total} (${parts.join(", ")}) [Seen on your visit] [Cookie Database]` +
        (ads ? `; advertising cookies: ${ads} [Cookie Database]` : "") +
        `; ${sum.unneededCount} of them aren't needed for the site to work [Cookie Database]`;
    }
    const fp = (s.trackers || []).filter(x => (x.fingerprinting || 0) >= 2).map(x => x.company);
    const smText = stateMediaText(s.owner);
    const fpText = fp.length ? `; trackers that read device details to recognize you without cookies (fingerprinting): ${[...new Set(fp)].join(", ")} [Tracker Radar]` : "";
    return `- ${s.domain}, visited ${day}: grade ${s.grade}, exposure ${s.score}/100, cookies ${s.cookieChoice || "none"} [Seen on your visit]; trackers seen [Seen on your visit]: ${t}; this site's own privacy policy ${pol}${br}${ck}${fpText}${smText}${scoreText(s)}`;
  }

  // What adds up to a site's exposure score (the popup's "Why it got a B" lines), from shared/data.js.
  const PART_TAG = { observed: "Seen on your visit", disclosed: "Privacy policy", breach: "HIBP" };
  function scoreParts(s) {
    const D = (typeof window !== "undefined" ? window : self).PrivaCData;
    if (!D || !D.computeScore) return null;
    const r = D.computeScore(s);
    return { ...r, counted: r.parts.filter(p => p.points > 0).sort((a, b) => b.points - a.points) };
  }
  function scoreText(s) {
    const r = scoreParts(s);
    if (!r) return "";
    return `; score made of: ${r.counted.map(p => `${p.label} (+${p.points}) [${PART_TAG[p.kind] || PART_TAG.observed}]`).join(", ") || "nothing counted"}`;
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

  // ---------- Data breaches (Have I Been Pwned), docs/ASKC-FIXES.md ----------
  // "Was linkedin.com hacked?" (real Gemma, 2026-10-24): C only ever saw a site's newest breach, matched only by its
  // web address or breach name, so "Was LinkedIn hacked?" or "linked in" found nothing and the 2012 hack was missed.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function monthYear(iso) { const [y, m] = String(iso || "").split("-"); return m ? `${MONTHS_LONG[+m - 1]} ${y}` : (y || "date unknown"); }
  // Words that are also the names of breached sites but almost always mean the word itself.
  const BREACH_STOP = new Set(["data", "cookie", "cookies", "privacy", "tracker", "trackers", "account", "accounts", "email", "password",
    "passwords", "game", "games", "chat", "mail", "news", "online", "best", "free", "shop", "phone", "info", "home", "music", "video",
    "social", "dating", "forum", "health", "money", "bank", "cloud", "site", "sites", "website", "breach", "hacked", "leak", "past",
    "tell", "about", "what", "which", "have", "been", "them", "their", "with", "from", "this", "that", "yes", "okay",
    "crypto", "exchange", "wallet", "school", "phone", "photos", "photo", "camera", "computer", "laptop", "router", "wifi", "work",
    "company", "store", "shopping", "streaming", "browser", "device", "server", "network", "credit", "card", "identity"]);

  // Sites in the breach list that the question means: by web address ("linkedin.com"), by name ("LinkedIn",
  // "linked in", "Ashley Madison"). At most 3, in the order found.
  function breachSites(question, lists) {
    const by = lists && lists.hibp && lists.hibp.byDomain;
    if (!by) return [];
    const q = String(question || "").toLowerCase();
    const domains = (q.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) || []).map((d) => d.replace(/^www\./, ""));
    const words = q.replace(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/g, (d) => d.replace(/^www\./, "").split(".")[0]).match(/[a-z0-9]+/g) || [];
    const names = new Set(words);
    // "linked in" -> "linkedin", "my space" -> "myspace": only when the second word is short, so ordinary words never fuse.
    for (let i = 0; i + 1 < words.length; i++) if (words[i + 1].length <= 3) names.add(words[i] + words[i + 1]);
    const L = (typeof window !== "undefined" ? window : self).PrivaCLists;
    const nq = L ? " " + L.norm(question) + " " : "";
    const named = (n) => { const x = L ? L.norm(n) : ""; return x.length >= 5 && !BREACH_STOP.has(x) && nq.includes(" " + x + " "); };
    const hits = [];
    for (const [d, b] of Object.entries(by)) {
      const n = siteName(d);
      if (domains.includes(d) || (n.length >= 4 && !BREACH_STOP.has(n) && !COMMON_WORDS.has(n) && names.has(n)) || named(b.title) ||
          [b, ...(b.earlier || [])].some((x) => named(x.name))) hits.push([d, b]);
      if (hits.length >= 3) break;
    }
    return hits;
  }

  // Every breach on record for a site, newest first: [{ when, title, count, kinds }].
  function breachList(b) {
    return [b, ...(b.earlier || [])].sort((x, y) => (String(x.breachDate) < String(y.breachDate) ? 1 : -1)).map((x) => ({
      when: monthYear(x.breachDate), title: x.title || x.name,
      count: x.pwnCount ? `${fmtCount(x.pwnCount)} accounts` : "number of accounts not given",
      kinds: (x.dataClasses || []).join(", ").toLowerCase()
    }));
  }
  function siteLabel(d, b) {   // the shortest title is usually the company itself ("LinkedIn", not "LinkedIn Scraped Data (2021)")
    const titles = [b, ...(b.earlier || [])].map((x) => x.title || x.name).filter(Boolean).sort((x, y) => x.length - y.length);
    return `${titles[0] || d} (${d})`;
  }
  function breachHead(d, b) {
    const n = 1 + ((b.earlier && b.earlier.length) || 0);
    return `${siteLabel(d, b)} has ${n} data breach${n > 1 ? "es" : ""} on record in Have I Been Pwned`;
  }
  // "Was X hacked?" answered from the list itself (like grade questions): every breach, exact numbers, no guessing.
  const BREACH_Q = /\b(hack\w*|breach\w*|leak\w*|pwn\w*|compromis\w*|stolen)\b/i;
  const FOLLOW_UP = /\b(it|its|it's|they|them|their|that|this|those|yes|yeah|yep|ok|okay|sure|please)\b/i;
  // Companies the tracker data knows ("Google"), named in the question as whole words.
  function namedCompanies(question, atlas) {
    return atlas && atlas.domains ? companiesIn(question, Object.keys(companiesOf(atlas))).slice(0, 2) : [];
  }
  // The one way every part of C finds the companies a question names (facts, sites shown in full, breach answers).
  // Backtest 2026-10-24: three different matchers meant "Who is Amazon?" found no facts while "Was Amazon hacked?"
  // did, "Who is Meta?" found nothing (Tracker Radar calls it Facebook), and "Did any site I visit get hacked?"
  // was answered about a tracker company named VISIT.
  const COMPANY_ALIASES = { meta: "Facebook", "meta platforms": "Facebook", instagram: "Facebook", whatsapp: "Facebook",
    alphabet: "Google", youtube: "Google", tiktok: "ByteDance", linkedin: "Microsoft", bing: "Microsoft",
    yahoo: "Verizon Media", aol: "Verizon Media", snapchat: "Snap", amazon: "Amazon.com", verizon: "Verizon Media" };
  // Company names that are everyday words: they count only when written the way the company writes them, not first.
  const EVERYDAY_NAMES = new Set(["visit", "next", "impact", "about you", "answers", "insider", "move", "near", "optimize", "orange",
    "polar", "smile", "stamped", "uplift", "indeed", "increasingly", "narrative", "stuff", "epic", "affinity", "iterate", "institute",
    "herald", "maverick", "terminus", "consumable", "radial", "admiral", "agora", "arbitrage", "triumphant", "seattle", "quant", "plex", "fomo"]);
  const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function companiesIn(question, names) {
    const L = (typeof window !== "undefined" ? window : self).PrivaCLists;
    if (!L || !question) return [];
    const raw = String(question);
    const nq = " " + L.norm(raw) + " ";
    const known = new Set(names);
    const full = [], first = [];
    for (const [alias, co] of Object.entries(COMPANY_ALIASES)) if (known.has(co) && nq.includes(" " + alias + " ")) full.push(co);
    for (const co of names) {
      const n = L.norm(co);
      if (n.length >= 4 && !BREACH_STOP.has(n) && nq.includes(" " + n + " ")) {
        if (EVERYDAY_NAMES.has(n)) { const m = new RegExp(`(^|[^A-Za-z])${escapeRe(co)}(?![A-Za-z])`).exec(raw); if (!m || m.index + m[1].length === 0) continue; }
        full.push(co);
      } else {   // "Lotame Solutions" also answers to "Lotame"; generic first words ("Digital", "Global") never do. Many first
        // words are everyday words too ("Better Commerce", "Improve Digital", "Index Exchange"), so the first word counts only
        // written with its capital, and not as the question's first word ("How can I make it better?" names no company).
        const w = n.split(" ")[0];
        const word = String(co).split(/[^A-Za-z0-9]/)[0];
        if (w !== n && w.length >= 5 && !BREACH_STOP.has(w) && !GENERIC_FIRST.has(w) && /^[A-Z]/.test(word) &&
            new RegExp(`[^A-Za-z]${escapeRe(word)}(?![A-Za-z])`).test(raw)) first.push(co);
      }
    }
    return [...new Set([...full, ...first.sort((x, y) => x.length - y.length)])];
  }
  const GENERIC_FIRST = new Set(["digital", "media", "global", "network", "networks", "group", "systems", "technologies", "technology",
    "solutions", "services", "software", "interactive", "mobile", "marketing", "analytics", "labs", "internet", "united", "american",
    "national", "international", "first", "smart", "cloud", "online", "social", "advanced", "audience", "trade", "direct", "content",
    "video", "local", "north", "south", "east", "west", "china", "beijing", "shanghai", "russia", "new", "general", "public", "power"]);

  const MORE_Q = /\b(more|else|again|why|how so|explain)\b/i;
  const AND_ABOUT = /^\s*(?:and|what about|how about|same for|also)\b/i;
  // sites = your browsing (data.sites), atlas = tracker data: so a name PrivaC knows gets an answer even without a breach.
  function breachAnswer(q, lists, history, sites, atlas) {
    if (!(lists && lists.hibp && lists.hibp.byDomain)) return null;
    const last = recent(history).slice(-1)[0];
    const lastWasBreach = !!(last && BREACH_Q.test(last.question));
    if (!BREACH_Q.test(q) && !(lastWasBreach && AND_ABOUT.test(q))) return null;   // "what about google?" after a breach question
    let hits = breachSites(q, lists);
    if (!hits.length && FOLLOW_UP.test(q) && last && !AND_ABOUT.test(q)) hits = breachSites(last.question, lists);   // "yes, its breaches"
    if (hits.length) {
      const parts = hits.map(([d, b]) => `${breachHead(d, b)} [HIBP]:\n` +
        breachList(b).map((x) => `- ${x.when}, ${x.title}: ${x.count}${x.kinds ? `; exposed ${x.kinds}` : ""}.`).join("\n"));
      const who = hits.length === 1 ? siteLabel(hits[0][0], hits[0][1]).replace(/ \(.*$/, "") : "one of these sites";
      return parts.join("\n\n") + `\n\nWhat you can do: if you have a ${who} account, change its password and the same password anywhere ` +
        `else you used it, turn on two-step sign-in, and watch for emails pretending to be ${hits.length === 1 ? who : "these sites"}.`;
    }
    const domain = (q.toLowerCase().match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/) || [])[0];
    const visited = namedSites(sites || [], q)[0];
    const company = namedCompanies(q, atlas)[0];
    // "Did any site I visit get hacked?", "Which of my sites leaked data?": your own sites, from the same list (backtest
    // 2026-10-24: six wordings went three different ways, one answered about a tracker company named VISIT).
    if (!domain && !visited && !company && MY_SITES.test(q)) return yourBreaches(lists, sites || []);
    // No breach on record. Say so for anything PrivaC knows: a web address, a site you visited, or a tracker company.
    const subject = domain ? domain.replace(/^www\./, "") : visited ? visited.domain : company;
    if (!subject) return null;   // nothing PrivaC knows: Gemma answers from the rest of the evidence
    const at = String(lists.hibp.fetchedAt || "").slice(0, 10).split("-");
    const updated = at.length === 3 ? ` (updated ${MONTHS[+at[1] - 1]} ${+at[2]}, ${at[0]})` : "";
    let seen = "";
    if (company && !domain && !visited) {
      const on = (sites || []).filter((s) => (s.trackers || []).some((t) => t && t.company === company)).length;
      if (on) seen = ` ${company}'s trackers were on ${on} of your ${sites.length} sites this week [Seen on your visit], which is about tracking, not a breach.`;
    }
    return `Have I Been Pwned's list${updated} has no breach on record for ${subject} [HIBP]. ` +
      "That doesn't prove it was never breached: the list only has breaches that became public." + seen +
      "\n\nWhat you can do: use a different password for each site and turn on two-step sign-in, so one breach can't unlock your other accounts.";
  }

  // Breach claims Gemma can't back (real Gemma on the G14, 2026-10-25: "Zara.com also had a data breach recently"
  // after a LinkedIn question, with no Zara breach on the list). A sentence saying a named site or company was
  // breached, hacked or leaked stays only when the breach list has it. Sentences that say there was no breach, or
  // explain what a breach is, name nobody and stay.
  const BREACH_CLAIM = /\b(?:had|has|have|suffered|experienced|was|were|been|got)\b[^.!?]*\b(?:breach\w*|hack\w*|leak\w*|pwn\w*|compromis\w*)/i;
  const DENIES = /\b(?:no|not|never|none)\b|n't\b/i;
  const NAMES_SOMEONE = /[a-z0-9-]+\.[a-z]{2,}\b|(?:^|\s)(?!(?:A|An|The|This|That|It|Its|You|Your|I|If|When|Some|Many|Most|Any|Each|Every|One|They|Their|There|These|Those|What|In|On|At|Since|After|Before|Also|And|But|So|Yes|No)\b)[A-Z][A-Za-z0-9]+/;
  function dropUnbackedBreaches(text, lists) {
    // A sentence keeps the source tags that follow it ("... passwords. [HIBP] Zara.com ...").
    return String(text || "").split("\n").map((par) => par.split(/(?<=[.!?](?:\s*\[[^\]]+\])*)\s+/).filter((sentence) => {
      if (!BREACH_CLAIM.test(sentence) || DENIES.test(sentence) || breachSites(sentence, lists).length) return true;
      return !NAMES_SOMEONE.test(sentence.replace(/\[[^\]]*\]/g, ""));
    }).join(" ")).join("\n");
  }

  // "Which site tracks me the most?" is about a site, not a company (real Gemma answered "Google" and then listed
  // Google again among the others). Counted from your browsing, so every wording gets the same answer.
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] || "");
  const MOST_SITE = /\b(?:which|what)\s+(?:of\s+my\s+)?(?:web)?sites?\b[^?]*\bmost\b|\bmost[-\s]+tracked\s+(?:web)?sites?\b/i;
  function mostTrackedAnswer(q, sites) {
    if (!MOST_SITE.test(q) || !/\btrack/i.test(q)) return null;
    if (!sites.length) return "You haven't visited any sites with PrivaC on yet, so there's no site to name yet.";
    const count = (s) => (s.trackers || []).filter(Boolean).length;
    const ranked = sites.filter(count).sort((a, b) => count(b) - count(a) || (b.score || 0) - (a.score || 0) || (a.domain < b.domain ? -1 : 1));
    if (!ranked.length) return `None of the ${sites.length} sites you visited in the last 7 days loaded a tracker PrivaC knows [Seen on your visit].`;
    const many = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const top = ranked[0];
    const cos = [...new Set(top.trackers.filter(Boolean).map((t) => t.company).filter(Boolean))];
    const named = cos.length > 5 ? `${cos.slice(0, 5).join(", ")} and ${cos.length - 5} more` : and(cos);
    let text = `${top.domain} tracked you the most: it loaded ${many(count(top), "tracker")} from ${cos.length} ${cos.length === 1 ? "company" : "companies"}` +
      `${named ? ` (${named})` : ""} [Seen on your visit].`;
    const next = ranked.slice(1, 3);
    if (next.length === 2 && count(next[0]) === count(next[1])) text += ` Next were ${and(next.map((s) => s.domain))}, with ${many(count(next[0]), "tracker")} each.`;
    else if (next.length) text += ` Next ${next.length > 1 ? "were" : "was"} ${and(next.map((s) => `${s.domain} (${many(count(s), "tracker")})`))}.`;
    return text;
  }

  const MY_SITES = /\b(?:web)?sites?\b|\bi\s+(?:visit|visited|went|use|go)\b|\bmy\s+(?:browsing|history)\b/i;
  function yourBreaches(lists, sites) {
    const by = lists.hibp.byDomain;
    const hit = sites.map((s) => [s.domain, by[s.domain] || s.breach]).filter(([, b]) => b);
    const at = String(lists.hibp.fetchedAt || "").slice(0, 10).split("-");
    const updated = at.length === 3 ? ` (updated ${MONTHS[+at[1] - 1]} ${+at[2]}, ${at[0]})` : "";
    if (!hit.length) return `None of the ${sites.length} site${sites.length === 1 ? "" : "s"} you visited in the last 7 days is in Have I Been Pwned's list${updated} [HIBP]. ` +
      "That doesn't prove they were never breached: the list only has breaches that became public.";
    return `${hit.length} of the ${sites.length} sites you visited in the last 7 days ${hit.length === 1 ? "is" : "are"} in Have I Been Pwned's list${updated} [HIBP]:\n` +
      hit.map(([d, b]) => `- ${d}: ` + breachList(b).map((x) => `${x.when}, ${x.title}: ${x.count}${x.kinds ? `; exposed ${x.kinds}` : ""}`).join(". ") + ".").join("\n") +
      "\n\nWhat you can do: if you have an account on one of these sites, change its password and the same password anywhere else you used it, " +
      "turn on two-step sign-in, and watch for emails pretending to be that site.";
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
      for (const co of companiesIn(question, Object.keys(byCo))) {
        if (facts.length >= 6) break;
        const x = byCo[co];
        seen.add(L.norm(co));
        const cat = Object.entries(x.cats).sort((a, b) => b[1] - a[1])[0][0];
        const alias = Object.keys(COMPANY_ALIASES).find((a) => COMPANY_ALIASES[a] === co && q.includes(" " + a + " "));
        const owns = alias ? ` (Tracker Radar lists ${alias.replace(/\b\w/g, (c) => c.toUpperCase())}'s trackers under ${co}, its owner)` : "";
        facts.push(`- ${co}${owns} runs ${x.n} tracker domain${x.n > 1 ? "s" : ""} (mostly ${cat}), the biggest on about ${x.prev}% of popular websites${x.ctry ? `; based in ${countryName(x.ctry)}` : ""} [Tracker Radar]`);
        const b = L.brokerFor(co, x.top, lists, atlas.entities && atlas.entities[co]);
        if (b) facts.push(`- ${co} is registered as a data broker in California (as "${b.name}") [CA Broker Registry]`);
      }
    }
    for (const b of (lists && lists.brokers && lists.brokers.list) || []) {
      if (facts.length >= 8) break;
      const hit = [b.name, b.dba].find(n => n && has(n) && !seen.has(L.norm(n)));
      if (hit) { seen.add(L.norm(hit)); facts.push(`- ${b.name} is registered as a data broker in California [CA Broker Registry]`); }
    }
    for (const [d, b] of breachSites(question, lists)) {
      if (facts.length >= 10) break;
      // Same first part as before (the newest breach), then every earlier one, so Gemma sees the whole record.
      const older = breachList(b).filter((x) => x.title !== (b.title || b.name) || x.when !== monthYear(b.breachDate));
      facts.push(`- ${b.title} (${d}) had a ${breachText(b)}` +
        (older.length ? `; earlier breaches on record: ${older.map((x) => `${x.when}, ${x.title}: ${x.count}${x.kinds ? `; exposed ${x.kinds}` : ""}`).join(". ")} [HIBP]` : ""));
    }
    return facts;
  }

  // ---------- Speed: a short, question-focused summary instead of every site in full ----------
  // A week of browsing written out in full was ~40,000 words: Gemma took a long time to read it (and its
  // context cut part of it off). Now Gemma gets totals and cross-site lists covering EVERY site, full details
  // only for the few sites that matter to the question, and one short line for the next riskiest ones.
  const DETAIL_SITES = 4;     // full detail lines (trackers, cookies, policy, breach)
  const SHORT_SITES = 10;     // then one short line each
  const LIST_MAX = 15;        // entries per cross-site list (brokers, foreign-adversary links, policies)
  const MAX_CONTEXT_CHARS = 15000;   // ~4,000 tokens: fits Ollama's 8,192 and the in-browser model with room to answer
  const COMMON_WORDS = new Set(["the", "and", "you", "your", "who", "why", "how", "what", "was", "are", "can", "did", "does", "has",
    "get", "got", "see", "use", "new", "web", "app", "all", "any", "not", "now", "our", "out", "way", "site", "sites", "news", "mail", "shop", "store", "home", "help"]);

  function siteName(domain) {   // "news.bbc.co.uk" -> "bbc", "flightdeals.example" -> "flightdeals"
    const p = String(domain || "").toLowerCase().split(".");
    if (p.length < 2) return p[0] || "";
    const sld = p.length >= 3 && p[p.length - 1].length === 2 && /^(co|com|org|net|ac|gov|edu)$/.test(p[p.length - 2]);
    return p[p.length - (sld ? 3 : 2)] || "";
  }

  // Sites the question names ("cnn.com" also finds edition.cnn.com; "flightdeals" alone works too).
  function namedSites(sites, question) {
    if (!question) return [];
    const q = String(question).toLowerCase();
    const tokens = [...new Set((q.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)*/g) || []).map(t => t.replace(/^www\./, "")))];
    return sites.filter(s => {
      const d = String(s.domain || "").toLowerCase();
      if (!d) return false;
      if (tokens.some(t => t === d || t.endsWith("." + d) || (t.includes(".") && d.endsWith("." + t)))) return true;
      const name = siteName(d);
      return name.length >= 3 && !COMMON_WORDS.has(name) && tokens.includes(name);
    });
  }

  // Those sites, and sites where a tracker company the question names was seen. When the question is about a company,
  // at most one of its own sites (google.com, mail.google.com...) is shown in full, so the rest show where it followed you.
  function focusSites(sites, question) {
    if (!question) return [];
    const named = namedSites(sites, question);
    const L = (typeof window !== "undefined" ? window : self).PrivaCLists;
    let byCompany = [];
    if (L) {
      const seenCos = new Set();
      for (const s of sites) for (const t of s.trackers || []) if (t && t.company) seenCos.add(t.company);
      const asked = new Set(companiesIn(question, [...seenCos]));
      if (asked.size) byCompany = sites.filter(s => (s.trackers || []).some(t => t && asked.has(t.company)));
    }
    const ownSites = byCompany.length ? named.slice(0, 1) : named;
    return [...new Set([...ownSites, ...byCompany, ...named])];
  }

  const yearOf = (b) => String(b.breachDate || b.addedDate || "").slice(0, 4);
  const ADVERSARY = new Set(["CN", "HK", "RU", "IR", "CU", "KP", "VE"]);   // 15 CFR 7.4 (same list as shared/data.js)
  const more = (list, max) => (list.length > max ? `; and ${list.length - max} more` : "");

  // Totals and cross-site lists over every site, so questions like "which data brokers have seen me?" or
  // "which sites sell my data?" are answered from all of your browsing, not only the sites shown in full.
  // lists = data.lists from PrivaCData.load(): when the broker registry was never downloaded, nothing is said
  // about brokers (an unknown is never shown as safe: docs/SPEC.md Honesty rules).
  function overview(sites, extra, lists) {
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const choices = { declined: 0, accepted: 0, "no-reject": 0, none: 0 };
    const byCo = new Map(), brokers = new Map(), fingerprint = new Map();
    const breached = [], flagged = [], sells = [], shares = [];
    for (const s of sites) {
      if (grades[s.grade] !== undefined) grades[s.grade]++;
      choices[s.cookieChoice in choices ? s.cookieChoice : "none"]++;
      const why = new Map();
      for (const t of s.trackers || []) {
        if (!t || !t.company) continue;
        let x = byCo.get(t.company);
        if (!x) byCo.set(t.company, (x = { sites: new Set(), category: t.category, country: t.country }));
        x.sites.add(s.domain);
        if (t.broker) {
          let b = brokers.get(t.broker);
          if (!b) brokers.set(t.broker, (b = { company: t.company, sites: [] }));
          if (!b.sites.includes(s.domain)) b.sites.push(s.domain);
        }
        if ((t.fingerprinting || 0) >= 2) { let f = fingerprint.get(t.company); if (!f) fingerprint.set(t.company, (f = new Set())); f.add(s.domain); }
        const listed = t.listed || listedCompany(t.company, extra);
        const inCountry = ADVERSARY.has(t.country);
        if (inCountry || listed) why.set(t.company, `${t.company} (${[inCountry ? countryName(t.country) : null, listed ? "Section 1260H list" : null].filter(Boolean).join("; ")})`);
      }
      for (const t of s.flagged || []) if (t && t.company && !why.has(t.company)) why.set(t.company, `${t.company} (${countryName(t.country)})`);
      if (s.owner && ADVERSARY.has(s.owner.country)) why.set("owner", `the site belongs to ${s.owner.company} (${countryName(s.owner.country)}${s.owner.stateMedia ? ", state-run media" : ""})`);
      if (s.addressFlag) why.set("address", `web address ends in ${s.addressFlag.ending} (${countryName(s.addressFlag.country)})`);
      if (s.serverFlag) why.set("server", `server address registered in ${countryName(s.serverFlag.country)} (regional internet registry)`);
      if (why.size) { const w = [...why.values()]; flagged.push(`${s.domain}: ${w.slice(0, 3).join(", ")}${w.length > 3 ? ` and ${w.length - 3} more` : ""}`); }
      if (s.breach) {
        const b = s.breach, kinds = (b.dataClasses || []).slice(0, 3).join(", ").toLowerCase();
        breached.push(`${s.domain} (${b.name}, ${yearOf(b)}${b.pwnCount ? `, ${fmtCount(b.pwnCount)} accounts` : ""}${kinds ? `: ${kinds}` : ""})`);
      }
      const p = s.policy || {};
      if (p.sells === true) sells.push(s.domain);
      else if (p.shares === true) shares.push(s.domain);
    }
    const lines = [];
    lines.push(`Your browsing with PrivaC on, last 7 days [Seen on your visit]: ${sites.length} sites; grades ${Object.entries(grades).map(([g, n]) => `${n} ${g}`).join(", ")}; ` +
      `cookie banners: ${choices.declined} declined, ${choices.accepted} accepted, ${choices["no-reject"]} had no Reject button, ${choices.none} with no banner seen.`);
    const top = [...byCo].sort((a, b) => b[1].sites.size - a[1].sites.size).slice(0, 10);
    if (top.length) lines.push(`Companies seen on the most sites [Seen on your visit] [Tracker Radar]: ${top.map(([co, x]) => `${co} (${x.category}, ${x.country ? countryName(x.country) : "unknown country"}) on ${x.sites.size} of ${sites.length} sites`).join("; ")}.`);
    if (brokers.size) {
      const list = [...brokers].map(([name, b]) => `${b.company} (registered as "${name}") on ${b.sites.length} site${b.sites.length > 1 ? "s" : ""}: ${b.sites.slice(0, 4).join(", ")}${b.sites.length > 4 ? "..." : ""}`);
      lines.push(`Registered California data brokers seen [CA Broker Registry] [Seen on your visit]: ${list.slice(0, LIST_MAX).join("; ")}${more(list, LIST_MAX)}.`);
    } else if (lists && lists.brokersAsOf) lines.push("No registered California data brokers seen [CA Broker Registry].");
    if (flagged.length) lines.push(`Foreign-adversary links seen [Seen on your visit] [Government list]: ${flagged.slice(0, LIST_MAX).join("; ")}${more(flagged, LIST_MAX)}.`);
    if (sells.length) lines.push(`Sites whose own privacy policy says they sell personal information [Privacy policy]: ${sells.slice(0, LIST_MAX).join(", ")}${more(sells, LIST_MAX)}.`);
    if (shares.length) lines.push(`Sites whose own privacy policy says they share personal information with partners [Privacy policy]: ${shares.slice(0, LIST_MAX).join(", ")}${more(shares, LIST_MAX)}.`);
    if (fingerprint.size) {
      const fp = [...fingerprint].sort((a, b) => b[1].size - a[1].size).slice(0, 8);
      lines.push(`Trackers that read device details to recognize you without cookies (fingerprinting) [Tracker Radar]: ${fp.map(([co, set]) => `${co} on ${set.size} site${set.size > 1 ? "s" : ""}`).join(", ")}.`);
    }
    if (breached.length) lines.push(`Sites you visited with a known data breach [HIBP]: ${breached.slice(0, 8).join("; ")}${more(breached, 8)}.`);
    return lines.join("\n");
  }

  function shortLine(s) {
    const cos = [...new Set((s.trackers || []).map(t => t.company).filter(Boolean))];
    return `- ${s.domain}: grade ${s.grade}, exposure ${s.score}/100, ${cos.length} tracker compan${cos.length === 1 ? "y" : "ies"}${cos.length ? ` (${cos.slice(0, 4).join(", ")}${cos.length > 4 ? "..." : ""})` : ""} [Seen on your visit]`;
  }

  // extra = { flagged, regtrack }: the checked fact files (optional; context still builds without them).
  // question (optional): sites it names, and sites where companies it names were seen, are shown in full.
  // The result always fits MAX_CONTEXT_CHARS (~4,000 tokens): short lines go first, then full-detail sites from
  // the least risky, so Gemma's rules (which come first) are never pushed out of its context window.
  function buildContext(data, today, facts, extra, question, history) {
    const tidy = (s) => (Array.isArray(s.trackers) && s.trackers.some(t => !t) ? { ...s, trackers: s.trackers.filter(Boolean) } : s);
    const sites = ((data && data.sites) || []).filter(Boolean).map(tidy).sort((a, b) => (b.score || 0) - (a.score || 0));
    // Unchanging background first, then everything about this question: Ollama can reuse the start of the last prompt.
    const date = `Today is ${today || new Date().toISOString().slice(0, 10)}.`;
    const bg = BACKGROUND + rulesText() + regtrackLines(extra) + (facts && facts.length ? `\n\nFacts about what you asked:\n${facts.join("\n")}` : "") + memoryText(history);
    if (!sites.length) return `${date}\n${bg}\n\nThe person hasn't visited any sites with PrivaC on yet.`;
    // Sites the question names first, then sites named in the last few questions (for follow-ups like "its cookies").
    const earlier = recent(history).map(t => t.question).reverse().join(" ");
    const detail = [...new Set([...focusSites(sites, question), ...focusSites(sites, earlier), ...sites])].slice(0, DETAIL_SITES);
    const shown = new Set(detail);
    const rest = sites.filter(s => !shown.has(s));
    const short = rest.slice(0, SHORT_SITES);
    const head = `${date}\n${bg}\n\n${overview(sites, extra, data && data.lists)}\n\n`;
    const detailLines = detail.map(s => [s, siteLine(s, extra)]);
    const shortLines = short.map(shortLine);
    const build = () => {
      const d = [...detailLines].sort((a, b) => (b[0].score || 0) - (a[0].score || 0));
      const left = sites.length - d.length - shortLines.length;
      return head +
        `Sites you visited, riskiest first (${sites.length}${sites.length > d.length ? `; full details for ${d.length}` : ""}):\n${d.map(x => x[1]).join("\n")}` +
        (shortLines.length ? `\n\nNext riskiest sites:\n${shortLines.join("\n")}` : "") +
        (left > 0 ? `\n(and ${left} more sites with lower exposure)` : "");
    };
    let text = build();
    while (text.length > MAX_CONTEXT_CHARS && (shortLines.length || detailLines.length > 1)) {
      if (shortLines.length) shortLines.pop(); else detailLines.pop();   // the question's own sites come first, so they stay
      text = build();
    }
    return text;
  }

  // ---------- Keeping C on topic (repo owner, 2026-10-24) ----------
  // Steps ("What you can do:") only when the person asks for advice or about a risk; Gemma added them to almost
  // every answer. Questions about C itself and requests that have nothing to do with privacy get C's own
  // answer without asking Gemma, which otherwise talks like a general chatbot ("I can write a poem").
  const WANTS_STEPS = /\b(should (i|we)|worr\w*|safe\w*|unsafe|danger\w*|risk\w*|protect\w*|stop|avoid|block\w*|remov\w*|delet\w*|opt[- ]?out|prevent\w*|what (can|should) i do|how (do|can|should) i|hack\w*|breach\w*|leak\w*|pwn\w*|scam\w*)\b/i;
  const ABOUT_C = /^\s*(?:(?:what|how)\s+(?:else\s+)?(?:can|could|do)\s+you\s+(?:do|help)\b|what\s+(?:can|could)\s+you\s+help(?:\s+me)?\s+with\b|(?:who|what)\s+are\s+you\b|what\s+are\s+you\s+able\s+to\s+do\b|what\s+(?:can|should)\s+i\s+ask\b|how\s+do(?:es)?\s+(?:you|ask c|privac)\s+work\b|help)\s*(?:you|for\s+me|here|exactly|me\s+with)?\s*[?!.]*\s*$/i;   // the whole question, so "What can you do about X?" goes to Gemma
  const OFF_TOPIC_THING = /\b(poems?|poetry|haikus?|songs?|lyrics|stor(?:y|ies)|essays?|jokes?|riddles?|recipes?|homework|code|python|javascript|programs?)\b/i;
  const OFF_TOPIC_ASK = /\b(write|compose|make|generate|tell|give|create|sing)\b/i;
  const PRIVACY_WORDS = /privacy|data|cookie|track|site|broker|breach|grade|polic|\.[a-z]{2,}\b/i;
  const ABOUT_ANSWER = "I'm C, PrivaC's privacy guide. I explain what PrivaC found on the sites you visit: each site's grade and why, " +
    "which tracker companies followed you, what cookies were stored and what they're for, data breaches, registered data brokers, " +
    "links to companies in foreign-adversary countries, and what privacy policies say about selling your data. On websites, I can " +
    "also decline extra cookies for you. My answers are written by Gemma 4, running on this computer, so your questions stay here. " +
    "Try asking: \"Which sites I visited are the riskiest?\"";
  const OFF_TOPIC_ANSWER = "I stick to your privacy, so I can't help with that one. Try asking me about a site you visited, " +
    "a tracker company, or whether to accept cookies.";
  // "Are you made with gemma" got "You are not made with Gemma" (real Gemma, 2026-10-24). Questions about what C is or runs on
  // get this fixed answer. Each pattern needs C ("you", "C", "PrivaC", "Ask C") or the model itself, so "Is my data sent to
  // Google?" or "What can you tell me about Google?" (questions about trackers) still go to Gemma.
  const MODEL_WORDS = /\b(gemma|llms?|large language models?|language models?|ai models?|litert)\b/i;
  const ABOUT_MODEL = [
    /\b(?:are|were)\s+you\s+(?:an?\s+)?(?:ai|a\.i\.|bot|chatbot|robot|human|real(?:\s+person)?|chatgpt|gpt|gemini|claude|llama|model|llm)\b/i,
    /\b(?:are|were)\s+you\s+(?:made|built|powered|trained|running|created)\b/i,
    /\b(?:who|what)\s+(?:made|built|created|trained|powers|runs)\s+(?:you|c|privac|ask\s+c)\b/i,
    /\bwhat\s+(?:ai|model|llm|brain)\s+(?:are|is|runs|powers|do)\b/i,
    /\b(?:do|does)\s+(?:you|c|privac|ask\s+c)\s+(?:use|run\s+on|send|share|upload|store)\b[^?.!]*\b(?:ai|model|google|openai|my\s+(?:questions?|data|browsing|chats?)|anywhere|online|cloud)\b/i,
    /\b(?:is|are)\s+my\s+(?:data|questions?|browsing|chats?)\s+(?:sent|shared|uploaded|stored)\b[^?.!]*\b(?:when\s+i\s+ask\s+you|to\s+you|ask\s+c|privac|gemma|the\s+ai)\b/i
  ];
  const MODEL_ANSWER = "I'm C, PrivaC's privacy guide, and my answers are written by Gemma 4, Google's open AI model (released March 31, 2026), " +
    "running on this computer: inside Chrome on your graphics chip (Gemma 4 E2B with Google's LiteRT-LM), or in the Ollama app if you picked it. " +
    "I'm not an online chatbot: your questions and browsing never leave this computer, and nothing is sent to Google or any AI company. " +
    "Gemma only writes the words. The grades, tracker lists, breach records and government lists come from PrivaC's own code and public data, " +
    "and each fact shows its source.";
  function cannedAnswer(q) {
    if (MODEL_WORDS.test(q) || ABOUT_MODEL.some((re) => re.test(q))) return MODEL_ANSWER;
    if (ABOUT_C.test(q)) return ABOUT_ANSWER;
    if (OFF_TOPIC_THING.test(q) && OFF_TOPIC_ASK.test(q) && !PRIVACY_WORDS.test(q)) return OFF_TOPIC_ANSWER;
    return null;
  }
  // "Why did planetfitness.com get a B?" (team doc, 2026-10-24: C said "I don't know yet"). Answered from the score
  // itself, the same lines as the popup's "Why it got a B", so the answer is always right and instant.
  const GRADE_WORDS_Q = /\b(grade[sd]?|grading|scored?|scoring|rate[ds]?|rating)\b/i;
  const GRADE_LETTER = /\b(?:get|gets|got|getting|has|have|had|is|was|earn|earned|receive|received|a|an)\s+(?:an?\s+)?["']?([A-Fa-f])["']?(?=[\s?.!,]|$)/;   // "get a d" too: people type in lowercase
  const GRADE_RANGES = "A is 0-20, B is 21-40, C is 41-60, D is 61-80, F is 81-100";
  const article = (g) => (/^[AEF]/.test(g) ? "an" : "a");
  // Fully / Partly checked, with how high the score could go (the popup says the same, shared/site-summary.js).
  function checkedLine(r) {
    const D = (typeof window !== "undefined" ? window : self).PrivaCData;
    if (!r.unknowns || !r.unknowns.length || !r.range) return "Fully checked: every line of the grade has an answer. What companies do with data on their own servers is still unknown. [Seen on your visit]";
    if (r.score >= 100) return `Partly checked: ${r.unknowns.join(", and ")}, but the score is already at the top (${r.score} out of 100), so that can't raise it. [${PART_TAG.disclosed}]`;
    const worst = D.gradeFor(r.range.max);
    const g = worst === r.grade ? `still ${article(worst)} ${worst}` : `${article(worst)} ${worst}`;
    return `Partly checked: ${r.unknowns.join(", and ")}, so this could be as high as ${r.range.max} out of 100 (${g}). [${PART_TAG.disclosed}]`;
  }
  // "Why does CNN have a bad grade?": the "a" there is a word, not the letter A. A lowercase "a" is the letter only when
  // nothing follows it, or "grade" does (backtest 2026-10-24: C answered "cnn.com got a D, not an A").
  function askedLetter(q) {
    for (const m of String(q).matchAll(new RegExp(GRADE_LETTER.source, "g"))) {
      if (m[1] !== "a") return m[1].toUpperCase();
      const after = q.slice(m.index + m[0].length);
      if (/^["']?\s*(?:grade\b|rating\b|[?.!,]|$)/i.test(after)) return "A";
    }
    return undefined;
  }
  // Every wording of "what's cnn.com's grade and why" gets the same answer: a site the person visited plus a grade word
  // ("explain cnn.com's grade", "cnn grade?", "what made its score go up"), or "why is cnn so bad". Before, only
  // questions starting with why/how did, and the rest went to Gemma and came back different each time.
  const SO_BAD = /\bwhy\b[^?]*\b(?:so\s+)?(?:bad|poor|low|high|good|terrible|awful)\b/i;
  function gradeIntent(q) { return GRADE_WORDS_Q.test(q) || SO_BAD.test(q) || (/\b(why|how)\b/i.test(q) && askedLetter(q) !== undefined); }
  function gradeAnswer(q, sites, history) {
    const last = recent(history).slice(-1)[0];
    const followUp = !gradeIntent(q) && last && gradeIntent(last.question) && AND_ABOUT.test(q);   // "and espn?" after a grade question
    if (!gradeIntent(q) && !followUp) return null;
    const named = namedSites(sites, q).slice(0, 3);
    if (!named.length) {
      const domain = (q.toLowerCase().match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/) || [])[0];
      return domain ? `I haven't seen ${domain.replace(/^www\./, "")} with PrivaC on in the last 7 days, so it has no grade yet. ` +
        "Open it with PrivaC on, then ask me again. [Seen on your visit]" : null;
    }
    const asked = followUp ? undefined : askedLetter(q);
    const parts = named.map(s => [s, scoreParts(s)]);
    if (parts.some(([, r]) => !r)) return null;
    return parts.map(([s, r]) => {
      const not = asked && asked !== r.grade && named.length === 1 ? `, not ${article(asked)} ${asked}` : "";
      const head = `${s.domain} got ${article(r.grade)} ${r.grade}${not}: an exposure score of ${r.score} out of 100, ` +
        `where higher means more of your data is exposed (${GRADE_RANGES}).`;
      const body = r.counted.length
        ? "What added points:\n" + r.counted.map(p => `- ${p.label} (+${p.points}) [${PART_TAG[p.kind] || PART_TAG.observed}]`).join("\n")
        : "Nothing added points: no trackers or tracking cookies were counted, and no data breach or foreign-adversary link is on record. [Seen on your visit]";
      return `${head}\n${body}\n${checkedLine(r)}`;
    }).join("\n\n") + (named.length === 1 ? topicRules(q) : "");
  }

  // The dashboard's Ask C button on a score line ('On cnn.com: what does "5 outside companies with trackers here" mean,
  // and why is it worth 25 points?') is answered from that line's own rule (Justin, 2026-10-24: C said "I don't know yet").
  const PART_Q = /\bwhat does "([^"]+)" mean\b/i;
  function partAnswer(q, sites) {
    const m = q.match(PART_Q);
    const s = m && namedSites(sites, q)[0];
    const r = s && scoreParts(s);
    const p = r && r.parts.find((x) => x.label === m[1]);
    if (!p || !p.rule) return null;
    return `"${p.label}" is one line of ${s.domain}'s exposure score [${PART_TAG[p.kind] || PART_TAG.observed}]. How it's counted: ${p.rule}. ` +
      `Here it adds ${p.points} of ${s.domain}'s ${r.score} points (${r.grade}); higher means more of your data is exposed (${GRADE_RANGES}).`;
  }
  // "Why did cnn.com get a C for tracker connections?": the breakdown, plus how the lines the question names are counted.
  const PART_TOPICS = [
    [/\btrack|\bconnections?\b/i, "tracker lines are", ["trackers", "ads"]],
    [/\bcookies?\b|\bbanners?\b/i, "cookie line is", ["cookies"]],
    [/\bpolic(?:y|ies)\b|\bsell|\bshar(?:e|es|ing)\b/i, "privacy policy line is", ["policy"]],
    [/\bbreach|\bhack|\bleak|\bpwn/i, "breach line is", ["breach"]],
    [/\bforeign\b|\badversar|\bchin|\brussia|\b1260h\b/i, "foreign-adversary line is", ["flag"]]
  ];
  function topicRules(q) {
    const D = (typeof window !== "undefined" ? window : self).PrivaCData;
    if (!D || !D.RULES) return "";
    return PART_TOPICS.filter(([re]) => re.test(q)).map(([, name, keys]) => `\nHow the ${name} counted: ${keys.map((k) => D.RULES[k]).join(". ")}.`).join("");
  }
  // Every rule once, for Gemma: so a rule question in any wording has its answer in the evidence.
  function rulesText() {
    const D = (typeof window !== "undefined" ? window : self).PrivaCData;
    if (!D || !D.RULES) return "";
    return `\n\nHow the grade is counted (higher means more exposed):\n` +
      ["trackers", "ads", "cookies", "flag", "policy", "breach"].map((k) => `- ${D.RULES[k]}.`).join("\n") + `\nGrades: ${GRADE_RANGES}.`;
  }

  const dropSteps = (text) => text.replace(/\s*What you can do:[\s\S]*$/i, "").trim();
  // While Gemma is still writing: also hide a half-written "What you can..." at the very end, so the steps never
  // flash up and then vanish when the answer finishes (Max, team doc).
  const hideSteps = (text) => String(text || "").replace(/\s*What you can do\b[\s\S]*$/i, "").replace(/\s*\bWhat(?: you(?: can(?: do)?)?)?\s*$/i, "");

  // A small memory: the last 3 questions and answers from this Ask C session, cut short (dashboard/ask-c.js).
  const MEMORY_TURNS = 3;
  function recent(history) {
    return (Array.isArray(history) ? history : [])
      .filter(t => t && typeof t.question === "string" && typeof t.answer === "string")
      .slice(-MEMORY_TURNS);
  }
  function memoryText(history) {
    const turns = recent(history);
    if (!turns.length) return "";
    const cut = (s, n) => { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "..." : s; };
    return "\n\nEarlier in this conversation (oldest first; only to understand follow-up questions):\n" +
      // Without its "What you can do" steps: Gemma copied the same tips into every next answer.
      turns.map(t => `- They asked: ${cut(t.question, 200)}\n  You answered: ${cut(dropSteps(t.answer), 300)}`).join("\n");
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

  // The verb after "the user", changed to go with "you": has -> have, watches -> watch, carries -> carry.
  // Words that aren't third-person verbs (can, will, should, not...) don't end in s, so they stay as they are.
  const YOU_VERBS = { is: "are", was: "were", has: "have", does: "do", isn: "aren", wasn: "weren", hasn: "haven", doesn: "don" };
  function youVerb(v) {
    const w = v.toLowerCase();
    if (YOU_VERBS[w]) return YOU_VERBS[w];
    if (/(?:sses|shes|ches|xes|zes|oes)$/.test(w)) return v.slice(0, -2);
    if (/[^aeiou]ies$/.test(w)) return v.slice(0, -3) + "y";
    if (w.length > 3 && /[^su]s$/.test(w)) return v.slice(0, -1);
    return v;
  }

  // C repeating himself (backtest 2026-10-24): a small model at low temperature can say the same sentence twice, and
  // with the conversation memory it says "Earlier I told you..." instead of answering. Both are taken out here.
  const TOLD_YOU = /^(?:earlier(?: in (?:this|our) conversation)?,?\s+i\s+(?:told|said|mentioned|explained|shared)|i\s+(?:already\s+)?(?:told|mentioned|explained)\s+(?:you\s+)?(?:this\s+)?(?:earlier|before|already))\b/i;
  const AS_I_SAID = /^as i (?:mentioned|said|explained|noted)(?: earlier| before)?,\s*/i;
  function noRepeats(text) {
    const seen = new Set();
    return text.split(/\n{2,}/).map((para) => {
      const out = [];
      for (const piece of para.split(/(?<=[.!?])\s+(?=[A-Z"(\[])|(?<=\])\s+(?=[A-Z"(])/)) {
        if (/^(\[[^\]]+\]\s*)+$/.test(piece)) { if (out.length && !out[out.length - 1].dropped) out[out.length - 1].text += " " + piece; continue; }
        let sentence = piece.replace(AS_I_SAID, "");
        if (sentence !== piece) sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        const key = sentence.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        const dropped = TOLD_YOU.test(sentence) || (key.length > 0 && seen.has(key));
        if (key) seen.add(key);
        out.push({ text: sentence, dropped });
      }
      return out.filter((x) => !x.dropped).map((x) => x.text).join(" ");
    }).filter(Boolean).join("\n\n");
  }

  // Fix Gemma's small formatting slips so the panel shows clean labels and "you".
  function cleanAnswer(text) {
    let t = String(text || "").replace(/`/g, "").replace(/\*\*/g, "");
    t = t.replace(/^(please )?note:? (that )?(this|the data provided) is (a )?sample[^.]*\.\s*/i, "");
    t = t.replace(/\bthe user's\b/gi, "your");
    // "the user has" -> "you have", not "you has" (docs/ASKC-FIXES.md Fix 2).
    // Only when "the user" starts a sentence or clause (it's the subject); "data about the user goes" stays "about you goes".
    t = t.replace(/(^|[.!?]\s+|\n\s*|\b(?:what|that|who|which|when|where|if|because|so|and|but|while|unless|whether)\s+)the user((?:\s+(?:also|always|often|still|never|just|already|usually|really|probably|only|then))?)\s+([a-z]+)\b/gi,
      (m, pre, adv, v) => `${pre}you${adv} ${youVerb(v)}`);
    t = t.replace(/\bthe user\b/gi, "you");
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
    t = noRepeats(t);
    return t.replace(/[ \t]+([.,;])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  }

  // A half-written last sentence that starts like one C already said stays hidden: if it turns out to be a repeat,
  // it would be removed when the answer finishes; if not, it shows a word or two later.
  function hideHalfRepeat(text) {
    const m = text.match(/^([\s\S]*[.!?\]])\s+([^.!?\]]+)$/);
    if (!m) return text;
    const key = (s) => s.replace(/\[[^\]]*\]?/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const tail = key(m[2]);
    return tail && m[1].split(/(?<=[.!?])\s+/).some((s) => key(s).startsWith(tail)) ? m[1] : text;
  }

  // The same question with the same evidence gets the same answer: Gemma picks its words with a fixed seed
  // (with a random one, asking twice gave two different answers).
  const SEED = 7;

  async function answer(question, deps) {
    const q = String(question || "").trim();
    if (!q) return { error: "Type a question for C first." };
    const canned = cannedAnswer(q);
    if (canned) return { answer: canned, trace: [] };
    const steps = WANTS_STEPS.test(q);
    const data = await deps.load();
    const graded = gradeAnswer(q, ((data && data.sites) || []).filter(Boolean), deps.history);
    const part = partAnswer(q, ((data && data.sites) || []).filter(Boolean));
    if (part) return { answer: part, trace: [{ tool: "get_site_report", label: "Your browsing" }] };
    if (graded) return { answer: graded, trace: [{ tool: "get_site_report", label: "Your browsing" }] };
    const most = mostTrackedAnswer(q, ((data && data.sites) || []).filter(Boolean));
    if (most) return { answer: most, trace: [{ tool: "get_site_report", label: "Your browsing" }] };
    const lists = deps.lists ? await deps.lists() : null;
    const breach = breachAnswer(q, lists, deps.history, ((data && data.sites) || []).filter(Boolean), deps.atlas ? deps.atlas() : null);
    if (breach) return { answer: breach, trace: [{ tool: "breaches", label: "Have I Been Pwned" }] };
    const atlas = deps.atlas ? deps.atlas() : null;
    // A follow-up that names nothing ("does it fingerprint me?", "tell me more") keeps the last question's facts, so
    // C doesn't lose what he knows about Criteo one question later (backtest 2026-10-24).
    let facts = lookupFacts(q, lists, atlas);
    const last = recent(deps.history).slice(-1)[0];
    // A question that names its own subject ("Who is Meta?") is answered without the earlier questions: they changed
    // the prompt, so asking twice gave two different answers even with the fixed seed (real Gemma, 2026-10-25).
    const standalone = (facts.length || namedSites(((data && data.sites) || []).filter(Boolean), q).length) && !AND_ABOUT.test(q) && !FOLLOW_UP.test(q);
    if (!facts.length && last && (FOLLOW_UP.test(q) || MORE_Q.test(q) || q.split(/\s+/).length <= 4)) facts = lookupFacts(last.question, lists, atlas);
    // "yes tell me more" after "Was LinkedIn hacked?" stays on LinkedIn (Gemma drifted to another site's breach).
    const moreBreach = last && BREACH_Q.test(last.question) && !BREACH_Q.test(q) && (FOLLOW_UP.test(q) || MORE_Q.test(q)) ? breachSites(last.question, lists) : [];
    const breachNames = and(moreBreach.map(([d, b]) => siteLabel(d, b).replace(/ \(.*$/, "")));
    const extra = deps.facts ? await deps.facts() : FACT_FILES;
    const trace = [{ tool: "get_site_report", label: "Your browsing" }];
    try {
      const context = buildContext(data, null, facts, extra, q, standalone ? [] : deps.history) +
        (steps ? "" : `\n\nFor this question: Don't add a "What you can do" line; just answer it.`) +
        (breachNames ? `\n\nFor this question: they want more about ${breachNames}'s breach record. Answer only about ${breachNames}, from its [HIBP] facts; don't bring up other sites' breaches.` : "");
      // A source tag needs evidence behind it: Gemma wrote [HIBP] with no breach facts (2026-10-24), which also showed a
      // "Have I Been Pwned" check mark C never made. Tags that aren't in the evidence are removed, so their chips don't show.
      const sourcedOnly = (t) => dropUnbackedBreaches(t, lists).replace(/\s*\[([^\]]+)\]/g, (m, tag) => (TAGS.includes(tag) && !context.includes(`[${tag}]`) ? "" : m));
      // While C is writing, his words get the same clean-up as the finished answer (repeats, unsupported tags, steps),
      // so nothing he showed is taken away at the end (Max, IDEA.md).
      const writing = (so) => hideHalfRepeat(sourcedOnly(cleanAnswer(steps ? so : hideSteps(so))));
      const raw = await deps.ask(q, { system: SYSTEM_PROMPT, context, options: { temperature: 0.2, seed: SEED },
                                      ...(deps.signal ? { signal: deps.signal } : {}),
                                      ...(deps.onToken ? { onToken: (piece, so) => deps.onToken(piece, writing(so)) } : {}) });
      const sourced = sourcedOnly(cleanAnswer(raw));
      const text = steps ? sourced : dropSteps(sourced);
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
