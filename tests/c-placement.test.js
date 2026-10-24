// content/c-placement.js: where C stands next to a cookie pop-up. He sits on the edge of the pop-up you
// actually see (hanging under it, or peeking over it), lined up with the button he's talking about, and his
// speech card never covers the pop-up. Geometry is measured from real sites at 1440 x 900 (October 2026);
// card and C sizes are measured from c-prompt.js. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../content/c-placement.js", "utf8");
function load(extra) {
  const ctx = Object.assign({ document: { querySelectorAll: () => [] }, getComputedStyle: () => ({}), innerWidth: 1440, innerHeight: 900 }, extra || {});
  ctx.window = ctx;
  if (!("PrivaCPrompt" in ctx)) ctx.PrivaCPrompt = {};
  vm.runInNewContext(SRC, ctx);
  return ctx;
}
const { place, findPanel } = load().PrivaCPlacement;

const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const VW = 1440, VH = 900;
const ASK = { width: 326, height: 158 };          // "Want me to decline the extra ones?" card
const WARN = { width: 326, height: 104 };         // "Beware! This site may still use cookies..." card
const C = { width: 120, height: 120 };
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const mid = (b) => (b.left + b.right) / 2;
const onScreen = (r, vw = VW, vh = VH) => r.left >= 0 && r.top >= 0 && r.left + r.width <= vw && r.top + r.height <= vh;
const ask = (panel, button, more) => place(Object.assign({ panel, button, card: ASK, c: C, vw: VW, vh: VH, kind: "ask" }, more));

test("banner across the top of the page (Tesco): C hangs from its bottom edge, right under Reject all", () => {
  const panel = box(0, 0, 1440, 246), button = box(1288, 113, 140, 40);
  const r = ask(panel, button);
  assert.strictEqual(r.edge, "below");
  assert.ok(r.cBox.top <= 246 && r.cBox.top >= 238, `hands on the banner's bottom edge, C's box starts at ${r.cBox.top}`);
  assert.ok(Math.abs(mid(r.cBox) - 1358) <= 1, `C under the button, got ${mid(r.cBox)}`);
  assert.ok(!overlaps(r.cardBox, panel), "the speech card doesn't cover the banner");
  assert.ok(onScreen(r));
});

test("Reject button sitting right on the pop-up's bottom edge: C's hands don't cover it", () => {
  const panel = box(440, 330, 560, 184), button = box(440, 470, 120, 44);
  const r = ask(panel, button);
  assert.strictEqual(r.edge, "below");
  assert.ok(!overlaps(r.cBox, button) && !overlaps(r.cardBox, button));
});

test("a banner still sliding down from the top keeps C under it (he follows it as it settles)", () => {
  const halfway = ask(box(0, -92, 1440, 246), box(1288, 21, 140, 40));
  assert.strictEqual(halfway.edge, "below");
  assert.ok(halfway.cBox.top <= 154 && halfway.cBox.top >= 146);
  const hidden = ask(box(0, -246, 1440, 246), box(1288, -133, 140, 40));
  assert.strictEqual(hidden.edge, "below", "still under it, hanging from the top of the window");
  assert.ok(onScreen(hidden));
});

test("window in the middle (John Lewis, boohoo): C hangs under it, lined up with Reject all", () => {
  const panel = box(120, 271, 1200, 358);
  const r = ask(panel, box(608, 543, 180, 54));
  assert.strictEqual(r.edge, "below");
  assert.ok(r.cBox.top <= 629 && r.cBox.top >= 621);
  assert.ok(Math.abs(mid(r.cBox) - 698) <= 1);
  assert.ok(!overlaps(r.cardBox, panel));
  const small = box(500, 321, 440, 258);
  const s = ask(small, box(680, 514, 111, 44));
  assert.strictEqual(s.edge, "below");
  assert.ok(Math.abs(mid(s.cBox) - 735.5) <= 1);
  assert.ok(!overlaps(s.cardBox, small));
});

