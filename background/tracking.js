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

let ATLAS = null, COOKIE_DB = null;
let OWNER_OF = {};          // "yandex.ru" -> "Yandex" (from Tracker Radar entities)
let COUNTRY_OF = {};        // "Yandex" -> "RU" (from atlas.json)
function setAtlas(a) {
  ATLAS = a;
  OWNER_OF = {}; COUNTRY_OF = {};
  for (const [co, props] of Object.entries(a.entities || {})) for (const d of props) if (!OWNER_OF[d]) OWNER_OF[d] = co;
  for (const v of Object.values(a.domains || {})) if (v[2] && !COUNTRY_OF[v[0]]) COUNTRY_OF[v[0]] = v[2];
}
function setCookieDb(d) { COOKIE_DB = d; }

// The Atlas loads a moment after Chrome wakes the background script. Requests that arrive
// before that wait for it, so they're never judged with the short fallback list.
let atlasReady = Promise.resolve();
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
  atlasReady = fetch(chrome.runtime.getURL("shared/atlas.json")).then(r => r.json()).then(setAtlas)
    .catch(e => console.warn("PrivaC: atlas.json didn't load, using the short fallback list", e));
  fetch(chrome.runtime.getURL("shared/cookie-db.json")).then(r => r.json()).then(setCookieDb)
    .catch(e => console.warn("PrivaC: cookie-db.json didn't load", e));
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
      if (hit) return { domain: d, company: hit[0], category: hit[1], country: hit[2], fingerprinting: hit[4] || 0 };
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

// Which company owns this site, and where it's based (when known).
function ownerOf(siteDomain) {
  for (const r of siteRoots(siteDomain)) {
    const co = OWNER_OF[r];
    if (co) return { company: co, country: COUNTRY_OF[co] || null };
  }
  return null;
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
        cookies: old.cookies || site.cookies,
        owner: site.owner || old.owner || null,
        foreignHosts: [...new Set([...(old.foreignHosts || []), ...(site.foreignHosts || [])])],
        policy: old.policy && old.policy.source ? old.policy : site.policy
      };
    }
    await chrome.storage.local.set({ privacData: data });
  }).catch(e => console.warn("PrivaC: could not save site", e));
  return saveChain;
}

// Cookie inventory: list the cookies the site and its trackers keep in this browser.
// Only name, owner domain and lifetime are kept; values are dropped right here and never stored.
async function inventoryCookies(domain) {
  if (!(chrome.cookies && chrome.cookies.getAll) || typeof PrivaCCookies === "undefined") return;
  const site = [...tabSites.values()].find(s => s.domain === domain);
  const roots = siteRoots(domain);
  const lookIn = new Set([roots[roots.length - 1] || domain, ...((site && site.trackers) || []).map(t => t.domain)]);
  const found = new Map();
  for (const d of lookIn) {
    let list = [];
    try { list = await chrome.cookies.getAll({ domain: d }); } catch (e) { continue; }
    for (const c of list) {
      const item = PrivaCCookies.describe(c, domain, COOKIE_DB);
      found.set(item.name + "@" + item.domain, item);
    }
  }
  const cookies = [...found.values()].slice(0, 80);
  saveChain = saveChain.then(async () => {
    const res = await chrome.storage.local.get("privacData");
    const s = res.privacData && Array.isArray(res.privacData.sites) && res.privacData.sites.find(x => x.domain === domain);
    if (!s) return;
    s.cookies = cookies;
    await chrome.storage.local.set({ privacData: res.privacData });
  }).catch(e => console.warn("PrivaC: could not save cookies", e));
  return saveChain;
}

if (chrome.webNavigation.onCompleted) {
  chrome.webNavigation.onCompleted.addListener(details => {
    if (details.frameId !== 0) return;
    const domain = cleanDomain(details.url);
    if (!domain) return;
    // Trackers set cookies a few seconds after the page loads, so look twice.
    setTimeout(() => inventoryCookies(domain), 4000);
    setTimeout(() => inventoryCookies(domain), 15000);
  });
}

