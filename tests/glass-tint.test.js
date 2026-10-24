// Liquid glass colors: every tint has a light and a dark wallpaper, the stylesheet points at them,
// and the Settings sheet offers exactly the tints settings.js accepts.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
require("../shared/settings.js");
const { TINTS } = window.PrivaCSettings;
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("each extra tint has light and dark wallpapers that are valid, self-contained SVGs", () => {
  for (const t of TINTS.filter((t) => t !== "aurora")) {
    for (const mode of ["light", "dark"]) {
      const svg = read(`shared/wallpapers/${t}-${mode}.svg`);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${t}-${mode}`);
      assert.match(svg, /<\/svg>\s*$/);
      assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/, "no outside links");
      assert.ok(svg.length < 4000, "small file");
    }
  }
});

test("the wallpapers are exactly what the build script makes (nobody hand-edited one)", () => {
  const { build } = require("../scripts/build-wallpapers.js");
  for (const [file, svg] of Object.entries(build())) assert.strictEqual(read(`shared/wallpapers/${file}`), svg, file);
});

test("ui.css uses each tint's wallpaper in light and dark; aurora keeps the original files", () => {
  const css = read("shared/ui.css");
  for (const t of TINTS.filter((t) => t !== "aurora")) {
    assert.ok(css.includes(`:root[data-tint="${t}"] .backdrop`), `${t} light rule`);
    assert.ok(css.includes(`wallpapers/${t}-light.svg`) && css.includes(`wallpapers/${t}-dark.svg`), `${t} files`);
  }
  assert.ok(css.includes('url("wallpaper-light.svg")') && css.includes('url("wallpaper-dark.svg")'));
});

test("Clean style still ignores the tint (solid background wins)", () => {
  const css = read("shared/ui.css");
  const clean = css.indexOf('[data-style="clean"] .backdrop');
  const lastTint = css.lastIndexOf('[data-tint=');
  assert.ok(clean > lastTint, "the Clean rule comes after every tint rule");
  assert.match(css, /\[data-style="clean"\]\[data-tint\] \.backdrop/);
});

test("the Settings sheet offers one swatch per tint, in the same order", () => {
  const html = read("dashboard/dashboard.html");
  const group = html.match(/data-setting="tint"[\s\S]*?<\/div>/);
  assert.ok(group, "tint swatches exist");
  const values = [...group[0].matchAll(/data-value="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(values, TINTS);
});

test("theme-boot paints the saved tint before the page draws", () => {
  assert.match(read("shared/theme-boot.js"), /dataset\.tint\s*=\s*look\.tint/);
});

// The toolbar's rounded panel over a website has no wallpaper (the website shows through), so the glass color
// used to change nothing there. Now each tint gives two colors that wash the panel's glass.
test("each extra tint has two wash colors, and the rounded panel over a website uses them", () => {
  const css = read("shared/ui.css");
  for (const t of TINTS.filter((t) => t !== "aurora")) {
    assert.match(css, new RegExp(`:root\\[data-tint="${t}"\\] \\{ --tint-a: #[0-9a-f]{6}; --tint-b: #[0-9a-f]{6}; \\}`), t);
  }
  assert.doesNotMatch(css, /\[data-tint="aurora"\] \{ --tint-a/, "aurora keeps the panel exactly as before");
  const popup = read("popup/popup.css");
  const rule = popup.match(/:root\.in-panel\[data-style="glass"\]\[data-tint\]:not\(\[data-tint="aurora"\]\) body \{[^}]*\}/);
  assert.ok(rule, "panel wash rule");
  assert.match(rule[0], /var\(--tint-a\)/);
  assert.match(rule[0], /var\(--tint-b\)/);
});

test("the swatches show the same colors the panel uses", () => {
  const css = read("shared/ui.css"), dash = read("dashboard/dashboard.css");
  for (const t of TINTS.filter((t) => t !== "aurora")) {
    const [, a, b] = css.match(new RegExp(`:root\\[data-tint="${t}"\\] \\{ --tint-a: (#[0-9a-f]{6}); --tint-b: (#[0-9a-f]{6}); \\}`)) || [];
    const swatch = (dash.match(new RegExp(`\\.swatch-${t} \\{[^}]*\\}`)) || [""])[0];
    assert.ok(a && swatch.includes(a) && swatch.includes(b), t);
  }
});