test("box in the bottom corner (Halfords): C peeks over its top edge, above Reject All", () => {
  const panel = box(32, 698, 760, 170);
  const r = ask(panel, box(559, 759, 213, 30));
  assert.strictEqual(r.edge, "above");
  assert.ok(r.cBox.bottom >= 698 && r.cBox.bottom <= 700, `hands resting on the top edge, C ends at ${r.cBox.bottom}`);
  assert.ok(Math.abs(mid(r.cBox) - 665.5) <= 1);
  assert.ok(!overlaps(r.cardBox, panel));
  assert.ok(onScreen(r));
});

test("Reject near the left end of a bottom bar: the card moves to C's right so he stays over the button", () => {
  const panel = box(0, 780, 1440, 120);
  const r = ask(panel, box(24, 820, 140, 40));
  assert.strictEqual(r.edge, "above");
  assert.strictEqual(r.flip, true);
  assert.ok(Math.abs(mid(r.cBox) - 94) <= 1);
  assert.ok(r.cardBox.left > r.cBox.left, "card on his right");
  assert.ok(!overlaps(r.cardBox, panel));
  assert.ok(onScreen(r));
});

test("tall pop-up with no room above or below (Rightmove): C stands on the window's bottom edge beside it", () => {
  const panel = box(477, 116, 486, 667);
  const r = ask(panel, box(501, 717, 438, 50));
  assert.strictEqual(r.edge, "corner");
  assert.strictEqual(r.cBox.bottom, VH, "feet on the window's bottom edge");
  assert.ok(!overlaps(r, panel), "beside the pop-up, not on it");
  assert.ok(onScreen(r));
});

test("pop-up covering the bottom corners: C picks the corner that leaves the Reject button visible", () => {
  const panel = box(40, 60, 1360, 800), button = box(1180, 790, 180, 44);
  const r = ask(panel, button);
  assert.strictEqual(r.edge, "corner");
  assert.ok(!overlaps(r, button), "the site's Reject button stays clickable");
  assert.ok(onScreen(r));
});

test("no spot is completely free: C takes the corner that covers the least of the Reject button", () => {
  // Rightmove-style tall pop-up in a 1280 x 720 window: both bottom corners touch the stacked buttons.
  const panel = box(397, 116, 486, 667), button = box(421, 667, 438, 41);       // measured in the lab page
  const r = place({ panel, button, card: ASK, c: C, vw: 1280, vh: 720, kind: "ask" });
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const covered = area(r.cBox, button) + area(r.cardBox, button);
  assert.strictEqual(covered, 0, `covers ${covered} px of the button`);
  assert.ok(onScreen(r, 1280, 720));
});

test("always fully on screen: button at the window's edge, small window", () => {
  const far = ask(box(0, 0, 1440, 120), box(1380, 40, 60, 40));
  assert.ok(onScreen(far));
  const small = place({ panel: box(100, 80, 400, 480), button: box(200, 500, 120, 40), card: ASK, c: C, vw: 800, vh: 600, kind: "ask" });
  assert.ok(onScreen(small, 800, 600));
  assert.ok(!overlaps(small, box(200, 500, 120, 40)), "the Reject button stays clickable");
});

test("with no button to point at, C sits near the pop-up's right end", () => {
  const r = ask(box(0, 780, 1440, 120), null);
  assert.strictEqual(r.edge, "above");
  assert.ok(mid(r.cBox) > 1300 && onScreen(r));
});

test("pop-up out of view below (a footer link): C peeks up from the window's bottom edge", () => {
  const r = place({ panel: box(0, 2400, 1440, 200), button: null, card: WARN, c: C, vw: VW, vh: VH, kind: "warn" });
  assert.strictEqual(r.cBox.bottom, VH);
  assert.ok(onScreen(r));
});

