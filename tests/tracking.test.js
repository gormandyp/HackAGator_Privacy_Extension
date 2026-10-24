// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

// Load background/tracking.js with a fake Chrome so we can drive it.
function load(openTabs = [], frames = null) {
  let store = {}, writes = 0;
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const chrome = {
    storage: { local: {
      get: async (k) => ({ [k]: store[k] && JSON.parse(JSON.stringify(store[k])) }),
      set: async (o) => { writes++; Object.assign(store, JSON.parse(JSON.stringify(o))); }
    } },
    // frames (optional): what each tab shows right now, as Chrome's webNavigation.getFrame reports it.
    webNavigation: { onCommitted: on("nav"), ...(frames ? { getFrame: async ({ tabId }) => (frames[tabId] ? { url: frames[tabId] } : null) } : {}) },
    webRequest: { onBeforeRequest: on("req"), onResponseStarted: on("resp") },
    tabs: { onRemoved: on("closed"), query: async () => openTabs },
    runtime: { onMessage: on("msg") }
  };
  const ctx = { chrome, console, URL, Promise, setTimeout };
  ctx.window = ctx;   // shared/data.js (country web addresses, F1) loads first in the real extension too
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/data.js", "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/ipgeo.js", "utf8"), ctx);   // server location (F3)
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/tracking.js", "utf8") + "\n;this.flush = async () => { await atlasReady; await tabsReady; for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); await saveChain; }; this.setAtlas = setAtlas; this.update = updateCookieChoice; this.ownerOf = ownerOf;", ctx);
  return { writes: () => writes, listeners, store: () => store, setStore: (s) => { store = s; }, flush: () => ctx.flush(), setAtlas: ctx.setAtlas, update: (d, c) => ctx.update(d, c), ownerOf: (d) => ctx.ownerOf(d), ip: ctx.PrivaCIP, parseRir: (t) => require("../scripts/build-ip-countries.js").parse([t]) };
}

test("records known trackers per site and keeps earlier sites", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 1, url: "https://news.example/a" });
  t.listeners.req({ tabId: 1, url: "https://stats.g.doubleclick.net/x" });
  t.listeners.nav({ frameId: 0, tabId: 1, url: "https://shop.example/" });
  t.listeners.req({ tabId: 1, url: "https://mc.yandex.ru/watch" });
  await t.flush();
  const sites = t.store().privacData.sites;
  assert.deepStrictEqual(sites.map(s => s.domain), ["news.example", "shop.example"]);
  assert.strictEqual(sites[0].trackers[0].company, "Google");
  assert.strictEqual(sites[1].trackers[0].country, "RU");
  assert.strictEqual(t.store().privacData.sample, false);
});

test("a declined cookie choice is not wiped by the next tracker", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 2, url: "https://news.example/" });
  await t.flush();
  t.store().privacData.sites[0].cookieChoice = "declined"; // cookie-detector wrote this
  t.listeners.req({ tabId: 2, url: "https://hotjar.com/s.js" });
  await t.flush();
  const site = t.store().privacData.sites[0];
  assert.strictEqual(site.cookieChoice, "declined");
  assert.strictEqual(site.trackers.length, 1);
});

test("ignores the site's own requests and unknown domains", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 3, url: "https://www.criteo.com/" });
  t.listeners.req({ tabId: 3, url: "https://static.criteo.com/x.js" });
  t.listeners.req({ tabId: 3, url: "https://cdn.unknown-thing.io/y.js" });
  await t.flush();
  assert.strictEqual(t.store().privacData.sites[0].trackers.length, 0);
});

const atlas = JSON.parse(fs.readFileSync(__dirname + "/../shared/atlas.json", "utf8"));

test("the new-tab page and chrome:// pages are not recorded as visits", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 4, url: "chrome://newtab/" });
  t.listeners.nav({ frameId: 0, tabId: 4, url: "chrome-extension://abc/dashboard/dashboard.html" });
  await t.flush();
  assert.strictEqual(t.store().privacData, undefined);
});

test("with the Atlas: finds trackers by parent domain, skips the site owner's own trackers", async () => {
  const t = load();
  t.setAtlas(atlas);
  t.listeners.nav({ frameId: 0, tabId: 5, url: "https://www.google.com/" });
  t.listeners.req({ tabId: 5, url: "https://stats.g.doubleclick.net/x" });      // Google on google.com
  t.listeners.nav({ frameId: 0, tabId: 6, url: "https://news.example/" });
  t.listeners.req({ tabId: 6, url: "https://stats.g.doubleclick.net/x" });      // Google on a news site
  t.listeners.req({ tabId: 6, url: "https://analytics.tiktok.com/i18n/pixel" }); // ByteDance
  await t.flush();
  const by = Object.fromEntries(t.store().privacData.sites.map(s => [s.domain, s]));
  const g = by["google.com"], n = by["news.example"];
  assert.strictEqual(g.trackers.length, 0);
  assert.deepStrictEqual(n.trackers.map(x => x.company), ["Google", "ByteDance"]);
  assert.strictEqual(n.trackers[1].country, "CN");
});

