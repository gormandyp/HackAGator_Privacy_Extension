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

    const adCount = t.filter(x => AD_CATEGORIES.includes(x.category)).length;
    const adPts = Math.min(20, adCount * 5);
    parts.push({ label: `${adCount} used for advertising, data brokering or recording your screen`, points: adPts, kind: "observed" });

    // Only what PrivaC actually saw costs points. No banner on the page = nothing to judge = 0.
    const COOKIE = {
      accepted:    [10, "All cookies accepted"],
      "no-reject": [10, "Cookie banner had no Reject button"],
      declined:    [0,  "Non-essential cookies declined"],
      none:        [0,  "No cookie banner seen"]
    };
    const [cookiePts, cookieLabel] = COOKIE[site.cookieChoice] || COOKIE.none;
    parts.push({ label: cookieLabel, points: cookiePts, kind: "observed" });

    const flagged = t.filter(x => FOREIGN_ADVERSARIES[x.country]);
    const flagPts = flagged.length ? 15 : 0;
    parts.push({ label: flagged.length ? `Link to a company in a listed foreign-adversary country` : "No foreign-adversary links", points: flagPts, kind: "observed" });

    const p = site.policy || {};
    let policyPts = 0, policyLabel = "Privacy policy not checked yet";
    if (p.sells === true) { policyPts = 15; policyLabel = "Policy says it sells personal information"; }
    else if (p.shares === true) { policyPts = 8; policyLabel = "Policy says it shares information with partners"; }
    else if (p.sells === false && p.shares === false) { policyPts = 0; policyLabel = "Policy says it doesn't sell or share"; }
    parts.push({ label: policyLabel, points: policyPts, kind: "disclosed" });

    // The site's own data breaches, from Have I Been Pwned. A recent one matters most.
    const b = site.breach;
    if (b && (b.addedDate || b.breachDate)) {
      const when = Date.parse(b.addedDate || b.breachDate);
      const recent = now - when < 365 * 86400000;
      const year = String(b.breachDate || b.addedDate).slice(0, 4);
      parts.push({ label: recent ? `Data breach reported in the last year (${b.name}, ${year})` : `Past data breach on record (${b.name}, ${year})`,
                   points: recent ? 15 : 5, kind: "breach" });
    } else {
      parts.push({ label: "No known data breaches", points: 0, kind: "breach" });
    }

    const score = Math.min(100, parts.reduce((s, x) => s + x.points, 0));
    return { score, grade: gradeFor(score), parts, flagged };
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
        const res = await chrome.storage.local.get("privacData");
        if (res && res.privacData && res.privacData.sites && res.privacData.sites.length) {
          return enrich(res.privacData);
        }
      } catch (e) { /* fall through to sample */ }
    }
    return enrich(SAMPLE_DATA);
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
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  async function clearAll() {
    if (hasChrome()) await chrome.storage.local.remove("privacData");
  }

  window.PrivaCData = { load, currentDomain, clearAll, computeScore, gradeFor, GRADE_WORDS, FOREIGN_ADVERSARIES };
})();
