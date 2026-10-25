// "You" means C (Preston, 2026-10-25: "when you say 'you' to C, it does not recognize that the user is talking to C, and
// repeats back 'You' to the user with something unrelated"). Real Gemma on the Mac answered "Are you there?" and "Can you
// help?" with its own instructions, "Are you safe?" about the person's browsing, and "What do you think?" with "you visited
// two sites". C's rule for Gemma is to call the person "you", and nothing said the person's "you" is C. Common questions
// to C now get C's own answer from PRIVACY.md and TERMS.md; the others still go to Gemma with a note saying who "you" is.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/askc.js");
const { answer } = window.PrivaCAskC;

const data = { sites: [{ domain: "news.example", grade: "D", score: 70, cookieChoice: "accepted", policy: {},
  trackers: [{ company: "Criteo", category: "Advertising", country: "FR" }, { company: "Hotjar", category: "Session Replay", country: "MT" }] }] };
const ECHO = "You are C, the friendly privacy guide inside the PrivaC browser extension.";

async function ask(question, reply = ECHO) {
  let calls = 0, context = "";
  const r = await answer(question, { load: async () => data, ask: async (q, o) => { calls++; context = o.context; return reply; } });
  return { ...r, calls, context };
}

test("\"Are you tracking me?\" gets C's own no, with what PrivaC does keep, instead of the person's own browsing", async () => {
  for (const q of ["Are you tracking me?", "Are you spying on me?", "Are you watching what I do?", "Are you recording my screen?",
    "Are you collecting my data?", "r u tracking me", "Is PrivaC tracking me?", "Is C spying on me?", "Are you monitoring me, C?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^No\. I don't track you or record your screen/, q);
    assert.match(r.answer, /stays on this computer/, q);
    assert.match(r.answer, /It keeps site names \(never the addresses of the pages you visit\)/, q);
    assert.doesNotMatch(r.answer, /tracker addresses on/, `${q}: not the dashboard's screen-recording list`);
  }
});

test("\"What do you know about me?\" says what PrivaC keeps, for how long, that questions aren't saved, and how to delete it", async () => {
  for (const q of ["What do you know about me?", "what do u know about me", "Do you know what sites I visited?", "Do you store my history?",
    "Do you keep my browsing history?", "Do you remember what I asked?", "Will you remember this conversation?",
    "What data do you have on me?", "What information do you have about me?", "Can you forget what I told you?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^Only what PrivaC saw in this browser, and it stays on this computer\./, q);
    assert.match(r.answer, /It deletes each site 7 days after your last visit/, q);
    assert.match(r.answer, /last 3 questions[^.]*while this page is open, and nothing you ask me is saved/, q);
    assert.match(r.answer, /Settings > "Clear my PrivaC data"/, q);
  }
});

test("\"Are you there?\" and \"How are you?\" get a short friendly reply, not the instructions", async () => {
  for (const [q, start] of [["Are you there?", /^I'm here!/], ["are u there", /^I'm here!/], ["Are you working?", /^I'm here!/],
    ["Are you on?", /^I'm here!/], ["you there?", /^I'm here!/], ["How are you?", /^I'm doing well/], ["how r u", /^I'm doing well/],
    ["How are you doing today, C?", /^I'm doing well/], ["What's up?", /^I'm doing well/]]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, start, q);
    assert.ok(r.answer.length < 200, `${q} -> ${r.answer}`);
  }
  assert.strictEqual((await ask("How are you different from other extensions?")).calls, 0, "still C's special answer");
});

test("\"Can you help me?\" and \"What's your name?\" get C's own intro; \"Are you a person?\" gets what C is", async () => {
  for (const q of ["Can you help me?", "can u help", "Could you help me out?", "What is your name?", "What's your name?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^I'm C, PrivaC's privacy guide\. Here's what PrivaC does for you/, q);
  }
  for (const q of ["Are you a person?", "are you a real person"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /written by Gemma 4/, q);
  }
});

test("\"Can you see what I type?\" and \"Can you read my emails?\" get PrivaC's privacy answer", async () => {
  for (const q of ["Can you see what I type?", "Can you read my emails?", "Do you read my messages?", "Can you see my screen?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^No\. .*never reads your passwords or what you type into websites/, q);
  }
});

test("\"How accurate are you?\" names the sources, \"Partly checked\" and that Gemma can word things wrongly", async () => {
  for (const q of ["How accurate are you?", "Are you accurate?", "Are you always right?", "Do you make mistakes?", "Can you be wrong?",
    "Is PrivaC accurate?", "Are your grades accurate?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    for (const fact of [/Tracker Radar/, /Have I Been Pwned/, /"Partly checked"/, /Gemma/, /pop-up/]) assert.match(r.answer, fact, `${q}: ${fact}`);
  }
});

test("\"Are you free?\" says PrivaC is free, the way TERMS.md does", async () => {
  for (const q of ["Are you free?", "Is PrivaC free?", "Do you cost money?", "How much do you cost?", "How much does PrivaC cost?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^PrivaC is free\. There are no accounts, payments, ads or paid features/, q);
  }
});

test("\"I love you\" and \"You're wrong\" get C's own reply", async () => {
  for (const q of ["I love you", "I love you C!", "you're the best", "You are awesome"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^Thank you!/, q);
  }
  for (const q of ["You are wrong", "You're wrong about news.example", "that's not right"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q} went to Gemma`);
    assert.match(r.answer, /^Sorry about that\./, q);
    assert.match(r.answer, /every point/, q);
  }
});

test("other questions to C still go to Gemma, told that \"you\" means C and given PrivaC's facts", async () => {
  for (const q of ["Can you protect me?", "Do you block ads?", "Why are you showing me this?", "Do you work offline?", "Do you use cookies?",
    "Can you clear my cookies?", "Did you block anything?", "can u decline cookies for me", "Are you able to block trackers on news.example?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
    assert.match(r.context, /For this question: the person is talking to you, C\. In their question, "you" and "your" mean you/, q);
    assert.match(r.context, /About PrivaC itself/, q);
  }
});

test("requests, opinions and \"you\" meaning anyone keep the usual evidence, with no note", async () => {
  for (const q of ["What can you tell me about Google?", "Can you explain my grade?", "Should you worry about Criteo?",
    "How do you clear cookies?", "What do you think of news.example?", "Do you think Criteo is bad?", "Who is Criteo?",
    "Can you tell me about you and cookies?", "Would you recommend accepting cookies?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
    assert.doesNotMatch(r.context, /the person is talking to you, C/, q);
  }
});

test("an answer about C still gets C's own words when Gemma reads its instructions back", async () => {
  const r = await ask("Do you work offline?", "I am C, the friendly privacy guide inside the PrivaC browser extension. [Seen on your visit]");
  assert.doesNotMatch(r.answer, /friendly privacy guide inside/);
  assert.match(r.answer, /^I'm C, PrivaC's privacy guide\./);
});