test("visits older than 7 days are deleted automatically", async () => {
  const t = load();
  const old = new Date(Date.now() - 8 * 86400000).toISOString();
  t.setStore({ privacData: { sites: [{ domain: "old.example", lastVisit: old, trackers: [] }] } });
  t.listeners.nav({ frameId: 0, tabId: 7, url: "https://new.example/" });
  await t.flush();
  assert.deepStrictEqual(t.store().privacData.sites.map(s => s.domain), ["new.example"]);
});

test("cookie choices: declined/accepted win over no-reject, and stick through tracker updates", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 8, url: "https://shop.example/" });
  await t.flush();
  await t.update("shop.example", "no-reject");
  assert.strictEqual(t.store().privacData.sites[0].cookieChoice, "no-reject");
  await t.update("shop.example", "declined");
  await t.update("shop.example", "no-reject");
  t.listeners.req({ tabId: 8, url: "https://hotjar.com/s.js" });
  await t.flush();
  assert.strictEqual(t.store().privacData.sites[0].cookieChoice, "declined");
});

test("prerendered pages (Google preloading results) are not visits and don't add trackers", async () => {
  const t = load();
  t.setAtlas(atlas);
  t.listeners.nav({ frameId: 0, tabId: 9, url: "https://www.google.com/search?q=x" });
  t.listeners.nav({ frameId: 0, tabId: 9, url: "https://www.temu.com/", documentLifecycle: "prerender" });
  t.listeners.req({ tabId: 9, url: "https://www.baidu.com/x.js", documentLifecycle: "prerender" });
  await t.flush();
  const sites = t.store().privacData.sites;
  assert.deepStrictEqual(sites.map(s => s.domain), ["google.com"]);
  assert.strictEqual(sites[0].trackers.length, 0);
});

test("the site's owner is recorded with its country (ya.ru = Yandex, Russia)", async () => {
  const t = load();
  t.setAtlas(atlas);
  const o = t.ownerOf("ya.ru");
  assert.strictEqual(o.company, "Yandex");
  assert.strictEqual(o.country, "RU");
  t.listeners.nav({ frameId: 0, tabId: 10, url: "https://ya.ru/" });
  await t.flush();
  assert.strictEqual(t.store().privacData.sites[0].owner.company, "Yandex");
});

test("F1: unknown outside servers with a listed country ending are remembered by name (label only)", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 3, url: "https://granma.cu/" });
  t.listeners.req({ tabId: 3, url: "https://static.granma.cu/a.js" });        // the site itself
  t.listeners.req({ tabId: 3, url: "https://stats.cip.cu/c.js?x=1" });        // outside, Cuban ending
  t.listeners.req({ tabId: 3, url: "https://cdn.unknown-cdn.com/x.js" });     // outside, no listed ending
  t.listeners.nav({ frameId: 0, tabId: 4, url: "https://news.example/" });
  t.listeners.req({ tabId: 4, url: "https://www.tns-counter.ru/V13a" });
  await t.flush();
  const sites = t.store().privacData.sites;
  assert.deepStrictEqual(sites.find(s => s.domain === "granma.cu").foreignHosts, ["cip.cu"]);
  assert.deepStrictEqual(sites.find(s => s.domain === "news.example").foreignHosts, ["tns-counter.ru"]);
});

test("pages Google pre-loads from its results (navigation prefetch) are not trackers of google.com", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 9, url: "https://www.google.com/search?q=aliexpress" });
  t.listeners.req({ tabId: 9, type: "main_frame", url: "https://hm.baidu.com/landing" });   // a known tracker domain
  t.listeners.req({ tabId: 9, type: "other", url: "https://hm.baidu.com/prefetched" });   // <link rel=prefetch> / speculative prefetch
  t.listeners.req({ tabId: 9, type: "script", url: "https://mc.yandex.ru/watch" });
  await t.flush();
  const g = t.store().privacData.sites.find(s => s.domain === "google.com");
  assert.deepStrictEqual(g.trackers.map(x => x.domain), ["mc.yandex.ru"]);
});

