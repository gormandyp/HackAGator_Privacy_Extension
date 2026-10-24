// PrivaC tracker recorder (by Matthew). Loaded by /background.js.
const TRACKERS = [
  { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" },
  { domain: "google-analytics.com", company: "Google", category: "Analytics", country: "US" },
  { domain: "googletagmanager.com", company: "Google", category: "Analytics", country: "US" },
  { domain: "connect.facebook.net", company: "Meta", category: "Advertising", country: "US" },
  { domain: "facebook.net", company: "Meta", category: "Advertising", country: "US" },
  { domain: "amazon-adsystem.com", company: "Amazon", category: "Advertising", country: "US" },
  { domain: "criteo.com", company: "Criteo", category: "Advertising", country: "FR" },
  { domain: "scorecardresearch.com", company: "Comscore", category: "Analytics", country: "US" },
  { domain: "hotjar.com", company: "Hotjar", category: "Session recording", country: "MT" },
  { domain: "rlcdn.com", company: "LiveRamp", category: "Data broker", country: "US" },
  { domain: "ct.pinterest.com", company: "Pinterest", category: "Advertising", country: "US" },
  { domain: "mc.yandex.ru", company: "Yandex", category: "Analytics", country: "RU" },
  { domain: "hm.baidu.com", company: "Baidu", category: "Analytics", country: "CN" }
];

const tabSites = new Map(); // tabId -> site being visited (rebuilt as you browse)

function matchingTracker(hostname) {
  return TRACKERS.find(t =>
    hostname === t.domain || hostname.endsWith("." + t.domain)
  );
}

function cleanDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Save one site into privacData, keeping other sites (history) and anything
// another part of PrivaC already learned (cookie choice, policy answers).
let saveChain = Promise.resolve();
function saveSite(site) {
  saveChain = saveChain.then(async () => {
    const res = await chrome.storage.local.get("privacData");
    const data = (res.privacData && Array.isArray(res.privacData.sites)) ? res.privacData : { sites: [] };
    data.sample = false;
    const i = data.sites.findIndex(s => s.domain === site.domain);
    if (i === -1) { data.sites.push(site); }
    else {
      const old = data.sites[i];
      const trackers = [...old.trackers || []];
      for (const t of site.trackers) if (!trackers.some(x => x.domain === t.domain)) trackers.push(t);
      data.sites[i] = {
        ...old,
        lastVisit: site.lastVisit,
        trackers,
        cookieChoice: old.cookieChoice && old.cookieChoice !== "none" ? old.cookieChoice : site.cookieChoice,
        policy: old.policy && old.policy.source ? old.policy : site.policy
      };
    }
    await chrome.storage.local.set({ privacData: data });
  }).catch(e => console.warn("PrivaC: could not save site", e));
  return saveChain;
}

// Start a fresh record when a tab navigates to a new website.
chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId !== 0) return;

  const domain = cleanDomain(details.url);
  if (!domain) return;

  tabSites.set(details.tabId, {
    domain,
    lastVisit: new Date().toISOString(),
    cookieChoice: "none",
    policy: { sells: null, shares: null, source: null },
    trackers: []
  });

  saveSite(tabSites.get(details.tabId));
});

// Detect requests to known tracking domains.
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId < 0) return;

    const site = tabSites.get(details.tabId);
    if (!site) return;

    const hostname = cleanDomain(details.url);
    if (!hostname) return;

    const tracker = matchingTracker(hostname);
    if (!tracker) return;

    // Don't count a site's own requests as third-party tracking.
    if (
      hostname === site.domain ||
      hostname.endsWith("." + site.domain)
    ) return;

    if (!site.trackers.some(t => t.domain === tracker.domain)) {
      site.trackers.push(tracker);
      site.lastVisit = new Date().toISOString();
      saveSite(site);
    }
  },
  { urls: ["<all_urls>"] }
);

// Clean up closed tabs.
chrome.tabs.onRemoved.addListener(tabId => {
  tabSites.delete(tabId);
});
