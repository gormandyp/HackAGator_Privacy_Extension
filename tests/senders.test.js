// Run with: node --test
// docs/STORE.md section 6, fix 4: messages that read your PrivaC data (Ask C, which site a tab is on) or control
// C's AI are answered only for PrivaC's own pages (popup, dashboard), never for a script running inside a website.
// Content scripts may only report what they saw, and only the background writes privacData (CLAUDE.md).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const read = (f) => fs.readFileSync(__dirname + "/../" + f, "utf8");
const ID = "privacid";
const runtime = { id: ID, getURL: (p) => `chrome-extension://${ID}/${p}` };
const POPUP = { id: ID, url: `chrome-extension://${ID}/popup/popup.html` };
const DASHBOARD = { id: ID, url: `chrome-extension://${ID}/dashboard/dashboard.html`, tab: { id: 5 } };
const WEBSITE = { id: ID, url: "https://news.example/article", tab: { id: 9 }, frameId: 0 };   // PrivaC's own content script
const OTHER = { id: "someotherextension", url: "chrome-extension://someotherextension/x.html" };

function senders() {
  const ctx = { chrome: { runtime } };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("background/senders.js"), ctx);
  return ctx;
}

test("PrivaC's own pages count as PrivaC's pages; its scripts inside websites and other extensions don't", () => {
  const s = senders();
  assert.strictEqual(s.fromPrivaCPage(POPUP), true);
  assert.strictEqual(s.fromPrivaCPage(DASHBOARD), true);
  assert.strictEqual(s.fromPrivaCPage(WEBSITE), false);
  assert.strictEqual(s.fromPrivaCPage(OTHER), false);
  assert.strictEqual(s.fromPrivaCPage({}), false);
  assert.strictEqual(s.fromPrivaCPage(undefined), false);
  assert.strictEqual(s.fromPrivaC(WEBSITE), true, "content scripts are PrivaC's");
  assert.strictEqual(s.fromPrivaC(OTHER), false);
  assert.strictEqual(s.fromPrivaC({}), false);
});

// background.js with its other scripts replaced by fakes.
function background() {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const calls = { askC: 0, lists: 0, cookie: [] };
  const chrome = {
    runtime: { ...runtime, onInstalled: on("installed"), onStartup: on("startup"), onConnect: on("connect"), onMessage: on("msg"), getURL: runtime.getURL },
    alarms: { create: () => {}, onAlarm: on("alarm") },
    tabs: { create: () => {} }
  };
  const ctx = {
    chrome, console, Promise, setTimeout, AbortController,
    PrivaCLists: { refresh: async () => { calls.lists++; return {}; }, load: async () => ({}) },
    PrivaCAskC: { answer: async () => { calls.askC++; return { answer: "hi" }; } },
    PrivaCGemma: { ask: async () => ({}), warm: () => {} },
    PrivaCAI: { ask: async () => ({}), warm: () => {}, command: async () => ({ ok: true }) },
    PrivaCData: { load: async () => ({}) },
    updateCookieChoice: (domain, choice) => calls.cookie.push([domain, choice])
  };
  ctx.self = ctx;
  ctx.importScripts = (...files) => { if (files.includes("background/senders.js")) vm.runInContext(read("background/senders.js"), ctx); };
  vm.createContext(ctx);
  vm.runInContext(read("background.js"), ctx);
  const send = (msg, sender) => new Promise((resolve) => {
    const keep = listeners.msg(msg, sender, resolve);
    if (keep !== true) setTimeout(() => resolve("no answer"), 5);
  });
  return { listeners, calls, send };
}

test("background.js loads the shared sender check before the scripts that use it", () => {
  const files = read("background.js").match(/importScripts\(([^)]*)\)/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  assert.ok(files.indexOf("background/senders.js") >= 0 && files.indexOf("background/senders.js") < files.indexOf("background/tracking.js"));
});

test("Ask C answers PrivaC's dashboard and popup, but not a script inside a website or another extension", async () => {
  const b = background();
  assert.deepStrictEqual(await b.send({ type: "askC", question: "Who is Criteo?" }, DASHBOARD), { answer: "hi" });
  assert.deepStrictEqual(await b.send({ type: "askC", question: "Who is Criteo?" }, POPUP), { answer: "hi" });
  assert.strictEqual(await b.send({ type: "askC", question: "What sites did I visit?" }, WEBSITE), "no answer");
  assert.strictEqual(await b.send({ type: "askC", question: "What sites did I visit?" }, OTHER), "no answer");
  assert.strictEqual(b.calls.askC, 2);
});

test("the streaming Ask C connection only works from PrivaC's own pages", () => {
  const b = background();
  let posted = 0;
  const port = (sender) => {
    const handlers = {};
    return { name: "privac-ask", sender, postMessage: () => { posted++; },
      onDisconnect: { addListener: () => {} }, onMessage: { addListener: (fn) => { handlers.msg = fn; } }, handlers, disconnect: () => {} };
  };
  const site = port(WEBSITE);
  b.listeners.connect(site);
  if (site.handlers.msg) site.handlers.msg({ type: "ask", question: "What sites did I visit?" });
  assert.strictEqual(b.calls.askC, 0);
  const dash = port(DASHBOARD);
  b.listeners.connect(dash);
  dash.handlers.msg({ type: "ask", question: "Who is Criteo?" });
  assert.strictEqual(b.calls.askC, 1);
  assert.ok(posted >= 1);
});

test("list refresh only from PrivaC's pages; a cookie choice from PrivaC's content script, not another extension", async () => {
  const b = background();
  const before = b.calls.lists;
  await b.send({ type: "refreshLists" }, WEBSITE);
  assert.strictEqual(b.calls.lists, before);
  await b.send({ type: "cookieChoice", domain: "news.example", choice: "declined" }, OTHER);
  await b.send({ type: "cookieChoice", domain: "news.example", choice: "declined" }, WEBSITE);
  assert.deepStrictEqual(b.calls.cookie, [["news.example", "declined"]]);
});

test("the cookie detector reports a confirmed decline to the background instead of writing privacData itself", () => {
  const js = read("content/cookie-detector.js");
  assert.doesNotMatch(js, /privacData/);
  assert.doesNotMatch(js, /storage\.local\.set/);
  assert.match(js, /tell\(\{ type: "cookieChoice", domain[^}]*choice: "declined" \}\)/);
});
