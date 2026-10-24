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
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/tracking.js", "utf8") + "\n;this.flush = () => saveChain;", ctx);
  return { listeners, store: () => store, flush: () => ctx.flush() };
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
