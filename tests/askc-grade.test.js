// "Why did planetfitness.com get a B?" -> C answered "I don't know yet" (team doc, Oct 24): Gemma only saw the grade
// and the exposure number, not what added up to it. Grade questions are now answered from the score itself
// (the same lines as the popup's "Why it got a B"), without asking Gemma, so the answer is always right.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
require("../shared/askc.js");
const { answer, buildContext } = window.PrivaCAskC;
const { computeScore } = window.PrivaCData;

const tr = (company, category, country = "US") => ({ domain: company.toLowerCase() + ".com", company, category, country });
function site(domain, trackers, extra = {}) {
  const s = { domain, trackers, cookieChoice: "accepted", policy: {}, lastVisit: "2026-10-24", ...extra };
  const r = computeScore(s);
  return { ...s, score: r.score, grade: r.grade };
}
const gym = site("planetfitness.com", [tr("Google", "Advertising"), tr("Meta", "Advertising"), tr("Hotjar", "Analytics"), tr("Optimizely", "Analytics")]);
const quiet = site("wikipedia.org", [], { cookieChoice: "none" });
const data = { sites: [gym, quiet] };

async function ask(question, sites = data.sites) {
  let calls = 0;
  const r = await answer(question, { load: async () => ({ sites }), ask: async () => { calls++; return "I don't know yet."; } });
  return { ...r, calls };
}

test("the test site really is a B with these points", () => {
  assert.strictEqual(gym.grade, "B");
  assert.strictEqual(gym.score, 40);
});

for (const q of ["Why did planetfitness.com get a B?", "why is planetfitness.com a B", "How did you rate planetfitness.com?",
  "Why does planetfitness get that grade?", "How was planetfitness.com scored?"]) {
  test(`"${q}" is answered from the score, not by Gemma`, async () => {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0);
    assert.ok(!/don't know/i.test(r.answer), r.answer);
    assert.match(r.answer, /planetfitness\.com got a B/);
    assert.match(r.answer, /40 out of 100/);
    assert.match(r.answer, /4 tracker connections to outside companies \(\+20\)/);
    assert.match(r.answer, /2 used for advertising, data brokering or recording your screen \(\+10\)/);
    assert.match(r.answer, /All cookies accepted \(\+10\)/);
    assert.match(r.answer, /\[Seen on your visit\]/);
    assert.deepStrictEqual(r.trace.map((t) => t.label), ["Your browsing"]);
  });
}

test("the answer says how the letters work, so a B makes sense", async () => {
  assert.match((await ask("Why did planetfitness.com get a B?")).answer, /B is 21-40/);
});

test("asking about a grade the site doesn't have: C says the grade it really has", async () => {
  const r = await ask("Why did planetfitness.com get an F?");
  assert.match(r.answer, /planetfitness\.com got a B, not an F/);
});

test("a site with nothing counted says so, instead of an empty list", async () => {
  const r = await ask("Why did wikipedia.org get an A?");
  assert.match(r.answer, /wikipedia\.org got an A/);
  assert.match(r.answer, /Nothing added points/);
});

test("a site PrivaC hasn't seen: C says it has no grade yet, and how to get one", async () => {
  const r = await ask("Why did zara.com get a C?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /haven't seen zara\.com/);
});

test("other questions still go to Gemma", async () => {
  assert.strictEqual((await ask("Who is Hotjar?")).calls, 1);
  assert.strictEqual((await ask("Which sites I visited are the riskiest?")).calls, 1);
  assert.strictEqual((await ask("How do I block trackers?")).calls, 1);
});

test("Gemma's evidence lists what makes up each detailed site's score, for grade questions asked other ways", () => {
  const c = buildContext(data, "2026-10-24", [], null, "Tell me about planetfitness.com");
  assert.match(c, /planetfitness\.com, visited[^\n]*score made of: 4 tracker connections to outside companies \(\+20\)/);
});

test("Ask C keeps the answer's line breaks, so each scoring line shows on its own", () => {
  const css = require("node:fs").readFileSync(__dirname + "/../dashboard/dashboard.css", "utf8");
  assert.match(css, /\.msg \.answer \{[^}]*white-space: pre-line;/);
});
