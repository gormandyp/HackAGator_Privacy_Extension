// Dashboard Settings sheet look (repo owner, Oct 24: "the UI needs to be fixed for the settings tab").
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const HTML = fs.readFileSync(__dirname + "/../dashboard/dashboard.html", "utf8");
const UI = fs.readFileSync(__dirname + "/../shared/ui.css", "utf8");
const alpha = (theme) => {
  const block = theme === "light" ? UI.slice(0, UI.indexOf('[data-theme="dark"]')) : UI.slice(UI.indexOf('[data-theme="dark"]'));
  return Number((block.match(/--glass-sheet: rgba\([^)]*,\s*([\d.]+)\)/) || [])[1]);
};

test("the \"See C on 17 kinds\" row shows one arrow, not the CSS arrow plus a › character on top of it", () => {
  const row = HTML.match(/<a class="row link"[^>]*>[\s\S]*?<\/a>/)[0];
  assert.match(row, /<span class="chev" aria-hidden="true"><\/span>/);
});

test("the sheet is solid enough that the page behind doesn't show through as colored smudges", () => {
  assert.ok(alpha("light") >= 0.8, `light ${alpha("light")}`);
  assert.ok(alpha("dark") >= 0.8, `dark ${alpha("dark")}`);
});
