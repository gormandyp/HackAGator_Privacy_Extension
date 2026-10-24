// C is the mascot, not a letter (Max, IDEA.md, Oct 24): wherever an icon stands for C (This week's "C stepped in",
// C's impact, the popup's "Ask C why" button, the Ask C button on every row), it shows C's face from shared/mascot.js.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

globalThis.window = globalThis;
require("../shared/mascot.js");
require("../shared/icons.js");
const I = window.PrivaCIcons;

test("icon(\"c\") and tile(\"c\") draw C's face, hidden from screen readers (a text label always sits beside it)", () => {
  for (const html of [I.icon("c"), I.icon("c", 16), I.tile("c", "c", "sm"), I.tile("c", "c", "lg")]) {
    assert.match(html, /stroke="#fa4616" stroke-width="19"/, "C's orange C shape: " + html.slice(0, 80));
    assert.ok(!/role="img"/.test(html), "decoration only");
  }
  assert.match(I.icon("c", 16), /height="16"/);
  assert.match(I.tile("c", "c", "sm"), /class="icon-tile tile-face tile-sm c-face"/, "no orange square behind an orange C");
  assert.ok(!/M16\.6 7\.3a6\.6/.test(I.icon("c")), "the old plain letter is gone");
});

test("the Ask C button on each dashboard row uses C's face", () => {
  const noop = () => {};
  globalThis.document = { addEventListener: noop, removeEventListener: noop };
  globalThis.addEventListener = noop;
  require("../dashboard/explain.js");
  const b = window.PrivaCExplain.button("Who is Criteo?", "Criteo");
  assert.match(b, /class="ask-btn c-face"/);
  assert.match(b, /stroke-width="19"/);
});

test("C's face stays visible in dark mode, and the face tile has no colored square", () => {
  const css = read("shared/ui.css");
  assert.match(css, /\[data-theme="dark"\] \.c-face svg \[stroke="#16233f"\][^{]*\{ stroke: #dfe5ef; \}/);
  assert.match(css, /\.icon-tile\.tile-face \{[^}]*background: var\(--fill\)/);
});
