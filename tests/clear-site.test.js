// IDEA.md (Justin, Smiley): a "Clear cache" button with a plain explanation. PrivaC clears one site at a time:
// the popup's "Clear this site's data" forgets that site's own cookies, storage and cache, so it can't link your
// next visit to earlier ones. Other companies' tracking cookies stay, and the popup says so. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const EXT = "chrome-extension://abc";
function background() {
  const removed = [];
  let listener = null;
  const ctx = {
    chrome: {
      runtime: { id: "abc", onMessage: { addListener: (fn) => { listener = fn; } } },
      browsingData: { remove: async (opts, what) => { removed.push(JSON.parse(JSON.stringify([opts, what]))); } }
    }
  };
  ctx.self = ctx;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/clear-site.js", "utf8"), ctx);
  const send = (msg, url = EXT + "/popup/popup.html") => new Promise((resolve) => {
    const kept = listener(msg, { id: "abc", url }, (r) => resolve(JSON.parse(JSON.stringify(r))));
    if (kept !== true) setImmediate(() => resolve(undefined));
  });
  return { removed, send };
}

test("clears that site's cookies, storage and cache, for both its addresses with and without www", async () => {
  const bg = background();
  assert.deepStrictEqual(await bg.send({ type: "privac-clear-site", domain: "planetfitness.com" }), { ok: true });
  const [opts, what] = bg.removed[0];
  assert.deepStrictEqual(opts.origins.sort(), ["http://planetfitness.com", "http://www.planetfitness.com", "https://planetfitness.com", "https://www.planetfitness.com"]);
  for (const k of ["cookies", "localStorage", "indexedDB", "cacheStorage", "serviceWorkers", "cache"]) assert.strictEqual(what[k], true, k);
  assert.ok(!what.history && !what.passwords && !what.downloads, "never history, passwords or downloads");
});

test("only PrivaC's own pages can ask, and only for a real site name", async () => {
  const bg = background();
  assert.strictEqual(await bg.send({ type: "privac-clear-site", domain: "planetfitness.com" }, "https://evil.example/"), undefined);
  assert.deepStrictEqual(await bg.send({ type: "privac-clear-site", domain: "not a domain/../x" }), { ok: false });
  assert.deepStrictEqual(await bg.send({ type: "privac-clear-site", domain: "" }), { ok: false });
  assert.strictEqual(bg.removed.length, 0);
});

test("the extension asks Chrome for the browsingData permission, and the background loads the file", () => {
  const m = JSON.parse(fs.readFileSync(__dirname + "/../manifest.json", "utf8"));
  assert.ok(m.permissions.includes("browsingData"));
  assert.match(fs.readFileSync(__dirname + "/../background.js", "utf8"), /importScripts\([^)]*"background\/clear-site\.js"/);
});

test("the popup explains what clearing does before you do it, and asks for a second tap", () => {
  const js = fs.readFileSync(__dirname + "/../popup/popup.js", "utf8");
  assert.match(js, /id="clear-site"/);
  assert.match(js, /signs you out of/i);
  assert.match(js, /can't link your next visit to earlier ones/i);
  assert.match(js, /other companies' tracking cookies aren't removed/i, "honest about what it can't clear (docs/SPEC.md Honesty rules)");
  assert.match(js, /Tap again to clear/);
  assert.match(js, /sendMessage\(\{ type: "privac-clear-site", domain: s\.domain \}\)/);
});
