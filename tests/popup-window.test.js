// The popup in Chrome's own window (Chrome's pages like the new-tab page, or Settings > Toolbar pop-up > Chrome's).
// Chrome draws that window as a plain rectangle and extensions can't round it, so floating rounded bars inset
// from its square edges looked rough. There the bars run edge to edge instead, like a Mac menu's header and footer.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const CSS = fs.readFileSync(__dirname + "/../popup/popup.css", "utf8");
const rule = (sel) => {
  const i = CSS.indexOf(sel + " {");
  assert.ok(i >= 0, `rule ${sel}`);
  return CSS.slice(i, CSS.indexOf("}", i));
};

test("in Chrome's window the page has no outer gap, and the top and bottom bars are square and edge to edge", () => {
  assert.match(rule(':root:not(.in-panel) body'), /padding: 0;/);
  assert.match(rule(':root:not(.in-panel) .bar.top'), /top: 0;[^}]*border-radius: 0;/);
  assert.match(rule(':root:not(.in-panel) .bar.bottom'), /bottom: 0;[^}]*border-radius: 0;/);
});

test("the cards keep their rounded corners, with the same side gap as before", () => {
  assert.match(rule(':root:not(.in-panel) main'), /margin: 8px 9px 0;/);
});

test("the rounded panel over a website keeps its floating look", () => {
  assert.match(CSS, /\.bar \{[^}]*border-radius: 16px;/);
  assert.match(CSS, /\.bar\.top \{ top: 8px;/);
});

// Mac check, Oct 25: scrolled down to "Clear this site's data", the cards slid under the panel's see-through top bar and
// showed in the gap above it. In the panel the bars stay in place and only the middle scrolls between them.
test("in the rounded panel only the middle scrolls, between the bars, so cards never slide under them", () => {
  assert.match(rule(':root.in-panel body'), /height: 100%;[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow: hidden;/);
  assert.match(rule(':root.in-panel .bar'), /position: relative;/);
  assert.match(rule(':root.in-panel main'), /min-height: 0;[^}]*overflow-y: auto;/);
});