// Cookie choices reported by content/cookie-detector.js.
// A real choice (declined / accepted) beats "no-reject"; nothing beats a real choice except a newer one.
function updateCookieChoice(domain, choice) {
  if (!["declined", "accepted", "no-reject"].includes(choice)) return Promise.resolve();
  saveChain = saveChain.then(async () => {
    const res = await chrome.storage.local.get("privacData");
    const data = res.privacData;
    const site = data && Array.isArray(data.sites) && data.sites.find(s => s.domain === domain);
    if (!site) return;
    if (choice === "no-reject" && (site.cookieChoice === "declined" || site.cookieChoice === "accepted")) return;
    site.cookieChoice = choice;
    for (const s of tabSites.values()) if (s.domain === domain) s.cookieChoice = choice;
    await chrome.storage.local.set({ privacData: data });
  }).catch(e => console.warn("PrivaC: could not save cookie choice", e));
  return saveChain;
}

// Chrome pauses the background script when idle and forgets tabSites. Keep a copy in
// session storage (cleared when Chrome closes) and restore it when the script wakes up.
let tabsReady = Promise.resolve();
if (chrome.storage.session) {
  tabsReady = chrome.storage.session.get("privacTabs").then(r => {
    for (const [id, site] of Object.entries((r && r.privacTabs) || {})) if (!tabSites.has(Number(id))) tabSites.set(Number(id), site);
  }).catch(() => {});
}
let tabsTimer = null;
function rememberTabs() {
  if (!chrome.storage.session) return;
  clearTimeout(tabsTimer);
  tabsTimer = setTimeout(() => chrome.storage.session.set({ privacTabs: Object.fromEntries(tabSites) }).catch(() => {}), 300);
}

// Background preloads (Google prerenders search results) are not visits.
function isBackgroundPage(details) {
  return details.documentLifecycle && details.documentLifecycle !== "active";
}

// Start a fresh record when a tab navigates to a new website.
chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId !== 0 || isBackgroundPage(details)) return;

  const domain = cleanDomain(details.url);
  if (!domain) return;

  const site = {
    domain,
    lastVisit: new Date().toISOString(),
    cookieChoice: "none",
    policy: { sells: null, shares: null, source: null },
    trackers: []
  };
  tabSites.set(details.tabId, site);
  rememberTabs();
  atlasReady.then(() => {
    site.owner = ownerOf(domain);
    saveSite(site);
    if (typeof PrivaCAlerts !== "undefined") PrivaCAlerts.check(details.tabId, site);
  });
});

function handleRequest(details, site) {
  const hostname = cleanDomain(details.url);
  if (!hostname) return;

  const tracker = matchingTracker(hostname);
  if (!tracker) return rememberForeignHost(site, hostname);

  // Don't count a site's own requests (or its owner's) as third-party tracking.
  if (isFirstParty(site.domain, hostname, tracker)) return;

  if (!site.trackers.some(t => t.domain === tracker.domain)) {
    site.trackers.push(tracker);
    site.lastVisit = new Date().toISOString();
    rememberTabs();
    saveSite(site);
    if (typeof PrivaCAlerts !== "undefined") PrivaCAlerts.check(details.tabId, site);
  }
}

// F1: an outside server not in the Atlas whose address ends in a listed country's code (cip.cu, tns-counter.ru).
// Only its main name is kept (never the full address); it's shown on the grade with 0 points.
function rememberForeignHost(site, hostname) {
  if (typeof PrivaCData === "undefined" || !PrivaCData.countryOfAddress(hostname)) return;
  if (isFirstParty(site.domain, hostname, null)) return;
  const roots = siteRoots(hostname);
  const name = roots[roots.length - 1] || hostname;
  site.foreignHosts = site.foreignHosts || [];
  if (site.foreignHosts.includes(name) || site.foreignHosts.length >= 20) return;
  site.foreignHosts.push(name);
  rememberTabs();
  saveSite(site);
}

// Detect requests to known tracking domains.
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId < 0 || isBackgroundPage(details)) return;
    const site = tabSites.get(details.tabId);
    if (site && ATLAS) return handleRequest(details, site);
    // Not ready yet (just woke up): wait for the Atlas and the restored tabs, then judge it.
    Promise.all([atlasReady, tabsReady]).then(() => {
      const s = site || tabSites.get(details.tabId);
      if (s) handleRequest(details, s);
    });
  },
  { urls: ["<all_urls>"] }
);

// "Clear my PrivaC data" removes privacData: forget the open tabs too, so nothing comes back.
if (chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.privacData && !changes.privacData.newValue) { tabSites.clear(); rememberTabs(); }
  });
}

// Clean up closed tabs.
chrome.tabs.onRemoved.addListener(tabId => {
  tabSites.delete(tabId);
  rememberTabs();
});
