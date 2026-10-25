// C stays visible on dark websites (Max, 2026-10-24). C's arms and legs are navy, which disappears against a
// dark page. This looks at the colors behind C and, on a dark background, swaps in the white-limbed copies of
// his drawings (c-poses/dark/, same file names, made by scripts/build-dark-poses.js). C drawn by the mascot
// code gets his limb lines recolored instead. Both get a white disc behind his face, since the inside of the
// C is see-through and his navy brows and mouth would vanish on a dark page. It checks again whenever C
// changes pose or moves, and when the page scrolls or resizes, so he switches back on a light area.
// Wraps PrivaCPrompt.cookie and .adversary without changing c-prompt.js (same hook as c-reaction-look.js),
// and also covers the unsafe-site warning (content/unsafe.js) without changing that file.
(function () {
  if (window.PrivaCContrast || !window.PrivaCPrompt || !window.PrivaCInk) return;
  window.PrivaCContrast = true;
  const P = window.PrivaCPrompt;
  const Ink = window.PrivaCInk;

  const CLEAR = { r: 0, g: 0, b: 0, a: 0 };
  const DARK_GUESS = { r: 20, g: 20, b: 20, a: 1 };
  const LIGHT_GUESS = { r: 255, g: 255, b: 255, a: 1 };
  const POSE = /\/c-poses\/(?:dark\/)?([\w-]+\.svg)$/;

  const watched = new Set();
  const inkOf = new WeakMap();                    // host -> "navy" | "white" (what C shows now)
  const newest = () => { const all = document.querySelectorAll("privac-prompt"); return all[all.length - 1] || null; };
  const ours = (el) => /^PRIVAC-/i.test(String((el && el.tagName) || ""));

  // One element's background as a color. Photos can't be read, so a light text color on one means "dark".
  function layerOf(el) {
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { return CLEAR; }
    if (!cs) return CLEAR;
    const bg = Ink.parseColor(cs.backgroundColor) || CLEAR;
    const image = String(cs.backgroundImage || "none");
    if (image !== "none") {
      const g = /gradient/i.test(image) ? Ink.firstColorIn(image) : null;
      if (g && g.a > 0) return Ink.over(g, bg);
      if (/url\(/i.test(image)) {
        const text = Ink.parseColor(cs.color);
        if (text) return Ink.luminance(text) > 0.5 ? DARK_GUESS : LIGHT_GUESS;
      }
    }
    return bg;
  }

  // What fills the window behind everything. Browsers paint the body's background across the whole window
  // when <html> has none, even below where a short page's content ends. With neither: white, or dark for
  // pages that ask for it.
  function canvas() {
    try {
      const root = layerOf(document.documentElement);
      const body = document.body ? layerOf(document.body) : CLEAR;
      if (root.a < 0.01 && body.a > 0) return Ink.over(body, LIGHT_GUESS);
      const scheme = String(getComputedStyle(document.documentElement).colorScheme || "");
      const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      if (/^\s*dark\s*$/.test(scheme) || (/dark/.test(scheme) && prefersDark)) return { r: 18, g: 18, b: 18, a: 1 };
    } catch (e) { /* ignore */ }
    return LIGHT_GUESS;
  }

  // The page's color at one point, looking through see-through layers and past PrivaC's own boxes.
  function colorAt(x, y) {
    let els;
    try { els = document.elementsFromPoint(x, y) || []; } catch (e) { return null; }
    let acc = CLEAR;
    for (const el of els) {
      if (ours(el)) continue;
      acc = Ink.over(acc, layerOf(el));
      if (acc.a >= 0.99) return acc;
    }
    return Ink.over(acc, canvas());
  }

  // Where C's arms and legs are: his sides, his feet, and just above his head.
  function inkBehind(c) {
    const r = c.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    const pts = [
      [r.left + r.width * 0.06, r.top + r.height * 0.55], [r.right - r.width * 0.06, r.top + r.height * 0.55],
      [r.left + r.width * 0.4, r.bottom - r.height * 0.04], [r.left + r.width * 0.6, r.bottom - r.height * 0.04],
      [r.left + r.width * 0.5, r.top + r.height * 0.04]
    ];
    const w = window.innerWidth || 0, h = window.innerHeight || 0;
    let white = 0, navy = 0;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || (w && x >= w) || (h && y >= h)) continue;
      const color = colorAt(x, y);
      if (!color) continue;
      if (Ink.inkFor(color) === "white") white++; else navy++;
    }
    if (white === navy) return null;              // no clear answer: keep what he has
    return white > navy ? "white" : "navy";
  }

  function paint(c, ink) {
    const img = c.querySelector("img");
    if (img) {
      const src = String(img.getAttribute("src") || img.src || "");
      const m = POSE.exec(src);
      if (m) {
        const want = chrome.runtime.getURL("c-poses/" + (ink === "white" ? "dark/" : "") + m[1]);
        if (src !== want) img.setAttribute("src", want);
      }
    }
    for (const svg of c.querySelectorAll("svg")) {
      const disc = svg.querySelector("[data-privac-face]");
      if (ink === "navy") { if (disc) disc.remove(); continue; }
      const arc = [...svg.querySelectorAll("path")].find((p) => String(p.getAttribute("d") || "").startsWith("M86.9 31.1"));
      if (disc || !arc) continue;
      const face = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      for (const [k, v] of [["data-privac-face", ""], ["cx", "60"], ["cy", "58"], ["r", "30"], ["fill", "#fff"]]) face.setAttribute(k, v);
      arc.parentNode.insertBefore(face, arc);
    }
    const from = ink === "white" ? Ink.NAVY : Ink.WHITE;
    const to = ink === "white" ? Ink.WHITE : Ink.NAVY;
    for (const el of c.querySelectorAll("svg path, svg circle")) {
      if (Ink.isFacePart(el.tagName, (n) => el.getAttribute(n))) continue;
      for (const a of ["stroke", "fill"]) if (el.getAttribute(a) === from) el.setAttribute(a, to);
    }
  }

  function check(host) {
    if (!host.isConnected || !host.shadowRoot) { watched.delete(host); return; }
    const c = host.shadowRoot.querySelector(".c");
    if (!c) return;
    const ink = inkBehind(c) || inkOf.get(host) || "navy";
    inkOf.set(host, ink);
    paint(c, ink);
  }

  let queued = false;
  function checkSoon() {
    if (queued || !watched.size) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const host of [...watched]) { try { check(host); } catch (e) { /* never break C */ } }
    });
  }

  function watch(host) {
    if (watched.has(host)) return;
    watched.add(host);
    new MutationObserver(checkSoon).observe(host.shadowRoot, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style", "class", "data-edge"]
    });
    check(host);
  }

  function hook(name) {
    const original = P[name];
    if (typeof original !== "function") return;
    P[name] = function (...args) {
      const before = newest();
      const result = original.apply(this, args);
      try {
        const host = newest();
        if (host && host !== before && host.shadowRoot) watch(host);
      } catch (e) { /* never break C */ }
      return result;
    };
  }
  hook("cookie");
  hook("adversary");

  // PrivaC pop-ups added straight to the page, like the unsafe-site warning (content/unsafe.js).
  // The cookie pop-up can move inside a site's dialog, so it's caught by the hooks above instead.
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes || []) {
        if (/^PRIVAC-(PROMPT|UNSAFE)$/i.test(String(n.tagName || "")) && n.shadowRoot) {
          try { watch(n); } catch (e) { /* never break C */ }
        }
      }
    }
  }).observe(document.documentElement, { childList: true });

  window.addEventListener("scroll", checkSoon, { passive: true, capture: true });
  window.addEventListener("resize", checkSoon, { passive: true });
})();
