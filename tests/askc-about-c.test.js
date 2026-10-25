// Ask C talking about itself (Max, real Gemma on the Mac, 2026-10-25): "What makes u so special" got
// "You are special because you are a privacy guide for the PrivaC browser extension. You only help with privacy
// concerns...", and another question got "I am a privacy guide for the PrivaC browser extension. I only help with
// privacy." Gemma was reading its own instructions back. Questions about C (however they're typed), greetings and
// thanks now get C's own answer, and an answer that repeats the instructions is replaced. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/askc.js");
const { answer } = window.PrivaCAskC;

const data = { sites: [{ domain: "news.example", grade: "D", score: 70, cookieChoice: "accepted", policy: {},
  trackers: [{ company: "Criteo", category: "Advertising", country: "FR" }] }] };
const ECHO = "You are special because you are a privacy guide for the PrivaC browser extension. You only help with privacy concerns related to your browsing activity.";

async function ask(question, reply = ECHO) {
  let calls = 0;
  const r = await answer(question, { load: async () => data, ask: async () => { calls++; return reply; } });
  return { ...r, calls };
}

test("questions about what makes C special get C's own answer, typed any way, without asking Gemma", async () => {
  for (const q of ["What makes u so special", "what makes you special?", "Why are you special?", "what's so special about you",
    "Why should I use you?", "why should i use privac", "How are you different from other extensions?", "What makes PrivaC different?",
    "what r u", "who r u?", "wat can u do", "what's your purpose?", "What is your job?", "Tell me about yourself, C"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /I'm C/, q);
    assert.ok(!/you are (?:a |the )?privacy guide/i.test(r.answer), q);
  }
});

test("the special answer says what PrivaC does differently, without claims it can't back up", async () => {
  const r = await ask("What makes u so special");
  assert.match(r.answer, /on this computer/i);
  assert.match(r.answer, /every point/i);
  assert.match(r.answer, /Reject|reject/);
  assert.ok(!/\bblock(?:s|ing)?\b(?! trackers or ads)/i.test(r.answer.replace(/doesn't block trackers or ads/i, "")), r.answer);
});

test("greetings and thanks get a short friendly reply, not the instructions", async () => {
  for (const q of ["hi", "Hello!", "hey C", "yo", "good morning", "thanks", "Thank you!", "ty", "ok cool"]) {
    const r = await ask(q, "I am a privacy guide for the PrivaC browser extension. I only help with privacy.");
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.ok(!/privacy guide for the PrivaC browser extension/i.test(r.answer), q);
    assert.ok(r.answer.length < 260, `${q} -> ${r.answer}`);
  }
});

test("an answer that reads Gemma's instructions back is replaced", async () => {
  for (const reply of [ECHO,
    "I am a privacy guide for the PrivaC browser extension. I only help with privacy.",
    "You are C, the friendly privacy guide inside the PrivaC browser extension.",
    "As PrivaC's privacy guide, you only help with privacy and you never write poems."]) {
    const r = await ask("what do you think about the weather", reply);
    assert.ok(!/(?:you|I) (?:am|are) (?:C, )?(?:a |the )?(?:friendly )?privacy guide/i.test(r.answer), r.answer);
    assert.ok(!/\byou only help with privacy\b/i.test(r.answer), r.answer);
    assert.match(r.answer, /privacy/i);
  }
});

test("real privacy answers that mention C or privacy are left alone", async () => {
  const ok = "Criteo is an advertising company based in France. [Tracker Radar] Its tracker loaded on news.example. [Seen on your visit]";
  const r = await ask("Who is Criteo?", ok);
  assert.strictEqual(r.calls, 1);
  assert.match(r.answer, /Criteo is an advertising company/);
  for (const q of ["Is news.example special?", "What makes news.example so bad?", "hi, who is Criteo?", "Thanks, and was news.example hacked?"]) {
    const s = await ask(q, ok);
    assert.ok(!/^(?:Hi|Hey|You're welcome|I'm C)/.test(s.answer), `${q} got C's own answer: ${s.answer}`);
  }
});
