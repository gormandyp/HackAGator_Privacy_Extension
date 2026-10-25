// A lighter home page (Max's idea, rendering A chosen by the repo owner, Oct 24): the "Cookies your sites kept" card
// only repeated This week's tracking-cookie count, so it moved to the Safety tab; the Ask C
// buttons on each row stay hidden until you point at the row; "Who followed you" starts with the top 5 companies.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("the cookie card moved from the home page to the Safety tab, and the home layouts don't save room for it", () => {
  const html = read("dashboard/dashboard.html");
  const overview = html.slice(html.indexOf('id="panel-overview"'), html.indexOf('id="panel-sites"'));
  const safety = html.slice(html.indexOf('id="panel-safety"'), html.indexOf('id="panel-ask"'));
  assert.ok(!/id="cookies-card"/.test(overview));
  assert.match(safety, /id="cookies-card"/);
  const css = read("dashboard/dashboard.css");
  for (const areas of css.match(/grid-template-areas:[^;]*;/g).filter((a) => /purposes/.test(a))) {
    assert.ok(!/\bcookies\b/.test(areas), areas);
  }
});

test("Ask C buttons on rows are hidden until you point at the row, but still show for the keyboard and touch screens", () => {
  const css = read("dashboard/dashboard.css");
  assert.match(css, /\.ask-btn \{[^}]*opacity: 0;/);
  assert.match(css, /\.ask-btn:focus-visible/);
  assert.match(css, /@media \(hover: none\) \{ \.ask-btn \{ opacity: \.8; \} \}/);
});

test("Who followed you starts with the top 5 companies and 6 sites, with a button for the rest", () => {
  const js = read("dashboard/overview.js");
  assert.match(js, /const LIMIT_SITES = 6, LIMIT_COS = 5;/);
  assert.match(js, /All \$\{agg\.companies\.length\} companies/);
});
