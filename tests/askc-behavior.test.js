// Ask C behavior (repo owner's feedback, 2026-10-24): C added "What you can do" to almost every answer, talked
// like a general chatbot ("I can write a poem"), and forgot the question before. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/askc.js");
const { answer, buildContext, SYSTEM_PROMPT } = window.PrivaCAskC;

const site = (domain, score, extra) => Object.assign({ domain, grade: score > 80 ? "F" : score > 60 ? "D" : "B", score, cookieChoice: "accepted",
  policy: {}, trackers: [{ company: "Criteo", category: "Advertising", country: "FR" }] }, extra);
const data = { sites: [site("news.example", 70)] };
const STEPS = "Criteo is an ad company. [Tracker Radar]\n\nWhat you can do: decline extra cookies when C offers.";

async function ask(question, reply = STEPS, extra = {}) {
  let calls = 0, seen = null;
  const r = await answer(question, { load: async () => extra.data || data, history: extra.history,
    ask: async (q, o) => { calls++; seen = { q, ...o }; return reply; } });
  return { ...r, calls, seen };
}

test("a plain question (what is / who is) gets no \"What you can do\" line", async () => {
  for (const q of ["Who is Criteo?", "What is a tracker?", "Why did news.example get a D?", "What does fingerprinting mean?"]) {
    const r = await ask(q);
    assert.ok(!/What you can do/i.test(r.answer), `${q} -> ${r.answer}`);
    assert.match(r.answer, /Criteo is an ad company/);
    assert.match(r.seen.context, /Don't add a "What you can do" line/);
  }
});

test("asking for advice or about a risk keeps the steps", async () => {
  for (const q of ["Who is LiveRamp and should I worry?", "How do I protect myself?", "Is news.example safe?",
    "What can I do about data brokers?", "Was news.example hacked?", "Should I accept cookies?"]) {
    const r = await ask(q);
    assert.match(r.answer, /What you can do: decline extra cookies/, q);
  }
});

test("the rules no longer tell Gemma to end every answer with steps, and keep C in character", () => {
  assert.ok(!/then a line starting "What you can do:"/.test(SYSTEM_PROMPT));
  assert.match(SYSTEM_PROMPT, /only when/i);
  assert.match(SYSTEM_PROMPT, /poems|stories|code/i);
});

test("\"What can you do?\" and \"Who are you?\" get C's own answer, not a general chatbot's", async () => {
  for (const q of ["What can you do?", "what can you help me with", "Who are you?", "What are you?", "help", "What can I ask you?"]) {
    const r = await ask(q, "I can write a poem, translate text and more.");
    assert.strictEqual(r.calls, 0, `${q}: answered without Gemma`);
    assert.match(r.answer, /privacy/i);
    assert.match(r.answer, /cookie/i);
    assert.ok(!/poem/i.test(r.answer));
  }
});

test("requests that aren't about privacy (a poem, code, homework) get a friendly no and a privacy suggestion", async () => {
  for (const q of ["Write me a poem about cats", "Can you write a story?", "write python code to sort a list", "Tell me a joke"]) {
    const r = await ask(q, "Roses are red...");
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /privacy/i, q);
    assert.ok(!/Roses/.test(r.answer));
  }
});

test("a privacy question that mentions a poem or a story still goes to Gemma", async () => {
  const r = await ask("Who is behind the news story tracker on news.example?");
  assert.strictEqual(r.calls, 1);
});

test("C remembers the last few questions: earlier turns go into the evidence", async () => {
  const history = [
    { question: "Why did flightdeals.example get an F?", answer: "It loaded 8 trackers. [Seen on your visit]" },
    { question: "Who is Yandex?", answer: "A Russian search company. [Tracker Radar]" }
  ];
  const r = await ask("And what about its cookies?", STEPS, { history });
  assert.match(r.seen.context, /Earlier in this conversation/);
  assert.match(r.seen.context, /Why did flightdeals\.example get an F\?/);
  assert.match(r.seen.context, /A Russian search company/);
  assert.ok(r.seen.context.indexOf("Who is Yandex?") > r.seen.context.indexOf("flightdeals.example get an F"), "oldest first");
});

test("a follow-up about a site named earlier shows that site in full, even when it isn't among the riskiest", async () => {
  const sites = [site("a.example", 99), site("b.example", 98), site("c.example", 97), site("d.example", 96), site("e.example", 95),
    site("quiet.example", 10, { cookies: [] , trackers: [{ company: "Hotjar", category: "Session recording", country: "MT" }] })];
  const history = [{ question: "Tell me about quiet.example", answer: "It's a B. [Seen on your visit]" }];
  const r = await ask("What trackers did it load?", STEPS, { data: { sites }, history });
  assert.match(r.seen.context, /- quiet\.example, visited/, "full detail line for the site from the earlier question");
});

test("memory is small: only the last 3 turns, each cut short", () => {
  const long = "x".repeat(2000);
  const history = [1, 2, 3, 4, 5].map((n) => ({ question: `Question ${n}?`, answer: `Answer ${n}. ${long}` }));
  const c = buildContext(data, "2026-10-24", [], null, "Next?", history);
  assert.ok(!/Question 1\?/.test(c) && !/Question 2\?/.test(c));
  assert.match(c, /Question 3\?[\s\S]*Question 5\?/);
  assert.ok(!c.includes("x".repeat(500)), "long answers are trimmed");
});

test("no history: no memory section", () => {
  assert.ok(!/Earlier in this conversation/.test(buildContext(data, "2026-10-24", [], null, "Hi")));
});
