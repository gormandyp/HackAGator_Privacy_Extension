// Builds the Liquid glass color wallpapers in shared/wallpapers/ (Settings > Appearance > Glass color).
// Each tint uses the same soft shapes as the original wallpaper (shared/wallpaper-light.svg / -dark.svg,
// which stay as the "aurora" tint) with its own colors, so the glass looks the same, just in another hue.
// Run: node scripts/build-wallpapers.js   (tests/glass-tint.test.js checks the files match this script)
const fs = require("fs");
const path = require("path");

// For each tint and mode: base = top/bottom of the background, a = the big upper band (3 stops),
// b = the lower band (2 stops), c = the glow top right, d = the glow in the middle, e = the glow bottom left,
// op = how strong a, b, c, d, e are, blur = softness.
const PALETTES = {
  ocean: {
    light: { base: ["#eef4fb", "#e2ebf6"], a: ["#3a8dff", "#3fb0ff", "#58d0ff"], b: ["#2fd0c8", "#4a8cff"], c: "#7fd4ff", d: "#6f9bff", e: "#8fd0ff", op: [.6, .5, .8, .45, .4], blur: 40 },
    dark: { base: ["#07101b", "#0b1a2b"], a: ["#1f5fd6", "#1b7fd0", "#17a3c7"], b: ["#0f8f9d", "#1f5fd6"], c: "#1b8fd0", d: "#2b5fc0", e: "#17a3c7", op: [.52, .42, .5, .32, .28], blur: 44 }
  },
  forest: {
    light: { base: ["#eff6f1", "#e3eee6"], a: ["#3fbf7f", "#58c98a", "#9ad66b"], b: ["#2fbfa0", "#7cd36a"], c: "#cfe36b", d: "#4fc3a1", e: "#7fd8a8", op: [.58, .5, .7, .42, .4], blur: 40 },
    dark: { base: ["#07120d", "#0d1c15"], a: ["#1e8f58", "#2a9d5c", "#5a9e2f"], b: ["#0f8a74", "#2a9d5c"], c: "#8aa52a", d: "#1b8f74", e: "#1e8f58", op: [.5, .42, .45, .3, .28], blur: 44 }
  },
  sunset: {
    light: { base: ["#fbf3ef", "#f5e7e2"], a: ["#ff8a5b", "#ff6f91", "#c77dff"], b: ["#ffb347", "#ff7e79"], c: "#ffd36e", d: "#ff8fb1", e: "#ffab73", op: [.55, .5, .8, .45, .4], blur: 40 },
    dark: { base: ["#140a0c", "#21111a"], a: ["#d9542b", "#c43c6c", "#7d3bc2"], b: ["#d98a1f", "#c94a4a"], c: "#d9a02b", d: "#b0417a", e: "#c45a2b", op: [.5, .4, .5, .3, .26], blur: 44 }
  },
  rose: {
    light: { base: ["#fbf1f5", "#f3e5ee"], a: ["#ff7eb6", "#e58cff", "#b39bff"], b: ["#ff9fc6", "#c6a0ff"], c: "#ffb3c9", d: "#f59ad0", e: "#e7a6ff", op: [.55, .5, .8, .45, .4], blur: 40 },
    dark: { base: ["#13090f", "#1e1020"], a: ["#c2387f", "#a33fc2", "#6b46d8"], b: ["#c2508a", "#7a46c8"], c: "#b8406a", d: "#b0418f", e: "#8a3fd0", op: [.5, .42, .5, .3, .26], blur: 44 }
  },
  graphite: {
    light: { base: ["#f3f4f6", "#e8e9ed"], a: ["#8f98a8", "#aab1be", "#c3c7d1"], b: ["#a1a9b7", "#8a93a3"], c: "#d0d3da", d: "#b3b9c4", e: "#a6adba", op: [.55, .5, .7, .45, .4], blur: 40 },
    dark: { base: ["#0a0b0e", "#15171c"], a: ["#4a505c", "#5a606c", "#6b7080"], b: ["#3d434e", "#555b67"], c: "#6b7080", d: "#50555f", e: "#444a55", op: [.55, .45, .5, .35, .3], blur: 44 }
  }
};

function svg(tint, mode, p) {
  const [oa, ob, oc, od, oe] = p.op;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <!-- PrivaC Liquid glass wallpaper (${tint}, ${mode}). Made by scripts/build-wallpapers.js: edit the script, not this file. -->
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.base[0]}"/><stop offset="1" stop-color="${p.base[1]}"/></linearGradient>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a[0]}"/><stop offset=".6" stop-color="${p.a[1]}"/><stop offset="1" stop-color="${p.a[2]}"/></linearGradient>
    <linearGradient id="b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${p.b[0]}"/><stop offset="1" stop-color="${p.b[1]}"/></linearGradient>
    <radialGradient id="c"><stop offset="0" stop-color="${p.c}"/><stop offset="1" stop-color="${p.c}" stop-opacity="0"/></radialGradient>
    <radialGradient id="d"><stop offset="0" stop-color="${p.d}"/><stop offset="1" stop-color="${p.d}" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${p.blur}"/></filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#base)"/>
  <g filter="url(#soft)">
    <path d="M-120 250 C 240 60 520 400 880 230 S 1450 40 1720 190 L 1720 420 C 1400 290 1180 560 860 500 S 260 330 -120 540 Z" fill="url(#a)" opacity="${oa}"/>
    <path d="M-120 780 C 280 610 640 880 980 730 S 1500 560 1720 650 L 1720 1120 L -120 1120 Z" fill="url(#b)" opacity="${ob}"/>
    <ellipse cx="1340" cy="150" rx="330" ry="210" fill="url(#c)" opacity="${oc}"/>
    <ellipse cx="760" cy="600" rx="300" ry="170" fill="url(#d)" opacity="${od}"/>
    <ellipse cx="180" cy="760" rx="260" ry="180" fill="${p.e}" opacity="${oe}"/>
  </g>
</svg>
`;
}

// Returns { "ocean-light.svg": "<svg ...", ... } without writing anything (used by the tests).
function build() {
  const out = {};
  for (const [tint, modes] of Object.entries(PALETTES)) for (const [mode, p] of Object.entries(modes)) out[`${tint}-${mode}.svg`] = svg(tint, mode, p);
  return out;
}

if (require.main === module) {
  const dir = path.join(__dirname, "..", "shared", "wallpapers");
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(build())) fs.writeFileSync(path.join(dir, file), text);
  console.log(`Wrote ${Object.keys(build()).length} wallpapers to shared/wallpapers/`);
}

module.exports = { build, PALETTES };
