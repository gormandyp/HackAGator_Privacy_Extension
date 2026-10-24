// Run with: node --test
// Ask C speed: Gemma reads a short, question-focused summary of your browsing instead of every site in full.
// (A week of browsing used to be ~40,000 words of evidence: slow to read and cut off by the model's context.)
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
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
  assert.match(ctx, /- lowrisk\.example, visited [^\n]*LiveRamp \(Data broker, based in United States\) \[Tracker Radar\]/);
});

test("brokers, breaches and foreign-adversary links are summarized from every site", () => {
  const sites = Array.from({ length: 60 }, (_, i) => site(i));
  sites.push({ ...site(97), domain: "broker.example", score: 1, grade: "A", trackers: [T("LiveRamp", "Data broker", "US", { broker: "LiveRamp Holdings, Inc." })] });
  sites.push({ ...site(96), domain: "hacked.example", score: 2, grade: "A", trackers: [], breach: { name: "Hacked", breachDate: "2025-06-01", addedDate: "2025-07-01", pwnCount: 5e6, dataClasses: ["Email addresses"] } });
  sites.push({ ...site(95), domain: "watched.example", score: 3, grade: "A", trackers: [T("Yandex", "Analytics", "RU")], flagged: [T("Yandex", "Analytics", "RU")] });
  const ctx = buildContext({ sites }, "2026-10-24", [], null, "Should I accept cookies?");
  assert.match(ctx, /data brokers[^\n]*\[CA Broker Registry\][^\n]*LiveRamp[^\n]*broker\.example/i);
  assert.match(ctx, /data breach[^\n]*\[HIBP\][^\n]*hacked\.example \(Hacked, 2025, 5\.0 million accounts: email addresses\)/i);
  assert.match(ctx, /foreign-adversary[^\n]*watched\.example: Yandex \(Russia\)/i);
  assert.match(ctx, /Companies seen on the most sites[^\n]*Company\d+ \(Advertising, United States\) on \d+ of 63 sites/);
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
  assert.match(ctx, /Baidu \(Analytics, based in China\) \[Tracker Radar\], on the Pentagon's Section 1260H list/);
  assert.match(ctx, /LiveRamp \(Data broker, based in United States\) \[Tracker Radar\], registered California data broker/);
  assert.match(ctx, /and \d+ more tracker companies/);
});

test("cookie purposes that share a name are counted together", () => {
  const cookies = [{ name: "a", category: "Functional" }, { name: "b", category: "Necessary" }, { name: "c", category: "Marketing", company: "X", days: 30 }];
  const ctx = buildContext({ sites: [{ ...site(1), cookies }] }, "2026-10-24", []);
  assert.match(ctx, /cookies stored: 3 \(2 needed for the site to work, 1 advertising and profiling\)/);
});

test("odd saved data (an empty site entry, a missing tracker) never stops C from answering", () => {
  const ctx = buildContext({ sites: [null, { domain: "odd.example", trackers: [null, T("Criteo")] }, { domain: "bare.example" }] }, "2026-10-24", [], null, "Who is Criteo?");
  assert.match(ctx, /odd\.example/);
  assert.match(ctx, /bare\.example/);
});

test("each site's own privacy policy is labeled as the site's, so a tracker company isn't credited with it", () => {
  const ctx = buildContext({ sites: [{ ...site(1), policy: { sells: true } }] }, "2026-10-24", []);
  assert.match(ctx, /this site's own privacy policy says it sells personal info \[Privacy policy\]/);
});

// ---------- from the independent review (Claude reviewer, 2026-10-24) ----------

test("'no data brokers seen' is only said when the broker registry was actually downloaded", () => {
  const sites = [{ ...site(1), trackers: [T("LiveRamp", "Data broker")] }];
  assert.doesNotMatch(buildContext({ sites }, "2026-10-24", []), /No registered California data brokers/);
  assert.match(buildContext({ sites, lists: { brokersAsOf: "2026-10-24T08:00:00Z" } }, "2026-10-24", []), /No registered California data brokers seen/);
});

test("asking about cnn.com finds the edition.cnn.com page you visited", () => {
  const sites = Array.from({ length: 8 }, (_, i) => ({ ...site(i), score: 90 - i }));
  sites.push({ ...site(50), domain: "edition.cnn.com", grade: "A", score: 10 });
  assert.match(buildContext({ sites }, "2026-10-24", [], null, "What is cnn.com collecting about me?"), /- edition\.cnn\.com, visited/);
});

test("which sites sell or share your data, and breach details, cover sites outside the full-detail ones", () => {
  const sites = Array.from({ length: 10 }, (_, i) => ({ ...site(i), score: 90 - i }));
  sites[6] = { ...sites[6], policy: { sells: true } };
  sites[7] = { ...sites[7], policy: { shares: true } };
  sites[8] = { ...sites[8], breach: { name: "Leak", breachDate: "2024-03-01", addedDate: "2024-04-01", pwnCount: 1200000, dataClasses: ["Passwords", "Email addresses"] } };
  const ctx = buildContext({ sites }, "2026-10-24", [], null, "Which sites sell my data?");
  assert.match(ctx, /own privacy policy says they sell personal information \[Privacy policy\]: site6\.example/);
  assert.match(ctx, /share personal information with partners \[Privacy policy\]: site7\.example/);
  assert.match(ctx, /site8\.example \(Leak, 2024, 1\.2 million accounts: passwords, email addresses\)/);
});

test("even a very heavy week stays within Gemma's context (rules are never pushed out)", () => {
  const heavy = Array.from({ length: 300 }, (_, i) => ({
    ...site(i), score: 100 - (i % 50), owner: { company: "StateCo" + i, country: "RU" }, addressFlag: { ending: ".ru", country: "RU" },
    serverFlag: { country: "RU" }, flagged: [T("Yandex", "Analytics", "RU"), T("Baidu", "Analytics", "CN"), T("Mail.ru", "Analytics", "RU")],
    trackers: Array.from({ length: 40 }, (_, k) => T(`Co${k}`, "Advertising", k % 5 ? "US" : "CN", { fingerprinting: 3 })),
    policy: { sells: true, shares: true, optOut: true, gpc: false, retention: false, preciseLocation: true, sensitive: true, otherSources: true,
      quotes: Object.fromEntries(["sells", "shares", "optOut", "gpc", "retention", "preciseLocation", "sensitive", "otherSources"].map(f => [f, "x".repeat(300)])),
      checkedAt: "2026-10-24T00:00:00Z" },
    breach: { name: "B" + i, breachDate: "2025-01-01", addedDate: "2025-02-01", pwnCount: 3e6, dataClasses: ["Email addresses", "Passwords"] }
  }));
  const ctx = buildContext({ sites: heavy }, "2026-10-24", ["- fact".repeat(20)], { flagged: require("../shared/flagged-companies.json"), regtrack: require("../shared/regtrack-facts.json") }, "What is site3.example collecting about me?");
  assert.ok(ctx.length <= 15000, `context is ${ctx.length} characters`);
  assert.match(ctx, /- site3\.example, visited/, "the site you asked about is kept");
});

test("asking about a company shows where it followed you, not only its own sites", () => {
  const own = ["google.com", "mail.google.com", "docs.google.com", "maps.google.com"].map((d, i) => ({ ...site(i), domain: d, score: 95 - i, trackers: [] }));
  const followed = [0, 1, 2].map((i) => ({ ...site(20 + i), domain: `blog${i}.example`, score: 20 - i, trackers: [T("Google", "Advertising")] }));
  const ctx = buildContext({ sites: [...own, ...followed] }, "2026-10-24", [], null, "Who is Google and should I worry?");
  const detailed = (ctx.match(/^- [^:\n]+, visited/gm) || []).map((l) => l.slice(2, l.indexOf(",")));
  assert.ok(followed.every((s) => detailed.includes(s.domain)), `full details: ${detailed.join(", ")}`);
});