test("'This site may still track you' warning: on a bottom bar he stands on it; with a top bar he stands in the corner", () => {
  const bottom = box(0, 760, 1440, 140);
  const b = place({ panel: bottom, button: null, card: WARN, c: C, vw: VW, vh: VH, kind: "warn" });
  assert.strictEqual(b.edge, "above");
  assert.ok(b.cBox.bottom >= 760 && b.cBox.bottom <= 762);
  const top = box(0, 0, 1440, 200);
  const t = place({ panel: top, button: null, card: WARN, c: C, vw: VW, vh: VH, kind: "warn" });
  assert.strictEqual(t.edge, "corner");
  assert.strictEqual(t.cBox.bottom, VH);
  assert.ok(!overlaps(t, top));
});

test("while C is reacting he keeps the same edge, just following the pop-up", () => {
  const r = ask(box(0, 600, 1440, 200), box(1200, 680, 140, 40), { edge: "below" });
  assert.strictEqual(r.edge, "below");
  assert.ok(onScreen(r));
});

test("no pop-up at all: bottom-right corner, like the foreign-adversary alert", () => {
  const r = ask(null, null);
  assert.strictEqual(r.edge, "corner");
  assert.strictEqual(r.cBox.bottom, VH);
  assert.ok(r.left + r.width <= VW && r.left > VW / 2);
});

test("tall consent wall with Manage | Reject | Accept along its bottom: in a corner, C covers none of its buttons, not just Reject", () => {
  const panel = box(170, 70, 1100, 760);
  const manage = box(200, 760, 200, 44), reject = box(620, 760, 200, 44), accept = box(1040, 760, 200, 44);
  const r = ask(panel, reject, { controls: [manage, reject, accept] });
  for (const b of [manage, reject, accept]) assert.ok(!overlaps(r.cBox, b) && !overlaps(r.cardBox, b), `covers a button at x ${b.left}`);
  assert.ok(onScreen(r));
});

test("stacked buttons (Reject above Accept, Accept on the bottom edge): C's hands don't rest on Accept either", () => {
  const panel = box(440, 300, 560, 200);
  const reject = box(460, 400, 120, 40), accept = box(470, 460, 120, 40);
  const r = ask(panel, reject, { controls: [reject, accept] });
  assert.strictEqual(r.edge, "below");
  assert.ok(!overlaps(r.cBox, accept) && !overlaps(r.cardBox, accept));
});

test("a banner in the page that you scroll past the middle of the window: C stays on his side while there's room there", () => {
  const first = ask(box(0, 474, 1440, 200), box(1200, 540, 160, 44));
  assert.strictEqual(first.edge, "above");
  const later = ask(box(0, 444, 1440, 200), box(1200, 510, 160, 44), { prefer: "above" });
  assert.strictEqual(later.edge, "above", "no jump to the other side");
  const far = ask(box(0, 150, 1440, 200), box(1200, 216, 160, 44), { prefer: "above" });
  assert.strictEqual(far.edge, "below", "switches once there's no room above any more");
  const back = ask(box(0, 500, 1440, 120), box(1200, 560, 160, 44), { prefer: "below" });
  assert.strictEqual(back.edge, "below", "and stays under it on the way back down");
});

test("a window shorter than C: his speech card (and its close button) starts on screen", () => {
  const r = place({ panel: null, button: null, card: ASK, c: C, vw: 1440, vh: 150, kind: "ask" });
  assert.ok(r.cardBox.top >= 0, `card top ${r.cardBox.top}`);
});

