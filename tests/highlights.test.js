// shared/highlights.js: home-page totals and standout facts.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
require("../shared/highlights.js");
const { aggregate, facts } = window.PrivaCHighlights;

const scored = (s) => Object.assign({}, s, window.PrivaCData.computeScore(s, Date.parse("2026-10-24")));

test("totals across the sample sites: companies, tracker purposes, average exposure, listed countries", async () => {
  const data = await window.PrivaCData.load();          // no Chrome here: the sample data
  const a = aggregate(data.sites);
  assert.strictEqual(a.siteCount, 6);
  assert.strictEqual(a.companyCount, 10);
  assert.strictEqual(a.companies[0].name, "Google");
  assert.ok(a.purposes.find((p) => p.label === "Advertising").n >= 4);
  assert.ok(a.purposes.some((p) => p.label === "Recording your screen"));
  assert.ok(a.avgScore > 0 && a.avgScore <= 100);
  assert.deepStrictEqual(a.countries.map((c) => c.name).sort(), ["China", "Russia"]);
});

test("facts come strongest first, and name what was seen or what the list says", async () => {
  const data = await window.PrivaCData.load();
  const f = facts(data.sites, { declines: 7 });
  assert.ok(f.length >= 4 && f.length <= 6);
  assert.strictEqual(f[0].tone, "alert");
  assert.match(f[0].title, /Baidu|Yandex/);
  for (let i = 1; i < f.length; i++) if (f[i].tone !== "good") assert.ok(f[i - 1].weight >= f[i].weight);
  assert.ok(f.some((x) => x.kind === "recording" && /Hotjar can record/.test(x.title)));
  assert.ok(f.some((x) => x.tone === "good"), "keeps one good-news fact");
  assert.ok(f.every((x) => x.ask && !/sold your data/i.test(x.title)));
});

test("state-run media leads; a recent breach outranks an old one; old breaches are shown as information", () => {
  const sites = [
    scored({ domain: "tass.com", owner: { company: "TASS", country: "RU", stateMedia: { classification: "SC" } }, trackers: [], cookieChoice: "none", policy: {} }),
    scored({ domain: "new.example", trackers: [], cookieChoice: "none", policy: {}, breach: { name: "New", breachDate: "2026-05-01", addedDate: "2026-06-01", pwnCount: 1200 } }),
    scored({ domain: "snap.example", trackers: [], cookieChoice: "none", policy: {}, breach: { name: "Snapchat", breachDate: "2014-01-01", addedDate: "2014-01-02", pwnCount: 4609615 } })
  ];
  const f = facts(sites);
  assert.strictEqual(f[0].kind, "state-media");
  assert.match(f[0].title, /tass\.com is state-run media: TASS \(Russia\)/);
  const recent = f.find((x) => x.site === "new.example"), old = f.find((x) => x.site === "snap.example");
  assert.strictEqual(recent.tone, "alert");
  assert.strictEqual(old.tone, "info");
  assert.match(old.title, /past data breach \(Snapchat, 2014\)/);
});

test("Tracker Radar malware label, fingerprinting and data brokers become facts", () => {
  const sites = [scored({ domain: "tass.com", cookieChoice: "declined", policy: {}, trackers: [
    { domain: "yadro.ru", company: "ECO PC - Complex Solutions", category: "Malware", country: null, fingerprinting: 0 },
    { domain: "fp.example", company: "PrintCo", category: "Analytics", country: "US", fingerprinting: 3 },
    { domain: "rlcdn.com", company: "LiveRamp", category: "Tracking", country: "US", broker: "LiveRamp Holdings, Inc." }] })];
  const kinds = facts(sites).map((x) => x.kind);
  for (const k of ["malware", "fingerprint", "broker"]) assert.ok(kinds.includes(k), k);
});

test("no sites: no facts, zero totals", () => {
  assert.deepStrictEqual(facts([]), []);
  assert.strictEqual(aggregate([]).avgScore, 0);
});

