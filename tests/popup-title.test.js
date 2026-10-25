// Cloud UI audit, 2026-10-25: the popup's site name broke in the middle of a word ("openencyclopedia.exa / mple").
// Long names now get a smaller size and may only break after a dot. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const read = (f) => fs.readFileSync(__dirname + "/../" + f, "utf8");

test("the popup's site name breaks only after a dot, never mid-word", () => {
  const js = read("popup/popup.js"), css = read("popup/popup.css");
  assert.match(js, /<h1 class="\$\{s\.domain\.length > 20 \? "long" : ""\}">\$\{breakable\(s\.domain\)\}<\/h1>/);
  assert.match(js, /const breakable = \(d\) => esc\(d\)\.replace\(\/\\\.\/g, "\.<wbr>"\)/);
  assert.doesNotMatch(css, /\.site-id h1 \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.site-id h1\.long \{ font-size: 15\.5px; \}/);
});
