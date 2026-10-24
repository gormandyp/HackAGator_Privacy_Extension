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

test("Fix 5: lowercase grade questions get the instant breakdown from the score, not Gemma", async () => {
  const g = data.sites[0].grade;
  for (const q of [`why did cnn.com get a ${g.toLowerCase()}`, "why does cnn.com have a c grade", "why did cnn.com get an f"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, new RegExp(`^cnn\\.com got an? ${g}`), q);
    assert.match(r.answer, /What added points:/);
  }
  const wrong = await ask("why did cnn.com get an f");
  if (g !== "F") assert.match(wrong.answer, /, not an F:/, "the letter asked is compared in capitals");
  const r = await ask("Why is cnn.com a concern?");
  assert.strictEqual(r.calls, 1, "a word starting with a-f (\"a concern\") isn't a grade letter");
});

test("Fix 4: Gemma's evidence names countries (China, France, United States), never bare codes", async () => {
  const r = await ask("Who tracked me on cnn.com?");
  const c = r.seen.context;
  assert.match(c, /Baidu \(Analytics, based in China\)/);
  assert.match(c, /Criteo \(Advertising, based in France\)/);
  assert.match(c, /Companies seen on the most sites[^\n]*Criteo \(Advertising, France\)/);
  assert.doesNotMatch(c, /based in [A-Z]{2}\)|\((?:Advertising|Analytics), [A-Z]{2}\)/);
  const facts = window.PrivaCAskC.lookupFacts("Who is Yandex?", null, { domains: { "yandex.ru": ["Yandex", "Advertising", "RU", 1.3] } });
  assert.match(facts.join("\n"), /based in Russia/);
  assert.doesNotMatch(facts.join("\n"), /based in RU\b/);
});

test("Fix 4: on a busy site, foreign-adversary trackers are still kept first once countries are names", () => {
  const trackers = Array.from({ length: 20 }, (_, i) => ({ company: `Plain${i}`, category: "Analytics", country: "US" }));
  trackers.push({ company: "Yandex", category: "Analytics", country: "RU" });
  const ctx = buildContext({ sites: [scored({ domain: "busy.example", lastVisit: "2026-10-24", cookieChoice: "accepted", policy: {}, trackers })] }, "2026-10-24", [], null, "busy.example");
  assert.match(ctx, /Yandex \(Analytics, based in Russia\)/, "Yandex is in the kept 12, not cut");
});

test("Fix 2: swapping \"the user\" for \"you\" also fixes the verb", () => {
  const cases = [
    ["The user has visited 5 sites. [Seen on your visit]", "You have visited 5 sites. [Seen on your visit]"],
    ["The user is tracked by Criteo. [Tracker Radar]", "You are tracked by Criteo. [Tracker Radar]"],
    ["The user was tracked on 3 sites.", "You were tracked on 3 sites."],
    ["Criteo knows what the user does. [Tracker Radar]", "Criteo knows what you do. [Tracker Radar]"],
    ["The user wants to know.", "You want to know."],
    ["The user visits cnn.com.", "You visit cnn.com."],
    ["The user watches videos.", "You watch videos."],
    ["The user accesses it.", "You access it."],
    ["The user carries a phone.", "You carry a phone."],
    ["The user is not tracked.", "You are not tracked."],
    ["The user doesn't see it.", "You don't see it."],
    ["The user's data is shared.", "Your data is shared."],
    ["Ads follow the user.", "Ads follow you."],
    ["The user can decline.", "You can decline."],
    ["The user uses Chrome.", "You use Chrome."],
    ["The user always visits cnn.com.", "You always visit cnn.com."],
    ["The user also has cookies.", "You also have cookies."],
    ["Data about the user goes to Criteo.", "Data about you goes to Criteo."],
    ["Criteo shows the user ads.", "Criteo shows you ads."],
    ["It's fine. The user isn't tracked here.", "It's fine. You aren't tracked here."]
  ];
  for (const [raw, want] of cases) assert.strictEqual(cleanAnswer(raw), want, raw);
});
