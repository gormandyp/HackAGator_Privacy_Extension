/*
  PrivaC impact + safety counters (for the dashboard's "What C did for you" and day / week / month views).
  Stored in chrome.storage.local as "privacStats":
    { days: { "2026-10-24": { events: { "popup-cookie": 3, ... }, snapshot: { sites, grades, trackers, ... } } } }
  Numbers only, never site names, kept 90 days (repo owner, 2026-10-24). Site history itself is still deleted after 7 days.
*/
(function () {
  const KEEP_DAYS = 90;
  // C's pop-ups and clicks (content/c-events.js).
  const EVENTS = ["popup-cookie", "popup-accept-only", "popup-adversary", "decline-click", "decline-confirmed",
                  "choose-click", "rejected-on-site", "accepted-on-site"];
  const POPUPS = ["popup-cookie", "popup-accept-only", "popup-adversary"];
  const RANGE_DAYS = { day: 1, week: 7, month: 30 };

  const pad = (n) => String(n).padStart(2, "0");
  // The person's own calendar day (local time), so "today" matches their clock.
  function dayKey(t = Date.now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function prune(st, now) {
    const oldest = dayKey(now - (KEEP_DAYS - 1) * 86400000);
    for (const k of Object.keys(st.days)) if (k < oldest) delete st.days[k];
    return st;
  }

  function dayOf(st, now) {
    const k = dayKey(now);
    return st.days[k] = st.days[k] || { events: {} };
  }

  // counts: { "popup-cookie": 2, ... } (batched by the background)
  function addEvents(st, counts, now = Date.now()) {
    st = st && st.days ? st : { days: {} };
    const d = dayOf(st, now);
    for (const [name, n] of Object.entries(counts || {})) {
      if (!EVENTS.includes(name) || !(n > 0)) continue;
      d.events[name] = (d.events[name] || 0) + n;
    }
    return prune(st, now);
  }

  // Numbers for today from scored sites (PrivaCData.load() output). Only sites visited today count.
  function snapshot(sites, now = Date.now()) {
    const today = dayKey(now);
    const s = { sites: 0, grades: { A: 0, B: 0, C: 0, D: 0, F: 0 }, unsafeSites: 0, flaggedSites: 0, breachedSites: 0,
                trackers: 0, adTrackers: 0, cookies: 0, trackingCookies: 0, declined: 0, accepted: 0, noReject: 0, neverAsked: 0 };
    for (const site of sites || []) {
      if (!site.lastVisit || dayKey(Date.parse(site.lastVisit)) !== today) continue;
      s.sites++;
      if (s.grades[site.grade] !== undefined) s.grades[site.grade]++;
      if (site.grade === "F") s.unsafeSites++;
      if ((site.flagged && site.flagged.length) || site.ownerFlag || site.addressFlag || site.serverFlag) s.flaggedSites++;
      if (site.breach) s.breachedSites++;
      const t = site.trackers || [];
      s.trackers += t.length;
      s.adTrackers += t.filter(x => ["Advertising", "Data broker", "Session recording"].includes(x.category) || x.broker).length;
      const c = site.cookies || [];
      s.cookies += c.length;
      s.trackingCookies += c.filter(x => x.category === "Marketing" || x.category === "Analytics").length;
      if (site.cookieChoice === "declined") s.declined++;
      else if (site.cookieChoice === "accepted") s.accepted++;
      else if (site.cookieChoice === "no-reject") s.noReject++;
      else if (t.length) s.neverAsked++;
    }
    return s;
  }

  function setSnapshot(st, snap, now = Date.now()) {
    st = st && st.days ? st : { days: {} };
    dayOf(st, now).snapshot = snap;
    return prune(st, now);
  }

  // range: "day" | "week" | "month". days: oldest first, one entry per calendar day (empty days included).
  function summary(st, range = "week", now = Date.now()) {
    const n = RANGE_DAYS[range] || 7;
    const days = [];
    const totals = { events: {}, popups: 0, sites: 0, grades: { A: 0, B: 0, C: 0, D: 0, F: 0 } };
    for (let i = n - 1; i >= 0; i--) {
      const key = dayKey(now - i * 86400000);
      const d = (st && st.days && st.days[key]) || { events: {} };
      const popups = POPUPS.reduce((sum, p) => sum + (d.events[p] || 0), 0);
      days.push({ day: key, events: d.events, popups, snapshot: d.snapshot || null });
      totals.popups += popups;
      for (const [k, v] of Object.entries(d.events)) totals.events[k] = (totals.events[k] || 0) + v;
      for (const [k, v] of Object.entries(d.snapshot || {})) {
        if (k === "grades") for (const g of Object.keys(totals.grades)) totals.grades[g] += v[g] || 0;
        else totals[k] = (totals[k] || 0) + v;
      }
    }
    return { range, from: days[0].day, to: days[days.length - 1].day, days, totals };
  }

  const root = typeof window !== "undefined" ? window : self;
  root.PrivaCStats = { addEvents, snapshot, setSnapshot, summary, dayKey, EVENTS, POPUPS, KEEP_DAYS };
})();
