// Team doc (Oct 24): "The grade's color coding needs to be more visible and accessible." Grade letters sit in white
// on a colored badge, and grade-colored text sits on the page. Both now meet WCAG AA contrast (4.5:1).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const THEME = fs.readFileSync(__dirname + "/../shared/theme.css", "utf8");
const UI = fs.readFileSync(__dirname + "/../shared/ui.css", "utf8");
const DARK = UI.slice(UI.indexOf('[data-theme="dark"]'));

const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (css, name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];

for (const g of ["a", "b", "c", "d", "f"]) {
  test(`grade ${g.toUpperCase()}: white letter on its badge is readable (4.5:1)`, () => {
    const solid = token(THEME, `grade-${g}-solid`);
    assert.ok(solid, "solid badge color");
    assert.ok(contrast(solid, "#ffffff") >= 4.5, `${solid}: ${contrast(solid, "#ffffff").toFixed(2)}`);
  });
  test(`grade ${g.toUpperCase()}: colored text is readable on the light and dark pages`, () => {
    const light = token(THEME, `grade-${g}`), dark = token(DARK, `grade-${g}`);
    assert.ok(contrast(light, "#f5f6f8") >= 4.5, `light ${light}: ${contrast(light, "#f5f6f8").toFixed(2)}`);
    assert.ok(contrast(dark, "#13161c") >= 4.5, `dark ${dark}: ${contrast(dark, "#13161c").toFixed(2)}`);
  });
}

test("badges and grade tiles use the solid colors", () => {
  assert.match(UI, /\.grade-A \{ --g: var\(--grade-a\); --gs: var\(--grade-a-solid\); \}/);
  const badge = UI.slice(UI.indexOf(".badge {"), UI.indexOf("}", UI.indexOf(".badge {")));
  assert.match(badge, /var\(--gs\)/);
  assert.doesNotMatch(badge, /var\(--g\)/);
  assert.match(UI, /\.tile-grade \{ --tile: var\(--gs\); \}/);
});
