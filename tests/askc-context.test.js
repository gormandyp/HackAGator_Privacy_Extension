// Run with: node --test
// Ask C speed: Gemma reads a short, question-focused summary of your browsing instead of every site in full.
// (A week of browsing used to be ~40,000 words of evidence: slow to read and cut off by the model's context.)
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/askc.js");
const { buildContext, answer } = window.PrivaCAskC;

const T = (company, category = "Advertising", country = "US", extra = {}) => ({ domain: company.toLowerCase().replace(/\W/g, "") + ".example", company, category, country, ...extra });
function site(i, more = {}) {
  const trackers = Array.from({ length: 20 }, (_, k) => T(`Company${(i + k) % 40}`));
  const cookies = Array.from({ length: 30 }, (_, k) => ({ name: `c${k}`, domain: `site${i}.example`, firstParty: true, category: k % 2 ? "Marketing" : "Functional", company: "X", purpose: "A long description of what this cookie is for, kept from the Open Cookie Database.", days: 30 }));
  return { domain: `site${i}.example`, lastVisit: "2026-10-23T10:00:00Z", grade: "C", score: 50 + (i % 40), cookieChoice: "accepted", cookies,
    policy: { sells: null, shares: null, source: null }, trackers, ...more };
}

test("a big week of browsing stays short for Gemma", () => {
  const sites = Array.from({ length: 200 }, (_, i) => site(i));
  const ctx = buildContext({ sites }, "2026-10-24", [], null, "Which sites I visited are the riskiest?");
  assert.ok(ctx.length < 20000, `context is ${ctx.length} characters`);
  assert.match(ctx, /200 sites/);                          // every site still counted
  assert.match(ctx, /site39\.example, visited 2026-10-23: grade C, exposure 89\/100/);   // riskiest in full
});

test("the site named in the question gets its full details even when it isn't risky", () => {
  const sites = Array.from({ length: 60 }, (_, i) => site(i));
  sites.push({ ...site(99), domain: "quietnews.example", grade: "A", score: 5 });
  for (const q of ["Why did quietnews.example get an A?", "What is quietnews collecting about me?"]) {
    const ctx = buildContext({ sites }, "2026-10-24", [], null, q);
    assert.match(ctx, /- quietnews\.example, visited 2026-10-23: grade A, exposure 5\/100/, q);
  }
});

test("sites where a company you asked about was seen are shown in full", () => {
  const sites = Array.from({ length: 60 }, (_, i) => site(i));
  sites.push({ ...site(98), domain: "lowrisk.example", grade: "A", score: 10, trackers: [T("LiveRamp", "Data broker", "US", { broker: "LiveRamp Holdings, Inc." })] });
  const ctx = buildContext({ sites }, "2026-10-24", [], null, "Who is LiveRamp and should I worry?");
  assert.match(ctx, /- lowrisk\.example, visited [^\n]*LiveRamp \(Data broker, based in US\) \[Tracker Radar\]/);
});

test("brokers, breaches and foreign-adversary links are summarized from every site", () => {
  const sites = Array.from({ length: 60 }, (_, i) => site(i));
  sites.push({ ...site(97), domain: "broker.example", score: 1, grade: "A", trackers: [T("LiveRamp", "Data broker", "US", { broker: "LiveRamp Holdings, Inc." })] });
  sites.push({ ...site(96), domain: "hacked.example", score: 2, grade: "A", trackers: [], breach: { name: "Hacked", breachDate: "2025-06-01", addedDate: "2025-07-01", pwnCount: 5e6, dataClasses: ["Email addresses"] } });
  sites.push({ ...site(95), domain: "watched.example", score: 3, grade: "A", trackers: [T("Yandex", "Analytics", "RU")], flagged: [T("Yandex", "Analytics", "RU")] });
  const ctx = buildContext({ sites }, "2026-10-24", [], null, "Should I accept cookies?");
  assert.match(ctx, /data brokers[^\n]*\[CA Broker Registry\][^\n]*LiveRamp[^\n]*broker\.example/i);
  assert.match(ctx, /data breach[^\n]*\[HIBP\][^\n]*hacked\.example \(Hacked, 2025\)/i);
  assert.match(ctx, /foreign-adversary[^\n]*watched\.example: Yandex \(Russia\)/i);
  assert.match(ctx, /Companies seen on the most sites[^\n]*Company\d+ \(Advertising, US\) on \d+ of 63 sites/);
});

test("Ask C hands the question to the evidence builder", async () => {
  let seen;
  const sites = Array.from({ length: 40 }, (_, i) => site(i));
  sites.push({ ...site(94), domain: "tiny.example", grade: "A", score: 0 });
  await answer("What is tiny.example collecting about me?", { load: async () => ({ sites }), ask: async (q, o) => { seen = o; return "ok"; } });
  assert.match(seen.context, /- tiny\.example, visited/);
  assert.ok(seen.context.length < 20000);
});

test("a site with many trackers keeps its foreign-adversary and broker links in the short list", () => {
  const many = Array.from({ length: 30 }, (_, k) => T(`Analytics${k}`, "Analytics"));
  many.push(T("Baidu", "Analytics", "CN"), T("LiveRamp", "Data broker", "US", { broker: "LiveRamp Holdings, Inc." }));
  const ctx = buildContext({ sites: [{ ...site(1), trackers: many }] }, "2026-10-24", [], { flagged: require("../shared/flagged-companies.json") });
  assert.match(ctx, /Baidu \(Analytics, based in CN\) \[Tracker Radar\], on the Pentagon's Section 1260H list/);
  assert.match(ctx, /LiveRamp \(Data broker, based in US\) \[Tracker Radar\], registered California data broker/);
  assert.match(ctx, /and \d+ more tracker companies/);
});
