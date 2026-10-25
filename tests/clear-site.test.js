// IDEA.md (Justin, Smiley): a "Clear cache" button with a plain explanation. PrivaC clears one site at a time:
// the popup's "Clear this site's data" forgets that site's own cookies, storage and cache, so it can't link your
// next visit to earlier ones. Other companies' tracking cookies stay, and the popup says so. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const EXT = "chrome-extension://abc";
function background(siteCookies) {
  const removed = [], asked = [];
  let listener = null;
  const ctx = {
    chrome: {
      runtime: { id: "abc", onMessage: { addListener: (fn) => { listener = fn; } } },
      browsingData: { remove: async (opts, what) => { removed.push(JSON.parse(JSON.stringify([opts, what]))); } }
    }
  };
  // Chrome's cookie list for the site, when a test gives one (names only; PrivaC never reads values).
  if (siteCookies) ctx.chrome.cookies = { getAll: async (q) => { asked.push(JSON.parse(JSON.stringify(q))); return siteCookies; } };
  ctx.self = ctx;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/clear-site.js", "utf8"), ctx);
  const send = (msg, url = EXT + "/popup/popup.html") => new Promise((resolve) => {
    const kept = listener(msg, { id: "abc", url }, (r) => resolve(JSON.parse(JSON.stringify(r))));
    if (kept !== true) setImmediate(() => resolve(undefined));
  });
  return { removed, asked, send };
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

// Mac check on real sites (puffco.com, cnn.com, Oct 25): clearing worked (puffco went from 30 cookies to 0), but the
// pop-up looked the same afterwards, so it seemed to do nothing. It now says what was removed and what happens next.
test("it answers with how many of the site's cookies Chrome removed, so the pop-up can say what it did", async () => {
  const bg = background([{ name: "_ga" }, { name: "_fbp" }, { name: "cart" }]);
  assert.deepStrictEqual(await bg.send({ type: "privac-clear-site", domain: "www.puffco.com" }), { ok: true, cookies: 3 });
  assert.deepStrictEqual(bg.asked, [{ domain: "puffco.com" }], "the whole site, like Chrome clears its cookies");
  assert.strictEqual(bg.removed.length, 1);
});

function clearedNote() {
  const js = fs.readFileSync(__dirname + "/../popup/popup.js", "utf8");
  const m = js.match(/\n  (function clearedNote\(domain, cookies\) \{[\s\S]*?\n  \})\n/);
  assert.ok(m, "popup.js has clearedNote(domain, cookies)");
  const ctx = {};
  vm.runInNewContext(m[1] + "\nthis.clearedNote = clearedNote;", ctx);
  return ctx.clearedNote;
}

test("after the second tap the pop-up says what was removed, what happens on reload, and that the grade stays", () => {
  const note = clearedNote();
  assert.strictEqual(note("puffco.com", 30), "Removed 30 cookies and puffco.com's saved data. Reload the page to start fresh; the site will set new cookies as it loads. " +
    "Clearing doesn't change the grade: it's about what the site loads on your visits.");
  assert.match(note("puffco.com", 1), /^Removed 1 cookie and puffco\.com's saved data\./);
  assert.match(note("puffco.com", 0), /^Removed puffco\.com's saved data \(it had no cookies\)\./);
  assert.match(note("puffco.com", null), /^Removed puffco\.com's cookies and saved data\./);
  const js = fs.readFileSync(__dirname + "/../popup/popup.js", "utf8");
  assert.match(js, /id="clear-done" role="status"/, "screen readers hear it too");
  assert.match(js, /clear\.classList\.add\("done"\)/, "the button looks finished");
  // G14 (Oct 25): in the panel, the note sat partly under the bottom bar until you scrolled.
  assert.match(js, /done\.hidden = false;\s*done\.scrollIntoView\(\{ block: "nearest" \}\);/, "the note scrolls into view");
});

test("the card is a short list with the limit on its own line, and the button looks like a button", () => {
  const js = fs.readFileSync(__dirname + "/../popup/popup.js", "utf8");
  const card = js.slice(js.indexOf('<section class="card glass clear">'), js.indexOf("</section>", js.indexOf('<section class="card glass clear">')));
  assert.strictEqual((card.match(/<li /g) || []).length, 3);
  assert.match(card, /<li class="chk-warn">[^\n]*Other companies' tracking cookies aren't removed/);
  const css = fs.readFileSync(__dirname + "/../popup/popup.css", "utf8");
  assert.match(css, /\.clear-btn \{[^}]*color: var\(--danger\);/, "red words, like Settings' \"Clear my PrivaC data\"");
  assert.match(css, /\.clear-btn\.done[^{]*\{[^}]*--t-green/, "green once it's done");
});
