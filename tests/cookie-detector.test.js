// content/cookie-detector.js: finds the site's cookie buttons by their wording and asks C to help.
// These tests run the real file against a small fake page. Labels come from real sites (October 2026).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../content/cookie-detector.js", "utf8");

// Whether a fake element of this kind ("button", "link" or a form's "submit" button) matches a selector.
function fits(kind, sel) {
  if (kind === "link") return /(^|,\s*)a(\[|,|$)/.test(sel);
  if (kind === "submit") return sel.includes('input[type="submit"]');
  return true;
}

// A fake button or link. `banner` is what closest() finds around it (the cookie pop-up).
function control(label, { kind = "button", banner = null } = {}) {
  return {
    kind, innerText: label, value: "", isConnected: true, clicks: 0, clickListeners: 0,
    matches: (sel) => fits(kind, sel),
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
  const later = new Map();   // the detector's own timers over 200 ms, run by clock.tick()
  const clock = { now: 0, nextId: 1, checks: 0 };
  clock.tick = (ms) => {
    const end = clock.now + ms;
    for (;;) {
      const due = [...later].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      later.delete(due[0]);
      clock.now = due[1].at;
      due[1].fn();
    }
    clock.now = end;
  };
  const document = {
    cookie,
    documentElement: {},
    querySelectorAll(sel) {
      if (sel === "*") { clock.checks++; return hosts; }
      return controls.filter((c) => fits(c.kind, sel));
    }
  };
  const ctx = {
    console: { log() {}, warn() {}, table() {}, error() {} },
    document, location: { hostname: "www.shop.example" }, innerWidth: 1440, innerHeight: 900,
    MutationObserver: class {
      constructor(callback) { ctx.observer = { callback }; }
      observe(target, options) { ctx.observer.options = options; }
    },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    // onDecline's 200 ms waits run right away; the detector's own longer timers (its 1.5 s and 4 s re-checks,
    // the re-check after the page changes) only run when a test calls clock.tick(ms).
    setTimeout: (fn, ms) => {
      if (ms <= 200) { setImmediate(fn); return 0; }
      const id = clock.nextId++;
      later.set(id, { fn, at: clock.now + ms });
      return id;
    },
    clearTimeout(id) { later.delete(id); },
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    chrome: { storage: { local: { get: async () => ({ privacData: { sites: [] } }), set: async (v) => saved.push(v) } } }
  };
  ctx.window = ctx;
  ctx.top = ctx;   // the top page, not a frame
  ctx.PrivaCPrompt = P;
  vm.runInNewContext(SRC, ctx);
  return { calls, ctx, saved, clock, kinds: () => calls.map((c) => c[0]) };
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
  // GOV.UK keeps the choice as URL-encoded JSON in cookies_policy (essential is always on).
  "GOV.UK": {
    declined: "cookies_policy=" + encodeURIComponent(JSON.stringify({ essential: true, settings: false, usage: false, campaigns: false })),
    accepted: "cookies_policy=" + encodeURIComponent(JSON.stringify({ essential: true, settings: true, usage: true, campaigns: true }))
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
  assert.strictEqual((await declineWith("cookies_policy=not-json")).result, "unverified");
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

// C staying silent (R14). The detector re-checks the page after it changes, since pop-ups often load late.
const pageChange = { target: { closest: () => null } };

test("a busy page (a price ticker changing every 100 ms) still gets re-checked: C asks about a late pop-up", () => {
  const controls = [];
  const page = load(controls);
  page.clock.tick(5000);   // the 1.5 s and 4 s re-checks: nothing there yet
  controls.push(...bannerWith(["Accept all", "Reject all"]).controls);
  for (let i = 0; i < 20; i++) {   // 2 seconds of the ticker changing the page
    page.ctx.observer.callback([pageChange]);
    page.clock.tick(100);
  }
  assert.deepStrictEqual(page.kinds(), ["cookie"]);
});

test("a pop-up already in the page but shown later by a style or class change is noticed", () => {
  const page = load([]);
  const { options } = page.ctx.observer;
  assert.strictEqual(options.childList, true);
  assert.strictEqual(options.subtree, true);
  assert.strictEqual(options.attributes, true, "watches attribute changes, not only added elements");
  for (const name of ["style", "class", "hidden"]) assert.ok(options.attributeFilter.includes(name), name);
});

test("C moving himself around doesn't make the detector re-check the page", () => {
  const page = load([]);
  page.clock.tick(5000);
  const before = page.clock.checks;
  const cMoved = { target: { closest: (sel) => (sel === "privac-prompt" ? {} : null) } };
  for (let i = 0; i < 10; i++) { page.ctx.observer.callback([cMoved]); page.clock.tick(100); }
  assert.strictEqual(page.clock.checks, before);
  page.ctx.observer.callback([cMoved, pageChange]);
  page.clock.tick(400);
  assert.ok(page.clock.checks > before, "a real page change still does");
});

// Accept wording that content/c-events.js already counts as "you accepted" (from real sites), but the detector
// didn't: a banner with one of these and only a settings button got no "Beware!" warning at all.
for (const label of ["Accept", "Allow", "Allow cookies", "I accept", "Accept and close", "Accept and continue",
  "Agree and close", "Yes, I'm happy", "Yes I’m happy"]) {
  test(`"${label}" + "Cookie settings": C warns that the site may still track you`, () => {
    assert.deepStrictEqual(load(bannerWith([label, "Cookie settings"]).controls).kinds(), ["acceptOnly"]);
  });
}

test("every Accept wording c-events.js knows also counts as Accept in the detector", () => {
  const events = fs.readFileSync(__dirname + "/../content/c-events.js", "utf8");
  const list = events.slice(events.indexOf("const ACCEPT = ["), events.indexOf("];", events.indexOf("const ACCEPT = [")));
  const samples = ["Accept", "Accept all", "Accept all cookies", "Accept cookies", "Allow", "Allow all", "Allow cookies",
    "Allow all cookies", "Agree", "Agree and close", "Agree and continue", "I agree", "I accept", "Accept and close",
    "Accept and continue", "Yes, I'm happy", "Yes I’m happy", "OK", "Okay", "Got it"];
  const known = eval("[" + list.slice(list.indexOf("[") + 1) + "]");   // c-events.js's own patterns
  for (const label of samples) {
    assert.ok(known.some((p) => p.test(label)), `c-events.js counts "${label}"`);
    assert.deepStrictEqual(load(bannerWith([label, "Cookie settings"]).controls).kinds(), ["acceptOnly"], label);
  }
});

// A "no" button whose wording isn't in REJECT_LABELS yet. The "Beware!" check already treated it as a way to
// say no, so C said nothing at all. Inside a cookie pop-up, a short label starting with reject/decline/deny/
// refuse/disagree, or saying necessary/essential "only", now counts as the Reject button. (PLAN.md lists
// "Deny" on Usercentrics as wording to check on the real site.)
for (const [labels, no, tool] of [
  [["Deny", "Allow selection", "Allow all"], "Deny", "a Deny button"],
  [["Accept All", "Deny", "More Information"], "Deny", "Deny between Accept and More"],
  [["Agree and close", "Disagree and close", "Learn more"], "Disagree and close", "Disagree and close"],
  [["Accept", "Decline"], "Decline", "two plain buttons"],
  [["Allow all", "Strictly necessary only"], "Strictly necessary only", "necessary-only wording"]
]) {
  test(`${tool} (${labels.join(" + ")}): C offers to decline, and "Protect me" clicks "${no}"`, async () => {
    const { controls } = bannerWith(labels);
    const page = load(controls);
    assert.deepStrictEqual(page.kinds(), ["cookie"]);
    const target = controls.find((c) => c.innerText === no);
    target.click = () => { target.clicks++; target.isConnected = false; };
    await page.calls[0][1].onDecline();
    assert.deepStrictEqual(controls.map((c) => c.clicks), controls.map((c) => (c === target ? 1 : 0)));
  });
}

test("a known Reject label wins over other no-words on the page", () => {
  const { controls } = bannerWith(["Decline", "Reject all", "Accept all"]);
  const page = load(controls);
  page.calls[0][1].onDecline();
  assert.strictEqual(controls[1].clicks, 1);
  assert.strictEqual(controls[0].clicks, 0);
});

test("a Decline button outside any cookie pop-up (a calendar invite) isn't mistaken for Reject", () => {
  const invite = control("Decline", { banner: null });
  assert.deepStrictEqual(load([invite, control("Accept", { banner: null })]).kinds(), []);
});

test("settings-style no-words aren't a one-click Reject: C warns instead of staying silent", () => {
  for (const labels of [["Accept all cookies", "Manage necessary cookies"], ["Accept all", "Reject or customise settings"]]) {
    assert.deepStrictEqual(load(bannerWith(labels).controls).kinds(), ["acceptOnly"], labels.join(" + "));
  }
});

// Reject shown as a plain link, or as a form's submit button. These count only inside a cookie pop-up.
for (const kind of ["link", "submit"]) {
  test(`Reject as a ${kind} inside a cookie pop-up: C offers to decline, and "Protect me" clicks it`, async () => {
    const { banner, controls } = bannerWith(["Accept all"]);
    const reject = control("Reject all", { kind, banner });
    reject.click = () => { reject.clicks++; reject.isConnected = false; };
    controls.push(reject);
    const page = load(controls);
    assert.deepStrictEqual(page.kinds(), ["cookie"]);
    await page.calls[0][1].onDecline();
    assert.strictEqual(reject.clicks, 1);
    assert.strictEqual(controls[0].clicks, 0, "Accept isn't touched");
  });

  test(`a "Reject all" ${kind} outside any cookie pop-up is left alone`, () => {
    assert.deepStrictEqual(load([control("Reject all", { kind, banner: null })]).kinds(), []);
  });
}
