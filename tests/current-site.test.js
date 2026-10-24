// Run with: node --test
// Which site the toolbar popup is about (shared/data.js currentDomain): the website in the tab, or none.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function currentDomainWith(tab, backgroundAnswer) {
  const chrome = {
    tabs: { query: async () => (tab ? [tab] : []) },
    runtime: { sendMessage: async (msg) => (msg.type === "privac-tab-site" ? backgroundAnswer : undefined) }
  };
  const ctx = { chrome, console, URL, Promise, setTimeout };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/data.js", "utf8"), ctx);
  return ctx.PrivaCData.currentDomain();
}

test("a website in the tab: its name, without www", async () => {
  assert.strictEqual(await currentDomainWith({ id: 1, url: "https://www.mlh.com/events" }), "mlh.com");
});

test("one of Chrome's own pages (new tab, settings): no site, never another website", async () => {
  assert.strictEqual(await currentDomainWith({ id: 1, url: "chrome://newtab/" }, { domain: "mlh.com" }), null);
  assert.strictEqual(await currentDomainWith({ id: 1, url: "chrome-extension://abc/dashboard/dashboard.html" }), null);
});

test("Chrome hides the address: the background says which site the tab shows (or none)", async () => {
  assert.strictEqual(await currentDomainWith({ id: 1 }, { domain: "google.com" }), "google.com");
  assert.strictEqual(await currentDomainWith({ id: 1 }, { domain: null }), null);
});
