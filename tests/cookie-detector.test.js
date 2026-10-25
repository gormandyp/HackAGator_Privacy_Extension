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
function load(controls, { hosts = [], cookie = "", notices = [] } = {}) {
  const calls = [];
  const positions = [];      // the boxes C was asked to stand on (positionAtBanner)
  const P = {
    cookie(opts) { calls.push(["cookie", opts]); },
    acceptOnly() { calls.push(["acceptOnly"]); },
    positionAtBanner(banner) { positions.push(banner); },
    hide() { calls.push(["hide"]); },
    ignored() {},
    isReacting: () => false,
    isCelebrating: () => false
  };
  const saved = [];
  const sent = [];           // messages to the background
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
      if (sel.includes('[class*="notice" i]')) return notices;   // "by continuing" strips (R19a)
      return controls.filter((c) => fits(c.kind, sel));
    }
  };
  const ctx = {
    console: { log() {}, warn() {}, table() {}, error() {} },
    document, location: { hostname: "www.shop.example" }, innerWidth: 1440, innerHeight: 900,
    MutationObserver: class {
      constructor(callback) { ctx.observer = { callback }; }
      observe(target, options) { ctx.observer.options = options; }
      disconnect() { ctx.observer.disconnected = true; }
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
    chrome: { storage: { local: { get: async () => ({ privacData: { sites: [] } }), set: async (v) => saved.push(v) } },
              runtime: { id: "privac-test", sendMessage: async (m) => { sent.push(m); } } }
  };
  ctx.window = ctx;
  ctx.top = ctx;   // the top page, not a frame
  ctx.PrivaCPrompt = P;
  vm.runInNewContext(SRC, ctx);
  return { calls, ctx, saved, sent, clock, positions, kinds: () => calls.map((c) => c[0]) };
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
  return { result, saved: page.saved, sent: page.sent };
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

// The background saves it (only the background writes privacData; docs/STORE.md section 6, fix 4).
test("a confirmed decline saves only the choice, never the cookie's contents", async () => {
  const { result, saved, sent } = await declineWith(RECORDS.CookieYes.declined, [{ domain: "shop.example" }]);
  assert.strictEqual(result, "confirmed");
  assert.strictEqual(saved.length, 0, "the detector doesn't write PrivaC's data itself");
  const choices = JSON.parse(JSON.stringify(sent.filter((m) => m.type === "cookieChoice")));
  assert.deepStrictEqual(choices, [{ type: "cookieChoice", domain: "shop.example", choice: "declined" }]);
  assert.ok(!/consentid|dGVzdA|cookieyes/.test(JSON.stringify(sent)), "no cookie names or values sent");
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

// PLAN R9 note 11 (puffco.com, 2026-10-25): Consentmo, a cookie app on Shopify stores, draws its pop-up inside an open
// shadow root on <csm-cookie-consent class="csm-cmp-root needsclick" popover="manual">. Real markup (captured in Chrome
// on the G14): <div> > <div id="csm-wrapper" class="csm-wrapper (hash)"> > <div role="region" aria-label="Cookie bar"
// class="(hashes) cc-floating cc-bottom cc-left cc-window ..."> > the text, and <div role="group" aria-label="Cookie
// consent actions" class="cc-compliance ..."> with the two buttons. Only each button itself matches BANNER (its class
// "isense-cc-submit-consent" contains "consent"), so closest() finds the button, whose text ("Accept") isn't about
// cookies; nothing around it matches (closest() stops at the shadow root). The host measures 0x0, the floating
// cc-window is the box you see, and the wrappers around it have no height.
function shadowBanner(tag, labels, text = "This website uses cookies to ensure you get the best experience on our website. Privacy Policy",
  { className = "csm-cmp-root needsclick", around = null, buttonsNamedConsent = true } = {}) {
  const host = { localName: tag, tagName: tag.toUpperCase(), id: "", className,
    getAttribute: (name) => (name === "class" ? className : null),
    closest: () => around,                                     // a cookie pop-up around the host in the page, if any
    getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }) };
  const root = { host };
  const flat = () => ({ top: 0, bottom: 0, left: 0, right: 1440, width: 1440, height: 0 });
  const outer = { parentElement: null, innerText: text, getBoundingClientRect: flat };
  const wrapper = { id: "csm-wrapper", parentElement: outer, innerText: text, getBoundingClientRect: flat };
  const box = { className: "cc-floating cc-bottom cc-left cc-window", parentElement: wrapper, innerText: text,
    getBoundingClientRect: () => ({ top: 640, bottom: 880, left: 16, right: 416, width: 400, height: 240 }) };
  const group = { className: "cc-compliance", parentElement: box, innerText: labels.join("\n"),
    getBoundingClientRect: () => ({ top: 820, bottom: 860, left: 32, right: 400, width: 368, height: 40 }) };
  const controls = labels.map((l) => Object.assign(control(l), { parentElement: group, getRootNode: () => root }));
  if (buttonsNamedConsent) for (const c of controls) c.closest = () => c;   // [class*="consent" i] on the button itself
  box.querySelectorAll = () => controls;
  root.querySelectorAll = (sel) => (sel === "*" || !sel.includes("button") ? [] : controls.filter((c) => fits(c.kind, sel)));
  host.shadowRoot = root;
  return { host, box, controls };
}

test("Consentmo (puffco.com): Accept + \"Do not sell or share\" inside <csm-cookie-consent>'s shadow root: C warns once, on the box you see", () => {
  const { host, box, controls } = shadowBanner("csm-cookie-consent", ["Do not sell or share", "Accept"]);
  const page = load([], { hosts: [host] });
  page.ctx.window.PrivaCCookieCheck();
  assert.deepStrictEqual(page.kinds(), ["acceptOnly"]);
  assert.strictEqual(page.positions.length, 1);
  assert.strictEqual(page.positions[0], box, "C stands on the cc-window box, not the 0x0 host or the button group");
  assert.strictEqual(controls[0].clicks, 0, "the short \"Do not sell or share\" is never clicked");
});

test("Consentmo's pop-up with a Reject all button: C offers to decline on the box you see, and \"Protect me\" clicks only Reject all", async () => {
  const { host, box, controls } = shadowBanner("csm-cookie-consent", ["Do not sell or share", "Reject all", "Accept"]);
  const page = load([], { hosts: [host] });
  assert.deepStrictEqual(page.kinds(), ["cookie"]);
  assert.strictEqual(page.positions.length, 1);
  assert.strictEqual(page.positions[0], box);
  const reject = controls[1];
  reject.click = () => { reject.clicks++; reject.isConnected = false; };
  await page.calls[0][1].onDecline();
  assert.deepStrictEqual(controls.map((c) => c.clicks), [0, 1, 0]);
});

test("a shadow root on an element named like a consent pop-up only by its id or a box around it counts too", () => {
  const byId = shadowBanner("x-root", ["Accept", "Manage choices"], undefined, { className: "x1" });
  byId.host.id = "consent-root";
  byId.host.closest = () => byId.host;                         // [id*="consent" i] matches the host itself
  assert.deepStrictEqual(load([], { hosts: [byId.host] }).kinds(), ["acceptOnly"]);
  const inBox = shadowBanner("x-root", ["Accept", "Manage choices"], undefined, { className: "x1", around: { innerText: "" } });
  const page = load([], { hosts: [inBox.host] });
  assert.deepStrictEqual(page.kinds(), ["acceptOnly"]);
  assert.strictEqual(page.positions[0], inBox.box);
});

test("a shadow root on an element not named like a cookie pop-up (a chat widget) with Accept/Decline: C stays out of it", () => {
  const { host } = shadowBanner("chat-widget", ["Accept", "Decline"],
    "Start a video chat? By chatting you agree to our privacy policy.", { className: "chat-root", buttonsNamedConsent: false });
  const page = load([], { hosts: [host] });
  page.clock.tick(5000);
  assert.deepStrictEqual(page.kinds(), []);
  assert.deepStrictEqual(page.positions, []);
});

test("a pop-up marked role=\"alertdialog\" (and named nothing else) counts as a cookie pop-up", () => {
  const { banner, controls } = bannerWith(["Accept", "Manage preferences"]);
  for (const c of controls) c.closest = (sel) => (sel.split(/,\s*/).includes('[role="alertdialog"]') ? banner : null);
  const page = load(controls);
  assert.deepStrictEqual(page.kinds(), ["acceptOnly"]);
  assert.strictEqual(page.positions[0], banner);
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

// chrome://extensions listed "PrivaC: Cookie banner did not disappear." as a warning on every failed decline
// (Tesco, Oct 24). It's an expected outcome that C already tells you about, so it's a plain log now.
test("a decline that didn't go through is logged quietly, not listed as an error on chrome://extensions", async () => {
  const { controls } = bannerWith(["Accept all", "Reject all"]);
  const page = load(controls);
  const loud = [];
  page.ctx.console = { log() {}, table() {}, warn: (...a) => loud.push(a), error: (...a) => loud.push(a) };
  assert.strictEqual(await page.calls[0][1].onDecline(), "failed");
  assert.deepStrictEqual(loud, []);
});

// After PrivaC is reloaded (or updated), Chrome leaves the old copy of this file running in open tabs, cut off
// from the extension: every chrome.* call then fails with "Extension context invalidated".
test("after PrivaC is reloaded, the old detector stops: no new pop-ups, no messages, and C's leftover is hidden", () => {
  const controls = [];
  const page = load(controls);
  delete page.ctx.chrome.runtime.id;   // what Chrome does to the old copy
  controls.push(...bannerWith(["Accept all", "Reject all"]).controls);
  page.ctx.observer.callback([pageChange]);
  page.clock.tick(5000);
  assert.deepStrictEqual(page.kinds(), ["hide"]);
  assert.strictEqual(page.ctx.observer.disconnected, true, "stops watching the page");
  assert.deepStrictEqual(page.sent, []);
});

// R19a (Max, checked live on mcdonalds.com/us, Oct 24): a strip at the top with no buttons at all, "By continuing to
// use our website, you agree to the revised Terms...", and only a link to opt out. C used to stay silent; now he
// warns "Beware!" like any banner with no way to say no.
function notice(text, links = []) {
  const el = { innerText: text, isConnected: true,
    getBoundingClientRect: () => ({ top: 0, bottom: 60, left: 0, right: 1440, width: 1440, height: 60 }) };
  const inside = links.map((l) => control(l, { kind: "link", banner: el }));
  el.querySelectorAll = (sel) => (/input/.test(sel) && el.form ? [{}] : sel.includes("input") ? [] : inside);
  return el;
}

test("McDonald's \"By continuing to use our website, you agree\" strip with no buttons: C warns once", () => {
  const strip = notice("By continuing to use our website, you agree to the revised Terms of Use and Privacy Statement. McDonald's Privacy Rights Center", ["McDonald's Privacy Rights Center"]);
  const page = load([], { notices: [strip] });
  page.ctx.window.PrivaCCookieCheck();
  assert.deepStrictEqual(page.kinds(), ["acceptOnly"]);
});

test("other real \"by using this site\" wordings warn too", () => {
  for (const text of ["By using this site, you agree to our use of cookies.", "By continuing to browse the site you are agreeing to our use of cookies.", "By browsing our website you consent to our cookie policy."]) {
    assert.deepStrictEqual(load([], { notices: [notice(text)] }).kinds(), ["acceptOnly"], text);
  }
});

test("a sign-in page's \"By continuing, you agree to the Terms\" is not a cookie notice", () => {
  assert.deepStrictEqual(load([], { notices: [notice("By continuing, you agree to Google's Terms of Service and Privacy Policy.")] }).kinds(), []);
  const form = notice("By using this site you agree to our Terms. Email Password Sign in");
  form.form = true;
  assert.deepStrictEqual(load([], { notices: [form] }).kinds(), [], "a notice with a sign-in form inside is left alone");
});

test("a whole page that happens to contain the sentence isn't treated as a notice", () => {
  const long = notice("By using this site you agree to our cookie policy. " + "News story text. ".repeat(80));
  assert.deepStrictEqual(load([], { notices: [long] }).kinds(), []);
});

test("a \"by continuing\" notice that also has a Reject button gets the decline offer, not the warning", () => {
  const { controls } = bannerWith(["Reject all"], "By continuing to use our website, you agree to our use of cookies.");
  const strip = notice("By continuing to use our website, you agree to our use of cookies.");
  assert.deepStrictEqual(load(controls, { notices: [strip] }).kinds(), ["cookie"]);
});

// R19a, second look (Max, mcdonalds.com/us live, Oct 24 9:45 PM): the real strip is 835 characters long and has an
// "Accept" button (section.tnc-banner-container, "Terms and Conditions Banner"). The 600-character limit for notices
// skipped it, so C stayed silent. Real text, real button.
const MCD = "Our Terms and Conditions have changed. Please take a moment to review the new McDonald's Terms and Conditions. These include updates to our Mobile Order & Pay experience (including web and guest ordering, cancellations, and refunds), MyMcDonald's Rewards program (including partner rewards, which may be subject to partner terms), stored value features like digital gift cards, and the dispute resolution and arbitration process. By continuing to use our website, you agree to the revised Terms & Conditions agreement. We are also updating our Privacy Statement to reflect how we may partner with select advertising partners to provide you with relevant advertising. You continue to have a right to opt out of the sharing of personal information for targeted advertising, which you can exercise in the McDonald's Privacy Rights Center.";
test("McDonald's real strip (835 characters, with an Accept button): C warns once", () => {
  assert.ok(MCD.length > 800 && MCD.length < 1000);
  const strip = notice(MCD, ["McDonald's Terms and Conditions", "Privacy Statement", "McDonald's Privacy Rights Center"]);
  // On the real page the Accept button isn't inside anything named like a cookie banner (closest() finds none),
  // so the accept-only search doesn't see it: only the "by continuing" notice search can.
  const page = load([control("Accept")], { notices: [strip] });
  page.ctx.window.PrivaCCookieCheck();
  assert.deepStrictEqual(page.kinds(), ["acceptOnly"]);
  page.ctx.window.PrivaCCookieCheck();
  assert.deepStrictEqual(page.kinds(), ["acceptOnly"], "once per page");
});
