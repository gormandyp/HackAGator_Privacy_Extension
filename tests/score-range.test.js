// Score range, coverage and the Fully / Partly checked label (ideas from Justin's docs/New-Privacy-Grade_Scale,
// repo owner 2026-10-24: keep the points and A-F cutoffs; unknown things still add 0 to the score itself).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
const { computeScore, RUBRIC_MAX } = window.PrivaCData;

const ad = { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" };

test("the rubric's line maximums add up to 115 (the score itself is capped at 100)", () => {
  assert.strictEqual(RUBRIC_MAX, 40 + 20 + 10 + 15 + 15 + 15);
});

test("everything checked: range is just the score, coverage 100%, evidence-supported", () => {
  const r = computeScore({ trackers: [ad], cookieChoice: "declined", policy: { sells: false, shares: false, source: "https://x.example/privacy" } });
  assert.strictEqual(r.score, 10);
  assert.deepStrictEqual(r.range, { min: 10, max: 10 });
  assert.strictEqual(r.coverage, 1);
  assert.strictEqual(r.scoreKind, "evidence-supported");
  assert.deepStrictEqual(r.unknowns, []);
});

test("policy not read: score unchanged, range reaches +15, coverage 100 of 115, partly checked", () => {
  const r = computeScore({ trackers: [ad], cookieChoice: "declined", policy: { sells: null, shares: null, source: null } });
  assert.strictEqual(r.score, 10, "unknown things still add nothing to the score itself");
  assert.deepStrictEqual(r.range, { min: 10, max: 25 });
  assert.strictEqual(r.coverage, 100 / 115);
  assert.strictEqual(r.scoreKind, "partly-checked");
  assert.deepStrictEqual(r.unknowns, ["the privacy policy isn't read yet"]);
});

test("policy read but silent: its own label, still unknown, same range", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: null, shares: null, source: "https://x.example/privacy" } });
  const line = r.parts.find((p) => p.kind === "disclosed");
  assert.strictEqual(line.label, "Privacy policy read, but it doesn't say whether it sells or shares");
  assert.strictEqual(line.points, 0);
  assert.deepStrictEqual(r.range, { min: 0, max: 15 });
  assert.deepStrictEqual(r.unknowns, ["the privacy policy doesn't say whether it sells or shares"]);
});

test("policy says it shares but not whether it sells: 8 now, up to 15", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: null, shares: true, source: "https://x.example/privacy" } });
  assert.strictEqual(r.score, 8);
  assert.deepStrictEqual(r.range, { min: 8, max: 15 });
  assert.strictEqual(r.scoreKind, "partly-checked");
  assert.deepStrictEqual(r.unknowns, ["the privacy policy doesn't say whether it sells"]);
});

test("policy says it doesn't sell but not whether it shares: 0 now, up to 8", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: false, shares: null, source: "https://x.example/privacy" } });
  assert.strictEqual(r.score, 0);
  assert.deepStrictEqual(r.range, { min: 0, max: 8 });
  assert.deepStrictEqual(r.unknowns, ["the privacy policy doesn't say whether it shares"]);
});

// Docs thread, 2026-10-25: a policy that says it doesn't sell but never mentions sharing was labelled "doesn't say whether
// it sells or shares". The label now says what the policy does say, and only the open question is left open.
test("policy says it doesn't sell, silent on sharing: the label says so", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: false, shares: null, source: "https://x.example/privacy" } });
  assert.strictEqual(r.parts.find((p) => p.kind === "disclosed").label, "Policy says it doesn't sell personal information, but doesn't say whether it shares");
});

test("policy says it doesn't share, silent on selling: the label says so, and only selling is unknown", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: null, shares: false, source: "https://x.example/privacy" } });
  assert.strictEqual(r.parts.find((p) => p.kind === "disclosed").label, "Policy says it doesn't share information with partners, but doesn't say whether it sells");
  assert.deepStrictEqual(r.unknowns, ["the privacy policy doesn't say whether it sells"]);
  assert.deepStrictEqual(r.range, { min: 0, max: 15 });
});

test("policy says it sells: resolved, whatever it says about sharing", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: true, shares: null, source: "https://x.example/privacy" } });
  assert.strictEqual(r.score, 15);
  assert.deepStrictEqual(r.range, { min: 15, max: 15 });
  assert.strictEqual(r.scoreKind, "evidence-supported");
});

test("the range's worst end is capped at 100, like the score", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ...ad, domain: `ad${i}.example`, company: `Ad Co ${i}`, country: i ? "US" : "CN" }));
  const r = computeScore({ trackers: many, cookieChoice: "accepted", policy: {}, breach: { name: "X", breachDate: "2026-06-01", addedDate: "2026-07-01" } }, Date.parse("2026-10-24"));
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.range, { min: 100, max: 100 });
});

test("the score always sits inside its range, and coverage stays between 0 and 1", () => {
  const sites = [
    { trackers: [] }, { trackers: [ad], policy: { shares: true } }, { trackers: [ad, ad], cookieChoice: "accepted", policy: { sells: false } },
    { trackers: [], cookieChoice: "no-reject", policy: { sells: true, shares: true } }
  ];
  for (const s of sites) {
    const r = computeScore(s);
    assert.ok(r.range.min <= r.score && r.score <= r.range.max, JSON.stringify(s));
    assert.ok(r.coverage >= 0 && r.coverage <= 1);
  }
});

test("policy says it doesn't sell but does share: settled at 8", () => {
  const r = computeScore({ trackers: [], cookieChoice: "none", policy: { sells: false, shares: true, source: "https://x.example/privacy" } });
  assert.strictEqual(r.score, 8);
  assert.deepStrictEqual(r.range, { min: 8, max: 8 });
  assert.strictEqual(r.scoreKind, "evidence-supported");
});
