// Run with: node --test
// Preston, 2026-10-25: reading the privacy policy should come first and feel friendly. While C reads it, the pop-up and
// dashboard say "Reading the privacy policy" with a small moving dot instead of a percentage; the grade's lines about
// selling and sharing are saved as soon as Gemma answers them (first of up to 4 calls); the site you're on now is read
// first; and the page's "Privacy" link is found as soon as the page is ready, not 4 seconds later.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(__dirname + "/../" + p, "utf8");
const POLICY_HTML = `<h1>Privacy Policy</h1><p>We do not sell your personal information to anyone.</p>` +
  "<p>We share information with advertising partners for targeted advertising on other sites.</p>" +
  "<p>We keep your information for as long as your account is open and then delete it.</p>" +
  "<p>We describe here how we look after the information you give us when you use the site.</p>".repeat(12);

function loadReader({ sites, ask, extra = {} }) {
  const store = { privacData: { sample: false, sites } };
  const session = {};
  const sessionLog = [];
  const listeners = [];
  const fetched = [];
  const chrome = {
    runtime: { getURL: (p) => "ext://" + p, onMessage: { addListener: (fn) => listeners.push(fn) } },
    storage: {
      local: {
        get: async (k) => ({ [k]: store[k] && JSON.parse(JSON.stringify(store[k])) }),
        set: async (o) => { Object.assign(store, JSON.parse(JSON.stringify(o))); }
      },
      session: {
        get: async (k) => ({ [k]: session[k] }),
        set: async (o) => { Object.assign(session, JSON.parse(JSON.stringify(o))); sessionLog.push(JSON.parse(JSON.stringify(o))); },
        remove: async (k) => { delete session[k]; }
      }
    }
  };
  const map = JSON.parse(read("shared/knowledge-map.json"));
  const fetch = async (url) => {
    fetched.push(url);
    if (url === "ext://shared/knowledge-map.json") return { ok: true, json: async () => map };
    return { ok: true, headers: { get: () => "text/html" }, text: async () => POLICY_HTML };
  };
  const ctx = { chrome, console: { log() {}, warn() {}, error() {} }, URL, Promise, setTimeout, fetch, PrivaCGemma: { ask }, ...extra };
  ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("shared/policy.js"), ctx);
  vm.runInContext(read("background/policy-reader.js"), ctx);
  const send = (domain) => listeners.forEach((fn) => fn({ type: "privac-policy-links", domain, links: [{ href: `https://${domain}/privacy`, text: "Privacy Policy" }] }, { tab: { id: 1 } }, () => {}));
  return { send, store, session, sessionLog, fetched, ctx, idle: () => ctx.PrivaCPolicyReader.idle() };
}
const site = (domain) => ({ domain, trackers: [], policy: { sells: null, shares: null, source: null } });
const tick = () => new Promise((r) => setTimeout(r, 5));

test("while C reads a site's policy, session storage says so; when the read ends, it doesn't", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const r = loadReader({ sites: [site("news.example")], ask: async () => { await gate; return { answers: [] }; } });
  r.send("news.example");
  for (let i = 0; i < 20 && !(r.session.privacPolicyReading || {})["news.example"]; i++) await tick();
  assert.ok(typeof r.session.privacPolicyReading["news.example"] === "number", "marked as being read, with the time it started");
  release();
  await r.idle();
  assert.deepStrictEqual(r.session.privacPolicyReading, {}, "cleared when the read is done");
});

test("selling and sharing are saved after Gemma's first answer, before the other questions are done", async () => {
  let calls = 0, release;
  const later = new Promise((r) => { release = r; });
  const ask = async (q) => {
    calls++;
    if (calls === 1) {
      assert.match(q, /"id": "sells"/, "the grade's questions are asked first");
      return { answers: [
        { id: "sells", answer: "no", quote: "We do not sell your personal information to anyone." },
        { id: "shares", answer: "yes", quote: "We share information with advertising partners for targeted advertising on other sites." }] };
    }
    await later;
    return { answers: [] };
  };
  const r = loadReader({ sites: [site("news.example")], ask });
  r.send("news.example");
  for (let i = 0; i < 40 && r.store.privacData.sites[0].policy.sells !== false; i++) await tick();
  const early = r.store.privacData.sites[0].policy;
  assert.strictEqual(early.sells, false);
  assert.strictEqual(early.shares, true);
  assert.strictEqual(early.checkedAt, undefined, "not marked as read yet, so a read cut off halfway is tried again");
  assert.ok(r.session.privacPolicyReading["news.example"], "still reading the rest");
  release();
  await r.idle();
  const done = r.store.privacData.sites[0].policy;
  assert.ok(done.checkedAt, "marked as read once every question is done");
  assert.strictEqual(done.shares, true);
});

