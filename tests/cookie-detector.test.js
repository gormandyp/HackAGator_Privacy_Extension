// content/cookie-detector.js: finds the site's cookie buttons by their wording and asks C to help.
// These tests run the real file against a small fake page. Labels come from real sites (October 2026).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../content/cookie-detector.js", "utf8");

// A fake button or link. `banner` is what closest() finds around it (the cookie pop-up).
function control(label, { kind = "button", banner = null } = {}) {
  return {
    kind, innerText: label, value: "", isConnected: true, clicks: 0, clickListeners: 0,
    getAttribute: () => null,
    getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 100, right: 220, width: 120, height: 40 }),
    closest: () => banner,
    click() { this.clicks++; },
    addEventListener(type) { if (type === "click") this.clickListeners++; },
    scrollIntoView() {}
  };
}

function bannerWith(labels, text = "We use cookies to improve your experience and show you ads.") {
  const banner = {
    innerText: text,
    getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 1440, width: 1440, height: 200 })
  };
  const controls = labels.map((l) => control(l, { banner }));
  banner.querySelectorAll = () => controls;
  return { banner, controls };
}

// Loads the detector on a page whose buttons are `controls`. `hosts` are elements with open shadow roots.
function load(controls, { hosts = [], cookie = "" } = {}) {
  const calls = [];
  const P = {
    cookie(opts) { calls.push(["cookie", opts]); },
    acceptOnly() { calls.push(["acceptOnly"]); },
    positionAtBanner() {},
    hide() { calls.push(["hide"]); },
    ignored() {},
    isReacting: () => false,
    isCelebrating: () => false
  };
  const saved = [];
  const document = {
    cookie,
    documentElement: {},
    querySelectorAll(sel) {
      if (sel === "*") return hosts;
      const withLinks = /(^|,\s*)a(\[|,|$)/.test(sel);
      return controls.filter((c) => c.kind === "button" || withLinks);
    }
  };
  const ctx = {
    console: { log() {}, warn() {}, table() {}, error() {} },
    document, location: { hostname: "www.shop.example" },
    MutationObserver: class { observe() {} },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    // onDecline's 200 ms waits run right away; the detector's own 1.5 s and 4 s re-checks are left out
    // so each test decides how many checks run.
    setTimeout: (fn, ms) => { if (ms <= 200) setImmediate(fn); return 0; },
    clearTimeout() {},
    chrome: { storage: { local: { get: async () => ({ privacData: { sites: [] } }), set: async (v) => saved.push(v) } } }
  };
  ctx.window = ctx;
  ctx.PrivaCPrompt = P;
  vm.runInNewContext(SRC, ctx);
  return { calls, ctx, saved, kinds: () => calls.map((c) => c[0]) };
}

// Each new Reject label: C offers to decline, on a banner with only that button and Accept.
for (const [label, site] of [
  ["Deny Cookies", "Superdrug"],
  ["Reject additional cookies", "gov.uk"],
  ["Allow recommended cookies only", "survey"]
]) {
  test(`"${label}" (${site}) is a Reject button: C offers to decline`, () => {
    const { controls } = bannerWith(["Accept all cookies", label]);
    const { kinds } = load(controls);
    assert.deepStrictEqual(kinds(), ["cookie"]);
  });
  test(`"${label.toUpperCase()}" matches whatever the letter case, but only as the whole label`, () => {
    assert.deepStrictEqual(load(bannerWith(["Accept all cookies", label.toUpperCase()]).controls).kinds(), ["cookie"]);
    const longer = load(bannerWith(["Accept all cookies", label + " and more"]).controls).kinds();
    assert.ok(!longer.includes("cookie"), "a longer label isn't a Reject button");
  });
}

test("an existing label (\"Reject all\") still works, and C opens once for the same button", () => {
  const { controls } = bannerWith(["Accept all", "Reject all"]);
  const page = load(controls);
  page.ctx.window.PrivaCCookieCheck();
  assert.deepStrictEqual(page.kinds(), ["cookie"]);
});
