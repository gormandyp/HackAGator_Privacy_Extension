// Run with: node --test
// The suggested Ask C questions adapt to the person's own browsing (docs/IDEA.md).
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../dashboard/ask-c.js");
const { suggestionsFor, sampleFor } = window.PrivaCAsk;

const t = (company, extra = {}) => ({ domain: `${company.toLowerCase()}.example`, company, category: "Advertising", country: "US", ...extra });
const real = {
  sample: false,
  sites: [
    { domain: "cnn.com", grade: "D", score: 62, trackers: [t("Criteo"), t("LiveRamp", { broker: "LiveRamp, Inc." })], cookies: [{ name: "_fbp" }] },
    { domain: "wired.com", grade: "C", score: 45, trackers: [t("Criteo")], breach: { title: "Wired" } },
    { domain: "google.com", grade: "A", score: 0, trackers: [] }
  ]
};

test("sample data keeps the fixed questions, which have sample answers", () => {
  const qs = suggestionsFor({ sample: true, sites: real.sites });
  assert.ok(qs.length >= 3);
  for (const q of qs.slice(0, 3)) assert.ok(sampleFor(q), `no sample answer for "${q}"`);
});

test("real browsing: riskiest site, most common tracker company, breached site", () => {
  const qs = suggestionsFor(real);
  assert.ok(qs.includes("Why did cnn.com get a D?"), qs.join(" | "));
  assert.ok(qs.includes("Who is Criteo and should I worry?"), qs.join(" | "));
  assert.ok(qs.includes("Was wired.com hacked?"), qs.join(" | "));
});

test("at most 4 questions, no repeats, 'an' before A and F", () => {
  const qs = suggestionsFor({ sample: false, sites: [{ domain: "bad.com", grade: "F", score: 90, trackers: [t("Yandex", { country: "RU" })] }] });
  assert.ok(qs.length <= 4);
  assert.strictEqual(new Set(qs).size, qs.length);
  assert.ok(qs.includes("Why did bad.com get an F?"), qs.join(" | "));
});

test("a site with only an A grade isn't suggested as risky", () => {
  const qs = suggestionsFor({ sample: false, sites: [real.sites[2]] });
  assert.ok(!qs.some((q) => q.startsWith("Why did google.com")), qs.join(" | "));
  assert.ok(qs.length >= 2);
});
