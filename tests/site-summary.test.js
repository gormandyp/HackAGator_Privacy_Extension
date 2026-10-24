// shared/site-summary.js: what the toolbar popup shows first for the site you're on.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
require("../shared/site-summary.js");
const { summarize, purposeOf, PURPOSES } = window.PrivaCSiteSummary;

const NOW = Date.parse("2026-10-24");
const scored = (s) => Object.assign({}, s, window.PrivaCData.computeScore(s, NOW));
const T = {
  gAds: { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" },
  gAn: { domain: "google-analytics.com", company: "Google", category: "Analytics", country: "US" },
  fb: { domain: "connect.facebook.net", company: "Facebook", category: "Advertising", country: "US" },
  amzn: { domain: "amazon-adsystem.com", company: "Amazon.com", category: "Advertising", country: "US" },
  hotjar: { domain: "hotjar.com", company: "Hotjar", category: "Session recording", country: "MT" },
  lr: { domain: "rlcdn.com", company: "LiveRamp", category: "Data broker", country: "US" },
  yandex: { domain: "mc.yandex.ru", company: "Yandex", category: "Session recording", country: "RU" },
  baidu: { domain: "hm.baidu.com", company: "Baidu", category: "Analytics", country: "CN", listed: true }
};

const cnn = scored({ domain: "cnn.com", trackers: [T.gAds, T.gAn, T.fb, T.amzn, T.hotjar, T.lr], cookieChoice: "no-reject", policy: { sells: true } });

test("reasons that add points come first, biggest first, and add up to the score", () => {
  const s = summarize(cnn, { now: NOW });
  assert.strictEqual(s.domain, "cnn.com");
  assert.strictEqual(s.grade, cnn.grade);
  assert.strictEqual(s.reasons.reduce((n, r) => n + r.points, 0), cnn.score);
  for (let i = 1; i < s.reasons.length; i++) assert.ok(s.reasons[i - 1].points >= s.reasons[i].points);
  assert.match(s.reasons[0].label, /6 tracker connections/);
  assert.strictEqual(s.reasons[0].source, "Seen on your visits in the last 7 days");
  assert.ok(s.reasons.some((r) => r.label === "Policy says it sells personal information" && r.source === "Disclosed in privacy policy"));
  assert.ok(s.reasons.every((r) => r.points > 0));
});

test("checks that added nothing are kept as short lines, good news marked good", () => {
  const s = summarize(cnn, { now: NOW });
  const flag = s.checks.find((c) => c.label === "No foreign-adversary links");
  const breach = s.checks.find((c) => c.label === "No known data breaches");
  assert.strictEqual(flag.tone, "good");
  assert.strictEqual(breach.tone, "good");
  const clean = summarize(scored({ domain: "quiet.example", trackers: [], cookieChoice: "none", policy: {} }), { now: NOW });
  assert.strictEqual(clean.reasons.length, 0);
  assert.strictEqual(clean.checks.find((c) => c.label === "Privacy policy not checked yet").tone, "info");
});

test("who saw your visit: companies with their main purpose, flagged first; purposes counted per tracker", () => {
  const s = summarize(scored({ domain: "tass.com", trackers: [T.gAds, T.yandex, T.fb, T.gAn], cookieChoice: "none", policy: {} }), { now: NOW });
  assert.strictEqual(s.trackerCount, 4);
  assert.strictEqual(s.companyCount, 3);
  assert.deepStrictEqual(s.companies.map((c) => c.name), ["Yandex", "Google", "Facebook"]);
  assert.strictEqual(s.companies[0].flagged, true);
  assert.strictEqual(s.companies[0].country, "Russia");
  assert.strictEqual(s.companies[1].purpose.key, "ads", "Google's main purpose is advertising, not measuring");
  assert.deepStrictEqual(s.purposes.map((p) => [p.key, p.n]), [["ads", 2], ["measure", 1], ["record", 1]]);
});

test("alerts: state-run media, then foreign-adversary trackers; one line each", () => {
  const tass = scored({ domain: "tass.com", owner: { company: "TASS", country: "RU", stateMedia: { classification: "SC" } }, trackers: [T.gAds, T.yandex], cookieChoice: "none", policy: {} });
  const s = summarize(tass, { now: NOW });
  assert.deepStrictEqual(s.alerts.map((a) => a.kind), ["state-media", "adversary"]);
  assert.strictEqual(s.alerts[0].title, "State-run media");
  assert.match(s.alerts[0].detail, /TASS \(Russia\)/);
  assert.strictEqual(s.alerts[1].title, "Foreign-adversary tracker");
  assert.match(s.alerts[1].detail, /Yandex \(Russia\)/);
});

test("1260H companies say so; a listed-country address only shows when nothing else explains it", () => {
  const baidu = summarize(scored({ domain: "example.cn", trackers: [T.baidu], cookieChoice: "none", policy: {} }), { now: NOW });
  assert.match(baidu.alerts[0].detail, /Baidu \(China; Pentagon 1260H list\)/);
  assert.ok(!baidu.alerts.some((a) => a.kind === "address"), "the tracker already explains the flag");
  const ir = summarize(scored({ domain: "news.example.ir", trackers: [], cookieChoice: "none", policy: {} }), { now: NOW });
  assert.deepStrictEqual(ir.alerts.map((a) => a.kind), ["address"]);
  assert.match(ir.alerts[0].detail, /\.ir \(Iran\)/);
});

test("a breach reported in the last year is an alert; an old one is only a check", () => {
  const wired = summarize(scored({ domain: "wired.com", trackers: [], cookieChoice: "declined", policy: {},
    breach: { name: "Wired", breachDate: "2025-12-01", addedDate: "2026-01-15", pwnCount: 2300000 } }), { now: NOW });
  assert.deepStrictEqual(wired.alerts.map((a) => a.kind), ["breach"]);
  assert.match(wired.alerts[0].detail, /Wired \(2025\), 2\.3 million accounts/);
  const snap = summarize(scored({ domain: "snapchat.com", trackers: [], cookieChoice: "declined", policy: {},
    breach: { name: "Snapchat", breachDate: "2013-12-31", addedDate: "2014-01-01", pwnCount: 4609615 } }), { now: NOW });
  assert.strictEqual(snap.alerts.length, 0);
  assert.ok(snap.checks.some((c) => /Past data breach on record \(Snapchat, 2013\)/.test(c.label) && c.tone === "info"));
});

test("C's verdict counts the companies and mentions the cookie choice; the headline is its first sentence", () => {
  const s = summarize(cnn, { now: NOW });
  assert.strictEqual(s.verdict,
    "Yikes. 5 outside companies saw your visits here this week. This site's cookie banner had no Reject button, only Accept.");
  assert.strictEqual(s.headline, "Yikes. 5 outside companies saw your visits here this week.");
  assert.strictEqual(s.cookieNote, "This site's cookie banner had no Reject button, only Accept.");
  const calm = summarize(scored({ domain: "docs.example", trackers: [], cookieChoice: "declined", policy: {} }), { now: NOW });
  assert.strictEqual(calm.verdict, "Looking good. No outside companies showed up here. You declined the extra cookies, nice.");
  const quiet = summarize(scored({ domain: "plain.example", trackers: [], cookieChoice: "none", policy: {} }), { now: NOW });
  assert.strictEqual(quiet.cookieNote, "");
});

test("every tracker category has a purpose, and unknown ones count as unlabelled tracking", () => {
  for (const cat of ["Advertising", "Analytics", "Session recording", "Data broker", "Social", "Malware", "High-risk", "Obscure ownership", "Tracking"]) {
    assert.ok(PURPOSES.some((p) => p.key === purposeOf(cat).key), cat);
  }
  assert.strictEqual(purposeOf("Measuring your visits").key, "measure", "the dashboard's labels map back too");
  assert.strictEqual(purposeOf("Something new").key, "other");
});
