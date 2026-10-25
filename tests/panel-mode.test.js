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

function load({ search = "?panel=1", embedded = true, theme = "light", style = "glass", height = 612.4, main = null } = {}) {
  const posted = [], winOn = {}, docOn = {}, watching = new Map();
  let resized = null, restyled = null;
  const classes = new Set();
  const root = { dataset: { theme, style }, classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) } };
  const body = { h: height, getBoundingClientRect() { return { height: this.h }; } };
  const ctx = {
    location: { search },
    document: { documentElement: root, body, addEventListener: (n, f) => { docOn[n] = f; }, querySelector: (sel) => (sel === "main" ? main : null) },
    ResizeObserver: class { constructor(cb) { resized = cb; } observe() {} },
    MutationObserver: class { constructor(cb) { this.cb = cb; if (!restyled) restyled = cb; } observe(target) { watching.set(target, this.cb); } },
    parent: { postMessage: (m, to) => posted.push([m, to]) },
    addEventListener: (n, f) => { winOn[n] = f; }
  };
  ctx.window = ctx;
  ctx.top = embedded ? {} : ctx;
  vm.runInNewContext(SRC, ctx);
  return { root, body, posted, winOn, docOn, classes, resize: () => resized && resized(), restyle: () => restyled && restyled(),
    changed: () => main && watching.get(main) && watching.get(main)() };
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

// Mac check, Oct 25: on a long page you scrolled to "Clear this site's data" and the cards slid under the top bar and
// showed through the gap above it. In the panel only the middle scrolls now (popup.css), so the page is as tall as the
// panel; it reports the height everything needs unscrolled, and again when the content changes (a clear's result).
test("when the middle scrolls inside the panel, it reports the height everything needs, and again when the content changes", () => {
  const main = { scrollHeight: 900, clientHeight: 300 };
  const t = load({ height: 640, main });
  t.resize();
  assert.strictEqual(t.posted.slice(-1)[0][0].height, 1240);
  main.scrollHeight = 950;
  t.changed();
  assert.strictEqual(t.posted.slice(-1)[0][0].height, 1290);
});
