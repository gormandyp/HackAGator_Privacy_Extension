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
    assert.match(r.answer, /4 outside companies with trackers here \(\+20\)/);
    assert.match(r.answer, /2 of them for advertising, data brokering or recording your screen \(\+10\)/);
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
  assert.match(c, /planetfitness\.com, visited[^\n]*score made of: 4 outside companies with trackers here \(\+20\)/);
});

test("Ask C keeps the answer's line breaks, so each scoring line shows on its own", () => {
  const css = require("node:fs").readFileSync(__dirname + "/../dashboard/dashboard.css", "utf8");
  assert.match(css, /\.msg \.answer \{[^}]*white-space: pre-line;/);
});

// Range (Justin's grade-scale doc): the instant answer says what's unknown and how high the score could go.
test("the instant grade answer names what's still unknown and how high the score could go", async () => {
  const r = await ask("Why did planetfitness.com get a B?");
  assert.match(r.answer, /Partly checked: the privacy policy isn't read yet, so this could be as high as 55 out of 100 \(a C\)\. \[Privacy policy\]/);
  const q = await ask("Why did wikipedia.org get an A?");
  assert.match(q.answer, /could be as high as 15 out of 100 \(still an A\)/);
  const full = site("checked.example", [], { cookieChoice: "declined", policy: { sells: false, shares: false } });
  const f = await ask("Why did checked.example get an A?", [full]);
  assert.match(f.answer, /Fully checked: every line of the grade has an answer\./);
});

// wired.com on the Mac (2026-10-25): already 100 of 100 with the policy unread, the popup said "could be as high as
// 100 of 100 (still an F)". At the top of the scale an unknown can't raise the score, so C says that instead.
test("a site already at 100 doesn't say it 'could be as high as 100'", async () => {
  const ads = [...Array(60)].map((_, i) => tr("Ad" + i, "Advertising"));
  const loud = site("loud.example", [...ads, tr("Baidu", "Advertising", "CN")],
    { cookieChoice: "none", breach: { name: "Loud", breachDate: "2026-05-01", addedDate: "2026-06-01", pwnCount: 1000 } });
  assert.strictEqual(loud.score, 100);
  const r = await ask("Why did loud.example get an F?", [loud]);
  assert.ok(!/could be as high as/.test(r.answer), r.answer);
  assert.match(r.answer, /Partly checked: the privacy policy isn't read yet, but the score is already at the top \(100 out of 100\), so that can't raise it\./);
});
