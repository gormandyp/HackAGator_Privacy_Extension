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
    document, location: { hostname: "www.shop.example" }, innerWidth: 1440, innerHeight: 900,
    MutationObserver: class { observe() {} },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    // onDecline's 200 ms waits run right away; the detector's own 1.5 s and 4 s re-checks are left out
    // so each test decides how many checks run.
    setTimeout: (fn, ms) => { if (ms <= 200) setImmediate(fn); return 0; },
    clearTimeout() {},
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    chrome: { storage: { local: { get: async () => ({ privacData: { sites: [] } }), set: async (v) => saved.push(v) } } }
  };
  ctx.window = ctx;
  ctx.top = ctx;   // the top page, not a frame
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

// Accept-only banners: no one-click Reject, so C warns "Beware!". A settings button isn't a one-click Reject.
for (const [labels, site] of [
  [["Continue and accept", "Cookie settings"], "Argos"],
  [["Continue and Accept", "Manage preferences"], "Sainsbury's"],
  [["Accept cookies", "Choose Cookies"], "Trainline"]
]) {
  test(`${site} (${labels.join(" + ")}): C warns that the site may still track you`, () => {
    assert.deepStrictEqual(load(bannerWith(labels).controls).kinds(), ["acceptOnly"]);
  });
}

test("a banner with Continue and accept plus a real Reject gets the decline offer, not the warning", () => {
  assert.deepStrictEqual(load(bannerWith(["Continue and accept", "Reject all"]).controls).kinds(), ["cookie"]);
});

// After "Protect me", C reads the consent tool's own record to say "Nice!" (confirmed) or "couldn't verify".
// Fake document.cookie strings for each tool, shaped like the real ones.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const RECORDS = {
  OneTrust: {
    declined: "OptanonConsent=isGpcEnabled=0&datestamp=Sat+Oct+24+2026&groups=C0001%3A1%2CC0002%3A0%2CC0003%3A0%2CC0004%3A0",
    accepted: "OptanonConsent=isGpcEnabled=0&datestamp=Sat+Oct+24+2026&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A0%2CC0004%3A1"
  },
  "Ensighten (John Lewis)": {
    declined: "JOHNLEWIS_ENSIGHTEN_PRIVACY_BANNER_VIEWED=1; JOHNLEWIS_ENSIGHTEN_PRIVACY_Advertising=0; JOHNLEWIS_ENSIGHTEN_PRIVACY_Analytics=0",
    accepted: "JOHNLEWIS_ENSIGHTEN_PRIVACY_BANNER_VIEWED=1; JOHNLEWIS_ENSIGHTEN_PRIVACY_Advertising=1; JOHNLEWIS_ENSIGHTEN_PRIVACY_Analytics=1"
  },
  CookieYes: {
    declined: "cookieyes-consent=consentid:dGVzdA,consent:no,action:yes,necessary:yes,functional:no,analytics:no,performance:no,advertisement:no,other:no",
    accepted: "cookieyes-consent=consentid:dGVzdA,consent:yes,action:yes,necessary:yes,functional:yes,analytics:yes,performance:yes,advertisement:yes,other:yes"
  },
  Cookiebot: {
    declined: "CookieConsent={stamp:%27k3b9%27%2Cnecessary:true%2Cpreferences:false%2Cstatistics:false%2Cmarketing:false%2Cmethod:%27explicit%27%2Cver:1%2Cutc:1792800000000%2Cregion:%27gb%27}",
    accepted: "CookieConsent={stamp:%27k3b9%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1%2Cutc:1792800000000%2Cregion:%27gb%27}"
  },
  Didomi: {
    declined: "didomi_token=" + b64({ user_id: "u1", purposes: { enabled: [], disabled: ["analytics", "advertising"] }, vendors: { enabled: [], disabled: ["google"] }, version: 2 }),
    accepted: "didomi_token=" + b64({ user_id: "u1", purposes: { enabled: ["analytics", "advertising"], disabled: [] }, vendors: { enabled: ["google"], disabled: [] }, version: 2 })
  }
};

// Opens C on a Reject banner, has the site's banner close when Reject is clicked, then sets the cookies.
async function declineWith(cookie, sites = []) {
  const { controls } = bannerWith(["Accept all", "Reject all"]);
  const page = load(controls);
  page.ctx.chrome.storage.local.get = async () => ({ privacData: { sites } });
  const reject = controls[1];
  reject.click = () => { reject.isConnected = false; page.ctx.document.cookie = cookie; };
  const result = await page.calls.find((c) => c[0] === "cookie")[1].onDecline();
  return { result, saved: page.saved };
}

for (const [tool, record] of Object.entries(RECORDS)) {
  test(`${tool}: declined -> "confirmed", accepted -> not confirmed`, async () => {
    assert.strictEqual((await declineWith(record.declined)).result, "confirmed");
    assert.notStrictEqual((await declineWith(record.accepted)).result, "confirmed");
  });
}

