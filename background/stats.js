// PrivaC impact + safety counters (shared/stats.js). Loaded by /background.js after tracking.js.
// - C's pop-ups and clicks arrive from content/c-events.js and are written in batches (one write per second at most).
// - Today's numbers (grades, trackers, cookies, unsafe sites) are recomputed a few seconds after privacData changes.
(function () {
  let pending = {};
  let timer = null;
  let chain = Promise.resolve();

  function flushStats() {
    clearTimeout(timer); timer = null;
    const counts = pending; pending = {};
    if (!Object.keys(counts).length) return chain;
    chain = chain.then(async () => {
      const r = await chrome.storage.local.get("privacStats");
      await chrome.storage.local.set({ privacStats: PrivaCStats.addEvents(r.privacStats, counts) });
    }).catch(e => console.warn("PrivaC: could not save counters", e));
    return chain;
  }

  function count(name) {
    if (!PrivaCStats.EVENTS.includes(name)) return;
    pending[name] = (pending[name] || 0) + 1;
    if (!timer) timer = setTimeout(flushStats, 1000);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "privac-event") count(msg.event);
  });

  // Today's snapshot, from the same scored sites the popup and dashboard show.
  let snapTimer = null;
  function snapshotSoon() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      chain = chain.then(async () => {
        if (typeof PrivaCData === "undefined" || !PrivaCData.load) return;
        const data = await PrivaCData.load();
        if (!data || data.sample) return;
        const r = await chrome.storage.local.get("privacStats");
        await chrome.storage.local.set({ privacStats: PrivaCStats.setSnapshot(r.privacStats, PrivaCStats.snapshot(data.sites.filter((s) => !s.example))) });
      }).catch(e => console.warn("PrivaC: could not save today's numbers", e));
    }, 5000);
  }
  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.privacData && changes.privacData.newValue) snapshotSoon();
    });
  }

  self.flushStats = flushStats;
})();
