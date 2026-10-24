// Run with: node --test
// Ask C knows when a site is state-run media (F2) and names the database as its source.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/state-media.js");
require("../shared/askc.js");
require("../dashboard/ask-c.js");
const { buildContext, cleanAnswer, SYSTEM_PROMPT } = window.PrivaCAskC;
const { renderAnswer } = window.PrivaCAsk;
const owner = window.PrivaCStateMedia.lookup("rt.com", require("../shared/state-media.json"));

test("a state-run site reaches Gemma labeled with the database and the [State Media Monitor] tag", () => {
  const ctx = buildContext({ sites: [{ domain: "rt.com", grade: "C", score: 55, trackers: [], owner }] }, "2026-10-24", []);
  assert.match(ctx, /rt\.com[^\n]*state-run media: RT \(Russia\), classified State-Controlled by State Media Monitor \(2026\) \[State Media Monitor\]/);
  assert.match(SYSTEM_PROMPT, /\[State Media Monitor\]/);
});

test("the tag survives clean-up and shows as a colored label", () => {
  const text = cleanAnswer("RT is run by the Russian state. [State Media Monitor]");
  assert.match(text, /\[State Media Monitor\]/);
  assert.match(renderAnswer(text), /<span class="src src-gov">State Media Monitor<\/span>/);
});