test("no consent record PrivaC knows: C keeps the honest \"couldn't verify\"", async () => {
  assert.strictEqual((await declineWith("")).result, "unverified");
  assert.strictEqual((await declineWith("session=abc123; theme=dark")).result, "unverified");
  assert.strictEqual((await declineWith("CookieConsent=-1")).result, "unverified", "Cookiebot's 'no consent needed here'");
  assert.strictEqual((await declineWith("didomi_token=not-base64!")).result, "unverified");
});

test("a confirmed decline saves only the choice, never the cookie's contents", async () => {
  const { result, saved } = await declineWith(RECORDS.CookieYes.declined, [{ domain: "shop.example" }]);
  assert.strictEqual(result, "confirmed");
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].privacData.sites[0].cookieChoice, "declined");
  assert.ok(!/consentid|dGVzdA|cookieyes/.test(JSON.stringify(saved)), "no cookie names or values stored");
});

test("Zara: with a \"Do not sell or share\" link and a Reject button, 5 checks click the link once and add one Reject listener", () => {
  const { controls } = bannerWith(["Do not sell or share my personal information", "Reject all", "Accept all"]);
  const page = load(controls);
  for (let i = 0; i < 4; i++) page.ctx.window.PrivaCCookieCheck();
  const [optOut, reject] = controls;
  assert.strictEqual(optOut.clicks, 1, "the opt-out link is clicked once per page");
  assert.strictEqual(reject.clickListeners, 1, "one 'you clicked Reject yourself' listener");
  assert.strictEqual(page.kinds().filter((k) => k === "cookie").length, 1, "C asks about Reject once");
});

test("Usercentrics: buttons inside an open shadow root (#usercentrics-root) are found", () => {
  const { controls } = bannerWith(["Accept all", "Reject all"]);
  const inner = { querySelectorAll: (sel) => (sel === "*" ? [] : controls) };
  const host = { id: "usercentrics-root", shadowRoot: inner };
  assert.deepStrictEqual(load([], { hosts: [host] }).kinds(), ["cookie"]);
});

test("an accept-only banner inside a shadow root still gets the warning", () => {
  const { controls } = bannerWith(["Accept all cookies", "Cookie settings"]);
  const host = { shadowRoot: { querySelectorAll: (sel) => (sel === "*" ? [] : controls) } };
  assert.deepStrictEqual(load([], { hosts: [host] }).kinds(), ["acceptOnly"]);
});

test("c-placement.js's copy of the Reject labels matches cookie-detector.js, so C lines up with the same button", () => {
  const patterns = (text) => new Set(text.match(/\/\^[^/]+\$\/i/g));
  const detector = patterns(SRC.slice(SRC.indexOf("const REJECT_LABELS"), SRC.indexOf("];", SRC.indexOf("const REJECT_LABELS"))));
  const placementSrc = fs.readFileSync(__dirname + "/../content/c-placement.js", "utf8");
  const start = placementSrc.indexOf("const REJECT = [");
  const placement = patterns(placementSrc.slice(start, placementSrc.indexOf("];", start)));
  assert.ok(detector.size >= 25);
  assert.deepStrictEqual([...detector].filter((p) => !placement.has(p)), [], "missing from c-placement.js");
  assert.deepStrictEqual([...placement].filter((p) => !detector.has(p)), [], "only in c-placement.js");
});

// Tesco-style: the site's banner slides out of the window or fades out but stays in the page. C used to say
// "I couldn't complete the cookie rejection" even though the site took the click.
async function declineWhere(afterClick, cookie = "") {
  const { controls } = bannerWith(["Accept all", "Reject all"]);
  const page = load(controls);
  const reject = controls[1];
  reject.click = () => { afterClick(reject); page.ctx.document.cookie = cookie; };
  return page.calls.find((c) => c[0] === "cookie")[1].onDecline();
}

test("banner slid up out of the window (still in the page): the click went through", async () => {
  const result = await declineWhere((b) => { b.getBoundingClientRect = () => ({ top: -180, bottom: -140, left: 1288, right: 1428, width: 140, height: 40 }); });
  assert.strictEqual(result, "unverified");
});

test("banner faded out or hidden by a box around it: the click went through", async () => {
  const result = await declineWhere((b) => { b.checkVisibility = () => false; });
  assert.strictEqual(result, "unverified");
});

test("banner still showing but the consent record says declined: confirmed", async () => {
  assert.strictEqual(await declineWhere(() => {}, RECORDS.OneTrust.declined), "confirmed");
});

test("banner still showing and no record: C honestly says it didn't work", async () => {
  assert.strictEqual(await declineWhere(() => {}), "failed");
  assert.strictEqual(await declineWhere((b) => { b.checkVisibility = () => true; }), "failed");
});
