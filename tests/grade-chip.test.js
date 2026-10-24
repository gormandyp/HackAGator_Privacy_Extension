// IDEA.md (Max): "Show the PrivaC grade box in the top right as soon as you open a site, with an x to close it
// (you shouldn't have to click the extension)." content/grade-chip.js shows a small grade box once per site per
// day, closes by itself, has an x, and opens the full panel when clicked. Settings can turn it off.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../content/grade-chip.js", "utf8");
function load() {
  const ctx = { console, setTimeout: () => 0, clearTimeout() {}, addEventListener() {}, location: { hostname: "www.planetfitness.com", protocol: "https:" },
    document: { readyState: "loading", addEventListener() {} }, chrome: { runtime: { id: "x", sendMessage: () => Promise.resolve() },
      storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } } } };
  ctx.window = ctx; ctx.top = ctx;
  vm.runInNewContext(SRC, ctx);
  return ctx.PrivaCGradeChip;
}
// The grade comes from the background (the same numbers the popup shows), not from what's stored on disk.
const B = { grade: "B", score: 40 };

test("shows this site's grade, score and the plain word for it", () => {
  const chip = load().pick({}, "planetfitness.com", "2026-10-24", B);
  assert.deepStrictEqual({ ...chip }, { domain: "planetfitness.com", grade: "B", score: 40, word: "Some exposure" });
});

test("once per site per day, not on every page of the same site", () => {
  const P = load();
  assert.strictEqual(P.pick({ privacChipSeen: { "planetfitness.com": "2026-10-24" } }, "planetfitness.com", "2026-10-24", B), null);
  assert.ok(P.pick({ privacChipSeen: { "planetfitness.com": "2026-10-23" } }, "planetfitness.com", "2026-10-24", B));
});

test("nothing when the site has no grade yet, or when it's turned off in Settings", () => {
  const P = load();
  assert.strictEqual(P.pick({}, "unknown.example", "2026-10-24", null), null);
  assert.strictEqual(P.pick({ privacSettings: { gradeChip: false } }, "planetfitness.com", "2026-10-24", B), null);
});

test("the day it was shown is remembered by site name only, and old days are dropped", () => {
  const seen = load().remember({ "old.example": "2026-10-01", "zara.com": "2026-10-23" }, "planetfitness.com", "2026-10-24");
  assert.deepStrictEqual({ ...seen }, { "zara.com": "2026-10-23", "planetfitness.com": "2026-10-24" });
});

test("runs on the top page only, from the manifest, after the panel script", () => {
  const m = JSON.parse(fs.readFileSync(__dirname + "/../manifest.json", "utf8"));
  const main = m.content_scripts.find((c) => c.js.includes("content/panel.js"));
  assert.ok(!main.all_frames);
  assert.ok(main.js.indexOf("content/grade-chip.js") > main.js.indexOf("content/panel.js"));
});

test("clicking the grade box opens PrivaC's panel through the background, like the toolbar button", () => {
  const tb = fs.readFileSync(__dirname + "/../background/toolbar.js", "utf8");
  assert.match(tb, /msg\.type === "privac-open-panel"[^\n]*click\(sender\.tab\)/);
  assert.match(SRC, /sendMessage\(\{ type: "privac-open-panel" \}\)/);
});

test("Settings: on by default, a switch to turn it off", () => {
  globalThis.window = globalThis;
  require("../shared/settings.js");
  assert.strictEqual(window.PrivaCSettings.merge(null).gradeChip, true);
  assert.strictEqual(window.PrivaCSettings.merge({ gradeChip: false }).gradeChip, false);
  assert.strictEqual(window.PrivaCSettings.merge({ gradeChip: "no" }).gradeChip, true);
  assert.match(fs.readFileSync(__dirname + "/../dashboard/dashboard.html", "utf8"), /data-setting-bool="gradeChip"/);
});

test("the background answers with the popup's own grade for that site, and never sample data", () => {
  const tb = fs.readFileSync(__dirname + "/../background/toolbar.js", "utf8");
  assert.match(tb, /msg\.type === "privac-site-grade"[\s\S]*PrivaCData\.load\(\)[\s\S]*!d\.sample/);
  assert.match(SRC, /sendMessage\(\{ type: "privac-site-grade", domain \}\)/);
});

// IDEA.md: "After you decline or accept cookies, a short box that explains what your choice means for your visit."
test("after you decline: the box says what that means, honestly (trackers can still load)", () => {
  const n = load().meaning({}, "declined");
  assert.strictEqual(n.title, "You declined extra cookies");
  assert.match(n.text, /not to store ad or tracking cookies/);
  assert.match(n.text, /Trackers can still load/);
  assert.match(n.text, /10 cookie points come off/);
});

test("after you accept: the box says what that means and what you can do", () => {
  const n = load().meaning({}, "accepted");
  assert.strictEqual(n.title, "You accepted all cookies");
  assert.match(n.text, /follow you to other sites/);
  assert.match(n.text, /adds 10 points/);
  assert.match(n.text, /Clear this site's data/);
});

test("no explanation for other choices, or when the box is turned off in Settings", () => {
  assert.strictEqual(load().meaning({}, "no-reject"), null);
  assert.strictEqual(load().meaning({ privacSettings: { gradeChip: false } }, "declined"), null);
});

test("c-events.js asks for the explanation when it records your choice", () => {
  const ev = fs.readFileSync(__dirname + "/../content/c-events.js", "utf8");
  assert.match(ev, /window\.PrivaCGradeChip\.explain\(c\)/);
});

// Range (Justin's grade-scale doc): when something is unknown, the box says how high the score could go.
test("the box line adds how high the score could go when part of the grade is unknown", () => {
  const P = load();
  const part = P.pick({}, "planetfitness.com", "2026-10-24", { grade: "B", score: 40, range: { min: 40, max: 55 } });
  assert.strictEqual(part.max, 55);
  assert.strictEqual(P.lineFor(part), "PrivaC · planetfitness.com · 40 of 100, could be up to 55");
  const full = P.pick({}, "planetfitness.com", "2026-10-24", { grade: "B", score: 40, range: { min: 40, max: 40 } });
  assert.strictEqual(full.max, undefined);
  assert.strictEqual(P.lineFor(full), "PrivaC · planetfitness.com · 40 of 100");
  const tb = fs.readFileSync(__dirname + "/../background/toolbar.js", "utf8");
  assert.match(tb, /reply\(s \? \{ grade: s\.grade, score: s\.score, range: s\.range \} : null\)/);
});
