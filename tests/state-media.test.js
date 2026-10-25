// Run with: node --test
// F2: state-run news sites (shared/state-media.json, shared/state-media.js).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
globalThis.window = globalThis;
require("../shared/data.js");
require("../shared/state-media.js");
const { computeScore, FOREIGN_ADVERSARIES } = window.PrivaCData;
const { lookup } = window.PrivaCStateMedia;
const LIST = require("../shared/state-media.json");

test("the list names its database, dataset DOI and the date it was checked", () => {
  assert.match(LIST.source.dataset, /doi\.org\/10\.5281\/zenodo\.17219015/);
  assert.match(LIST.source.website, /^https:\/\/statemediamonitor\.com/);
  assert.ok(LIST.checkedOn);
});

test("every outlet is sourced: listed country, State-Controlled or Captured Public, profile link, domains with evidence", () => {
  assert.ok(LIST.outlets.length >= 15);
  const seen = new Set();
  for (const o of LIST.outlets) {
    assert.ok(o.name, "name");
    assert.ok(FOREIGN_ADVERSARIES[o.country], `${o.name}: ${o.country} isn't a 15 CFR 7.4 country`);
    assert.ok(["SC", "CaPu"].includes(o.classification), `${o.name}: ${o.classification} (privately owned outlets are left out)`);
    assert.match(o.profile, /^https:\/\/statemediamonitor\.com\//, o.name);
    assert.ok(o.smmUpdated, `${o.name}: needs the profile's date`);
    assert.ok(o.domains.length >= 1, o.name);
    for (const d of o.domains) {
      assert.ok(/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d), `${o.name}: bad domain ${d}`);
      assert.ok(!seen.has(d), `${d} listed twice`);
      seen.add(d);
      assert.ok(o.evidence && o.evidence[d], `${o.name}: ${d} needs evidence (profile, Tracker Radar owner, or Wikipedia)`);
    }
  }
});

test("the state-run sites from the Saturday test are all found (docs/history/HANDOFF.md)", () => {
  const expect = {
    "en.irna.ir": "IR", "english.news.cn": "CN", "cgtn.com": "CN", "granma.cu": "CU",
    "presstv.co.uk": "IR", "rt.com": "RU", "tass.com": "RU"
  };
  for (const [domain, country] of Object.entries(expect)) {
    const hit = lookup(domain, LIST);
    assert.ok(hit, `${domain} not found`);
    assert.strictEqual(hit.country, country, domain);
  }
});

test("matches the domain or its subdomains only", () => {
  assert.strictEqual(lookup("www.rt.com", LIST).company, "RT");
  assert.strictEqual(lookup("notrt.com", LIST), null);
  assert.strictEqual(lookup("rt.com.evil.example", LIST), null);
  assert.strictEqual(lookup("cnn.com", LIST), null);
  assert.strictEqual(lookup("rt.com", null), null);
});

test("a state-run site gets the one foreign-adversary line (15 points), naming the database and year", () => {
  const owner = lookup("english.news.cn", LIST);
  const r = computeScore({ domain: "english.news.cn", trackers: [], cookieChoice: "declined", policy: {}, owner });
  const line = r.parts.find((p) => p.points === 15);
  assert.ok(line, "15-point line");
  assert.match(line.label, /state-run media/i);
  assert.match(line.label, /Xinhua/);
  assert.match(line.label, /State Media Monitor/);
  assert.match(line.label, /China/);
});

test("state media plus a Chinese tracker is still one 15-point line, not two", () => {
  const owner = lookup("cgtn.com", LIST);
  const r = computeScore({ domain: "cgtn.com", cookieChoice: "declined", policy: {}, owner,
    trackers: [{ domain: "hm.baidu.com", company: "Baidu", category: "Analytics", country: "CN", listed: true }] });
  assert.strictEqual(r.parts.filter((p) => p.points === 15 && /adversary|state-run|1260H/i.test(p.label)).length, 1);
  assert.match(r.parts.find((p) => p.points === 15).label, /state-run media/i);
});

test("tracking records a state-run outlet as the site's owner, ahead of Tracker Radar's guess", () => {
  const on = () => ({ addListener: () => {} });
  const chrome = {
    storage: { local: { get: async () => ({}), set: async () => {} } },
    webNavigation: { onCommitted: on(), onCompleted: on() }, webRequest: { onBeforeRequest: on() }, tabs: { onRemoved: on() }
  };
  const ctx = { chrome, console, URL, Promise, setTimeout };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../shared/state-media.js", "utf8"), ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../background/tracking.js", "utf8") +
    "\n;this.setAtlas = setAtlas; this.setStateMedia = setStateMedia; this.ownerOf = ownerOf;", ctx);
  ctx.setAtlas({ entities: { "ANO TV-Novosti": ["rt.com"] }, domains: {} });
  assert.strictEqual(ctx.ownerOf("rt.com").company, "ANO TV-Novosti");
  ctx.setStateMedia(LIST);
  const o = ctx.ownerOf("rt.com");
  assert.strictEqual(o.company, "RT");
  assert.strictEqual(o.country, "RU");
  assert.strictEqual(o.stateMedia.classification, "SC");
});

test("an outlet's own sister addresses (tass.ru on tass.com) are first-party, not 'unknown outside servers'", () => {
  const on = () => ({ addListener: () => {} });
  const chrome = { storage: { local: { get: async () => ({}), set: async () => {} } },
    webNavigation: { onCommitted: on(), onCompleted: on() }, webRequest: { onBeforeRequest: on() }, tabs: { onRemoved: on() } };
  const ctx = { chrome, console, URL, Promise, setTimeout };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../shared/state-media.js", "utf8"), ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../background/tracking.js", "utf8") +
    "\n;this.setAtlas = setAtlas; this.setStateMedia = setStateMedia; this.isFirstParty = isFirstParty;", ctx);
  ctx.setAtlas({ entities: {}, domains: {} });
  ctx.setStateMedia({ outlets: [{ name: "TASS", short: "TASS", country: "RU", classification: "SC", domains: ["tass.ru", "tass.com"] },
                                { name: "RT", short: "RT", country: "RU", classification: "SC", domains: ["rt.com"] }] });
  assert.strictEqual(ctx.isFirstParty("tass.com", "cdn-media.tass.ru", null), true);
  assert.strictEqual(ctx.isFirstParty("tass.com", "rt.com", null), false);
  assert.strictEqual(ctx.isFirstParty("news.example", "tass.ru", null), false);
});
