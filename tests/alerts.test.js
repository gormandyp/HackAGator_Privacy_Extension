// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function load() {
  const sent = [];
  const flagged = JSON.parse(fs.readFileSync(__dirname + "/../shared/flagged-companies.json", "utf8"));
  const ctx = {
    console, Promise, Set, Map,
    fetch: async () => ({ json: async () => flagged }),
    tabSites: new Map(),
    chrome: {
      runtime: { getURL: (p) => p, onMessage: { addListener() {} } },
      tabs: { sendMessage: async (tabId, msg) => { sent.push([tabId, msg]); } },
      storage: {}
    }
  };
  ctx.self = ctx;
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/data.js", "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/alerts.js", "utf8"), ctx);
  return { A: ctx.PrivaCAlerts, sent };
}

test("names the country and the 1260H list with its date (and Alibaba's court case)", async () => {
  const { A } = load();
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(A.describe("Baidu", "CN"), "Baidu (China; on the Pentagon's Section 1260H list, June 2026)");
  assert.match(A.describe("Alibaba", "CN"), /which it is contesting in court/);
  assert.strictEqual(A.describe("Yandex", "RU"), "Yandex (Russia)");
  assert.strictEqual(A.describe("Google", "US"), null);
});

test("tells the tab once per site, including when the site's owner is the flagged company", async () => {
  const { A, sent } = load();
  const site = { domain: "ya.ru", trackers: [{ company: "Google", country: "US" }], owner: { company: "Yandex", country: "RU" } };
  await A.check(7, site);
  await A.check(7, site);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(JSON.stringify(sent[0][1].companies), JSON.stringify(["Yandex (Russia)"]));
  await A.check(8, { domain: "safe.example", trackers: [{ company: "Google", country: "US" }] });
  assert.strictEqual(sent.length, 1);
});
