// F1: a site's own country web address (.ir, .ru, .cn ...) counts as the foreign-adversary line.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
const { computeScore, countryOfAddress } = window.PrivaCData;

const flagLine = (r) => r.parts.find(p => /foreign-adversary|country code|1260H/.test(p.label) && p.points === 15);

test("country web addresses map to the 15 CFR 7.4 countries", () => {
  assert.strictEqual(countryOfAddress("en.irna.ir"), "IR");
  assert.strictEqual(countryOfAddress("ya.ru"), "RU");
  assert.strictEqual(countryOfAddress("old.example.su"), "RU");
  assert.strictEqual(countryOfAddress("xn--80aswg.xn--p1ai"), "RU");   // .рф
  assert.strictEqual(countryOfAddress("news.cn"), "CN");
  assert.strictEqual(countryOfAddress("www.gov.hk"), "HK");
  assert.strictEqual(countryOfAddress("granma.cu"), "CU");
  assert.strictEqual(countryOfAddress("kcna.kp"), "KP");
  assert.strictEqual(countryOfAddress("vtv.gob.ve"), "VE");
  assert.strictEqual(countryOfAddress("cgtn.com"), null);
  assert.strictEqual(countryOfAddress("bbc.co.uk"), null);
  assert.strictEqual(countryOfAddress(""), null);
});

test("a .ir site with no trackers gets the full 15-point line, naming the ending and the country", () => {
  const r = computeScore({ domain: "en.irna.ir", trackers: [], cookieChoice: "none", policy: {} });
  assert.strictEqual(r.score, 15);
  assert.match(flagLine(r).label, /\.ir.*Iran/);
  assert.strictEqual(r.addressFlag.country, "IR");
});

test(".рф shows as .рф, not its punycode", () => {
  const r = computeScore({ domain: "xn--80aswg.xn--p1ai", trackers: [], cookieChoice: "none", policy: {} });
  assert.match(flagLine(r).label, /\.рф/);
});

test("never doubled: a .ru site with a Russian tracker and a Russian owner is still 15", () => {
  const r = computeScore({ domain: "ya.ru", owner: { company: "Yandex", country: "RU" },
    trackers: [{ domain: "mc.yandex.ru", company: "Yandex", category: "Analytics", country: "RU" }], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 5 + 15);
  assert.strictEqual(r.parts.filter(p => p.points === 15).length, 1);
});

test("unknown outside servers with those endings get a label only (0 points)", () => {
  const r = computeScore({ domain: "news.example", trackers: [], foreignHosts: ["cip.cu", "tns-counter.ru"], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 0);
  const line = r.parts.find(p => /cip\.cu/.test(p.label));
  assert.strictEqual(line.points, 0);
  assert.match(line.label, /cip\.cu \(Cuba\)/);
  assert.match(line.label, /tns-counter\.ru \(Russia\)/);
  assert.match(line.label, /owner unknown/);
});

test("a known tracker with no country but a listed ending is also label only", () => {
  const r = computeScore({ domain: "news.example", trackers: [{ domain: "b37mrtl.ru", company: "Unknown Co", category: "Analytics", country: null }], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 5);
  assert.ok(r.parts.some(p => /b37mrtl\.ru \(Russia\)/.test(p.label) && p.points === 0));
});

test("ordinary sites get no extra line and the breach line stays last", () => {
  const r = computeScore({ domain: "cnn.com", trackers: [], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.parts.length, 6);
  assert.strictEqual(r.addressFlag, null);
  assert.match(r.parts.at(-1).label, /breach/);
});
