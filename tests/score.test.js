// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;           // data.js attaches PrivaCData to window
require("../shared/data.js");
const { computeScore, gradeFor } = window.PrivaCData;

const tracker = (category, country = "US") => ({ domain: "x.com", company: "X", category, country });

test("no trackers, declined cookies, clean policy = exposure 0, grade A", () => {
  const r = computeScore({ trackers: [], cookieChoice: "declined", policy: { sells: false, shares: false } });
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.grade, "A");
});

test("tracker points cap at 40, ad points cap at 20", () => {
  const many = Array.from({ length: 12 }, () => tracker("Advertising"));
  const r = computeScore({ trackers: many, cookieChoice: "declined", policy: { sells: false, shares: false } });
  assert.strictEqual(r.score, 60);
});

test("foreign-adversary country adds 15 and is flagged", () => {
  const r = computeScore({ trackers: [tracker("Analytics", "CN")], cookieChoice: "declined", policy: { sells: false, shares: false } });
  assert.strictEqual(r.flagged.length, 1);
  assert.strictEqual(r.score, 5 + 15);
});

test("no banner with trackers = never asked = 10; no banner and nothing tracking = 0", () => {
  const tracked = computeScore({ trackers: [tracker("Analytics")], cookieChoice: "none", policy: {} });
  assert.strictEqual(tracked.score, 5 + 10);
  const cookieOnly = computeScore({ trackers: [], cookies: [{ name: "_fbp", category: "Marketing" }], cookieChoice: "none", policy: {} });
  assert.strictEqual(cookieOnly.score, 10);
});

test("rubric v3: no banner, no tracking and an unchecked policy add nothing", () => {
  const r = computeScore({ trackers: [] , cookieChoice: "none", policy: { sells: null, shares: null } });
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.grade, "A");
});

test("a banner with no reject option costs as much as accepting all", () => {
  const r = computeScore({ trackers: [], cookieChoice: "no-reject", policy: {} });
  assert.strictEqual(r.score, 10);
});

test("session recording counts with advertising", () => {
  const r = computeScore({ trackers: [tracker("Session recording")], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 10);
});

test("breach in the last year adds 15, an older one adds 5", () => {
  const now = Date.parse("2026-10-23");
  const recent = computeScore({ trackers: [], breach: { name: "X", breachDate: "2026-06-01", addedDate: "2026-07-01" } }, now);
  const old = computeScore({ trackers: [], breach: { name: "X", breachDate: "2021-01-01", addedDate: "2021-02-01" } }, now);
  assert.strictEqual(recent.score, 15);
  assert.strictEqual(old.score, 5);
  assert.match(recent.parts.at(-1).label, /last year \(X, 2026\)/);
});

test("grade boundaries", () => {
  assert.strictEqual(gradeFor(20), "A");
  assert.strictEqual(gradeFor(21), "B");
  assert.strictEqual(gradeFor(60), "C");
  assert.strictEqual(gradeFor(80), "D");
  assert.strictEqual(gradeFor(81), "F");
});
