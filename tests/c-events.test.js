// content/c-events.js: counts C's pop-ups and button clicks, and reports cookie choices to the background,
// without changing Matthew's c-prompt.js or cookie-detector.js.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function load(pageButtons = []) {
  const sent = [], calls = [], listeners = {};
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
    chrome: { runtime: { sendMessage: (m) => sent.push(m) } } };
  ctx.window = ctx;
  ctx.window.PrivaCPrompt = P;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../content/c-events.js", "utf8"), ctx);
  return { P: ctx.window.PrivaCPrompt, sent, calls, listeners };
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