test("the site you opened most recently is read next, ahead of ones still waiting", async () => {
  let release;
  const first = new Promise((r) => { release = r; });
  const order = [];
  const ask = async () => {
    if (!order.length) await first;
    return { answers: [] };
  };
  const r = loadReader({ sites: [site("news.example"), site("shop.example"), site("mail.example")], ask });
  r.send("news.example");
  for (let i = 0; i < 20 && !r.fetched.includes("https://news.example/privacy"); i++) await tick();
  r.send("shop.example");
  await tick();
  r.send("mail.example");
  await tick();
  order.push("go");
  release();
  await r.idle();
  const pages = r.fetched.filter((u) => /\/privacy$/.test(u));
  assert.deepStrictEqual(pages, ["https://news.example/privacy", "https://mail.example/privacy", "https://shop.example/privacy"]);
  for (const d of ["news.example", "shop.example", "mail.example"]) assert.ok(r.store.privacData.sites.find((s) => s.domain === d).policy.checkedAt, d);
});

test("a page that sends its links before its visit is saved still gets its policy read", async () => {
  let saved;
  const saveChain = new Promise((r) => { saved = r; });
  const r = loadReader({ sites: [], ask: async () => ({ answers: [] }), extra: { saveChain } });
  r.send("news.example");
  await tick();
  r.store.privacData.sites.push(site("news.example"));   // tracking.js's save of the visit lands
  saved();
  await r.idle();
  assert.ok(r.store.privacData.sites[0].policy.checkedAt);
});

test("the same site asked twice while it's being read is read once", async () => {
  let asks = 0;
  const r = loadReader({ sites: [site("news.example")], ask: async () => { asks++; return { answers: [] }; } });
  r.send("news.example");
  r.send("news.example");
  await r.idle();
  assert.strictEqual(r.fetched.filter((u) => u === "https://news.example/privacy").length, 1);
});

test("readPolicy reports each answered batch except the last", async () => {
  const ctx = {}; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("shared/policy.js"), ctx);
  const map = JSON.parse(read("shared/knowledge-map.json"));
  const seen = [];
  let calls = 0;
  await ctx.PrivaCPolicy.readPolicy({ html: POLICY_HTML, url: "https://news.example/privacy" }, map,
    async () => { calls++; return { answers: [{ id: "sells", answer: "no", quote: "We do not sell your personal information to anyone." }] }; },
    { onBatch: (p) => seen.push(JSON.parse(JSON.stringify(p))) });
  assert.ok(calls >= 2);
  assert.strictEqual(seen.length, calls - 1);
  assert.strictEqual(seen[0].sells, false);
});

// ---- what the pop-up and dashboard say ----
function summary() {
  const ctx = {}; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("shared/data.js"), ctx);
  vm.runInContext(read("shared/site-summary.js"), ctx);
  return ctx;
}
const unread = () => {
  const ctx = summary();
  const s = { domain: "news.example", trackers: [], policy: { sells: null, shares: null, source: null }, cookieChoice: "none" };
  return { ctx, s: Object.assign(s, ctx.PrivaCData.computeScore(s)) };
};

