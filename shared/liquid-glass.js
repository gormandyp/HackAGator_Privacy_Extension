// Liquid glass: Apple-style refraction for the floating glass parts (toolbar, sheets, popup bars).
// Each element marked data-liquid gets an SVG filter on its backdrop: a light blur, then a displacement
// map that bends what's behind near the rim like the curved edge of a lens, then a color boost.
// The flat middle passes light straight through. Chromium only; elsewhere the CSS blur fallback stays.
// bezelMap is pure (tests/liquid-glass.test.js); the rest runs in the page.
(function () {
  const root = typeof window !== "undefined" ? window : self;

  // RGBA bytes for a w x h rounded rectangle: R = sideways shift, G = up/down shift, 128 = straight through.
  // `bezel` is how far in from the edge the glass curves; the bend is strongest at the rim.
  function bezelMap(w, h, radius, bezel, power) {
    w = Math.max(0, Math.floor(w)); h = Math.max(0, Math.floor(h));
    const k = power || 2.2;
    const data = new Uint8ClampedArray(w * h * 4);
    const r = Math.max(0, Math.min(radius || 0, w / 2, h / 2));
    const hx = w / 2 - r, hy = h / 2 - r;
    const b = Math.max(1, bezel || 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
        const qx = Math.abs(px) - hx, qy = Math.abs(py) - hy;
        let nx = 0, ny = 0, d;
        if (qx > 0 && qy > 0) {                          // in a rounded corner
          const len = Math.hypot(qx, qy);
          d = r - len;
          nx = (qx / len) * Math.sign(px); ny = (qy / len) * Math.sign(py);
        } else if (qx > qy) { d = r - qx; nx = Math.sign(px); }   // nearest a left/right edge
        else { d = r - qy; ny = Math.sign(py); }                  // nearest a top/bottom edge
        const t = d / b;
        const m = d >= 0 && t < 1 ? Math.pow(1 - t, k) : 0;
        const i = (y * w + x) * 4;
        data[i] = 128 - m * 127 * nx;       // look inward: right of the left edge, left of the right edge
        data[i + 1] = 128 - m * 127 * ny;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    return data;
  }

  const api = { bezelMap, apply() {}, refresh() {} };
  root.PrivaCLiquid = api;
  if (typeof document === "undefined" || typeof module !== "undefined" && !root.document) return;

  // How each kind of glass looks: bezel width, bend strength (px), blur behind it (px), color boost.
  const PRESETS = {
    bar: { bezel: 16, scale: 42, blur: 6, sat: 1.9 },
    sheet: { bezel: 20, scale: 38, blur: 18, sat: 1.8 },
    pill: { bezel: 14, scale: 34, blur: 5, sat: 1.9 },
    card: { bezel: 22, scale: 46, blur: 14, sat: 1.8 }
  };
  const NS = "http://www.w3.org/2000/svg";
  const live = new WeakMap();     // element -> { id, key }
  let defs = null, count = 0, pending = false;

  const supported = (() => {
    try { return /Chrome\//.test(navigator.userAgent) && CSS.supports("backdrop-filter", "blur(1px)"); } catch (e) { return false; }
  })();
  const isGlass = () => document.documentElement.dataset.style === "glass";

  function holder() {
    if (defs && defs.isConnected) return defs;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    defs = document.createElementNS(NS, "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  function mapUrl(w, h, radius, bezel) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(bezelMap(w, h, radius, bezel), w, h), 0, 0);
    return c.toDataURL("image/png");
  }

  function apply(el) {
    if (!supported) return;
    if (!isGlass()) { el.style.removeProperty("--lg"); return; }
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 8 || h < 8) return;
    const o = { ...PRESETS.card, ...(PRESETS[el.dataset.liquid] || {}) };
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = [w, h, radius, o.bezel, o.scale, o.blur, o.sat].join(",");
    const cur = live.get(el);
    if (cur && cur.key === key && document.getElementById(cur.id)) { el.style.setProperty("--lg", `url(#${cur.id})`); return; }
    const id = cur ? cur.id : `privac-lg-${++count}`;
    let f = document.getElementById(id);
    if (!f) { f = document.createElementNS(NS, "filter"); f.id = id; holder().appendChild(f); }
    const attrs = { x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" };
    for (const [k, v] of Object.entries(attrs)) f.setAttribute(k, v);
    f.innerHTML =
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${o.blur}" edgeMode="duplicate" result="soft"/>` +
      `<feImage href="${mapUrl(w, h, radius, o.bezel)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="lens"/>` +
      `<feDisplacementMap in="soft" in2="lens" scale="${o.scale}" xChannelSelector="R" yChannelSelector="G" result="bent"/>` +
      `<feColorMatrix in="bent" type="saturate" values="${o.sat}"/>`;
    live.set(el, { id, key });
    el.style.setProperty("--lg", `url(#${id})`);
  }

  function refresh() {
    pending = false;
    document.querySelectorAll("[data-liquid]").forEach((el) => { apply(el); watch(el); });
  }
  function soon() { if (!pending) { pending = true; requestAnimationFrame(refresh); } }

  const sizes = typeof ResizeObserver === "function" ? new ResizeObserver(soon) : null;
  const watched = new WeakSet();
  function watch(el) { if (sizes && !watched.has(el)) { watched.add(el); sizes.observe(el); } }

  function start() {
    if (!supported) return;
    refresh();
    new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ["data-style", "data-theme"] });
    new MutationObserver((list) => {
      for (const m of list) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches("[data-liquid]") || n.querySelector("[data-liquid]"))) { soon(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  api.apply = apply;
  api.refresh = soon;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
