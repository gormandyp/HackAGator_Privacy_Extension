/*
  PrivaC data layer — THE HANDOFF POINT between the UI and the extension logic.

  The UI never talks to the network itself. It reads one object from
  chrome.storage.local under the key "privacData", shaped like this:

  {
    sites: [
      {
        domain: "dailynews.example",
        lastVisit: "2026-10-23T14:02:00Z",
        cookieChoice: "declined" | "accepted" | "no-reject" | "none",   // "none" = no banner seen; "no-reject" = banner had no way to say no
        cookies: [ { name, domain, firstParty, category, company, purpose, days } ],  // names only, never values (shared/cookies.js)
        breach: { name, breachDate, addedDate, pwnCount } | null,      // the site's own most recent breach (Have I Been Pwned)
        policy: { sells: true|false|null, shares: true|false|null, source: "url or null" },
        trackers: [
          { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" }
        ]
      }
    ]
  }

  Whoever writes the background script only has to keep that object updated.
  Scores and grades are calculated HERE (computeScore) so every screen agrees.
  If no real data exists yet, the UI shows SAMPLE_DATA with a "sample data" note.
*/
(function () {
  // U.S. Commerce Department "foreign adversary" list, 15 CFR § 7.4.
  // Verify the current list before the demo — regulations can change.
  const FOREIGN_ADVERSARIES = {
    CN: "China", HK: "Hong Kong (China)", CU: "Cuba", IR: "Iran",
    KP: "North Korea", RU: "Russia", VE: "Venezuela"
  };

  // F1: country web-address endings for those countries. "xn--p1ai" is how browsers write ".рф".
  const COUNTRY_ENDINGS = { ir: "IR", ru: "RU", su: "RU", "xn--p1ai": "RU", cn: "CN", hk: "HK", cu: "CU", kp: "KP", ve: "VE" };
  const ENDING_SHOWN = { "xn--p1ai": "рф" };
  function endingOf(host) { return String(host || "").toLowerCase().replace(/\.$/, "").split(".").pop(); }
  // "en.irna.ir" -> "IR"; "cgtn.com" -> null. A web address ending is a public fact, not proof of where servers are.
  function countryOfAddress(host) {
    const parts = String(host || "").split(".");
    return parts.length > 1 ? COUNTRY_ENDINGS[endingOf(host)] || null : null;
  }

  const AD_CATEGORIES = ["Advertising", "Data broker", "Session recording"];

  const T = {
    gAds:      { domain: "doubleclick.net",        company: "Google",     category: "Advertising", country: "US" },
    gAnalytics:{ domain: "google-analytics.com",   company: "Google",     category: "Analytics",   country: "US" },
    meta:      { domain: "connect.facebook.net",   company: "Meta",       category: "Advertising", country: "US" },
    amazon:    { domain: "amazon-adsystem.com",    company: "Amazon",     category: "Advertising", country: "US" },
    criteo:    { domain: "criteo.com",             company: "Criteo",     category: "Advertising", country: "FR" },
    comscore:  { domain: "scorecardresearch.com",  company: "Comscore",   category: "Analytics",   country: "US" },
    hotjar:    { domain: "hotjar.com",             company: "Hotjar",     category: "Session recording", country: "MT" },
    liveramp:  { domain: "rlcdn.com",              company: "LiveRamp",   category: "Data broker", country: "US" },
    pinterest: { domain: "ct.pinterest.com",       company: "Pinterest",  category: "Advertising", country: "US" },
    yandex:    { domain: "mc.yandex.ru",           company: "Yandex",     category: "Analytics",   country: "RU" },
    baidu:     { domain: "hm.baidu.com",           company: "Baidu",      category: "Analytics",   country: "CN" }
  };

  const SAMPLE_DATA = {
    sample: true,
    sites: [
      { domain: "dailynews.example", lastVisit: "2026-10-23T14:02:00Z", cookieChoice: "declined",
        policy: { sells: false, shares: true, source: null },
        trackers: [T.gAds, T.gAnalytics, T.meta, T.amazon, T.criteo, T.comscore, T.liveramp] },
      { domain: "weathernow.example", lastVisit: "2026-10-23T12:40:00Z", cookieChoice: "accepted",
        policy: { sells: true, shares: true, source: null },
        trackers: [T.gAds, T.meta, T.amazon, T.comscore, T.liveramp, T.hotjar] },
      { domain: "recipebox.example", lastVisit: "2026-10-22T23:15:00Z", cookieChoice: "none",
        policy: { sells: null, shares: null, source: null },
        trackers: [T.gAds, T.gAnalytics, T.meta, T.pinterest, T.criteo, T.amazon, T.hotjar] },
      { domain: "flightdeals.example", lastVisit: "2026-10-22T19:05:00Z", cookieChoice: "accepted",
        policy: { sells: true, shares: true, source: null },
        trackers: [T.gAds, T.meta, T.yandex, T.baidu, T.criteo, T.liveramp, T.hotjar, T.amazon] },
      { domain: "campuslibrary.example", lastVisit: "2026-10-22T16:30:00Z", cookieChoice: "none",
        policy: { sells: false, shares: false, source: null },
        trackers: [T.gAnalytics] },
      { domain: "openencyclopedia.example", lastVisit: "2026-10-21T21:10:00Z", cookieChoice: "none",
        policy: { sells: false, shares: false, source: null },
        trackers: [] }
    ]
  };

  /*
    Privacy exposure score, 0–100. Higher = more exposure. NOT a probability.
    Each part is returned so the UI can explain the grade line by line.
  */
  function computeScore(site, now = Date.now()) {
    const t = site.trackers || [];
    const parts = [];

    const trackerPts = Math.min(40, t.length * 5);
    parts.push({ label: `${t.length} tracker ${t.length === 1 ? "connection" : "connections"} to outside companies`, points: trackerPts, kind: "observed" });

    const adCount = t.filter(x => AD_CATEGORIES.includes(x.category) || x.broker).length;
    const adPts = Math.min(20, adCount * 5);
    parts.push({ label: `${adCount} used for advertising, data brokering or recording your screen`, points: adPts, kind: "observed" });

    // Cookies: points come off when you weren't given a real way to say no.
    // No banner is only fine when the site doesn't track you (nothing to refuse).
    const trackingCookies = (site.cookies || []).filter(c => c.category === "Marketing" || c.category === "Analytics").length;
    const tracksYou = t.length > 0 || trackingCookies > 0;
    const COOKIE = {
      accepted:    [10, "All cookies accepted"],
      "no-reject": [10, "Cookie banner had no Reject button"],
      declined:    [0,  "Non-essential cookies declined"],
      none:        tracksYou ? [10, "Tracks you with no cookie banner: you were never asked"] : [0, "No cookie banner, and nothing tracking you"]
    };
    const [cookiePts, cookieLabel] = COOKIE[site.cookieChoice] || COOKIE.none;
    parts.push({ label: cookieLabel, points: cookiePts, kind: "observed" });

    // Foreign-adversary line (15 points, counted once): a tracker company based in a 15 CFR 7.4 country,
    // a tracker company on the Pentagon's Section 1260H list, the site's own company based in a listed country,
    // or (F2) the site is a state-run outlet of a listed country.
    const flagged = t.filter(x => FOREIGN_ADVERSARIES[x.country] || x.listed);
    const owner = site.owner && FOREIGN_ADVERSARIES[site.owner.country] ? site.owner : null;
    const listed = flagged.filter(x => x.listed);
    let flagLabel = "No foreign-adversary links";
    const sm = owner && owner.stateMedia;
    if (sm) {
      // F2: the site itself is a state-run outlet (shared/state-media.json, State Media Monitor).
      const kind = { SC: "State-Controlled", CaPu: "Captured Public (state-managed)" }[sm.classification] || "state media";
      flagLabel = `This site is state-run media: ${owner.company} (${FOREIGN_ADVERSARIES[owner.country]}), classified ${kind} by State Media Monitor (${String(sm.updated || "").slice(0, 4) || "2026"})`;
    } else if (listed.length) {
      const names = [...new Set(listed.map(x => x.company))].join(", ");
      flagLabel = `Link to ${names}, on the Pentagon's Section 1260H list of Chinese military companies (June 2026)`;
    } else if (flagged.length) {
      const names = [...new Set(flagged.map(x => `${x.company} (${FOREIGN_ADVERSARIES[x.country]})`))].join(", ");
      flagLabel = `Link to a company in a listed foreign-adversary country: ${names}`;
    } else if (owner) {
      flagLabel = `This site is owned by ${owner.company}, based in ${FOREIGN_ADVERSARIES[owner.country]} (a listed foreign-adversary country)`;
    }
    // F1: the site's own web address ends in a listed country's code (.ir, .ru, .cn ...). Same single line.
    const addrCountry = countryOfAddress(site.domain);
    const addressFlag = addrCountry ? { ending: "." + (ENDING_SHOWN[endingOf(site.domain)] || endingOf(site.domain)), country: addrCountry } : null;
    if (addressFlag && !flagged.length && !owner) {
      flagLabel = `This site's web address ends in ${addressFlag.ending}, the country code of ${FOREIGN_ADVERSARIES[addrCountry]} (a listed foreign-adversary country)`;
    }
    // F3: the site's own server address is registered (regional internet registry) in a listed country. Same single line.
    const serverFlag = site.server && FOREIGN_ADVERSARIES[site.server.country] ? site.server : null;
    if (serverFlag && !flagged.length && !owner && !addressFlag) {
      flagLabel = `This site's server address is registered in ${FOREIGN_ADVERSARIES[serverFlag.country]} (regional internet registry), a listed foreign-adversary country`;
    }
    const flagPts = flagged.length || owner || addressFlag || serverFlag ? 15 : 0;
    parts.push({ label: flagLabel, points: flagPts, kind: "observed" });

    // Outside servers whose owner we don't know but whose address ends in a listed country's code: shown, 0 points.
    const unknownHosts = [...new Set([
      ...(site.foreignHosts || []),
      ...t.filter(x => !FOREIGN_ADVERSARIES[x.country] && !x.listed && countryOfAddress(x.domain)).map(x => x.domain)
    ])];
    if (unknownHosts.length) {
      const names = unknownHosts.slice(0, 5).map(h => `${h} (${FOREIGN_ADVERSARIES[countryOfAddress(h)]})`).join(", ");
      const more = unknownHosts.length > 5 ? ` and ${unknownHosts.length - 5} more` : "";
      parts.push({ label: `Also contacted outside ${unknownHosts.length === 1 ? "server" : "servers"} with a listed country's web address, owner unknown: ${names}${more}`, points: 0, kind: "observed" });
    }
    // F3: outside servers whose address is registered in a listed country (owner unknown): shown, 0 points.
    const servers = (site.foreignServers || []).filter(x => FOREIGN_ADVERSARIES[x.country] && !unknownHosts.includes(x.host));
    if (servers.length) {
      const names = servers.slice(0, 5).map(x => `${x.host} (${FOREIGN_ADVERSARIES[x.country]})`).join(", ");
      const more = servers.length > 5 ? ` and ${servers.length - 5} more` : "";
      parts.push({ label: `Also contacted outside ${servers.length === 1 ? "server" : "servers"} whose address is registered in a listed country, owner unknown: ${names}${more}`, points: 0, kind: "observed" });
    }

    const p = site.policy || {};
    let policyPts = 0, policyLabel = "Privacy policy not checked yet";
    if (p.sells === true) { policyPts = 15; policyLabel = "Policy says it sells personal information"; }
    else if (p.shares === true) { policyPts = 8; policyLabel = "Policy says it shares information with partners"; }
    else if (p.sells === false && p.shares === false) { policyPts = 0; policyLabel = "Policy says it doesn't sell or share"; }
    parts.push({ label: policyLabel, points: policyPts, kind: "disclosed" });

    // The site's own data breaches, from Have I Been Pwned (rule v4, repo owner 2026-10-24):
    // reported in the last 12 months 15; happened in the last 5 years 5; older 0, unless major (100 million+ accounts) 5.
    // Every breach is listed; points come from the worst one, counted once.
    const b = site.breach;
    if (b && (b.addedDate || b.breachDate)) {
      const all = [b, ...(b.earlier || [])];
      const scored = all.map(x => ({ x, ...breachPoints(x, now) })).sort((p, q) => q.points - p.points);
      const top = scored[0];
      const others = all.filter(x => x !== top.x).sort((p, q) => (yearOf(p) < yearOf(q) ? 1 : -1));
      const extra = others.length ? `; ${others.length} ${others.length === 1 ? "other breach" : "earlier breaches"} on record: ${others.map(x => `${x.name} (${yearOf(x)})`).join(", ")}` : "";
      parts.push({ label: top.label + extra, points: top.points, kind: "breach" });
    } else {
      parts.push({ label: "No known data breaches", points: 0, kind: "breach" });
    }

    const score = Math.min(100, parts.reduce((s, x) => s + x.points, 0));
    return { score, grade: gradeFor(score), parts, flagged, ownerFlag: owner, addressFlag, serverFlag };
  }

  const YEAR_MS = 365.25 * 86400000;
  function yearOf(b) { return String(b.breachDate || b.addedDate).slice(0, 4); }
  function breachPoints(b, now) {
    const added = Date.parse(b.addedDate || b.breachDate), happened = Date.parse(b.breachDate || b.addedDate);
    const millions = b.pwnCount ? Math.floor(b.pwnCount / 1e6) : 0;
    if (now - added < YEAR_MS) return { points: 15, label: `Data breach reported in the last year (${b.name}, ${yearOf(b)})` };
    if (now - happened < 5 * YEAR_MS) return { points: 5, label: `Data breach in the last 5 years (${b.name}, ${yearOf(b)})` };
    if (millions >= 100) return { points: 5, label: `Major past data breach (${b.name}, ${yearOf(b)}, ${millions} million accounts)` };
    return { points: 0, label: `Past data breach on record (${b.name}, ${yearOf(b)}): older than 5 years, no points` };
  }

  function gradeFor(score) {
    if (score <= 20) return "A";
    if (score <= 40) return "B";
    if (score <= 60) return "C";
    if (score <= 80) return "D";
    return "F";
  }

  const GRADE_WORDS = { A: "Low exposure", B: "Some exposure", C: "Moderate exposure", D: "High exposure", F: "Very high exposure" };

  function hasChrome() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }

  async function load() {
    if (hasChrome()) {
      try {
        const res = await chrome.storage.local.get(["privacData", "privacLists"]);
        if (res && res.privacData && res.privacData.sites && res.privacData.sites.length) {
          // Add breach (HIBP) and data-broker (CA registry) facts from the downloaded public lists.
          const lists = res.privacLists || null;
          const root = typeof window !== "undefined" ? window : self;
          if (lists && root.PrivaCLists) root.PrivaCLists.annotate(res.privacData, lists, null);
          annotateListed(res.privacData, await flaggedFile());
          const out = enrich(res.privacData);
          out.lists = lists ? { breachesAsOf: lists.hibp && lists.hibp.fetchedAt, brokersAsOf: lists.brokers && lists.brokers.fetchedAt } : null;
          return out;
        }
      } catch (e) { /* fall through to sample */ }
    }
    return enrich(SAMPLE_DATA);
  }

  // Section 1260H companies (shared/flagged-companies.json, hand-checked by Max). Marks trackers whose company is listed.
  let FLAGGED = null;
  async function flaggedFile() {
    if (FLAGGED) return FLAGGED;
    try { FLAGGED = await fetch(chrome.runtime.getURL("shared/flagged-companies.json")).then(r => r.json()); } catch (e) { FLAGGED = null; }
    return FLAGGED;
  }
  function annotateListed(data, file) {
    const list = (file && file.companies) || [];
    for (const s of (data && data.sites) || []) for (const t of s.trackers || []) {
      const hit = list.find(c => c.atlasCompany.toLowerCase() === String(t.company || "").toLowerCase());
      t.listed = hit ? { list: "Section 1260H", date: file.listDate, contested: /sued|contest/i.test(hit.note || "") } : null;
    }
    return data;
  }

  function enrich(data) {
    const sites = data.sites.map(s => Object.assign({}, s, computeScore(s)));
    return { sample: !!data.sample, sites };
  }

  // Domain of the tab the user is looking at (popup only). Falls back to the first site.
  async function currentDomain() {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) return new URL(tab.url).hostname.replace(/^www\./, "");
        // Chrome can hide the address; the background knows which site that tab is on.
        if (tab && tab.id != null && chrome.runtime && chrome.runtime.sendMessage) {
          const r = await chrome.runtime.sendMessage({ type: "privac-tab-site", tabId: tab.id });
          if (r && r.domain) return r.domain;
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  async function clearAll() {
    if (hasChrome()) await chrome.storage.local.remove(["privacData", "privacStats"]);   // history and daily counts
  }

  window.PrivaCData = { countryOfAddress, annotateListed, load, currentDomain, clearAll, computeScore, gradeFor, GRADE_WORDS, FOREIGN_ADVERSARIES };
})();
