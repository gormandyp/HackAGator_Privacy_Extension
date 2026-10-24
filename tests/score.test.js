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

// Breach rule v4 (repo owner, 2026-10-24): reported in the last 12 months 15; happened in the last 5 years 5;
// older than 5 years 0 unless major (100 million+ accounts) 5. Every breach is still listed.
test("breach in the last year adds 15, one in the last 5 years adds 5, older adds 0 but is listed", () => {
  const now = Date.parse("2026-10-23");
  const recent = computeScore({ trackers: [], breach: { name: "X", breachDate: "2026-06-01", addedDate: "2026-07-01" } }, now);
  const mid = computeScore({ trackers: [], breach: { name: "X", breachDate: "2023-01-01", addedDate: "2023-02-01" } }, now);
  const old = computeScore({ trackers: [], breach: { name: "Snapchat", breachDate: "2014-01-01", addedDate: "2014-01-02", pwnCount: 4609615 } }, now);
  assert.strictEqual(recent.score, 15);
  assert.strictEqual(mid.score, 5);
  assert.strictEqual(old.score, 0);
  assert.match(recent.parts.at(-1).label, /last year \(X, 2026\)/);
  assert.match(old.parts.at(-1).label, /Snapchat, 2014.*older than 5 years/);
});

test("a major old breach (100 million+ accounts) still adds 5", () => {
  const r = computeScore({ trackers: [], breach: { name: "LinkedIn", breachDate: "2012-05-05", addedDate: "2016-05-21", pwnCount: 164611595 } }, Date.parse("2026-10-23"));
  assert.strictEqual(r.score, 5);
  assert.match(r.parts.at(-1).label, /Major past data breach \(LinkedIn, 2012, 164 million accounts\)/);
});

test("all of a site's breaches are listed; points come from the worst one, counted once", () => {
  const breach = { name: "New", breachDate: "2024-03-01", addedDate: "2024-04-01", pwnCount: 1000,
    earlier: [{ name: "Old", breachDate: "2013-01-01", addedDate: "2014-01-01", pwnCount: 2000 }, { name: "Mid", breachDate: "2022-01-01", addedDate: "2022-02-01", pwnCount: 3000 }] };
  const r = computeScore({ trackers: [], breach }, Date.parse("2026-10-23"));
  assert.strictEqual(r.score, 5);
  assert.match(r.parts.at(-1).label, /New, 2024/);
  assert.match(r.parts.at(-1).label, /2 earlier breaches on record: Mid \(2022\), Old \(2013\)/);
});

test("grade boundaries", () => {
  assert.strictEqual(gradeFor(20), "A");
  assert.strictEqual(gradeFor(21), "B");
  assert.strictEqual(gradeFor(60), "C");
  assert.strictEqual(gradeFor(80), "D");
  assert.strictEqual(gradeFor(81), "F");
});

const fs = require("node:fs");
const flaggedFile = JSON.parse(fs.readFileSync(__dirname + "/../shared/flagged-companies.json", "utf8"));

test("1260H company: names the list and date, 15 points, never doubled with its country", () => {
  const data = { sites: [{ trackers: [{ domain: "baidu.com", company: "Baidu", category: "Tracking", country: "CN" }], cookieChoice: "declined", policy: {} }] };
  window.PrivaCData.annotateListed(data, flaggedFile);
  const r = computeScore(data.sites[0]);
  const line = r.parts.find(p => /1260H/.test(p.label));
  assert.match(line.label, /Baidu, on the Pentagon's Section 1260H list of Chinese military companies \(June 2026\)/);
  assert.strictEqual(r.score, 5 + 15);
});

test("a site owned by a company in a listed country gets the same single flag", () => {
  const r = computeScore({ trackers: [], owner: { company: "Yandex", country: "RU" }, cookieChoice: "none", policy: {} });
  assert.strictEqual(r.score, 15);
  assert.match(r.parts.find(p => p.points === 15).label, /owned by Yandex, based in Russia/);
  const both = computeScore({ trackers: [tracker("Analytics", "RU")], owner: { company: "Yandex", country: "RU" }, cookieChoice: "declined", policy: {} });
  assert.strictEqual(both.score, 5 + 15);
});
