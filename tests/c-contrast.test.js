// content/c-contrast.js: when the website behind C is dark, C's arms and legs turn white; when it's light
// they stay navy. Runs on a fake page (no browser needed). Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const NAVY = "#16233f";
const URL = (p) => "chrome-extension://x/" + p;

// A fake SVG shape: enough of an Element for the script (tag, attributes, a marker).
function shape(tag, attrs) {
  const a = Object.assign({}, attrs);
  return {
    tagName: tag, nodeName: tag,
    getAttribute: (n) => (n in a ? a[n] : null),
    setAttribute: (n, v) => { a[n] = String(v); },
    hasAttribute: (n) => n in a,
    removeAttribute: (n) => { delete a[n]; },
    attrs: a
  };
}

function setup({ pageColor = "rgb(255, 255, 255)", layers = null, under = null, imgFile = "mascot-push-up.svg", inline = false, clickThrough = null } = {}) {
  const observers = [];
  class FakeObserver { constructor(cb) { this.cb = cb; observers.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } disconnect() {} }

  const img = { tagName: "IMG", src: URL("c-poses/" + imgFile), getAttribute() { return this.src; }, setAttribute(n, v) { if (n === "src") this.src = v; } };
  const arm = shape("path", { d: "M23 66 L10 82", stroke: NAVY });
  const mouth = shape("path", { d: "M51 66 Q60 75 69 66", stroke: NAVY, fill: "none" });
  const eye = shape("circle", { r: "6.5", fill: "#fff", stroke: NAVY });
  const pupil = shape("circle", { r: "3.2", fill: NAVY });
  const arc = shape("path", { d: "M86.9 31.1 A38 38 0 1 0 86.9 84.9", stroke: "#fa4616" });
  const shapes = [arm, arc, mouth, eye, pupil];
  const svgEl = {
    tagName: "svg",
    querySelectorAll: (s) => (s === "path" ? shapes.filter((x) => x.tagName === "path") : []),
    querySelector: (s) => (s === "[data-privac-face]" ? shapes.find((x) => x.hasAttribute("data-privac-face")) || null : null),
    insertBefore: (el, ref) => { el.remove = () => shapes.splice(shapes.indexOf(el), 1); shapes.splice(shapes.indexOf(ref), 0, el); }
  };
  arc.parentNode = svgEl;
  const c = {
    getBoundingClientRect: () => ({ left: 800, top: 500, right: 920, bottom: 630, width: 120, height: 130 }),
    querySelector: (s) => (s === "img" ? (inline ? null : img) : null),
    querySelectorAll: (s) => (!inline ? [] : s === "svg" ? [svgEl] : /path|circle/.test(s) ? shapes.slice() : [])
  };
  const root = { querySelector: (s) => (s === ".c" ? c : null) };
  const host = { tagName: "PRIVAC-PROMPT", shadowRoot: root, isConnected: true };

  // What's under any point: C's own pop-up first (the script must skip it), then the page's layers.
  const page = layers || [{ tagName: "BODY", bg: pageColor }, { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }];
  const card = { tagName: "PRIVAC-GRADE" };
  const stack = [host, card, ...(under ? under.map((i) => page[i]) : page)];
  const styles = new Map(page.concat(clickThrough || []).map((el) => [el, { backgroundColor: el.bg, backgroundImage: el.image || "none", color: el.color || "rgb(0, 0, 0)" }]));
  styles.set(document_root(), { backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none", color: "rgb(0,0,0)", colorScheme: "normal" });
  function document_root() { return page[page.length - 1]; }

  const hosts = [];
  const P = {
    cookie: () => { hosts.push(host); },
    adversary: () => { hosts.push(host); }
  };
  const listeners = {};
  const ctx = {
    document: {
      querySelectorAll: () => hosts.slice(),
      // clickThrough: layers with pointer-events: none, which elementsFromPoint only returns while a style turns that off.
      adoptedStyleSheets: [],
      elementsFromPoint: () => (clickThrough && ctx.document.adoptedStyleSheets.some((x) => /pointer-events:\s*auto\s*!important/.test(x.text))
        ? [host, card, ...clickThrough, ...stack.slice(2)] : stack),
      documentElement: document_root(),
      body: page.find((el) => el.tagName === "BODY") || null,
      createElementNS: (ns, tag) => shape(tag, {})
    },
    getComputedStyle: (el) => styles.get(el) || { backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none", color: "rgb(0,0,0)" },
    matchMedia: () => ({ matches: false }),
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (n, f) => { listeners[n] = f; },
    MutationObserver: FakeObserver,
    requestAnimationFrame: (f) => f(),
    setTimeout: (f) => f(), clearTimeout: () => {},
    chrome: { runtime: { getURL: URL } },
    CSSStyleSheet: class { replaceSync(t) { this.text = t; } }
  };
  ctx.window = ctx; ctx.window.PrivaCPrompt = P;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../shared/c-ink.js", "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(__dirname + "/../content/c-contrast.js", "utf8"), ctx);
  return { P, ctx, img, arm, arc, mouth, eye, pupil, shapes, observers, styles, page, listeners };
}

test("on a dark website C switches to the white-limbed drawing", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("on a light website C keeps his navy limbs", () => {
  const t = setup({ pageColor: "rgb(255, 255, 255)" });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/mascot-push-up.svg"));
});

test("the foreign-adversary pop-up gets the same treatment", () => {
  const t = setup({ pageColor: "rgb(0, 0, 0)", imgFile: "mascot-alarmed-yield-wave.svg" });
  t.P.adversary({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-alarmed-yield-wave.svg"));
});

test("when C's pose changes later, the new drawing is checked too", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  t.P.cookie({});
  const obs = t.observers.find((o) => o.target && o.target.querySelector);
  assert.ok(obs, "watches C's pop-up");
  t.img.src = URL("c-poses/mascot-cliff-hang.svg");          // c-placement.js moves him under the banner
  obs.cb([]);
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-cliff-hang.svg"));
});

test("if the page turns light again, C goes back to navy limbs", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
  t.styles.get(t.page[0]).backgroundColor = "rgb(255, 255, 255)";
  t.listeners.scroll();                                       // checked again on scroll
  assert.strictEqual(t.img.src, URL("c-poses/mascot-push-up.svg"));
});

test("see-through layers are looked through to the color underneath", () => {
  const layers = [
    { tagName: "DIV", bg: "rgba(0, 0, 0, 0)" },               // transparent wrapper
    { tagName: "SECTION", bg: "rgba(255, 255, 255, 0.05)" },  // faint tint
    { tagName: "BODY", bg: "rgb(10, 10, 10)" },
    { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }
  ];
  const t = setup({ layers });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("a page with no background color at all counts as the browser's white", () => {
  const layers = [{ tagName: "BODY", bg: "rgba(0, 0, 0, 0)" }, { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }];
  const t = setup({ layers });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/mascot-push-up.svg"));
});

test("a photo background with light text counts as dark", () => {
  const layers = [
    { tagName: "DIV", bg: "rgba(0, 0, 0, 0)", image: 'url("hero.jpg")', color: "rgb(255, 255, 255)" },
    { tagName: "BODY", bg: "rgb(255, 255, 255)" },
    { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }
  ];
  const t = setup({ layers });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("a dark gradient background counts as dark", () => {
  const layers = [
    { tagName: "DIV", bg: "rgba(0, 0, 0, 0)", image: "linear-gradient(rgb(15, 23, 42), rgb(30, 41, 59))" },
    { tagName: "BODY", bg: "rgb(255, 255, 255)" },
    { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }
  ];
  const t = setup({ layers });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("C drawn by the mascot code (not a pose file) gets white limbs and a white face behind his navy features", () => {
  const t = setup({ pageColor: "rgb(0, 0, 0)", inline: true });
  t.P.cookie({});
  assert.strictEqual(t.arm.getAttribute("stroke"), "#ffffff");
  assert.strictEqual(t.mouth.getAttribute("stroke"), NAVY);
  assert.strictEqual(t.eye.getAttribute("stroke"), NAVY);
  assert.strictEqual(t.pupil.getAttribute("fill"), NAVY);
  const disc = t.shapes.find((x) => x.hasAttribute("data-privac-face"));
  assert.ok(disc, "a white face disc is added");
  assert.strictEqual(t.shapes.indexOf(disc), t.shapes.indexOf(t.arc) - 1, "right behind the C, under his features");
  assert.strictEqual(disc.getAttribute("fill"), "#fff");
  // And back.
  t.styles.get(t.page[0]).backgroundColor = "rgb(255, 255, 255)";
  t.listeners.scroll();
  assert.strictEqual(t.arm.getAttribute("stroke"), NAVY);
  assert.ok(!t.shapes.some((x) => x.hasAttribute("data-privac-face")), "face disc removed on light pages");
});

test("below where a short page's content ends, the body's color still counts (browsers paint it across the window)", () => {
  // Only <html> is under C there, and it's transparent; the body is dark.
  const layers = [{ tagName: "BODY", bg: "rgb(15, 23, 42)" }, { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }];
  const t = setup({ layers, under: [1] });
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("C's own speech bubble and PrivaC's grade box aren't mistaken for the website", () => {
  // The stack in setup() starts with privac-prompt and privac-grade; if they counted, there'd be no color.
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  t.P.cookie({});
  assert.ok(t.img.src.includes("/dark/"));
});

test("the unsafe-site warning (content/unsafe.js, its own pop-up) gets white limbs on a dark site too", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  const pageObs = t.observers.find((o) => o.target === t.ctx.document.documentElement);
  assert.ok(pageObs, "watches the page for PrivaC pop-ups being added");
  assert.strictEqual(pageObs.opts.childList, true);
  assert.ok(!pageObs.opts.subtree, "only the page's top level, so it stays cheap");
  const img = { tagName: "IMG", src: URL("c-poses/mascot-alarmed-yield-wave.svg"), getAttribute() { return this.src; }, setAttribute(n, v) { if (n === "src") this.src = v; } };
  const c = {
    getBoundingClientRect: () => ({ left: 900, top: 560, right: 1020, bottom: 680, width: 120, height: 120 }),
    querySelector: (s) => (s === "img" ? img : null), querySelectorAll: () => []
  };
  const unsafe = { tagName: "PRIVAC-UNSAFE", isConnected: true, shadowRoot: { querySelector: (s) => (s === ".c" ? c : null) } };
  pageObs.cb([{ addedNodes: [unsafe] }]);
  assert.strictEqual(img.src, URL("c-poses/dark/mascot-alarmed-yield-wave.svg"));
  // Other things added to the page are ignored.
  pageObs.cb([{ addedNodes: [{ tagName: "DIV" }, { nodeType: 3 }] }]);
});

// Cloud UI audit, 2026-10-25: on a dark page the unsafe-site warning's C stayed navy. The warning slides up from below
// the window, so when it was first checked C wasn't on screen yet, and nothing checked again once it arrived.
test("the unsafe-site warning is checked again when its slide-in ends, so C turns white once he's on screen", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  const pageObs = t.observers.find((o) => o.target === t.ctx.document.documentElement);
  const img = { tagName: "IMG", src: URL("c-poses/mascot-alarmed-yield-wave.svg"), getAttribute() { return this.src; }, setAttribute(n, v) { if (n === "src") this.src = v; } };
  let top = 900;   // below the 800-pixel window while it slides in
  const c = {
    getBoundingClientRect: () => ({ left: 900, top, right: 1020, bottom: top + 120, width: 120, height: 120 }),
    querySelector: (s) => (s === "img" ? img : null), querySelectorAll: () => []
  };
  const events = {};
  const root = { querySelector: (s) => (s === ".c" ? c : null), addEventListener: (n, f) => { events[n] = f; } };
  pageObs.cb([{ addedNodes: [{ tagName: "PRIVAC-UNSAFE", isConnected: true, shadowRoot: root }] }]);
  assert.strictEqual(img.src, URL("c-poses/mascot-alarmed-yield-wave.svg"), "off screen: nothing to look at yet");
  top = 560;
  assert.ok(events.animationend, "listens for the slide-in to end");
  events.animationend();
  assert.strictEqual(img.src, URL("c-poses/dark/mascot-alarmed-yield-wave.svg"));
});

// A photo or video hero (like gymshark.com): its pixels can't be read, so the text laid over it is the hint.
function hero({ tag = "VIDEO", texts }) {
  const box = { left: 0, top: 0, right: 1280, bottom: 700, width: 1280, height: 700 };
  const media = { tagName: tag, getBoundingClientRect: () => box };
  const textEls = texts.map(({ color, bg = "rgba(0, 0, 0, 0)", at = { left: 100, top: 400, right: 500, bottom: 460 } }) => ({
    tagName: "H2",
    childNodes: [{ nodeType: 3, textContent: "SOFTSENSE" }],
    getBoundingClientRect: () => Object.assign({ width: at.right - at.left, height: at.bottom - at.top }, at),
    style: { color, backgroundColor: bg }
  }));
  const container = { tagName: "SECTION", querySelectorAll: () => textEls, parentElement: null };
  media.parentElement = container;
  return { media, textEls };
}

function heroSetup(h, pageColor = "rgb(245, 245, 245)") {
  const layers = [h.media, { tagName: "BODY", bg: pageColor }, { tagName: "HTML", bg: "rgba(0, 0, 0, 0)" }];
  const t = setup({ layers });
  for (const el of h.textEls) t.styles.set(el, { backgroundColor: el.style.backgroundColor, backgroundImage: "none", color: el.style.color });
  t.styles.set(h.media, { backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none", color: "rgb(0, 0, 0)" });
  return t;
}

test("over a video hero with white text on it (gymshark.com), C gets white limbs", () => {
  const h = hero({ texts: [{ color: "rgb(255, 255, 255)" }, { color: "rgb(255, 255, 255)" }] });
  const t = heroSetup(h);
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("over a photo with dark text on it, C keeps navy limbs", () => {
  const h = hero({ tag: "IMG", texts: [{ color: "rgb(17, 17, 17)" }] });
  const t = heroSetup(h, "rgb(0, 0, 0)");                  // even on a dark page: the photo is what's behind C
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/mascot-push-up.svg"));
});

test("a button with its own solid background doesn't count as a hint about the photo", () => {
  // White "Shop new in" button with dark text, plus white headline: the headline decides.
  const h = hero({ texts: [{ color: "rgb(17, 17, 17)", bg: "rgb(255, 255, 255)" }, { color: "rgb(255, 255, 255)" }] });
  const t = heroSetup(h);
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

test("text that isn't on top of the photo isn't a hint", () => {
  const h = hero({ texts: [{ color: "rgb(255, 255, 255)", at: { left: 100, top: 900, right: 500, bottom: 960 } }] });
  const t = heroSetup(h);                                   // light page, no hint: look through to the page
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/mascot-push-up.svg"));
});

test("a photo with no text on it (a product shot) falls back to the page color", () => {
  const h = hero({ tag: "IMG", texts: [] });
  const dark = heroSetup(h, "rgb(10, 10, 10)");
  dark.P.cookie({});
  assert.strictEqual(dark.img.src, URL("c-poses/dark/mascot-push-up.svg"));
  const light = heroSetup(hero({ tag: "IMG", texts: [] }), "rgb(255, 255, 255)");
  light.P.cookie({});
  assert.strictEqual(light.img.src, URL("c-poses/mascot-push-up.svg"));
});

// Mac check, 2026-10-25: on cnn.com C stood on a near-black ad strip with navy limbs. The strip sits in a header with
// pointer-events: none, which document.elementsFromPoint skips, so C saw the white page under it. For the lookup only,
// a style C's code adds and takes away again makes those layers count; the page's own style sheets are left as they were.
test("a dark strip the mouse clicks through (pointer-events: none) still counts as what's behind C", () => {
  const t = setup({ pageColor: "rgb(255, 255, 255)", clickThrough: [{ tagName: "DIV", bg: "rgb(12, 12, 12)" }, { tagName: "HEADER", bg: "rgba(0, 0, 0, 0)" }] });
  const pageSheet = { text: "the site's own adopted sheet" };
  t.ctx.document.adoptedStyleSheets = [pageSheet];
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
  assert.deepStrictEqual(Array.from(t.ctx.document.adoptedStyleSheets), [pageSheet], "the page's style sheets are put back");
});

test("without that style support, C still checks the page the usual way", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  delete t.ctx.CSSStyleSheet;
  t.P.cookie({});
  assert.strictEqual(t.img.src, URL("c-poses/dark/mascot-push-up.svg"));
});

// The look-through style makes the browser restyle the whole page, about 5 ms per 1,000 elements (Chromium, 2026-10-25),
// so on a very big page C checks the usual way, and checks are spaced out instead of running every frame while he moves.
test("on a very big page C doesn't add the look-through style", () => {
  const t = setup({ pageColor: "rgb(255, 255, 255)", clickThrough: [{ tagName: "DIV", bg: "rgb(12, 12, 12)" }] });
  let added = 0;
  const sheets = [];
  Object.defineProperty(t.ctx.document, "adoptedStyleSheets", { get: () => sheets, set: (v) => { added++; sheets.splice(0, sheets.length, ...v); } });
  t.ctx.document.getElementsByTagName = () => ({ length: 20000 });
  t.P.cookie({});
  assert.strictEqual(added, 0);
  assert.strictEqual(t.img.src, URL("c-poses/mascot-push-up.svg"), "checked the usual way");
});

test("checks are spaced out while C moves: at most one every 150 ms", () => {
  const t = setup({ pageColor: "rgb(17, 24, 39)" });
  const timers = [];
  t.ctx.setTimeout = (f, ms) => { timers.push(ms || 0); f(); };
  let now = 1000;
  t.ctx.Date = { now: () => now };
  t.P.cookie({});
  const obs = t.observers.find((o) => o.target && o.target.querySelector);
  obs.cb([]);                       // moved right after the first check
  assert.ok(timers.some((ms) => ms > 0 && ms <= 150), `waited before checking again (${timers.join(", ")})`);
});
