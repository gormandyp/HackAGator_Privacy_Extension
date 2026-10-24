// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

// Load background/tracking.js with a fake Chrome so we can drive it.
function load() {
  let store = {};
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const chrome = {
    storage: { local: {
      get: async (k) => ({ [k]: store[k] && JSON.parse(JSON.stringify(store[k])) }),
      set: async (o) => { Object.assign(store, JSON.parse(JSON.stringify(o))); }
    } },
    webNavigation: { onCommitted: on("nav") },
    webRequest: { onBeforeRequest: on("req") },
    tabs: { onRemoved: on("closed") }
  };
  const ctx = { chrome, console, URL, Promise, setTimeout };
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/tracking.js", "utf8") + "\n;this.flush = async () => { await atlasReady; await tabsReady; for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); await saveChain; }; this.setAtlas = setAtlas; this.update = updateCookieChoice; this.ownerOf = ownerOf;", ctx);
  return { listeners, store: () => store, setStore: (s) => { store = s; }, flush: () => ctx.flush(), setAtlas: ctx.setAtlas, update: (d, c) => ctx.update(d, c), ownerOf: (d) => ctx.ownerOf(d) };
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
