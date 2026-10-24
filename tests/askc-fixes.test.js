// Ask C bugs found 2026-10-24 (docs/ASKC-FIXES.md); fixes 1, 4 and 5 were also seen with real Gemma on the demo Mac.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const { answer, buildContext, cleanAnswer, SYSTEM_PROMPT } = window.PrivaCAskC;

const scored = (s) => ({ ...s, ...window.PrivaCData.computeScore(s) });
const data = { sites: [
  scored({ domain: "cnn.com", lastVisit: "2026-10-24", cookieChoice: "accepted", policy: {},
    trackers: [{ company: "Criteo", category: "Advertising", country: "FR" }, { company: "Baidu", category: "Analytics", country: "CN" }] })
] };
async function ask(q, d = data) {
  let calls = 0, seen = null;
  const r = await answer(q, { load: async () => d, ask: async (question, o) => { calls++; seen = o; return "OK. [Seen on your visit]"; } });
  return { ...r, calls, seen };
}

test("Fix 1: \"What can you do about X?\" is a real question for Gemma, not a request for C's intro", async () => {
  for (const q of ["What can you do about trackers on cnn.com?", "What could you do about Baidu tracking me?",
    "What can you do to protect me on wired.com?", "How can you help me with cookies on ikea.com?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, `${q} -> ${r.answer}`);
  }
  for (const q of ["What can you do?", "what can you do for me?", "Who are you?", "help", "What can I ask you?", "what can you help me with"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} should get C's intro`);
    assert.match(r.answer, /I'm C, PrivaC's privacy guide/);
  }
});
