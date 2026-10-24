// PrivaC tracker recorder (by Matthew). Loaded by /background.js.
// Tracker list: shared/atlas.json (3,700+ domains from DuckDuckGo Tracker Radar, built by scripts/build-atlas.js).
// TRACKERS below is only a fallback if the Atlas can't load.
const RETENTION_DAYS = 7; // visit history older than this is deleted automatically

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

let ATLAS = null;
function setAtlas(a) { ATLAS = a; }
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
  fetch(chrome.runtime.getURL("shared/atlas.json")).then(r => r.json()).then(setAtlas)
    .catch(e => console.warn("PrivaC: atlas.json didn't load, using the short fallback list", e));
}

// "a.b.example.com" -> ["a.b.example.com", "b.example.com", "example.com"]
function suffixes(hostname) {
  const parts = hostname.split(".");
  const out = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join("."));
  return out;
}

function matchingTracker(hostname) {
  if (ATLAS) {
    for (const d of suffixes(hostname)) {
      const hit = ATLAS.domains[d];
      if (hit) return { domain: d, company: hit[0], category: hit[1], country: hit[2] };
    }
    return null;
  }
  return TRACKERS.find(t =>
    hostname === t.domain || hostname.endsWith("." + t.domain)
  );
}

// Site roots worth comparing: "news.bbc.co.uk" -> ["news.bbc.co.uk", "bbc.co.uk"] (never "co.uk" or "com").
function siteRoots(domain) {
  return suffixes(domain).filter(r => {
    const p = r.split(".");
    if (p.length < 2) return false;
    if (p.length === 2 && /^(co|com|org|net|ac|gov|edu)$/.test(p[0]) && p[1].length === 2) return false;
    return true;
  });
}

// True when the request goes to the site itself or to the company that owns the site
// (google.com loading doubleclick.net is Google talking to Google, not a third party).
function isFirstParty(siteDomain, hostname, tracker) {
  const roots = siteRoots(siteDomain);
  if (roots.some(r => hostname === r || hostname.endsWith("." + r))) return true;
  const owned = ATLAS && tracker && ATLAS.entities[tracker.company];
  return !!(owned && roots.some(r => owned.includes(r)));
}

// Only real web pages count as visits (not the new-tab page, settings, or extension pages).
function cleanDomain(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null; // localhost, intranet names
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isFresh(site, now = Date.now()) {
  return !site.lastVisit || now - Date.parse(site.lastVisit) < RETENTION_DAYS * 86400000;
}

// Save one site into privacData, keeping other sites (history) and anything
// another part of PrivaC already learned (cookie choice, policy answers).
let saveChain = Promise.resolve();
function saveSite(site) {
  saveChain = saveChain.then(async () => {
    const res = await chrome.storage.local.get("privacData");
    const data = (res.privacData && Array.isArray(res.privacData.sites)) ? res.privacData : { sites: [] };
    data.sample = false;
    data.sites = data.sites.filter(s => isFresh(s));   // auto-delete old history
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

    // Don't count a site's own requests (or its owner's) as third-party tracking.
    if (isFirstParty(site.domain, hostname, tracker)) return;

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