test("F3: the page's own server and outside servers in a listed country are recorded (country only)", async () => {
  const t = load();
  t.ip.setData(t.parseRir("2|ripencc|1|1|1|20261023|+0\nripencc|RU|ipv4|95.173.128.0|4096|2008|allocated|a\nripencc|IR|ipv4|185.1.0.0|256|2012|allocated|b"));
  t.listeners.resp({ tabId: 5, frameId: 0, type: "main_frame", url: "https://tass.com/", ip: "95.173.130.1" });
  t.listeners.nav({ frameId: 0, tabId: 5, url: "https://tass.com/" });
  await t.flush();
  t.listeners.resp({ tabId: 5, frameId: 0, type: "image", url: "https://img.tass.com/a.jpg", ip: "95.173.130.2" });  // the site itself
  t.listeners.resp({ tabId: 5, frameId: 0, type: "script", url: "https://cdn.other.example/x.js?q=1", ip: "185.1.0.9" });
  t.listeners.resp({ tabId: 5, frameId: 0, type: "script", url: "https://safe.example/x.js", ip: "8.8.8.8" });
  t.listeners.resp({ tabId: 6, frameId: 0, type: "main_frame", url: "https://cnn.com/", ip: "151.101.1.67" });
  t.listeners.nav({ frameId: 0, tabId: 6, url: "https://cnn.com/" });
  await t.flush();
  const sites = t.store().privacData.sites;
  const tass = sites.find(s => s.domain === "tass.com");
  assert.deepStrictEqual(tass.server, { country: "RU" });
  assert.deepStrictEqual(tass.foreignServers, [{ host: "other.example", country: "IR" }]);
  assert.strictEqual(sites.find(s => s.domain === "cnn.com").server, null);
});

test("speed: a burst of trackers on one page is saved in a couple of writes, not one per tracker", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 11, url: "https://busy.example/" });
  await t.flush();
  const before = t.writes();
  for (const d of ["doubleclick.net", "google-analytics.com", "connect.facebook.net", "amazon-adsystem.com", "criteo.com", "scorecardresearch.com", "hotjar.com", "rlcdn.com"])
    t.listeners.req({ tabId: 11, type: "script", url: "https://" + d + "/x.js" });
  await t.flush();
  assert.ok(t.writes() - before <= 2, `wrote ${t.writes() - before} times`);
  assert.strictEqual(t.store().privacData.sites.find(s => s.domain === "busy.example").trackers.length, 8);
});

test("pages already open when PrivaC starts (just reloaded) are recorded, not missed", async () => {
  const t = load([{ id: 21, url: "https://www.google.com/search?q=x" }, { id: 22, url: "chrome://newtab/" }, { id: 23, url: undefined }]);
  await t.flush();
  await new Promise(r => setTimeout(r, 10));
  await t.flush();
  assert.deepStrictEqual(t.store().privacData.sites.map(s => s.domain), ["google.com"]);
  t.listeners.req({ tabId: 21, type: "script", url: "https://mc.yandex.ru/watch" });   // later requests on that tab count
  await t.flush();
  assert.strictEqual(t.store().privacData.sites[0].trackers.length, 1);
});

test("the popup can ask which site a tab is on (when Chrome hides the tab's address)", async () => {
  const t = load();
  t.listeners.nav({ frameId: 0, tabId: 31, url: "https://www.google.com/" });
  await t.flush();
  let answer;
  t.listeners.msg({ type: "privac-tab-site", tabId: 31 }, {}, (a) => { answer = a; });
  assert.strictEqual(answer.domain, "google.com");
});


test("once a tab shows one of Chrome's own pages (new tab, settings), the popup isn't told the website it showed before", async () => {
  const frames = {};
  const t = load([], frames);
  t.listeners.nav({ frameId: 0, tabId: 41, url: "https://mlh.com/" });
  await t.flush();
  frames[41] = "chrome://new-tab-page/";   // Chrome sends extensions no navigation event for its own pages
  const answer = await new Promise((r) => t.listeners.msg({ type: "privac-tab-site", tabId: 41 }, {}, r));
  assert.strictEqual(answer.domain, null);
});

test("the popup is told the website the tab really shows right now", async () => {
  const frames = { 42: "https://www.google.com/search?q=mlh" };
  const t = load([], frames);
  t.listeners.nav({ frameId: 0, tabId: 42, url: "https://mlh.com/" });   // an older record for this tab
  await t.flush();
  const answer = await new Promise((r) => t.listeners.msg({ type: "privac-tab-site", tabId: 42 }, {}, r));
  assert.strictEqual(answer.domain, "google.com");
});
