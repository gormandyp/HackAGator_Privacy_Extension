// Steadier grades between people and reloads (repo owner, 2026-10-24: "the same individual can open a tab
// multiple times and the score can significantly change"). Each company counts once, however many web
// addresses it loads from; and only companies seen on at least half of your visits add points.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
const { computeScore } = window.PrivaCData;

const t = (domain, company, category = "Advertising", country = "US") => ({ domain, company, category, country });
const google = [t("doubleclick.net", "Google"), t("googlesyndication.com", "Google"), t("google-analytics.com", "Google", "Analytics"), t("googletagmanager.com", "Google", "Analytics")];
const settled = { cookieChoice: "declined", policy: { sells: false, shares: false } };

test("one company with four web addresses counts once: 5 + 5, not 20 + 10", () => {
  const r = computeScore({ trackers: google, ...settled });
  assert.strictEqual(r.score, 10);
  assert.strictEqual(r.parts[0].label, "1 outside company with trackers here");
  assert.strictEqual(r.parts[1].label, "1 of them for advertising, data brokering or recording your screen");
});

test("different companies still count one each, with the same caps (40 and 20)", () => {
  const many = Array.from({ length: 12 }, (_, i) => t(`ad${i}.example`, `Ad Co ${i}`));
  const r = computeScore({ trackers: [...many, ...google], ...settled });
  assert.strictEqual(r.parts[0].points, 40);
  assert.strictEqual(r.parts[1].points, 20);
  assert.match(r.parts[0].label, /^13 outside companies/);
});

test("a company counts for advertising if any of its addresses does", () => {
  const r = computeScore({ trackers: [t("a.example", "Acme", "Analytics"), t("b.example", "Acme", "Advertising"), t("c.example", "Stats Inc", "Analytics")], ...settled });
  assert.strictEqual(r.parts[0].points, 10);
  assert.strictEqual(r.parts[1].points, 5);
});

test("the same visit in a different order gives the same score", () => {
  const a = computeScore({ trackers: [...google, t("criteo.com", "Criteo", "Advertising", "FR")], ...settled });
  const b = computeScore({ trackers: [t("criteo.com", "Criteo", "Advertising", "FR"), ...google.slice().reverse()], ...settled });
  assert.strictEqual(a.score, b.score);
});

test("over several visits, only companies seen on at least half of them add points; the rest are listed", () => {
  const site = {
    trackers: [...google, t("criteo.com", "Criteo"), t("rubicon.example", "Rubicon"), t("pubmatic.example", "PubMatic")],
    visits: 4,
    companyVisits: { Google: { n: 4 }, Criteo: { n: 2 }, Rubicon: { n: 1 }, PubMatic: { n: 1 } },
    ...settled
  };
  const r = computeScore(site);
  assert.strictEqual(r.parts[0].points, 10, "Google and Criteo");
  assert.strictEqual(r.parts[1].points, 10);
  const once = r.parts.find((p) => /fewer than half/.test(p.label));
  assert.strictEqual(once.points, 0);
  assert.strictEqual(once.label, "Also seen on fewer than half of your 4 visits (0 points): PubMatic, Rubicon");
});

test("reloading can't pile points up: a one-off ad company on a 3rd visit adds nothing", () => {
  const two = computeScore({ trackers: google, visits: 2, companyVisits: { Google: { n: 2 } }, ...settled });
  const three = computeScore({ trackers: [...google, t("x.example", "One Off Ads")], visits: 3, companyVisits: { Google: { n: 3 }, "One Off Ads": { n: 1 } }, ...settled });
  assert.strictEqual(three.score, two.score);
});

test("first visit, or a record with no visit counts (older data, sample data): every company counts", () => {
  const first = computeScore({ trackers: [...google, t("criteo.com", "Criteo")], visits: 1, companyVisits: { Google: { n: 1 }, Criteo: { n: 1 } }, ...settled });
  const old = computeScore({ trackers: [...google, t("criteo.com", "Criteo")], ...settled });
  assert.strictEqual(first.score, 20);
  assert.strictEqual(old.score, 20);
  assert.ok(!first.parts.some((p) => /fewer than half/.test(p.label)));
});

test("a foreign-adversary company is flagged even if it showed up only once", () => {
  const r = computeScore({ trackers: [...google, t("mc.yandex.ru", "Yandex", "Analytics", "RU")], visits: 4,
    companyVisits: { Google: { n: 4 }, Yandex: { n: 1 } }, ...settled });
  assert.strictEqual(r.flagged.length, 1);
  assert.ok(r.parts.some((p) => p.points === 15 && /Yandex \(Russia\)/.test(p.label)));
});

// Cookie part (repo owner 2026-10-24, top option): trackers that load only after you click Accept are listed but add
// no tracker points, so the site's grade is about the site; your choice still costs its 10 cookie points.
test("companies that loaded only after you clicked Accept are listed, 0 points; Accept itself still costs 10", () => {
  const base = [t("connect.facebook.net", "Meta"), t("google-analytics.com", "Google", "Analytics")];
  const extra = [t("criteo.com", "Criteo", "Advertising", "FR"), t("rlcdn.com", "LiveRamp", "Data broker")].map((x) => ({ ...x, afterAccept: true }));
  const declined = computeScore({ trackers: base, cookieChoice: "declined", policy: {} });
  const accepted = computeScore({ trackers: [...base, ...extra], cookieChoice: "accepted", policy: {} });
  assert.strictEqual(accepted.score - declined.score, 10);
  const line = accepted.parts.find((p) => /after you clicked Accept/.test(p.label));
  assert.strictEqual(line.points, 0);
  assert.strictEqual(line.label, "Loaded only after you clicked Accept (listed, 0 points; accepting costs the 10 cookie points): Criteo, LiveRamp");
});

test("a company that also loaded before Accept (any of its addresses) still counts", () => {
  const r = computeScore({ trackers: [t("doubleclick.net", "Google"), { ...t("googlesyndication.com", "Google"), afterAccept: true }], cookieChoice: "accepted", policy: {} });
  assert.strictEqual(r.parts[0].points, 5);
  assert.ok(!r.parts.some((p) => /after you clicked Accept/.test(p.label)));
});

test("an after-Accept company is listed once, on the Accept line, not also on the fewer-than-half line", () => {
  const r = computeScore({ trackers: [t("doubleclick.net", "Google"), { ...t("criteo.com", "Criteo"), afterAccept: true }],
    visits: 4, companyVisits: { Google: { n: 4 }, Criteo: { n: 1 } }, cookieChoice: "accepted", policy: {} });
  assert.ok(!r.parts.some((p) => /fewer than half/.test(p.label)));
  assert.match(r.parts.find((p) => /after you clicked Accept/.test(p.label)).label, /: Criteo$/);
});
