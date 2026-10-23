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

test("unknown policy and no cookie choice are not treated as safe", () => {
  const r = computeScore({ trackers: [] , cookieChoice: "none", policy: { sells: null, shares: null } });
  assert.strictEqual(r.score, 10);
});

test("grade boundaries", () => {
  assert.strictEqual(gradeFor(20), "A");
  assert.strictEqual(gradeFor(21), "B");
  assert.strictEqual(gradeFor(60), "C");
  assert.strictEqual(gradeFor(80), "D");
  assert.strictEqual(gradeFor(81), "F");
});
