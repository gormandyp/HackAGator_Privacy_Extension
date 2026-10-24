/*
  PrivaC public lists: data breaches (Have I Been Pwned) and registered data brokers (California CPPA).

  Privacy rule: we download each WHOLE list (the same file for every user) and match on this computer.
  We never send a site or company name to these services.

  Stored in chrome.storage.local.privacLists:
    { hibp:    { fetchedAt, byDomain: { "wired.com": { name, title, breachDate, addedDate, pwnCount, dataClasses } } },
      brokers: { fetchedAt, list: [ { name, dba, site } ] } }
*/
(function () {
  const HIBP_URL = "https://haveibeenpwned.com/api/v3/breaches";
  const BROKER_URL = "https://cppa.ca.gov/data_broker_registry/registry.csv";
  const MAX_AGE_MS = 24 * 3600 * 1000;

  // ---------- parsing (pure) ----------
  function compactBreaches(all) {
    const byDomain = {};
    for (const b of all || []) {
      if (!b.Domain || b.IsFabricated || b.IsSpamList || b.IsRetired) continue;
      const d = b.Domain.toLowerCase().replace(/^www\./, "");
      const item = { name: b.Name, title: b.Title, breachDate: b.BreachDate, addedDate: (b.AddedDate || "").slice(0, 10),
                     pwnCount: b.PwnCount, dataClasses: (b.DataClasses || []).slice(0, 6) };
      if (!byDomain[d] || item.addedDate > byDomain[d].addedDate) byDomain[d] = item;
    }
    return byDomain;
  }

  function parseCsv(text) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (c !== "\r") f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  function hostOf(url) {
    try { return new URL(/^https?:/i.test(url) ? url : "https://" + url).hostname.toLowerCase().replace(/^www\./, ""); }
    catch (e) { return null; }
  }

  function compactBrokers(csv) {
    return parseCsv(csv).slice(1).filter(r => r[0] && r[0].trim())
      .map(r => ({ name: r[0].trim(), dba: (r[1] || "").trim(), site: hostOf((r[2] || "").trim()) }));
  }

  // ---------- matching (pure) ----------
  const SUFFIX = /\b(inc|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|plc|sa|ag|gmbh|bv|holdings?|group|the)\b\.?/g;
  function norm(s) { return String(s || "").toLowerCase().replace(/&/g, " and ").replace(SUFFIX, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }

  function suffixes(host) {
    const p = String(host || "").split("."); const out = [];
    for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i).join("."));
    return out;
  }

  // Is this tracker's company a registered California data broker? Returns the registry entry or null.
  function brokerFor(company, trackerDomain, lists, ownedDomains) {
    const list = lists && lists.brokers && lists.brokers.list;
    if (!list || !company) return null;
    const c = norm(company);
    const domains = new Set([...(ownedDomains || []), ...suffixes(trackerDomain)]);
    for (const b of list) {
      if (b.site && domains.has(b.site)) return b;
      for (const n of [b.name, b.dba]) {
        const x = norm(n);
        if (!x) continue;
        if (x === c || (c.length >= 5 && x.startsWith(c + " "))) return b;
      }
    }
    return null;
  }

  // The site's own most recent breach, matching the site or any parent domain.
  function breachFor(siteDomain, lists) {
    const by = lists && lists.hibp && lists.hibp.byDomain;
    if (!by) return null;
    for (const d of suffixes(siteDomain)) if (by[d]) return by[d];
    return null;
  }

  // Add breach + broker info to saved sites (doesn't change what was observed).
  function annotate(data, lists, atlas) {
    if (!data || !lists) return data;
    for (const s of data.sites || []) {
      if (!s.breach) s.breach = breachFor(s.domain, lists);
      for (const t of s.trackers || []) {
        const owned = atlas && atlas.entities && atlas.entities[t.company];
        const b = brokerFor(t.company, t.domain, lists, owned);
        t.broker = b ? b.name : null;
      }
    }
    return data;
  }

  // ---------- downloading (extension only) ----------
  async function refresh(opts = {}) {
    const fetchFn = opts.fetch || fetch;
    const store = opts.storage || chrome.storage.local;
    const now = opts.now || Date.now();
    const cur = (await store.get("privacLists")).privacLists || {};
    const next = { ...cur };
    const stale = (x) => opts.force || !x || !x.fetchedAt || now - Date.parse(x.fetchedAt) > MAX_AGE_MS;
    const stamp = new Date(now).toISOString();
    if (stale(cur.hibp)) {
      try {
        const r = await fetchFn(HIBP_URL, { headers: { Accept: "application/json" } });
        if (r.ok) next.hibp = { fetchedAt: stamp, byDomain: compactBreaches(await r.json()) };
      } catch (e) { console.warn("PrivaC: breach list refresh failed; keeping the last copy", e); }
    }
    if (stale(cur.brokers)) {
      try {
        const r = await fetchFn(BROKER_URL);
        if (r.ok) next.brokers = { fetchedAt: stamp, list: compactBrokers(await r.text()) };
      } catch (e) { console.warn("PrivaC: broker list refresh failed; keeping the last copy", e); }
    }
    await store.set({ privacLists: next });
    return next;
  }

  async function load() {
    try { return (await chrome.storage.local.get("privacLists")).privacLists || null; } catch (e) { return null; }
  }

  (typeof window !== "undefined" ? window : self).PrivaCLists = {
    refresh, load, annotate, breachFor, brokerFor, compactBreaches, compactBrokers, parseCsv, norm, HIBP_URL, BROKER_URL
  };
})();
