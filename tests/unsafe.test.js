// Unsafe-site warning (PLAN R5, SPEC F6; repo owner chose to build it 2026-10-25): a site graded F that also loads a
// company from a listed foreign-adversary country or the Pentagon's 1260H list, or had a data breach reported in the
// last year, gets C's warning with "Go back" and "Continue anyway". It warns; it never blocks. Once per site a day,
// Settings > C on websites > "Unsafe-site warnings" turns it off. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const read = (f) => fs.readFileSync(__dirname + "/../" + f, "utf8");

const NOW = Date.parse("2026-10-25T12:00:00Z");

function background() {
  const listeners = [], wentBack = [];
  const flagged = JSON.parse(read("shared/flagged-companies.json"));
  const ctx = {
    console, Promise, Set, Map, Date,
    fetch: async () => ({ json: async () => flagged }),
    tabSites: new Map(),
    fromPrivaC: (s) => !!(s && s.id === "privac"),
    chrome: {
      runtime: { id: "privac", getURL: (p) => p, onMessage: { addListener: (f) => listeners.push(f) } },
      tabs: { sendMessage: async () => {}, goBack: async (id) => { wentBack.push(id); } },
      storage: {}
    }
  };
  ctx.self = ctx; ctx.window = ctx;
  vm.runInNewContext(read("shared/data.js"), ctx);
  vm.runInNewContext(read("background/alerts.js"), ctx);
  return { A: ctx.PrivaCAlerts, ctx, listeners, wentBack };
}

const site = (extra) => Object.assign({ domain: "flightdeals.example", grade: "F", score: 92, trackers: [{ company: "Google", country: "US" }] }, extra);

test("F plus a listed company: the reason names the company, its country and the list with its date", async () => {
  const { A } = background();
  await new Promise((r) => setTimeout(r, 0));
  const reasons = A.unsafeReasons(site({ trackers: [{ company: "Baidu", country: "CN" }] }), NOW);
  assert.strictEqual(reasons.length, 1);
  assert.match(reasons[0], /Baidu \(China; on the Pentagon's Section 1260H list, June 2026\)/);
});

test("F plus a data breach reported in the last year: the reason names Have I Been Pwned, the breach and its year", () => {
  const { A } = background();
  const r = A.unsafeReasons(site({ breach: { name: "FlightDeals", breachDate: "2026-03-02", addedDate: "2026-04-10" } }), NOW);
  assert.deepStrictEqual(Array.from(r), ["Have I Been Pwned lists a data breach of this site reported in the last year (FlightDeals, 2026)."]);
  assert.deepStrictEqual(Array.from(A.unsafeReasons(site({ breach: { name: "Old", breachDate: "2019-01-01", addedDate: "2019-02-01" } }), NOW)), [], "older breaches don't count");
});

test("no warning without an F, or with an F but nothing else", async () => {
  const { A } = background();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepStrictEqual(Array.from(A.unsafeReasons(site({ grade: "D", trackers: [{ company: "Baidu", country: "CN" }] }), NOW)), []);
  assert.deepStrictEqual(Array.from(A.unsafeReasons(site(), NOW)), []);
});

test("the background answers a PrivaC page script with the grade and reasons, ignores anyone else, and goes back on request", async () => {
  const { ctx, listeners, wentBack } = background();
  ctx.PrivaCData.load = async () => ({ sites: [site({ trackers: [{ company: "Yandex", country: "RU" }] })] });
  const ask = (msg, sender) => new Promise((res) => { let replied = false;
    const reply = (v) => { replied = true; res(v); };
    const keep = listeners.some((f) => f(msg, sender, reply) === true);
    if (!keep) setTimeout(() => !replied && res("no answer"), 10); });
  const tab = { id: 4 };
  const r = await ask({ type: "privac-site-unsafe", domain: "flightdeals.example" }, { id: "privac", tab });
  assert.strictEqual(r.grade, "F");
  assert.match(r.reasons[0], /Yandex \(Russia\)/);
  assert.strictEqual(await ask({ type: "privac-site-unsafe", domain: "flightdeals.example" }, { id: "someone-else", tab }), "no answer");
  listeners.forEach((f) => f({ type: "privac-go-back" }, { id: "privac", tab }, () => {}));
  assert.deepStrictEqual(wentBack, [4]);
});

// The page side: content/unsafe.js
function page() {
  const ctx = { window: null, top: null, document: { readyState: "loading" }, addEventListener() {}, setTimeout() {},
    location: { protocol: "https:", hostname: "www.flightdeals.example" } };
  ctx.window = ctx; ctx.top = ctx;
  vm.runInNewContext(read("content/unsafe.js"), ctx);
  return ctx.PrivaCUnsafe;
}

test("once per site a day, off in Settings, and only when the background found reasons", () => {
  const U = page();
  const info = { grade: "F", reasons: ["It loaded Baidu (China)."] };
  assert.ok(U.pick({}, "flightdeals.example", "2026-10-25", info));
  assert.strictEqual(U.pick({ privacSettings: { popups: { unsafe: false } } }, "flightdeals.example", "2026-10-25", info), null);
  assert.strictEqual(U.pick({ privacUnsafeSeen: { "flightdeals.example": "2026-10-25" } }, "flightdeals.example", "2026-10-25", info), null);
  assert.ok(U.pick({ privacUnsafeSeen: { "flightdeals.example": "2026-10-24" } }, "flightdeals.example", "2026-10-25", info), "a new day");
  assert.strictEqual(U.pick({}, "flightdeals.example", "2026-10-25", { grade: "F", reasons: [] }), null);
  assert.strictEqual(U.pick({}, "flightdeals.example", "2026-10-25", null), null);
});

test("the wording warns and offers both ways out, and never claims the site is dangerous or blocked (Honesty rules)", () => {
  const html = page().card({ grade: "F", reasons: ["It loaded Baidu (China; on the Pentagon's Section 1260H list, June 2026)."] });
  assert.match(html, /PrivaC grades this site F/);
  assert.match(html, /Baidu \(China; on the Pentagon&#39;s Section 1260H list, June 2026\)/, "reasons are escaped");
  assert.match(html, /data-a="back">Go back</);
  assert.match(html, /data-a="stay">Continue anyway</);
  assert.ok(!/dangerous|malicious|blocked|sends your data/i.test(html));
});

test("wired up: content script, setting with a switch, a stats event, and the docs", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.ok(manifest.content_scripts[0].js.includes("content/unsafe.js"));
  assert.ok(!manifest.content_scripts[1].js.includes("content/unsafe.js"), "top page only, not every frame");
  globalThis.window = globalThis;
  require("../shared/settings.js");
  assert.strictEqual(window.PrivaCSettings.merge(null).popups.unsafe, true);
  assert.strictEqual(window.PrivaCSettings.merge({ popups: { unsafe: false } }).popups.unsafe, false);
  assert.match(read("dashboard/dashboard.html"), /data-popup="unsafe"/);
  assert.match(read("shared/stats.js"), /"popup-unsafe"/);
  assert.match(read("docs/SPEC.md"), /F6 Unsafe-site warning\. Built/);
});

test("\"Clear my PrivaC data\" also forgets which sites were warned, and PRIVACY.md says what's kept", () => {
  assert.match(read("shared/data.js"), /chrome\.storage\.local\.remove\(\[[^\]]*"privacUnsafeSeen"/);
  const privacy = read("PRIVACY.md");
  assert.match(privacy, /unsafe-site warning already appeared today/i);
  assert.match(privacy, /Settings › Unsafe-site warnings/);
});
