// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/data.js");
require("../shared/askc.js");
const L = window.PrivaCLists;
const atlas = JSON.parse(fs.readFileSync(__dirname + "/../shared/atlas.json", "utf8"));

const HIBP = [
  { Name: "Wired", Title: "Wired", Domain: "wired.com", BreachDate: "2025-12-01", AddedDate: "2025-12-27T00:00:00Z", PwnCount: 2300000, DataClasses: ["Email addresses", "Names"] },
  { Name: "OldWired", Title: "Wired (old)", Domain: "wired.com", BreachDate: "2015-01-01", AddedDate: "2016-01-01T00:00:00Z", PwnCount: 10, DataClasses: [] },
  { Name: "Fake", Title: "Fake", Domain: "fake.example", IsFabricated: true, BreachDate: "2026-01-01", AddedDate: "2026-01-01", PwnCount: 1, DataClasses: [] }
];
const CSV = 'Data broker name:,"Doing Business As (DBA), if applicable:",Data broker primary website:\n' +
  '"LiveRamp Holdings, Inc.",,https://liveramp.com\nCriteo Corp.,,https://www.criteo.com\n"eXelate, Inc.",Nielsen Marketing Cloud,\n';
const lists = { hibp: { byDomain: L.compactBreaches(HIBP) }, brokers: { list: L.compactBrokers(CSV) } };

test("breach list keeps the newest breach per domain and drops fabricated ones", () => {
  assert.strictEqual(lists.hibp.byDomain["wired.com"].name, "Wired");
  assert.strictEqual(lists.hibp.byDomain["fake.example"], undefined);
  assert.strictEqual(L.breachFor("www.news.wired.com", lists).name, "Wired");
});

test("broker registry CSV parses quoted names and websites", () => {
  assert.deepStrictEqual(lists.brokers.list[0], { name: "LiveRamp Holdings, Inc.", dba: "", site: "liveramp.com" });
  assert.strictEqual(lists.brokers.list[1].site, "criteo.com");
});

test("tracker companies match registered brokers by name or website", () => {
  assert.ok(L.brokerFor("LiveRamp", "rlcdn.com", lists));
  assert.ok(L.brokerFor("Criteo", "criteo.net", lists, ["criteo.com"]));
  assert.strictEqual(L.brokerFor("Google", "doubleclick.net", lists), null);
});

test("annotated sites score the breach and count broker trackers", () => {
  const data = { sites: [{ domain: "wired.com", cookieChoice: "none", trackers: [{ domain: "rlcdn.com", company: "LiveRamp", category: "Tracking", country: "US" }] }] };
  L.annotate(data, lists, atlas);
  const r = window.PrivaCData.computeScore(data.sites[0], Date.parse("2026-10-23"));
  assert.strictEqual(data.sites[0].trackers[0].broker, "LiveRamp Holdings, Inc.");
  assert.strictEqual(r.score, 5 + 5 + 10 + 15); // tracker + broker + tracked with no banner + recent breach
});

test("Ask C looks up companies and breached sites named in the question", () => {
  const f = window.PrivaCAskC.lookupFacts("Who is LiveRamp, and was wired.com hacked?", lists, atlas);
  const all = f.join("\n");
  assert.match(all, /LiveRamp runs \d+ tracker domain/);
  assert.match(all, /registered as a data broker in California[^\n]*\[CA Broker Registry\]/);
  assert.match(all, /Wired \(wired\.com\) had a data breach on 2025-12-01[^\n]*2\.3 million accounts[^\n]*\[HIBP\]/);
});

test("refresh downloads both lists once a day and keeps the old copy if a download fails", async () => {
  let store = {}; let calls = 0;
  const storage = { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) };
  const ok = async (url) => { calls++; return url.includes("haveibeenpwned") ? { ok: true, json: async () => HIBP } : { ok: true, text: async () => CSV }; };
  await L.refresh({ fetch: ok, storage, now: Date.parse("2026-10-23T10:00:00Z") });
  await L.refresh({ fetch: ok, storage, now: Date.parse("2026-10-23T20:00:00Z") });   // same day: no download
  assert.strictEqual(calls, 2);
  const down = async () => { throw new Error("offline"); };
  await L.refresh({ fetch: down, storage, now: Date.parse("2026-10-25T10:00:00Z") });
  assert.ok(store.privacLists.hibp.byDomain["wired.com"]);
});

require("../shared/cookies.js");
const cookieDb = JSON.parse(fs.readFileSync(__dirname + "/../shared/cookie-db.json", "utf8"));

test("cookies: names are classified, values are never kept", () => {
  const now = Date.parse("2026-10-23");
  const c = window.PrivaCCookies.describe({ name: "_fbp", value: "fb.1.secret", domain: ".cnn.com", expirationDate: now / 1000 + 90 * 86400 }, "cnn.com", cookieDb, now);
  assert.deepStrictEqual(Object.keys(c).sort(), ["category", "company", "days", "domain", "firstParty", "name", "purpose"]);
  assert.strictEqual(c.category, "Marketing");
  assert.strictEqual(c.company, "Facebook");
  assert.strictEqual(c.days, 90);
  assert.ok(!JSON.stringify(c).includes("secret"));
});

test("Ask C context explains what a site collects", () => {
  const C = window.PrivaCCookies;
  const site = { domain: "cnn.com", score: 50, grade: "C", cookieChoice: "no-reject", trackers: [{ company: "Google", category: "Advertising", country: "US", fingerprinting: 3 }],
    cookies: [C.describe({ name: "_fbp", domain: ".cnn.com", expirationDate: Date.now() / 1000 + 9e6 }, "cnn.com", cookieDb),
              C.describe({ name: "_ga", domain: ".cnn.com", session: true }, "cnn.com", cookieDb),
              C.describe({ name: "__cf_bm", domain: ".cnn.com", session: true }, "cnn.com", cookieDb)] };
  const ctx = window.PrivaCAskC.buildContext({ sites: [site] }, "2026-10-23");
  assert.match(ctx, /cookies stored: 3 \(1 advertising and profiling, 1 measures your visits, 1 needed for the site to work\)/);
  assert.match(ctx, /advertising cookies: _fbp \(Facebook, kept \d+ months\)/);
  assert.match(ctx, /2 of them aren't needed for the site to work \[Cookie Database\]/);
  assert.match(ctx, /fingerprinting\): Google \[Tracker Radar\]/);
});
