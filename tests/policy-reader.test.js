// Run with: node --test
// background/policy-reader.js with a fake Chrome, fetch and Gemma.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const POLICY_HTML = `<h1>Privacy Policy</h1><p>We do not sell your personal information to anyone.</p>` +
  "<p>We describe here how we look after the information you give us when you use the site.</p>".repeat(12);

function load({ sites, ask, fetchFn }) {
  let store = { privacData: { sample: false, sites } };
  const listeners = [];
  const fetched = [];
  const chrome = {
    runtime: { getURL: (p) => "ext://" + p, onMessage: { addListener: (fn) => listeners.push(fn) } },
    storage: { local: {
      get: async (k) => ({ [k]: store[k] && JSON.parse(JSON.stringify(store[k])) }),
      set: async (o) => { Object.assign(store, JSON.parse(JSON.stringify(o))); }
    } }
  };
  const map = JSON.parse(fs.readFileSync(__dirname + "/../shared/knowledge-map.json", "utf8"));
  const fetch = async (url, opts) => {
    fetched.push({ url, opts });
    if (url === "ext://shared/knowledge-map.json") return { ok: true, json: async () => map };
    return fetchFn ? fetchFn(url, opts) : { ok: true, headers: { get: () => "text/html" }, text: async () => POLICY_HTML };
  };
  const ctx = { chrome, console, URL, Promise, setTimeout, fetch, PrivaCGemma: { ask } };
  ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../shared/policy.js", "utf8"), ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../background/policy-reader.js", "utf8"), ctx);
  const send = (msg, sender = { tab: { id: 1 } }) => listeners.forEach((fn) => fn(msg, sender, () => {}));
  return { send, store: () => store, fetched, idle: () => ctx.PrivaCPolicyReader.idle() };
}

const links = [{ href: "https://news.example/privacy", text: "Privacy Policy" }];
const noSellAsk = async () => ({ answers: [{ id: "sells", answer: "no", quote: "We do not sell your personal information to anyone." }] });

test("reads the policy for a visited site and saves the answers into site.policy", async () => {
  const r = load({ sites: [{ domain: "news.example", trackers: [], policy: { sells: null, shares: null, source: null } }], ask: noSellAsk });
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  const p = r.store().privacData.sites[0].policy;
  assert.strictEqual(p.sells, false);
  assert.strictEqual(p.source, "https://news.example/privacy");
  assert.ok(p.checkedAt);
  const page = r.fetched.find((f) => f.url === "https://news.example/privacy");
  assert.strictEqual(page.opts.credentials, "omit", "never send the person's cookies with the policy request");
});

test("doesn't re-read a policy checked in the last 7 days", async () => {
  const fresh = { sells: false, shares: null, source: "https://news.example/privacy", checkedAt: new Date().toISOString() };
  let asked = 0;
  const r = load({ sites: [{ domain: "news.example", trackers: [], policy: fresh }], ask: async () => { asked++; return { answers: [] }; } });
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  assert.strictEqual(asked, 0);
});

test("ignores sites PrivaC hasn't recorded, and links to other websites", async () => {
  let asked = 0;
  const ask = async () => { asked++; return { answers: [] }; };
  const r = load({ sites: [{ domain: "news.example", trackers: [] }], ask });
  r.send({ type: "privac-policy-links", domain: "unknown.example", links: [{ href: "https://unknown.example/privacy", text: "Privacy Policy" }] });
  r.send({ type: "privac-policy-links", domain: "news.example", links: [{ href: "https://tracker.net/privacy", text: "Privacy Policy" }] });
  await r.idle();
  assert.strictEqual(asked, 0);
  assert.ok(!r.fetched.some((f) => /tracker\.net|unknown\.example/.test(f.url)));
});

test("if Gemma is off, nothing is saved and the site is tried again on the next visit", async () => {
  let fail = true;
  const ask = async () => { if (fail) throw new Error("offline"); return noSellAsk(); };
  const r = load({ sites: [{ domain: "news.example", trackers: [], policy: { sells: null, shares: null, source: null } }], ask });
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  assert.strictEqual(r.store().privacData.sites[0].policy.checkedAt, undefined);
  fail = false;
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  assert.strictEqual(r.store().privacData.sites[0].policy.sells, false);
});

test("a non-HTML policy (e.g. PDF) is skipped", async () => {
  let asked = 0;
  const r = load({
    sites: [{ domain: "news.example", trackers: [] }],
    ask: async () => { asked++; return { answers: [] }; },
    fetchFn: async () => ({ ok: true, headers: { get: () => "application/pdf" }, text: async () => "%PDF" })
  });
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  assert.strictEqual(asked, 0);
});

// docs/STORE.md section 6, fix 1: a site's "Privacy" link can forward the request somewhere else.
test("a policy link that forwards to another website or to a home-network address is not read", async () => {
  for (const finalUrl of ["https://tracker.net/privacy", "http://192.168.1.1/", "http://localhost:8080/x", "http://10.0.0.5/privacy", "http://[::1]/"]) {
    let asked = 0;
    const r = load({
      sites: [{ domain: "news.example", trackers: [] }],
      ask: async () => { asked++; return noSellAsk(); },
      fetchFn: async () => ({ ok: true, redirected: true, url: finalUrl, headers: { get: () => "text/html" }, text: async () => POLICY_HTML })
    });
    r.send({ type: "privac-policy-links", domain: "news.example", links });
    await r.idle();
    assert.strictEqual(asked, 0, finalUrl);
    assert.strictEqual(r.store().privacData.sites[0].policy, undefined, finalUrl);
  }
});

test("a policy link that forwards within the same site is still read", async () => {
  const r = load({
    sites: [{ domain: "news.example", trackers: [] }],
    ask: noSellAsk,
    fetchFn: async () => ({ ok: true, redirected: true, url: "https://www.news.example/legal/privacy-policy", headers: { get: () => "text/html" }, text: async () => POLICY_HTML })
  });
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  assert.strictEqual(r.store().privacData.sites[0].policy.sells, false);
});

// Fix 2: while C's AI isn't set up, a failed read used to fetch the policy page again on every visit.
test("if Gemma is off, the next visit asks Gemma again without fetching the policy page again", async () => {
  let fail = true;
  const ask = async () => { if (fail) throw new Error("offline"); return noSellAsk(); };
  const r = load({ sites: [{ domain: "news.example", trackers: [] }], ask });
  for (let i = 0; i < 3; i++) {
    r.send({ type: "privac-policy-links", domain: "news.example", links });
    await r.idle();
  }
  fail = false;
  r.send({ type: "privac-policy-links", domain: "news.example", links });
  await r.idle();
  assert.strictEqual(r.fetched.filter((f) => f.url === "https://news.example/privacy").length, 1);
  assert.strictEqual(r.store().privacData.sites[0].policy.sells, false);
});
