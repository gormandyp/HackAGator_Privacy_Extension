/*
  C's limb color: navy on light websites, white on dark ones, so C stays visible next to any cookie banner.
  Used by content/c-contrast.js (on websites) and scripts/build-dark-poses.js (makes c-poses/dark/).

  The arms, hands, fingers and legs turn white. The inside of the C is see-through, so on a dark page his
  navy brows and mouth would vanish too: the dark versions get a white face disc behind the C instead, and
  his face (eyes, pupils, brows, mouth) stays navy, like the toolbar icon. The yield sign's border and
  lettering stay navy too (they sit on yellow).
*/
(function () {
  const NAVY = "#16233f";
  const WHITE = "#ffffff";
  const ARC = '<path d="M86.9 31.1';               // the start of the orange C in every drawing
  // fill "#fff" (not "#ffffff") so the limb recoloring never touches it.
  const FACE_DISC = '<circle data-privac-face="" cx="60" cy="58" r="30" fill="#fff"/>';

  // Face parts by shape: brows start at x 47/48, mouths at x 51/52; eyes and pupils have these sizes.
  const FACE_PATH = /^M(47|48|51|52) /;
  const FACE_RADII = ["6.5", "7.5", "2.6", "3.2"];

  // get(name) returns an attribute's value (works for a DOM element or a parsed SVG tag).
  function isFacePart(tag, get) {
    tag = String(tag).toLowerCase();
    if (tag === "text" || tag === "ellipse") return true;
    if (tag === "circle") return FACE_RADII.includes(String(get("r")));
    if (tag === "path") {
      const d = String(get("d") || "");
      return FACE_PATH.test(d) || get("fill") === "#ffcc00" || d.startsWith("M93 -14");
    }
    return true;                                   // anything else (clip shapes) is left alone
  }

  // A pose file's text with its navy limbs turned white and a white face disc behind the C.
  function darkenSvg(text) {
    if (!text.includes(FACE_DISC) && text.includes(ARC)) text = text.replace(ARC, FACE_DISC + ARC);
    return text.replace(/<(path|circle|ellipse|text|rect)\b([^>]*)>/g, (whole, tag, attrs) => {
      if (!attrs.includes(NAVY)) return whole;
      const get = (n) => { const m = new RegExp(`\\s${n}="([^"]*)"`).exec(attrs); return m ? m[1] : undefined; };
      if (isFacePart(tag, get)) return whole;
      return whole.split(NAVY).join(WHITE);
    });
  }

  // A CSS color as the browser reports it ("rgb(...)", "rgba(...)", "rgb(r g b / a)", "#rrggbb").
  function parseColor(css) {
    const s = String(css || "").trim().toLowerCase();
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    let m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) {
      const n = parseInt(m[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (!m) return null;
    let a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (m[4] && m[4].endsWith("%")) a /= 100;
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }

  // The first color in a gradient, e.g. "linear-gradient(rgb(15, 23, 42), ...)".
  function firstColorIn(css) {
    const m = /rgba?\([^)]*\)|#[0-9a-f]{6}\b/i.exec(String(css || ""));
    return m ? parseColor(m[0]) : null;
  }

  // A see-through color laid over another.
  function over(top, bottom) {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (k) => Math.round((top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a);
    return { r: mix("r"), g: mix("g"), b: mix("b"), a };
  }

  // How bright a color looks (WCAG relative luminance, 0 = black, 1 = white).
  function luminance({ r, g, b }) {
    const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  }

  const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const NAVY_L = luminance(parseColor(NAVY));

  // "white" when white limbs stand out more than navy ones on this background.
  function inkFor(bg) {
    const l = luminance(bg);
    return contrast(1, l) > contrast(NAVY_L, l) ? "white" : "navy";
  }

  const api = { NAVY, WHITE, FACE_DISC, isFacePart, darkenSvg, parseColor, firstColorIn, over, luminance, inkFor };
  if (typeof window !== "undefined") window.PrivaCInk = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
