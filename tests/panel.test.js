// content/panel.js: PrivaC's toolbar pop-up floating over a website in a rounded panel (Chrome draws its own
// pop-up window as a plain rectangle). It shows PrivaC's own pop-up page in a frame the website can't read,
// appears once that page has drawn, takes its height, and closes like Chrome's pop-up does.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../content/panel.js", "utf8");
const ORIGIN = "chrome-extension://privacid";

function classList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach((x) => s.add(x)),
    remove: (...c) => c.forEach((x) => s.delete(x)),
    toggle: (c, on) => { if (on === undefined ? !s.has(c) : on) s.add(c); else s.delete(c); return s.has(c); },
    contains: (c) => s.has(c)
  };
}

function load({ protocol = "https:", modal = false, fullscreen = false, xml = false, innerHeight = 900, inFrame = false, existing } = {}) {
  const winOn = {}, docOn = {}, timers = [], sent = [], focused = [];
  let listener = null;
  const pageInput = { tagName: "INPUT", isConnected: true, focus(o) { focused.push(["page input", o]); } };
  const doc = {
    activeElement: pageInput,
    visibilityState: "visible",
    fullscreenElement: fullscreen ? {} : null,
    body: { tagName: "BODY" },
    createElement: (tag) => make(tag),
    querySelector: (sel) => (sel === "dialog:modal" && modal ? { tagName: "DIALOG" } : null),
    addEventListener: (n, f) => { docOn[n] = f; },
    removeEventListener: (n, f) => { if (docOn[n] === f) delete docOn[n]; }
  };
  doc.documentElement = {
    namespaceURI: xml ? null : "http://www.w3.org/1999/xhtml",
    children: [],
    appendChild(c) { this.children.push(c); c.parent = this; c.isConnected = true; return c; }
  };
  function make(tag) {
    const e = {
      tagName: tag.toUpperCase(), attrs: {}, children: [], style: {}, classList: classList(), isConnected: false, parent: null,
      set className(v) { v.split(" ").forEach((c) => this.classList.add(c)); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(c) { this.children.push(c); c.parent = this; return c; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; this.isConnected = false; },
      attachShadow(o) { this.shadowMode = o.mode; this.shadow = make("#shadow-root"); this.shadow.host = this; return this.shadow; },
      focus(o) { focused.push([this.tagName, o]); if (this.tagName === "IFRAME") doc.activeElement = host(); }
    };
    if (tag === "iframe") e.contentWindow = { frame: true };
    return e;
  }
  const host = () => doc.documentElement.children.find((c) => c.tagName === "PRIVAC-PANEL");
  const ctx = {
    console, document: doc, location: { protocol }, innerHeight,
    addEventListener: (n, f) => { winOn[n] = f; },
    removeEventListener: (n, f) => { if (winOn[n] === f) delete winOn[n]; },
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    requestAnimationFrame: (f) => f(),
    chrome: { runtime: {
      id: "privacid",
      getURL: (p) => "chrome-extension://dynamic-1234/" + p,
      sendMessage: (m) => { sent.push(m); },
      onMessage: { addListener: (fn) => { listener = fn; } }
    } }
  };
  ctx.window = ctx;
  ctx.top = inFrame ? {} : ctx;
  if (existing) ctx.PrivaCPanel = existing;
  vm.runInNewContext(SRC, ctx);

  const click = () => { let r; listener({ type: "privac-panel" }, { id: "privacid" }, (x) => { r = x; }); return r; };
  const parts = () => {
    const h = host();
    const box = h && h.shadow.children.find((c) => c.tagName === "DIV");
    const frame = box && box.children.find((c) => c.tagName === "IFRAME");
    return { host: h, box, frame };
  };
  const fromPanel = (data) => winOn.message({ source: parts().frame.contentWindow, origin: ORIGIN, data: { privacPanel: 1, ...data } });
  return { ctx, doc, winOn, docOn, timers, sent, focused, pageInput, click, parts, fromPanel, hasListener: () => !!listener };
}
const plain = (x) => JSON.parse(JSON.stringify(x));   // objects made inside vm have another realm's prototypes
const DRAWN = { type: "size", height: 640, theme: "light", style: "glass", ready: true };

test("clicking the toolbar button on a website floats PrivaC's own pop-up page in a panel at the top right", () => {
  const t = load();
  assert.deepStrictEqual(plain(t.click()), { ok: true, open: true });
  const { host, box, frame } = t.parts();
  assert.ok(host && host.isConnected, "added to the page");
  assert.strictEqual(host.shadowMode, "closed", "the website's scripts can't reach inside");
  assert.match(host.getAttribute("style"), /position:\s*fixed !important/);
  assert.match(host.getAttribute("style"), /z-index:\s*2147483647 !important/);
  assert.strictEqual(frame.src, "chrome-extension://dynamic-1234/popup/popup.html?panel=1", "PrivaC's pop-up page (address changes every session)");
  assert.strictEqual(box.getAttribute("role"), "dialog");
  assert.strictEqual(box.getAttribute("aria-label"), "PrivaC");
  const css = host.shadow.children.find((c) => c.tagName === "STYLE").textContent;
  assert.match(css, /border-radius:\s*2\dpx/, "rounded corners");
});

test("it stays invisible until the pop-up page has drawn, then takes the page's height and the keyboard focus", () => {
  const t = load();
  t.click();
  const { box } = t.parts();
  assert.ok(!box.classList.contains("shown"));
  t.fromPanel({ ...DRAWN, height: 120, ready: false });
  assert.ok(!box.classList.contains("shown"), "not while the header is all there is");
  t.fromPanel(DRAWN);
  assert.ok(box.classList.contains("shown"));
  assert.strictEqual(box.style.height, "640px");
  assert.deepStrictEqual(plain(t.focused), [["IFRAME", { preventScroll: true }]]);
});

test("it matches the pop-up's light/dark mode and style (so the website shows through the glass)", () => {
  const t = load();
  t.click();
  const { box, frame } = t.parts();
  t.fromPanel({ ...DRAWN, theme: "dark" });
  assert.ok(box.classList.contains("dark"));
  assert.strictEqual(frame.style.colorScheme, "dark", "Chrome only lets a frame be see-through when its light/dark matches");
  t.fromPanel({ ...DRAWN, theme: "light", style: "clean" });
  assert.ok(!box.classList.contains("dark") && box.classList.contains("clean"));
  assert.strictEqual(frame.style.colorScheme, "light");
});

test("taller than the window: the panel stops 10px above the bottom and the pop-up scrolls inside it", () => {
  const t = load({ innerHeight: 500 });
  t.click();
  t.fromPanel({ ...DRAWN, height: 700 });
  assert.strictEqual(t.parts().box.style.height, "480px");
  t.ctx.innerHeight = 800;
  t.winOn.resize();
  assert.strictEqual(t.parts().box.style.height, "700px", "follows the window when it's resized");
});

test("messages from the website itself are ignored (only PrivaC's page in the panel counts)", () => {
  const t = load();
  t.click();
  const { box, frame } = t.parts();
  t.winOn.message({ source: t.ctx, origin: "https://site.example", data: { privacPanel: 1, ...DRAWN } });
  t.winOn.message({ source: frame.contentWindow, origin: "https://site.example", data: { privacPanel: 1, ...DRAWN } });
  t.winOn.message({ source: frame.contentWindow, origin: ORIGIN, data: DRAWN });
  t.winOn.message({ source: t.ctx, origin: "https://site.example", data: { privacPanel: 1, type: "close" } });
  assert.ok(!box.classList.contains("shown"));
  assert.ok(t.parts().host, "still open");
});

test("clicking the toolbar button again closes it", () => {
  const t = load();
  t.click();
  t.fromPanel(DRAWN);
  assert.deepStrictEqual(plain(t.click()), { ok: true, open: false });
  assert.strictEqual(t.parts().host, undefined);
  assert.ok(!t.winOn.message && !t.winOn.keydown && !t.winOn.pointerdown && !t.docOn.visibilitychange, "stops listening to the page");
  assert.deepStrictEqual(plain(t.click()), { ok: true, open: true }, "and the next click opens it again");
});

test("Escape, a click on the page outside it, leaving the page or switching tabs close it; clicks on it don't", () => {
  const t = load();
  t.click();
  t.winOn.pointerdown({ composedPath: () => [t.parts().host, t.doc.documentElement] });
  assert.ok(t.parts().host, "a click on the panel keeps it open");
  t.winOn.keydown({ key: "Tab" });
  assert.ok(t.parts().host);
  t.winOn.keydown({ key: "Escape" });
  assert.strictEqual(t.parts().host, undefined);

  t.click();
  t.winOn.pointerdown({ composedPath: () => [{ tagName: "A" }, t.doc.documentElement] });
  assert.strictEqual(t.parts().host, undefined);

  t.click();
  t.doc.visibilityState = "hidden";
  t.docOn.visibilitychange();
  assert.strictEqual(t.parts().host, undefined);

  t.doc.visibilityState = "visible";
  t.click();
  t.winOn.pagehide();
  assert.strictEqual(t.parts().host, undefined);
});

test("the pop-up page can close it (Escape inside it, or after opening the dashboard)", () => {
  const t = load();
  t.click();
  t.fromPanel(DRAWN);
  t.fromPanel({ type: "close" });
  assert.strictEqual(t.parts().host, undefined);
});

test("closing gives the keyboard back to what you were using on the page", () => {
  const t = load();
  t.click();
  t.fromPanel(DRAWN);
  t.winOn.keydown({ key: "Escape" });
  assert.deepStrictEqual(plain(t.focused.slice(-1)), [["page input", { preventScroll: true }]]);
});

test("pages it can't float on answer no, so the background opens Chrome's own pop-up instead", () => {
  for (const [opts, why] of [[{ protocol: "file:" }, "page"], [{ xml: true }, "page"], [{ modal: true }, "modal"], [{ fullscreen: true }, "fullscreen"]]) {
    const t = load(opts);
    assert.deepStrictEqual(plain(t.click()), { ok: false, why }, JSON.stringify(opts));
    assert.strictEqual(t.parts().host, undefined);
  }
});

test("if PrivaC's page never draws in the panel, the panel goes away and asks for Chrome's window", () => {
  const t = load();
  t.click();
  const wait = t.timers[0];
  assert.ok(wait.ms >= 2000 && wait.ms <= 6000, `gives it a few seconds, got ${wait.ms}`);
  wait.f();
  assert.strictEqual(t.parts().host, undefined);
  assert.deepStrictEqual(plain(t.sent), [{ type: "privac-panel-failed" }]);

  const ok = load();
  ok.click();
  ok.fromPanel(DRAWN);
  if (!ok.timers[0].cleared) ok.timers[0].f();
  assert.ok(ok.parts().host, "a panel that drew stays");
  assert.deepStrictEqual(plain(ok.sent), []);
});

test("if the website removed the panel, the next click opens a fresh one", () => {
  const t = load();
  t.click();
  t.parts().host.remove();
  assert.deepStrictEqual(plain(t.click()), { ok: true, open: true });
  assert.ok(t.parts().host);
});

test("only the top page gets a panel (frames inside it never do)", () => {
  const t = load({ inFrame: true });
  assert.strictEqual(t.hasListener(), false);
});

test("a copy left on the page from before PrivaC was reloaded gives way to a fresh one; a live copy isn't doubled", () => {
  assert.strictEqual(load({ existing: { runtimeId: undefined } }).hasListener(), true, "the old copy lost its connection");
  assert.strictEqual(load({ existing: { runtimeId: "privacid" } }).hasListener(), false, "already running");
});