// ---- Finding the pop-up you actually see, from the button cookie-detector.js found -------------------------
function dom() {
  const styles = new Map();
  const el = (tag, rect, opts = {}) => {
    const n = { nodeType: 1, tagName: tag.toUpperCase(), id: opts.id || "", className: opts.cls || "", parentElement: null, children: [],
      getAttribute: (a) => (opts.attrs || {})[a] ?? null, getBoundingClientRect: () => rect, getRootNode() { return null; },
      matches: (sel) => /button/.test(sel) && tag === "button" };
    styles.set(n, Object.assign({ position: "static", backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none", boxShadow: "none", borderTopWidth: "0px", borderTopStyle: "none", borderTopColor: "rgb(0, 0, 0)" }, opts.style));
    return n;
  };
  const nest = (...chain) => { for (let i = 0; i < chain.length - 1; i++) chain[i].parentElement = chain[i + 1]; return chain[0]; };
  const body = el("body", box(0, 0, 1440, 3000));
  const doc = { body, documentElement: el("html", box(0, 0, 1440, 3000)) };
  body.parentElement = doc.documentElement;
  const ctx = load({ document: doc, getComputedStyle: (n) => styles.get(n), innerWidth: 1440, innerHeight: 900 });
  return { el, nest, body, find: ctx.PrivaCPlacement.findPanel };
}
const WHITE = { backgroundColor: "rgb(255, 255, 255)" };

test("finds the whole banner when the detector only found the Reject button (Tesco)", () => {
  const { el, nest, body, find } = dom();
  const banner = el("div", box(0, 0, 1440, 246), { style: Object.assign({ position: "fixed" }, WHITE) });
  const row = el("div", box(1288, 20, 140, 220), { cls: "ddsweb-consent-banner__buttons-container" });
  const btn = el("button", box(1288, 113, 140, 40), { cls: "ddsweb-consent-banner__button", style: WHITE });
  nest(btn, row, banner, body);
  assert.strictEqual(find(btn), banner);
});

test("full-screen dimmed overlay: finds the white box inside it, not the overlay (Waitrose)", () => {
  const { el, nest, body, find } = dom();
  const overlay = el("div", box(0, 0, 1440, 900), { style: { position: "fixed", backgroundColor: "rgba(0, 0, 0, 0.5)" } });
  const center = el("div", box(0, 0, 1440, 900));
  const card = el("div", box(40, 300, 1360, 300), { style: Object.assign({ boxShadow: "0 2px 8px black" }, WHITE) });
  const row = el("div", box(72, 468, 1296, 72), { style: WHITE });
  const btn = el("button", box(600, 480, 160, 44));
  nest(btn, row, card, center, overlay, body);
  assert.strictEqual(find(btn), card);
});

test("a sticky button bar inside a fixed pop-up: the pop-up, not the bar", () => {
  const { el, nest, body, find } = dom();
  const dialog = el("div", box(400, 100, 640, 600), { attrs: { role: "dialog" }, style: Object.assign({ position: "fixed" }, WHITE) });
  const bar = el("div", box(400, 620, 640, 80), { style: Object.assign({ position: "sticky" }, WHITE) });
  const btn = el("button", box(860, 640, 160, 44));
  nest(btn, bar, dialog, body);
  assert.strictEqual(find(btn), dialog);
});

test("a banner in the page's own flow: the cookie banner, not the page around it", () => {
  const { el, nest, body, find } = dom();
  const page = el("div", box(0, 0, 1440, 3000), { id: "page", style: WHITE });
  const banner = el("div", box(0, 0, 1440, 180), { cls: "cookie-notice", style: { backgroundColor: "rgb(30, 30, 30)" } });
  const btn = el("button", box(1200, 60, 160, 44));
  nest(btn, banner, page, body);
  assert.strictEqual(find(btn), banner);
});

test("nothing that looks like a pop-up: no panel (C goes to the corner)", () => {
  const { el, nest, body, find } = dom();
  const btn = el("button", box(0, 0, 0, 0));
  nest(btn, body);
  assert.strictEqual(find(btn), null);
});

test("full-window cookie wall: the text column in the middle, never the Reject button itself", () => {
  const { el, nest, body, find } = dom();
  const wall = el("div", box(0, 0, 1440, 900), { id: "consent-wall", style: { position: "fixed", backgroundColor: "rgb(247, 247, 251)" } });
  const column = el("div", box(440, 330, 560, 200));
  const row = el("div", box(440, 470, 560, 44));
  const btn = el("button", box(440, 470, 120, 44), { style: Object.assign({ borderTopWidth: "2px", borderTopStyle: "solid" }, WHITE) });
  nest(btn, row, column, wall, body);
  assert.strictEqual(find(btn), column);
});

test("a dialog box that fills most of a small window: the dialog itself, not the row of buttons in it", () => {
  const { el, nest, body, find } = dom();
  const dialog = el("dialog", box(19, 40, 1400, 820), { style: Object.assign({ position: "fixed" }, WHITE) });
  const row = el("div", box(1000, 129, 220, 41));
  const btn = el("button", box(1000, 129, 102, 41));
  nest(btn, row, dialog, body);
  assert.strictEqual(find(btn), dialog);
});

// ---- C asks once (cookie-detector.js can alternate between two buttons on one page) ------------------------
function promptWorld() {
  const hosts = [];
  const calls = [];
  const makeHost = (kind) => {
    const handlers = {};
    const wrap = { out: false, classList: { contains: (c) => c === "out" && wrap.out } };
    const choose = { addEventListener: (t, f) => { handlers[t] = f; } };
    const host = { kind, isConnected: true, handlers, wrap,
      shadowRoot: { querySelector: (sel) => ({ ".wrap": wrap, '[data-a="decline"]': kind === "ask" ? {} : null,
        '[data-a="choose"]': kind === "ask" ? choose : null, ".card.alert": kind === "alert" ? {} : null })[sel] || null } };
    return host;
  };
  const P = {
    cookie: () => { calls.push("cookie"); hosts.push(makeHost("ask")); },
    acceptOnly: () => { calls.push("acceptOnly"); hosts.push(makeHost("warn")); },
    adversary: () => { calls.push("adversary"); hosts.push(makeHost("alert")); },
    positionAtBanner: () => { calls.push("move"); }
  };
  const ctx = load({ PrivaCPrompt: P, document: { querySelectorAll: (s) => (s === "privac-prompt" ? hosts.filter((h) => h.isConnected) : []), body: null, documentElement: {} } });
  return { P: ctx.PrivaCPrompt, hosts, calls, close: (h) => { h.isConnected = false; } };
}

test("while C is asking about cookies, the detector can't open him again or move him (Zara opened 28 in 10 s)", () => {
  const { P, hosts, calls } = promptWorld();
  P.cookie({}); P.positionAtBanner({});
  assert.deepStrictEqual(calls, ["cookie", "move"]);
  P.acceptOnly(); P.positionAtBanner({});            // the "Do not sell or share" link, pressed again
  P.cookie({}); P.positionAtBanner({});              // the Reject button again
  assert.deepStrictEqual(calls, ["cookie", "move"], "nothing new opened, nothing moved");
  assert.strictEqual(hosts.length, 1);
});

test("once that pop-up is closed, the next one opens normally", () => {
  const { P, hosts, calls, close } = promptWorld();
  P.cookie({});
  close(hosts[0]);
  P.acceptOnly(); P.positionAtBanner({});
  assert.deepStrictEqual(calls, ["cookie", "acceptOnly", "move"]);
});

test("the cookie question replaces the 'may still track you' warning, not the other way round", () => {
  const { P, calls } = promptWorld();
  P.acceptOnly();
  P.cookie({});
  P.acceptOnly();
  assert.deepStrictEqual(calls, ["acceptOnly", "cookie"]);
});

test("after you pick 'Let me choose', C doesn't ask again on this page", () => {
  const { P, hosts, calls, close } = promptWorld();
  P.cookie({});
  hosts[0].handlers.click();                          // "Let me choose"
  close(hosts[0]);
  P.cookie({}); P.positionAtBanner({});
  P.acceptOnly(); P.positionAtBanner({});
  assert.deepStrictEqual(calls, ["cookie"]);
});

test("a C hidden because a site's dialog had no room for him doesn't count as asking", () => {
  const { P, hosts, calls } = promptWorld();
  P.cookie({});
  hosts[0].style = { visibility: "hidden" };
  P.acceptOnly();
  assert.deepStrictEqual(calls, ["cookie", "acceptOnly"]);
});

test("a foreign-adversary alert on screen doesn't stop the cookie question", () => {
  const { P, calls } = promptWorld();
  P.adversary({});
  P.cookie({});
  assert.deepStrictEqual(calls, ["adversary", "cookie"]);
});
