// PrivaC on Windows (checked on the team's ASUS G14, 2026-10-24). Windows shows scrollbars that macOS hides, and
// people there don't have a Mac. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const read = (f) => fs.readFileSync(__dirname + "/../" + f, "utf8");
const CSS = read("dashboard/dashboard.css");

const rulesFor = (cls) => [...CSS.matchAll(new RegExp(`(?:^|[\\s,}])\\.${cls}(?![\\w-])[^{,]*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);

test("the Settings sheet and the Sites list never show a sideways scrollbar (Windows drew one for a 1 px overflow)", () => {
  for (const cls of ["sheet-body", "site-list"]) {
    assert.ok(rulesFor(cls).some((b) => /overflow-x:\s*hidden/.test(b)), `.${cls} needs overflow-x: hidden`);
  }
});

test("what people read doesn't assume a Mac", () => {
  for (const f of ["dashboard/dashboard.html", "popup/popup.html", "shared/highlights.js"]) {
    assert.doesNotMatch(read(f), /\b(your|this) Mac\b|Mac's/, f);
  }
});
