// "The settings tab has curved borders that end a bit too early and cut off some things" (repo owner, 2026-10-24).
// Cause: a glass panel's bright rounded rim is drawn by .glass::before, sized to the panel. When the panel itself
// scrolls, that rim scrolls away with the content, so its rounded bottom edge shows up halfway down the list.
// Glass panels now stay still and their content scrolls inside them. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const HTML = fs.readFileSync(__dirname + "/../dashboard/dashboard.html", "utf8");
const CSS = fs.readFileSync(__dirname + "/../dashboard/dashboard.css", "utf8");

const rulesFor = (cls) => [...CSS.matchAll(new RegExp(`(?:^|[\\s,}])\\.${cls}(?![\\w-])[^{,]*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);

test("no glass panel on the dashboard scrolls itself (its rim would scroll away)", () => {
  const glassClasses = new Set();
  for (const m of HTML.matchAll(/class="([^"]*\bglass\b[^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c && c !== "glass") glassClasses.add(c);
  for (const c of glassClasses) for (const body of rulesFor(c)) {
    assert.doesNotMatch(body, /overflow(-y)?\s*:\s*(auto|scroll)/, `.${c} scrolls: put a scrolling element inside it instead`);
  }
});

test("the Settings sheet and the Sites list scroll inside their glass panel", () => {
  const sheet = HTML.match(/<aside class="sheet glass"[\s\S]*?<\/aside>/)[0];
  assert.match(sheet, /^<aside[^>]*>\s*<div class="sheet-body">/);
  assert.ok(rulesFor("sheet-body").some((b) => /overflow-y:\s*auto/.test(b)));
  assert.match(HTML, /<div class="site-index glass">\s*<div class="site-list" id="sites"/);
  assert.ok(rulesFor("site-list").some((b) => /overflow-y:\s*auto/.test(b)));
});
