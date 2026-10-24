// popup/panel-mode.js: when the pop-up page floats over a website in content/panel.js's rounded panel, it tells
// the panel how tall it is, its light/dark mode and style, and when it has finished drawing; Escape closes it.
// Opened the usual way (Chrome's pop-up window, or the HTML file on its own) it does nothing.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../popup/panel-mode.js", "utf8");

const plain = (x) => JSON.parse(JSON.stringify(x));   // objects made inside vm have another realm's prototypes

function load({ search = "?panel=1", embedded = true, theme = "light", style = "glass", height = 612.4 } = {}) {
  const posted = [], winOn = {}, docOn = {};
  let resized = null, restyled = null;
  const classes = new Set();
  const root = { dataset: { theme, style }, classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) } };
  const body = { h: height, getBoundingClientRect() { return { height: this.h }; } };
  const ctx = {
    location: { search },
    document: { documentElement: root, body, addEventListener: (n, f) => { docOn[n] = f; } },
    ResizeObserver: class { constructor(cb) { resized = cb; } observe() {} },
    MutationObserver: class { constructor(cb) { restyled = cb; } observe() {} },
    parent: { postMessage: (m, to) => posted.push([m, to]) },
    addEventListener: (n, f) => { winOn[n] = f; }
  };
  ctx.window = ctx;
  ctx.top = embedded ? {} : ctx;
  vm.runInNewContext(SRC, ctx);
  return { root, body, posted, winOn, docOn, classes, resize: () => resized && resized(), restyle: () => restyled && restyled() };
}

test("inside the panel it marks the page, so popup.css drops the wallpaper and the website shows through the glass", () => {
  const t = load();
  assert.ok(t.classes.has("in-panel"));
});

test("it tells the panel its height, light/dark and style, and when the pop-up has finished drawing", () => {
  const t = load();
  t.resize();
  assert.deepStrictEqual(plain(t.posted.map((p) => p[0])), [{ privacPanel: 1, type: "size", height: 613, theme: "light", style: "glass", ready: false }]);
  t.docOn["privac-popup-ready"]();
  assert.deepStrictEqual(plain(t.posted.slice(-1)[0][0]), { privacPanel: 1, type: "size", height: 613, theme: "light", style: "glass", ready: true });
  t.body.h = 700;
  t.resize();
  assert.strictEqual(t.posted.slice(-1)[0][0].height, 700, "and again whenever its height changes");
});

test("switching to dark mode or the Clean style is passed on, and nothing is sent twice", () => {
  const t = load();
  t.resize();
  t.resize();
  assert.strictEqual(t.posted.length, 1);
  t.root.dataset.theme = "dark";
  t.root.dataset.style = "clean";
  t.restyle();
  assert.deepStrictEqual(plain(t.posted.slice(-1)[0][0]), { privacPanel: 1, type: "size", height: 613, theme: "dark", style: "clean", ready: false });
});

test("Escape asks the panel to close", () => {
  const t = load();
  t.winOn.keydown({ key: "a" });
  t.winOn.keydown({ key: "Escape" });
  assert.deepStrictEqual(plain(t.posted.map((p) => p[0])), [{ privacPanel: 1, type: "close" }]);
});

test("opening the dashboard, Settings or Ask C (they open a new tab) closes the panel, like Chrome's pop-up", () => {
  const t = load();
  const clickOn = (id) => t.docOn.click({ target: { closest: (sel) => (sel.split(",").map((x) => x.trim()).includes(id) ? { id } : null) } });
  clickOn("#some-row");
  assert.deepStrictEqual(t.posted, [], "other clicks leave it open");
  for (const id of ["#open-dashboard", "#open-dashboard-top", "#open-settings", "#ask-site"]) clickOn(id);
  assert.deepStrictEqual(plain(t.posted.map((p) => p[0])), Array(4).fill({ privacPanel: 1, type: "close" }));
});

test("opened the usual way (Chrome's window, or the file on its own in a frame) it does nothing", () => {
  for (const opts of [{ search: "" }, { search: "?site=cnn.com" }, { embedded: false }]) {
    const t = load(opts);
    t.resize();
    assert.strictEqual(t.classes.size, 0, JSON.stringify(opts));
    assert.deepStrictEqual(plain(t.posted), []);
    assert.strictEqual(t.winOn.keydown, undefined);
  }
});
