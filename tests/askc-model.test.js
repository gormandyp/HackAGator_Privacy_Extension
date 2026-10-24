// "Are you made with gemma" (real Gemma on the demo Mac, 2026-10-24 7:30 PM) got "You are not made with Gemma. I am C...".
// Gemma 4 is the project's headline "recent technology", so questions about what C is or runs on get a fixed, true answer.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const A = window.PrivaCAskC;

async function ask(q) {
  let calls = 0;
  const r = await A.answer(q, { load: async () => ({ sites: [] }), ask: async () => { calls++; return "You are not made with Gemma."; } });
  return { ...r, calls };
}

test("questions about what C is or runs on get the true answer: Gemma 4, on this computer, nothing sent out", async () => {
  for (const q of ["Are you made with gemma", "Are you made with Gemma?", "What AI are you?", "Are you ChatGPT?", "are you an AI",
    "Who made you?", "What model runs C?", "Do you use Gemma 4?", "Is my data sent to Google when I ask you?", "What is Gemma?",
    "does ask c send my questions anywhere", "Which LLM powers PrivaC?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /Gemma 4/, q);
    assert.match(r.answer, /March 31, 2026/);
    assert.match(r.answer, /on this computer/);
    assert.match(r.answer, /never leave this computer/);
    assert.doesNotMatch(r.answer, /not made with Gemma|^Yes\b/i, q);
  }
});

test("questions that mention Google, Gemini or \"you\" but are about tracking still go to Gemma", async () => {
  for (const q of ["Is my data sent to Google?", "Is Gemini tracking me?", "What can you tell me about Google?",
    "Who is Google and should I worry?", "Should you worry about Criteo?", "Are you able to block trackers on cnn.com?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
  }
});

test("C's intro and Gemma's background facts both say what C runs on, so other wordings come out right too", async () => {
  const r = await ask("Who are you?");
  assert.match(r.answer, /Gemma 4/);
  const ctx = A.buildContext({ sites: [] }, "2026-10-24", []);
  assert.match(ctx, /About you, C: your answers are written by Gemma 4/);
});
