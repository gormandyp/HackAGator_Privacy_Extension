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
      (byDomain[d] = byDomain[d] || []).push(item);
    }
    // Newest breach per site, with the site's earlier breaches (up to 5) under "earlier" so all can be listed.
    for (const d of Object.keys(byDomain)) {
      const [newest, ...rest] = byDomain[d].sort((a, b) => (a.addedDate < b.addedDate ? 1 : -1));
      if (rest.length) newest.earlier = rest.slice(0, 5).map(({ name, title, breachDate, addedDate, pwnCount }) => ({ name, title, breachDate, addedDate, pwnCount }));
      byDomain[d] = newest;
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
  // Company names repeat on almost every site (Google, Meta...), so each cleaned name is remembered.
  const NORMED = new Map();
  function norm(s) {
    const key = String(s || "");
    let v = NORMED.get(key);
    if (v === undefined) {
      v = key.toLowerCase().replace(/&/g, " and ").replace(SUFFIX, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      if (NORMED.size > 20000) NORMED.clear();
      NORMED.set(key, v);
    }
    return v;
  }

  function suffixes(host) {
    const p = String(host || "").split("."); const out = [];
    for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i).join("."));
    return out;
  }

  // Speed: the registry (~560 entries) is indexed once each time the lists are loaded (about 1 ms) instead of
  // being scanned (with name clean-up) for every tracker on every site each time a page opens.
  // index.site / index.name / index.lead map a website, a cleaned name, or a cleaned name's first word(s)
  // to the FIRST registry entry (list order) that has it, so answers match the one-by-one scan exactly.
  const INDEXES = new WeakMap();
  function brokerIndex(list) {
    let ix = INDEXES.get(list);
    if (ix && ix.n === list.length) return ix;
    ix = { n: list.length, site: new Map(), name: new Map(), lead: new Map() };
    const first = (map, key, i) => { if (!map.has(key)) map.set(key, i); };
    list.forEach((b, i) => {
      if (b.site) first(ix.site, b.site, i);
      for (const n of [b.name, b.dba]) {
        const x = norm(n);
        if (!x) continue;
        first(ix.name, x, i);
        for (let k = x.indexOf(" "); k > 0; k = x.indexOf(" ", k + 1)) first(ix.lead, x.slice(0, k), i);   // "liveramp holdings" -> "liveramp"
      }
    });
    INDEXES.set(list, ix);
    return ix;
  }

  // Is this tracker's company a registered California data broker? Returns the registry entry or null.
  // First match in registry order wins: same website (tracker domain, its parents, or the company's own domains),
  // same cleaned name, or the registry name starts with the company's name (5+ letters, whole words).
  function brokerFor(company, trackerDomain, lists, ownedDomains) {
    const list = lists && lists.brokers && lists.brokers.list;
    if (!list || !company) return null;
    const ix = brokerIndex(list);
    const c = norm(company);
    let best = Infinity;
    const take = (i) => { if (i !== undefined && i < best) best = i; };
    for (const d of ownedDomains || []) take(ix.site.get(d));
    for (const d of suffixes(trackerDomain)) take(ix.site.get(d));
    if (c) take(ix.name.get(c));
    if (c.length >= 5) take(ix.lead.get(c));
    return best === Infinity ? null : list[best];
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
