// Impact + safety counters (shared/stats.js): numbers per day, kept 90 days, never site names.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
globalThis.window = globalThis;
require("../shared/stats.js");
const S = window.PrivaCStats;
const day = (s) => Date.parse(s + "T12:00:00");

test("events add up per day; unknown event names are ignored", () => {
  let st = null;
  st = S.addEvents(st, { "popup-cookie": 2, "decline-click": 1, "made-up": 5 }, day("2026-10-24"));
  st = S.addEvents(st, { "popup-cookie": 1 }, day("2026-10-24"));
  assert.deepStrictEqual(st.days["2026-10-24"].events, { "popup-cookie": 3, "decline-click": 1 });
});

test("kept 90 days, then dropped", () => {
  let st = S.addEvents(null, { "popup-adversary": 1 }, day("2026-07-01"));
  st = S.addEvents(st, { "popup-adversary": 1 }, day("2026-10-24"));
  assert.deepStrictEqual(Object.keys(st.days), ["2026-10-24"]);
});

const scored = (domain, grade, extra = {}) => ({ domain, lastVisit: "2026-10-24T15:00:00Z", grade, trackers: [{ category: "Advertising" }, { category: "Analytics" }],
  cookies: [{ category: "Marketing" }, { category: "Necessary" }], cookieChoice: "declined", flagged: [], ownerFlag: null, addressFlag: null, serverFlag: null, breach: null, ...extra });

test("a day's snapshot is numbers only: grades, trackers, cookies, cookie choices, unsafe and flagged sites", () => {
  const sites = [scored("a.example", "A"), scored("b.example", "F", { cookieChoice: "accepted", flagged: [{}], breach: { name: "B" } }),
    scored("old.example", "D", { lastVisit: "2026-10-20T10:00:00Z" })];
  const snap = S.snapshot(sites, day("2026-10-24"));
  assert.deepStrictEqual(snap, { sites: 2, grades: { A: 1, B: 0, C: 0, D: 0, F: 1 }, unsafeSites: 1, flaggedSites: 1, breachedSites: 1,
    trackers: 4, adTrackers: 2, cookies: 4, trackingCookies: 2, declined: 1, accepted: 1, noReject: 0, neverAsked: 0 });
  assert.ok(!JSON.stringify(snap).includes("example"));
});

test("day / week / month summaries add events and snapshots; total pop-ups = all of C's warnings", () => {
  let st = null;
  st = S.addEvents(st, { "popup-cookie": 2, "popup-adversary": 1, "decline-confirmed": 1 }, day("2026-10-24"));
  st = S.addEvents(st, { "popup-accept-only": 3 }, day("2026-10-20"));
  st = S.addEvents(st, { "popup-cookie": 4 }, day("2026-10-01"));
  st = S.setSnapshot(st, { sites: 5, grades: { A: 5, B: 0, C: 0, D: 0, F: 0 }, unsafeSites: 0, flaggedSites: 0, breachedSites: 0, trackers: 9, adTrackers: 1, cookies: 3, trackingCookies: 1, declined: 1, accepted: 0, noReject: 0, neverAsked: 0 }, day("2026-10-24"));
  const now = day("2026-10-24");
  assert.strictEqual(S.summary(st, "day", now).totals.popups, 3);
  assert.strictEqual(S.summary(st, "week", now).totals.popups, 6);
  assert.strictEqual(S.summary(st, "month", now).totals.popups, 10);
  const w = S.summary(st, "week", now);
  assert.strictEqual(w.days.length, 7);
  assert.strictEqual(w.totals.trackers, 9);
  assert.strictEqual(w.totals.events["decline-confirmed"], 1);
  assert.strictEqual(S.summary(st, "month", now).days.length, 30);
});

test("background: C events are counted (batched writes) and Clear my data removes them", async () => {
  let store = {}; let writes = 0; const listeners = [];
  const ctx = { console, Promise, setTimeout, clearTimeout, Date,
    chrome: { storage: { local: { get: async (k) => ({ [k]: store[k] && JSON.parse(JSON.stringify(store[k])) }), set: async (o) => { writes++; Object.assign(store, JSON.parse(JSON.stringify(o))); } },
      onChanged: { addListener() {} } },
      runtime: { onMessage: { addListener: (fn) => listeners.push(fn) } }, alarms: { create() {}, onAlarm: { addListener() {} } } } };
  ctx.self = ctx; ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/stats.js", "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/stats.js", "utf8") + ";this.flushStats = flushStats;", ctx);
  for (let i = 0; i < 5; i++) listeners[0]({ type: "privac-event", event: "popup-cookie", domain: "x.example" }, {});
  listeners[0]({ type: "privac-event", event: "decline-click", domain: "x.example" }, {});
  await ctx.flushStats();
  const today = Object.keys(store.privacStats.days)[0];
  assert.deepStrictEqual(store.privacStats.days[today].events, { "popup-cookie": 5, "decline-click": 1 });
  assert.strictEqual(writes, 1);
  assert.ok(!JSON.stringify(store.privacStats).includes("x.example"));
});
