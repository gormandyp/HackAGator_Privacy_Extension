/*
  PrivaC cookie inventory: what each cookie on a site is for, using the Open Cookie Database (shared/cookie-db.json).
  We keep only a cookie's NAME, which site set it, and how long it lasts. Cookie VALUES are never read into storage.
*/
(function () {
  // Open Cookie Database category -> plain words, and whether the site needs it to work.
  const KIND = {
    Functional:      { label: "needed for the site to work", needed: true },
    Necessary:       { label: "needed for the site to work", needed: true },
    Security:        { label: "security", needed: true },
    Personalization: { label: "remembers your settings", needed: false },
    Analytics:       { label: "measures your visits", needed: false },
    Marketing:       { label: "advertising and profiling", needed: false }
  };

  function lookup(name, db) {
    if (!db) return null;
    const v = db.exact[name] || (db.prefix.find(p => name.startsWith(p[0])) || []).slice(1);
    return v && v.length ? { platform: v[0], category: v[1], purpose: v[2], retention: v[3], company: v[4] } : null;
  }

  // chrome.cookies.Cookie -> what we store (no value).
  function describe(c, siteDomain, db, now = Date.now()) {
    const domain = String(c.domain || "").replace(/^\./, "");
    const info = lookup(c.name, db);
    const days = c.session || !c.expirationDate ? 0 : Math.max(0, Math.round((c.expirationDate * 1000 - now) / 86400000));
    return {
      name: c.name, domain,
      firstParty: domain === siteDomain || siteDomain.endsWith("." + domain) || domain.endsWith("." + siteDomain),
      category: info ? info.category : "Unknown",
      company: info ? info.company || info.platform : null,
      purpose: info ? info.purpose : null,
      days
    };
  }

  function summarize(cookies) {
    const by = {};
    for (const c of cookies || []) (by[c.category] = by[c.category] || []).push(c);
    const unneeded = (cookies || []).filter(c => KIND[c.category] && !KIND[c.category].needed);
    return { total: (cookies || []).length, byCategory: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])),
             marketing: by.Marketing || [], analytics: by.Analytics || [], unneededCount: unneeded.length,
             unknown: (by.Unknown || []).length };
  }

  function lifetime(days) { return !days ? "until you close the browser" : days >= 365 ? `${Math.round(days / 365)} year${days >= 730 ? "s" : ""}` : days >= 30 ? `${Math.round(days / 30)} months` : `${days} days`; }

  (typeof window !== "undefined" ? window : self).PrivaCCookies = { lookup, describe, summarize, lifetime, KIND };
})();