test("similar facts merge, foreign-adversary facts are capped at 2, so other strong findings still show", () => {
  const sm = (domain, company, cc) => scored({ domain, owner: { company, country: cc, stateMedia: { classification: "SC" } }, trackers: [], cookieChoice: "none", policy: {} });
  const sites = [sm("tass.com", "TASS", "RU"), sm("en.irna.ir", "IRNA", "IR"),
    scored({ domain: "taobao.com", owner: { company: "Alibaba", country: "CN" }, trackers: [], cookieChoice: "none", policy: {} }),
    scored({ domain: "baidu.com", owner: { company: "Baidu", country: "CN" }, trackers: [{ domain: "hm.baidu.com", company: "Baidu", category: "Analytics", country: "CN" }], cookieChoice: "none", policy: {} }),
    scored({ domain: "news.example", cookieChoice: "none", policy: { sells: true }, trackers: [
      { domain: "mc.yandex.ru", company: "Yandex", category: "Session recording", country: "RU", fingerprinting: 3 },
      { domain: "yadro.ru", company: "ECO PC", category: "Malware", country: null }] })];
  const f = facts(sites);
  const foreign = f.filter((x) => ["state-media", "owner", "address", "adversary"].includes(x.kind));
  assert.strictEqual(foreign.length, 2);
  assert.match(f.find((x) => x.kind === "state-media").title, /You visited 2 state-run media sites/);
  for (const k of ["malware", "recording", "sells"]) assert.ok(f.some((x) => x.kind === k), k);
  const adv = f.find((x) => x.kind === "adversary");
  if (adv) assert.doesNotMatch(adv.title, /Baidu/, "Baidu on its own baidu.com is the owner fact, not a tracker fact");
});

test("the Cookies card gets the tracking cookies seen on the most sites", () => {
  const sites = [
    scored({ domain: "a.example", trackers: [], cookieChoice: "none", policy: {}, cookies: [{ name: "_ga", category: "Analytics" }, { name: "_fbp", category: "Marketing" }, { name: "sid", category: "Necessary" }] }),
    scored({ domain: "b.example", trackers: [], cookieChoice: "none", policy: {}, cookies: [{ name: "_ga", category: "Analytics" }] })];
  const a = aggregate(sites);
  assert.deepStrictEqual(a.topCookies.map((c) => [c.name, c.sites]), [["_ga", 2], ["_fbp", 1]]);
  assert.strictEqual(a.trackingCookies, 3);
  assert.strictEqual(a.cookies, 4);
});

test("at equal reach, companies from listed countries sort first (so a trimmed table keeps them)", () => {
  const sites = [scored({ domain: "a.example", cookieChoice: "none", policy: {}, trackers: [
    { domain: "aa.com", company: "Aardvark Ads", category: "Advertising", country: "US" },
    { domain: "mc.yandex.ru", company: "Yandex", category: "Analytics", country: "RU" }] })];
  assert.deepStrictEqual(aggregate(sites).companies.map((c) => c.name), ["Yandex", "Aardvark Ads"]);
});

// Max, 2026-10-25: clicking "Google followed you across 2 of your 5 sites" opened the first site in the list
// (every fact opened flightdeals.example in the sample), not Google. A fact about a company now opens that company's
// own site when you visited it (google.com), otherwise the riskiest site where it tracked you, and names the company
// so the Sites tab can point at its row.
const T = (company, category = "Advertising") => ({ company, category, country: "US", domain: company.toLowerCase() + "-cdn.com" });
const visit = (domain, trackers) => scored({ domain, lastVisit: "2026-10-25", cookieChoice: "accepted", policy: {}, trackers });

test("a fact about a company opens that company's own site when you visited it, and names the company", () => {
  const sites = [visit("cnn.com", [T("Google"), T("Criteo")]), visit("espn.com", [T("Google")]), visit("google.com", []),
    visit("weather.com", [T("Criteo"), T("Google")]), visit("zara.com", [])];
  const reach = facts(sites).find((f) => f.kind === "reach");
  assert.match(reach.title, /^Google followed you across 3 of your 5 sites/);
  assert.strictEqual(reach.site, "google.com");
  assert.strictEqual(reach.company, "Google");
});

test("without the company's own site, it opens the riskiest site where the company tracked you", () => {
  const busy = [T("Google"), T("Criteo"), T("Hotjar", "Session recording"), T("Meta"), T("Amazon"), T("Comscore", "Analytics")];
  const sites = [visit("calm.example", [T("Hotjar", "Session recording")]), visit("busy.example", busy), visit("quiet.example", [T("Google")])];
  const rec = facts(sites).find((f) => f.kind === "recording");
  assert.strictEqual(rec.company, "Hotjar");
  assert.strictEqual(rec.site, "busy.example", "the highest-scoring site Hotjar was on");
  const reach = facts(sites).find((f) => f.kind === "reach");
  assert.strictEqual(reach.site, "busy.example");
});
