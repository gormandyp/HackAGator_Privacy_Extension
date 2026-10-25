// Justin's two reports (docs/IDEA.md on New-Grading_Scale, 2026-10-24):
// 1. Asking C why a site's "tracker connections" line cost points got "I don't know yet": the rules behind each line
//    weren't in C's evidence. Each line of the score now carries its rule, and C answers from it.
// 2. Quest Diagnostics had a breach in the news but PrivaC said "No known data breaches". Have I Been Pwned only lists
//    breaches whose account data became public; the line now says where it looked, and its rule says that.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const A = window.PrivaCAskC, D = window.PrivaCData;
const atlas = JSON.parse(fs.readFileSync(__dirname + "/../shared/atlas.json", "utf8"));
const T = (domain) => { const a = atlas.domains[domain]; return { domain, company: a[0], category: a[1], country: a[2], fingerprinting: a[4] || 0 }; };
const site = { domain: "cnn.com", cookieChoice: "accepted", policy: {}, lastVisit: "2026-10-24T12:00:00Z",
  trackers: ["doubleclick.net", "facebook.net", "criteo.com", "amazon-adsystem.com", "rlcdn.com"].map(T) };
const s = { ...site, ...D.computeScore(site) };
const data = { sample: false, sites: [s] };

async function ask(question) {
  let calls = 0, seen = null;
  const r = await A.answer(question, { load: async () => data, lists: async () => null, atlas: () => atlas,
    ask: async (q, o) => { calls++; seen = o; return "OK. [Seen on your visit]"; } });
  return { ...r, calls, context: (seen && seen.context) || "" };
}

test("every line of the score says how it's counted", () => {
  for (const p of s.parts) assert.ok(typeof p.rule === "string" && p.rule.length > 20, p.label);
  assert.match(s.parts[0].rule, /5 points for each outside company[^.]*up to 40/);
  assert.match(s.parts.find((p) => p.kind === "breach").rule, /only lists breaches whose account data became public/);
});

test("the dashboard's Ask C button on a score line is answered from that line's rule, instantly", async () => {
  const p = s.parts[0];
  const r = await ask(`On cnn.com: what does "${p.label}" mean, and why is it worth ${p.points} points?`);
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^"5 outside companies with trackers here" is one line of cnn\.com's exposure score/);
  assert.match(r.answer, /5 points for each outside company/);
  assert.match(r.answer, new RegExp(`adds ${p.points} of cnn\\.com's ${s.score} points \\(${s.grade}\\)`));
  assert.match(r.answer, /\[Seen on your visit\]/);
});

test("\"why did cnn.com get a C for tracker connections?\" adds how the tracker lines are counted", async () => {
  for (const q of [`Why did cnn.com get ${/^[AEF]/.test(s.grade) ? "an" : "a"} ${s.grade} for tracker connections?`, "why is cnn's grade so bad for trackers?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /How the tracker lines are counted: 5 points for each outside company/, q);
  }
  const plain = await ask("Why did cnn.com get its grade?");
  assert.doesNotMatch(plain.answer, /How the tracker lines are counted/, "only when the question names that part");
});

test("Gemma gets the grading rules too, for questions in other words", async () => {
  const r = await ask("How do cookies change my score?");
  assert.match(r.context, /How the grade is counted \(higher means more exposed\):\n- 5 points for each outside company/);
});

test("no breach found: the line names the list it checked", () => {
  assert.strictEqual(s.parts.find((p) => p.kind === "breach").label, "No breach on record in Have I Been Pwned");
});
