// PrivaC foreign-adversary alerts (PLAN R4). Loaded by /background.js after tracking.js.
// When a page loads a tracker from a company based in a 15 CFR 7.4 country or on the Section 1260H list,
// or the site itself belongs to such a company, tell that tab so C can show Matthew's adversary pop-up.
// Shown once per site per browser session.
(function () {
  let FLAGGED = null;
  const ready = fetch(chrome.runtime.getURL("shared/flagged-companies.json")).then(r => r.json())
    .then(f => { FLAGGED = f; }).catch(() => {});
  const shownThisSession = new Set();   // domains already alerted (mirrored to session storage)
  const restored = chrome.storage.session
    ? chrome.storage.session.get("privacAlerted").then(r => { for (const d of (r && r.privacAlerted) || []) shownThisSession.add(d); }).catch(() => {})
    : Promise.resolve();

  const COUNTRY = () => (self.PrivaCData && PrivaCData.FOREIGN_ADVERSARIES) || {};

  function listedEntry(company) {
    const list = (FLAGGED && FLAGGED.companies) || [];
    return list.find(c => c.atlasCompany.toLowerCase() === String(company || "").toLowerCase()) || null;
  }

  // "Baidu (China; on the Pentagon's Section 1260H list, June 2026)" — names the list and date (Honesty rules).
  function describe(company, country) {
    const where = COUNTRY()[country];
    const e = listedEntry(company);
    const bits = [];
    if (where) bits.push(where);
    if (e) bits.push("on the Pentagon's Section 1260H list, June 2026" + (/sued|contest/i.test(e.note || "") ? ", which it is contesting in court" : ""));
    return bits.length ? `${company} (${bits.join("; ")})` : null;
  }

  function companiesFor(site) {
    const out = new Map();
    for (const t of site.trackers || []) {
      const d = describe(t.company, t.country);
      if (d) out.set(t.company, d);
    }
    if (site.owner) {
      let d = describe(site.owner.company, site.owner.country);
      if (d && site.owner.stateMedia) d = d.replace(/\)$/, "; state-run media)");   // F2
      if (d) out.set(site.owner.company, d);
    }
    return [...out.values()];
  }

  async function check(tabId, site) {
    await Promise.all([ready, restored]);
    const companies = companiesFor(site);
    if (!companies.length || shownThisSession.has(site.domain)) return;
    try {
      await chrome.tabs.sendMessage(tabId, { type: "privac-adversary", domain: site.domain, companies });
      shownThisSession.add(site.domain);
      if (chrome.storage.session) chrome.storage.session.set({ privacAlerted: [...shownThisSession] }).catch(() => {});
    } catch (e) { /* page not ready yet; content/alerts.js asks again when it loads */ }
  }

  // content/alerts.js asks on load, in case the message above arrived before it was listening.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "privac-get-adversary" || !sender.tab) return;
    const site = tabSites.get(sender.tab.id);
    if (site) check(sender.tab.id, site);
  });

  self.PrivaCAlerts = { check, companiesFor, describe };
})();
