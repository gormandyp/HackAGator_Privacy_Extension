// content/c-events.js: counts C's pop-ups and button clicks, and reports cookie choices to the background,
// without changing Matthew's c-prompt.js or cookie-detector.js.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function load(pageButtons = [], settings = null, settingsLater = false) {
  const sent = [], calls = [], listeners = {};
  const storageListeners = [];
  const P = {
    cookie(opts) { calls.push(["cookie", opts]); },
    acceptOnly() { calls.push(["acceptOnly"]); },
    adversary(o) { calls.push(["adversary", o]); },
    ignored() { calls.push(["ignored"]); },
    hide() {}
  };
  const document = {
    addEventListener: (name, fn) => { listeners[name] = fn; },
    querySelectorAll: () => pageButtons
  };
  const ctx = { console, Promise, location: { hostname: "www.news.example" }, document,
    chrome: { runtime: { sendMessage: (m) => sent.push(m) },
      storage: { local: { get: () => ({ then: (fn) => { const give = () => fn({ privacSettings: settings }); if (settingsLater) setTimeout(give, 0); else give(); return { catch() {} }; } }) },
                 onChanged: { addListener: (fn) => storageListeners.push(fn) } } } };
  ctx.window = ctx;
  ctx.window.PrivaCPrompt = P;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../content/c-events.js", "utf8"), ctx);
  return { P: ctx.window.PrivaCPrompt, sent, calls, listeners, storageListeners, document };
}
const events = (sent) => sent.filter(m => m.type === "privac-event").map(m => m.event);
const choices = (sent) => sent.filter(m => m.type === "cookieChoice").map(m => m.choice);

test("each C pop-up is counted, and the original pop-up still runs", () => {
  const { P, sent, calls } = load();
  P.cookie({});
  P.acceptOnly();
  P.adversary({ companies: ["Yandex (Russia)"] });
  assert.deepStrictEqual(calls.map(c => c[0]), ["cookie", "acceptOnly", "adversary"]);
  assert.deepStrictEqual(events(sent), ["popup-cookie", "popup-accept-only", "popup-adversary"]);
  assert.strictEqual(sent[0].domain, "news.example");
});

test("'Decline extras' clicks are counted; a confirmed decline is recorded through the background", async () => {
  const { P, sent, calls } = load();
  P.cookie({ onDecline: async () => "confirmed", onChoose: () => "opened" });
  const opts = calls[0][1];
  assert.strictEqual(await opts.onDecline(), "confirmed");
  assert.strictEqual(opts.onChoose(), "opened");
  assert.deepStrictEqual(events(sent), ["popup-cookie", "decline-click", "decline-confirmed", "choose-click"]);
  assert.deepStrictEqual(choices(sent), ["declined"]);
});

test("an unconfirmed decline is counted as a click but not recorded as declined", async () => {
  const { P, sent, calls } = load();
  P.cookie({ onDecline: async () => "unconfirmed" });
  await calls[0][1].onDecline();
  assert.deepStrictEqual(choices(sent), []);
});

test("a banner with only an Accept button is recorded as no-reject; rejecting on the site yourself counts as declined", () => {
  const { P, sent } = load();
  P.acceptOnly();
  P.ignored();
  assert.deepStrictEqual(choices(sent), ["no-reject", "declined"]);
  assert.ok(events(sent).includes("rejected-on-site"));
});

test("no 'no-reject' when the page offered 'Do not sell or share my personal information' (C clicked it)", () => {
  const optOut = { innerText: "Do not sell or share my personal information", getAttribute: () => null };
  const { P, sent } = load([optOut]);
  P.acceptOnly();
  assert.deepStrictEqual(choices(sent), []);
  assert.ok(events(sent).includes("popup-accept-only"));
});

test("clicking a cookie banner's Accept button yourself is recorded as accepted", () => {
  const { sent, listeners } = load();
  const banner = { id: "onetrust-banner-sdk", className: "", parentElement: null };
  const accept = { tagName: "BUTTON", innerText: "Accept All Cookies", id: "", className: "", parentElement: banner,
    closest: () => accept, getAttribute: () => null };
  listeners.click({ isTrusted: true, target: accept });
  listeners.click({ isTrusted: false, target: accept });                       // scripted clicks don't count
  const other = { tagName: "BUTTON", innerText: "Accept", id: "", className: "", parentElement: { id: "checkout", className: "", parentElement: null }, closest: () => other, getAttribute: () => null };
  listeners.click({ isTrusted: true, target: other });                          // not in a cookie banner
  assert.deepStrictEqual(choices(sent), ["accepted"]);
});

test("pop-ups turned off in Settings don't show and aren't counted; cookie choices are still recorded", () => {
  const { P, sent, calls } = load([], { popups: { adversary: false, acceptOnly: false } });
  P.adversary({ companies: ["Baidu (China)"] });
  P.acceptOnly();
  P.cookie({});
  assert.deepStrictEqual(calls.map(c => c[0]), ["cookie"]);
  assert.deepStrictEqual(events(sent), ["popup-cookie"]);
  assert.deepStrictEqual(choices(sent), ["no-reject"]);
});

test("changing a setting takes effect right away on open pages", () => {
  const { P, calls, storageListeners } = load();
  storageListeners.forEach(fn => fn({ privacSettings: { newValue: { popups: { cookie: false } } } }, "local"));
  P.cookie({});
  P.adversary({});
  assert.deepStrictEqual(calls.map(c => c[0]), ["adversary"]);
});


test("Protect me automatically: C declines without waiting for a click, and it's counted like a click", async () => {
  const { P, sent, calls } = load([], { autoDecline: true });
  await Promise.resolve();
  P.cookie({ onDecline: async () => "confirmed" });
  assert.strictEqual(calls[0][1].auto, true);
  await calls[0][1].onDecline();
  assert.deepStrictEqual(events(sent), ["popup-cookie", "auto-decline", "decline-click", "decline-confirmed"]);
  assert.deepStrictEqual(choices(sent), ["declined"]);
});

test("Protect me automatically still works when the cookie question itself is turned off", async () => {
  const { P, calls } = load([], { autoDecline: true, popups: { cookie: false } });
  await Promise.resolve();
  P.cookie({ onDecline: async () => "confirmed" });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][1].auto, true);
});

test("without the setting, C asks first as before", async () => {
  const { P, calls } = load();
  await Promise.resolve();
  P.cookie({ onDecline: async () => "confirmed" });
  assert.ok(!calls[0][1].auto);
});

test("Protect me automatically when the settings arrive after C already asked (first check on page load)", async () => {
  const decline = { clicks: 0, click() { this.clicks++; } };
  const host = { shadowRoot: { querySelector: (s) => (s === '[data-a="decline"]' ? decline : null) } };
  const { P, calls, document } = load([], { autoDecline: true }, true);
  document.querySelectorAll = (s) => (s === "privac-prompt" && calls.length ? [host] : []);
  P.cookie({ onDecline: async () => "confirmed" });       // before the saved settings are read
  assert.ok(!calls[0][1].auto);
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(decline.clicks, 1, "C presses Protect me for you once the setting is known");
});
