// Card titles like "Worth knowing" and "This week" stand out before the box's contents, since test users weren't
// sure what each box was for (Max, IDEA.md, Oct 24). Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const css = require("fs").readFileSync(require("path").join(__dirname, "..", "dashboard", "dashboard.css"), "utf8");

test("dashboard card titles are larger and bolder than the text under them", () => {
  const rule = css.match(/\.card h2 \{([^}]*)\}/)[1];
  assert.ok(parseFloat(rule.match(/font-size:\s*([\d.]+)px/)[1]) >= 17, rule);
  assert.ok(parseInt(rule.match(/font-weight:\s*(\d+)/)[1], 10) >= 700, rule);
});
