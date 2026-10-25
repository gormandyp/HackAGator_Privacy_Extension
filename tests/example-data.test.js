// Settings > "Show example data" (Preston, 2026-10-25): the demo can't wait weeks for real browsing, so a switch
// adds example sites next to the real ones. Real data is never changed, and every screen says "Example data".
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
globalThis.window = globalThis;
require("../shared/settings.js");
require("../shared/example-data.js");
require("../shared/data.js");
const ATLAS = require("../shared/atlas.json");
const COOKIES = require("../shared/cookie-db.json");
const FLAGGED = require("../shared/flagged-companies.json");
const read = (p) => fs.readFileSync(__dirname + "/../" + p, "utf8");
const DAY = 86400000;

// A fake chrome.storage that records every write, so the tests can prove privacData is never touched.
function fakeChrome(store) {
  const writes = [];
  globalThis.chrome = {
    storage: { local: {
      get: async (keys) => { const out = {}; for (const k of [].concat(keys)) if (k in store) out[k] = JSON.parse(JSON.stringify(store[k])); return out; },
      set: async (x) => { writes.push(x); Object.assign(store, x); },
      remove: async () => {}
    } },
    runtime: { getURL: (p) => p }
  };
  globalThis.fetch = async (p) => ({ json: async () => (p.endsWith("flagged-companies.json") ? FLAGGED : {}) });
  return writes;
}
const realSite = { domain: "news.real-site.test", lastVisit: new Date().toISOString(), cookieChoice: "declined", trackers: [{ domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" }] };

test("the setting is off unless switched on, and only a true/false is kept", () => {
  assert.strictEqual(PrivaCSettings.merge(null).exampleData, false);
  assert.strictEqual(PrivaCSettings.merge({ exampleData: true }).exampleData, true);
  assert.strictEqual(PrivaCSettings.merge({ exampleData: "yes" }).exampleData, false);
});

test("example sites use made-up .example names (no claims about real websites), all visited in the last 7 days", () => {
  const now = Date.parse("2026-10-25T19:00:00Z");
  const sites = PrivaCExample.sites(now);
  assert.ok(sites.length >= 12, `${sites.length} sites`);
  for (const s of sites) {
    assert.match(s.domain, /\.example$/, s.domain);
    assert.strictEqual(s.example, true);
    const age = now - Date.parse(s.lastVisit);
    assert.ok(age >= 0 && age < 7 * DAY, `${s.domain} last visit ${s.lastVisit}`);
  }
  assert.notStrictEqual(PrivaCExample.sites(now)[0], sites[0], "a fresh copy each time");
});

test("every example tracker is a real Tracker Radar entry: same company, purpose, country and fingerprinting", () => {
  for (const s of PrivaCExample.sites()) for (const t of s.trackers) {
    const row = ATLAS.domains[t.domain];
    assert.ok(row, `${t.domain} on ${s.domain} is not in atlas.json`);
    assert.deepStrictEqual([t.company, t.category, t.country, t.fingerprinting], [row[0], row[1], row[2], row[4] || 0], t.domain);
  }
});

test("every example cookie is in the Open Cookie Database with the same purpose and company", () => {
  for (const s of PrivaCExample.sites()) for (const c of s.cookies) {
    const v = COOKIES.exact[c.name] || (COOKIES.prefix.find((p) => c.name.startsWith(p[0])) || []).slice(1);
    assert.ok(v && v.length, `${c.name} on ${s.domain} is not in cookie-db.json`);
    assert.deepStrictEqual([c.category, c.company, c.purpose], [v[1], v[4] || v[0], v[2]], c.name);
    assert.strictEqual(c.firstParty, c.domain === s.domain, `${c.name} firstParty on ${s.domain}`);
    assert.ok(!("value" in c), "names only, never values");
  }
});

test("the example covers what the demo shows: every grade, _ga on several sites, China and Russia, a Section 1260H company", async () => {
  fakeChrome({ privacSettings: { exampleData: true } });
  const d = await PrivaCData.load();
  const grades = new Set(d.sites.map((s) => s.grade));
  for (const g of "ABCDF") assert.ok(grades.has(g), `no grade ${g}: ${[...grades]}`);
  assert.ok(d.sites.filter((s) => s.cookies.some((c) => c.name === "_ga")).length >= 5);
  const countries = new Set(d.sites.flatMap((s) => s.trackers.map((t) => t.country)));
  assert.ok(countries.has("CN") && countries.has("RU"));
  assert.ok(d.sites.some((s) => s.trackers.some((t) => t.listed && t.listed.list === "Section 1260H")));
  for (const c of ["declined", "accepted", "none", "no-reject"]) assert.ok(d.sites.some((s) => s.cookieChoice === c), c);
});

test("switched on: example sites are added next to the real ones, the result says so, and privacData is never written", async () => {
  const store = { privacData: { sample: false, sites: [realSite] }, privacSettings: { exampleData: true } };
  const before = JSON.stringify(store.privacData);
  const writes = fakeChrome(store);
  const d = await PrivaCData.load();
  assert.strictEqual(d.example, true);
  assert.strictEqual(d.sample, false);
  assert.ok(d.sites.some((s) => s.domain === realSite.domain && !s.example), "the real site is still there");
  assert.ok(d.sites.filter((s) => s.example).length >= 12);
  assert.strictEqual(writes.length, 0);
  assert.strictEqual(JSON.stringify(store.privacData), before);
});

test("switched off: exactly the real data, as before", async () => {
  fakeChrome({ privacData: { sample: false, sites: [realSite] }, privacSettings: { exampleData: false } });
  const d = await PrivaCData.load();
  assert.deepStrictEqual(d.sites.map((s) => s.domain), [realSite.domain]);
  assert.ok(!d.example);
});

test("switched on with no real browsing yet: example sites, not the old sample (so the pop-up never shows them as your tab)", async () => {
  fakeChrome({ privacSettings: { exampleData: true } });
  const d = await PrivaCData.load();
  assert.strictEqual(d.example, true);
  assert.strictEqual(d.sample, false);
  assert.ok(d.sites.every((s) => s.example));
});

test("a real visit to a site with the same name wins over the example one", async () => {
  const domain = PrivaCExample.sites()[0].domain;
  fakeChrome({ privacData: { sites: [{ ...realSite, domain }] }, privacSettings: { exampleData: true } });
  const d = await PrivaCData.load();
  const same = d.sites.filter((s) => s.domain === domain);
  assert.strictEqual(same.length, 1);
  assert.ok(!same[0].example);
});

test("the background never uses example sites for daily totals, the grade box or the unsafe-site warning", () => {
  assert.match(read("background/stats.js"), /PrivaCStats\.snapshot\(data\.sites\.filter\(\(s\) => !s\.example\)\)/);
  assert.match(read("background/toolbar.js"), /x\.domain === msg\.domain && !x\.example/);
  assert.match(read("background/alerts.js"), /x\.domain === msg\.domain && !x\.example/);
  assert.match(read("background.js"), /"shared\/example-data\.js", "shared\/data\.js"/);
});

test("Settings: a 'Show example data' switch in Your data, above Clear, in the same style as the other switches", () => {
  const html = read("dashboard/dashboard.html");
  const group = html.slice(html.indexOf('<h3 class="group-title">Your data</h3>'), html.indexOf('id="clear"'));
  assert.match(group, /<label class="row"><span>Show example data<small>[^<]+<\/small><\/span><input type="checkbox" class="switch" data-setting-bool="exampleData"><\/label>/);
  assert.ok(html.indexOf("../shared/example-data.js") < html.indexOf("../shared/data.js"));
  assert.ok(read("popup/popup.html").indexOf("../shared/example-data.js") < read("popup/popup.html").indexOf("../shared/data.js"));
  // Switching re-draws the dashboard with Settings still open.
  assert.match(read("dashboard/tabs.js"), /exampleData/);
});

test("while it's on, the dashboard header says \"Example data\", and C's impact and Safety show example totals", () => {
  assert.match(read("dashboard/dashboard.js"), /data\.example[\s\S]{0,200}Example data/);
  assert.match(read("dashboard/activity.js"), /loadStats\(data\.sample \|\| data\.example\)/);
});
