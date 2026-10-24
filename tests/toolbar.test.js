// background/toolbar.js: what clicking PrivaC's toolbar button does. Chrome draws an extension's pop-up
// window as a plain rectangle, so on a website PrivaC floats its pop-up over the page in a rounded panel
// (content/panel.js). Where it can't (Chrome's own pages, the Web Store, PDFs, a page showing a modal dialog,
// a tab that was open before PrivaC was installed or reloaded), Chrome's usual pop-up window opens instead.
// Settings > Toolbar pop-up > "Chrome's" always uses Chrome's window.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function load({ settings = null, answer = { ok: true, open: true }, openFails = false, tabs = [] } = {}) {
  const calls = [];
  const on = {};
  const chrome = {
    storage: {
      local: { get: async () => ({ privacSettings: settings }) },
      onChanged: { addListener: (fn) => { on.storage = fn; } }
    },
    tabs: {
      sendMessage: async (tabId, msg, opts) => {
        calls.push(["sendMessage", tabId, msg, opts]);
        if (answer instanceof Error) throw answer;
        return answer;
      },
      query: async () => tabs
    },
    action: {
      onClicked: { addListener: (fn) => { on.click = fn; } },
      setPopup: async (o) => { calls.push(["setPopup", o]); },
      openPopup: async (o) => { calls.push(["openPopup", o]); if (openFails) throw new Error("Could not find an active browser window."); }
    },
    runtime: { onMessage: { addListener: (fn) => { on.message = fn; } } },
    webNavigation: { onCommitted: { addListener: (fn) => { on.nav = fn; } } }
  };
  const ctx = { console, Promise, setTimeout, chrome };
  ctx.self = ctx;
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/settings.js", "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/toolbar.js", "utf8"), ctx);
  return { T: ctx.PrivaCToolbar, calls, on };
}
const TAB = { id: 7, windowId: 3 };
const plain = (x) => JSON.parse(JSON.stringify(x));   // objects made inside vm have another realm's prototypes
const tick = () => new Promise((r) => setTimeout(r, 0));
const CHROME_WINDOW = [["setPopup", { tabId: 7, popup: "popup/popup.html" }], ["openPopup", { windowId: 3 }]];

test("the click handler is registered as soon as the background starts (Chrome only delivers clicks to listeners added right away)", () => {
  const { on } = load();
  assert.strictEqual(typeof on.click, "function");
});

test("on a website, the click asks the page to float the rounded panel, and Chrome's window stays shut", async () => {
  const { T, calls } = load();
  assert.strictEqual(await T.click(TAB), "panel");
  assert.deepStrictEqual(plain(calls), [["sendMessage", 7, { type: "privac-panel" }, { frameId: 0 }]], "only the top page is asked; no Chrome window");
});

test("clicking again while it's open closes it (the page says it's handled, so Chrome's window still stays shut)", async () => {
  const { T, calls } = load({ answer: { ok: true, open: false } });
  assert.strictEqual(await T.click(TAB), "panel");
  assert.ok(!calls.some((c) => c[0] === "openPopup"));
});

test("pages PrivaC isn't running on (Chrome's own pages, the Web Store, PDFs, tabs from before install) get Chrome's pop-up window", async () => {
  const { T, calls } = load({ answer: new Error("Could not establish connection. Receiving end does not exist.") });
  assert.strictEqual(await T.click(TAB), "window");
  assert.deepStrictEqual(plain(calls.slice(1)), CHROME_WINDOW, "set for this tab first, then opened in its window");
});

test("a page showing its own modal dialog (the panel would be stuck behind it) also gets Chrome's window", async () => {
  const { T, calls } = load({ answer: { ok: false, why: "modal" } });
  assert.strictEqual(await T.click(TAB), "window");
  assert.deepStrictEqual(plain(calls.slice(1)), CHROME_WINDOW);
});

test("Settings > Toolbar pop-up > Chrome's: always Chrome's window, and the page is never asked", async () => {
  const { T, calls } = load({ settings: { toolbar: "window" } });
  assert.strictEqual(await T.click(TAB), "window");
  assert.deepStrictEqual(plain(calls), CHROME_WINDOW);
});

test("if Chrome can't open its window right now, it stays set for the tab so the next click opens it", async () => {
  const { T, calls } = load({ answer: new Error("no receiver"), openFails: true });
  assert.strictEqual(await T.click(TAB), "window-next-click");
  assert.deepStrictEqual(plain(calls.slice(1, 2)), [["setPopup", { tabId: 7, popup: "popup/popup.html" }]]);
});

test("after the tab goes to a new page, the next click tries the rounded panel again (frames inside the page don't count)", () => {
  const { calls, on } = load();
  on.nav({ tabId: 7, frameId: 0 });
  on.nav({ tabId: 7, frameId: 4 });
  assert.deepStrictEqual(plain(calls), [["setPopup", { tabId: 7, popup: "" }]]);
});

test("a panel that couldn't load on the page asks for Chrome's window instead", async () => {
  const { calls, on } = load();
  on.message({ type: "privac-panel-failed" }, { tab: TAB, frameId: 0 });
  on.message({ type: "privac-panel-failed" }, {});            // not from a tab: ignored
  on.message({ type: "askC" }, { tab: TAB });                 // other messages: not ours
  await tick();
  assert.deepStrictEqual(plain(calls), CHROME_WINDOW);
});

test("switching Settings back to Rounded clears Chrome's window from every open tab", async () => {
  const { calls, on } = load({ tabs: [{ id: 1 }, { id: 2 }] });
  on.storage({ privacSettings: { oldValue: { toolbar: "window" }, newValue: { toolbar: "panel" } } }, "local");
  await tick(); await tick();
  assert.deepStrictEqual(plain(calls), [["setPopup", { tabId: 1, popup: "" }], ["setPopup", { tabId: 2, popup: "" }]]);
  calls.length = 0;
  on.storage({ privacSettings: { oldValue: { toolbar: "panel" }, newValue: { toolbar: "panel", style: "clean" } } }, "local");
  on.storage({ privacSettings: { oldValue: { toolbar: "window" }, newValue: { toolbar: "panel" } } }, "session");
  await tick(); await tick();
  assert.deepStrictEqual(calls, [], "other setting changes leave tabs alone");
});

test("a click with no usable tab does nothing", async () => {
  const { T, calls } = load();
  assert.strictEqual(await T.click(undefined), "none");
  assert.strictEqual(await T.click({ id: -1, windowId: 3 }), "none");
  assert.deepStrictEqual(calls, []);
});
