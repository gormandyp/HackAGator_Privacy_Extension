// PrivaC privacy-policy reader (PLAN R3). Loaded by /background.js after tracking.js and shared/policy.js.
// content/policy-link.js sends the "Privacy" links it finds on a page you're visiting. For a site PrivaC has
// recorded, and at most once a week per site, this fetches the site's own policy page (without your cookies),
// asks Gemma the Knowledge Map questions on this computer, and saves the checked answers into site.policy.
// The score already reads policy.sells / policy.shares (shared/data.js).
(function () {
  const RECHECK_MS = 7 * 86400000;      // read each site's policy at most once a week
  const MAX_HTML = 2000000;             // ignore pages over ~2 MB

  let MAP = null;
  const mapReady = fetch(chrome.runtime.getURL("shared/knowledge-map.json")).then((r) => r.json())
    .then((m) => { MAP = m; }).catch((e) => console.warn("PrivaC: knowledge-map.json didn't load; policy reader off", e));

  const inFlight = new Set();
  let queue = Promise.resolve();        // one policy at a time, so Gemma isn't flooded
  let ownChain = Promise.resolve();

  // Save through tracking.js's save chain when it's loaded, so writes to privacData never overlap.
  function save(domain, policy) {
    const work = async () => {
      const res = await chrome.storage.local.get("privacData");
      const data = res.privacData;
      const site = data && Array.isArray(data.sites) && data.sites.find((s) => s.domain === domain);
      if (!site) return;
      site.policy = { ...(site.policy || {}), ...policy };
      await chrome.storage.local.set({ privacData: data });
    };
    if (typeof saveChain !== "undefined") {
      saveChain = saveChain.then(work).catch((e) => console.warn("PrivaC: could not save policy", e));
      return saveChain;
    }
    ownChain = ownChain.then(work).catch((e) => console.warn("PrivaC: could not save policy", e));
    return ownChain;
  }

  async function check(domain, links) {
    await mapReady;
    if (!MAP || inFlight.has(domain)) return;
    const res = await chrome.storage.local.get("privacData");
    const site = res.privacData && Array.isArray(res.privacData.sites) && res.privacData.sites.find((s) => s.domain === domain);
    if (!site) return;                                       // only sites PrivaC has recorded
    const p = site.policy || {};
    if (p.checkedAt && Date.now() - Date.parse(p.checkedAt) < RECHECK_MS) return;
    const url = PrivaCPolicy.pickPolicyLink(links, domain);  // same site only
    if (!url) return;

    inFlight.add(domain);
    try {
      const page = await fetch(url, { credentials: "omit", cache: "no-store", redirect: "follow" });
      if (!page.ok) return;
      const type = (page.headers && page.headers.get("content-type")) || "";
      if (!/html|text\/plain/i.test(type)) return;           // PDFs and the like are skipped
      const html = (await page.text()).slice(0, MAX_HTML);
      // "low": Ask C questions go first; a policy read pauses while C is answering someone.
      const policy = await PrivaCPolicy.readPolicy({ html, url }, MAP, (q, o) => PrivaCGemma.ask(q, { ...o, priority: "low" }));
      await save(domain, policy);
    } catch (e) {
      // Gemma off, network error, or not a policy page: save nothing, so the next visit tries again.
      console.warn(`PrivaC: couldn't read the privacy policy for ${domain}`, e && e.message);
    } finally {
      inFlight.delete(domain);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "privac-policy-links" || !msg.domain || !Array.isArray(msg.links)) return;
    const domain = String(msg.domain).replace(/^www\./, "");
    const links = msg.links.slice(0, 40);
    queue = queue.then(() => check(domain, links)).catch(() => {});
  });

  // For tests: resolves when queued policy reads (and their saves) are finished.
  (typeof self !== "undefined" ? self : window).PrivaCPolicyReader = { idle: () => queue.then(() => (typeof saveChain !== "undefined" ? saveChain : ownChain)) };
})();
