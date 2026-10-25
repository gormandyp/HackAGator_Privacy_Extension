// Run with: node --test
// Mac check, 2026-10-25: asked "Is it safe to use cnn.com without an ad blocker?", real Gemma said cnn.com's B "means
// it has moderate exposure". The grade box and popup call a B "Some exposure" (C is "Moderate exposure"). Gemma only saw
// "grade B", so it guessed the words. Every site line now carries the grade's own words.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
require("../shared/askc.js");
const { buildContext } = window.PrivaCAskC;

const site = (domain, grade, score) => ({ domain, grade, score, cookieChoice: "none", lastVisit: "2026-10-24", trackers: [] });

test("Gemma sees each grade with the same words the popup uses", () => {
  const ctx = buildContext({ sites: [site("cnn.com", "B", 25), site("wired.com", "F", 100)] }, "2026-10-24", [], null, "Is it safe to use cnn.com?");
  assert.match(ctx, /cnn\.com[^\n]*grade B \(Some exposure\)/);
  assert.doesNotMatch(ctx, /grade B \(Moderate/);
});

test("the all-sites list carries the grade words too", () => {
  const ctx = buildContext({ sites: [site("cnn.com", "B", 25), site("wired.com", "F", 100)] }, "2026-10-24", [], null, "Which sites are worst?");
  assert.match(ctx, /wired\.com[^\n]*grade F \(Very high exposure\)/);
});