test("checkedFor says the policy is being read while it is, and keeps the honest range", () => {
  const { ctx, s } = unread();
  const c = ctx.PrivaCSiteSummary.checkedFor(s, { reading: true });
  assert.strictEqual(c.reading, true);
  assert.strictEqual(c.status, "Reading the privacy policy");
  assert.match(c.note, /^Until it's read, this could be/);
  assert.match(c.note, new RegExp(`as high as ${s.range.max} of 100`));
  const idle = ctx.PrivaCSiteSummary.checkedFor(s);
  assert.ok(!idle.reading);
  assert.match(idle.note, /isn't read yet/);
});

test("a policy that's already read shows no reading dot, even if it's being read again", () => {
  const ctx = summary();
  const s = { domain: "news.example", trackers: [], policy: { sells: false, shares: false, source: "https://news.example/privacy", checkedAt: "2026-10-01T00:00:00Z" }, cookieChoice: "none" };
  Object.assign(s, ctx.PrivaCData.computeScore(s));
  assert.ok(!ctx.PrivaCSiteSummary.checkedFor(s, { reading: true }).reading);
});

test("summarize passes the reading state through", () => {
  const { ctx, s } = unread();
  assert.strictEqual(ctx.PrivaCSiteSummary.summarize(s, { reading: true }).checked.reading, true);
});

test("the pop-up and dashboard show the words and a dot instead of the percentage while reading", () => {
  const popup = read("popup/popup.js"), dash = read("dashboard/dashboard.js");
  for (const js of [popup, dash]) {
    assert.match(js, /readingPolicies\(\)/, "reads which policies are being read");
    assert.match(js, /\.reading \?[^:]*progress-dot/, "a dot while reading");
    assert.match(js, /% of the grade checked/, "the percentage is still there when nothing is being read");
  }
  const css = read("shared/ui.css");
  assert.match(css, /\.progress-dot\s*\{/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^}]*\.progress-dot/, "the dot holds still for people who turn motion off");
});

test("PrivaCData.readingPolicies lists sites being read, and ignores a read that started over 5 minutes ago", async () => {
  const ctx = {}; ctx.self = ctx; ctx.window = ctx;
  const now = Date.now();
  ctx.chrome = { storage: { local: { get: async () => ({}) }, session: { get: async () => ({ privacPolicyReading: { "news.example": now - 1000, "old.example": now - 6 * 60000 } }) } } };
  vm.createContext(ctx);
  vm.runInContext(read("shared/data.js"), ctx);
  const r = await ctx.PrivaCData.readingPolicies();
  assert.deepStrictEqual(Object.keys(r), ["news.example"]);
  const none = {}; none.self = none; none.window = none;
  vm.createContext(none);
  vm.runInContext(read("shared/data.js"), none);
  assert.deepStrictEqual(Object.keys(await none.PrivaCData.readingPolicies()), [], "outside Chrome: nothing");
});

test("the pop-up redraws when C starts or stops reading this site's policy, or saves its first answers", () => {
  const js = read("popup/popup.js");
  const m = js.match(/\n  (function redrawWhenPolicyRead\(site, reading\) \{[\s\S]*?\n  \})\n/);
  assert.ok(m, "popup.js has redrawWhenPolicyRead(site, reading)");
  const listeners = [];
  const ctx = { reloads: 0, chrome: { storage: { onChanged: { addListener: (f) => listeners.push(f) } } } };
  ctx.location = { reload: () => { ctx.reloads++; } };
  vm.runInNewContext(m[1] + "\nthis.redrawWhenPolicyRead = redrawWhenPolicyRead;", ctx);
  ctx.redrawWhenPolicyRead({ domain: "news.example", policy: { sells: null, shares: null, source: null } }, true);
  const fire = (changes, area) => listeners.forEach((f) => f(changes, area));
  fire({ privacPolicyReading: { newValue: { "news.example": 1, "other.example": 2 } } }, "session");
  assert.strictEqual(ctx.reloads, 0, "still reading: nothing to redraw");
  fire({ privacData: { newValue: { sites: [{ domain: "news.example", policy: { sells: false, shares: true, source: "https://news.example/privacy" } }] } } }, "local");
  assert.strictEqual(ctx.reloads, 1, "first answers saved (not marked read yet)");
  fire({ privacPolicyReading: { newValue: { "other.example": 2 } } }, "session");
  assert.strictEqual(ctx.reloads, 2, "the read ended");
  assert.match(js, /redrawWhenPolicyRead\(site, !!reading\[site\.domain\]\)/);
});

// ---- finding the link sooner ----
test("the Privacy link is looked for as soon as the page is ready, and again whenever links appear", () => {
  const m = JSON.parse(read("manifest.json"));
  const own = m.content_scripts.find((c) => c.js.includes("content/policy-link.js"));
  assert.strictEqual(own.run_at, "document_end", "at DOMContentLoaded, not after the page finishes loading");
  assert.deepStrictEqual(own.js, ["content/policy-link.js"]);
  assert.ok(!own.all_frames, "top page only");
  assert.strictEqual(m.content_scripts.filter((c) => c.js.includes("content/policy-link.js")).length, 1);
  const js = read("content/policy-link.js");
  assert.match(js, /MutationObserver/);
  assert.doesNotMatch(js, /setTimeout\(send, 4000\)/, "no fixed 4-second wait");
});

test("policy-link.js sends the links once a late footer adds them", async () => {
  const sent = [];
  let observer = null;
  const links = [];
  const ctx = {
    window: {}, location: { hostname: "www.news.example" },
    document: { documentElement: {}, querySelectorAll: () => links },
    chrome: { runtime: { sendMessage: (m) => { sent.push(m); return Promise.resolve(); } } },
    MutationObserver: class { constructor(fn) { this.fn = fn; observer = this; } observe() {} disconnect() { this.off = true; } },
    setTimeout: (fn, ms) => (ms > 1000 ? 0 : setTimeout(fn, 5)), clearTimeout   // the 15-second give-up never comes here
  };
  ctx.window.top = ctx.window; ctx.window.self = ctx.window;
  vm.runInNewContext(read("content/policy-link.js"), ctx);
  assert.strictEqual(sent.length, 0, "nothing yet");
  assert.ok(observer, "watches the page");
  links.push({ href: "https://www.news.example/privacy", textContent: "Privacy Policy", getAttribute: () => "/privacy" });
  observer.fn([]);
  await new Promise((r) => setTimeout(r, 30));
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].domain, "news.example");
  assert.ok(observer.off, "stops watching once sent");
});
