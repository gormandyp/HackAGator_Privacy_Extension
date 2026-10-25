// "Why isn't the privacy policy checked yet" right after "Why did anthropic.com get a C?" (Max, real Gemma on the Mac,
// 2026-10-25) got "You have not yet checked the privacy policy for mail.yahoo.com": the wrong site, and it blamed the
// person, though reading policies is PrivaC's job. Now it's answered by code, about the site just asked about, with
// the real reasons a policy can still be unread. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const A = window.PrivaCAskC;

const site = (domain, policy, trackers) => ({ domain, lastVisit: "2026-10-25", cookieChoice: "none", policy, trackers });
const browsing = { sites: [
  site("mail.yahoo.com", {}, [{ company: "Yahoo", category: "Advertising", country: "US" }]),
  site("anthropic.com", {}, [{ company: "ByteDance", category: "Advertising", country: "CN" }, { company: "Google", category: "Analytics", country: "US" },
    { company: "Segment", category: "Advertising", country: "US" }]),
  site("zara.com", { source: "https://www.zara.com/privacy", checkedAt: "2026-10-24T10:00:00Z" }, [{ company: "Google", category: "Advertising", country: "US" }])
].map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) })) };

async function ask(q, questions = []) {
  let calls = 0;
  const history = questions.map((question) => ({ question, answer: "An earlier answer." }));
  const r = await A.answer(q, { load: async () => browsing, history,
    ask: async () => { calls++; return "You have not yet checked the privacy policy for mail.yahoo.com [Seen on your visit]."; } });
  return { ...r, calls };
}

test("\"Why isn't the privacy policy checked yet\" after a grade question is about that site, answered by code", async () => {
  for (const q of ["Why isnt the privacy policy checked yet", "why hasn't the privacy policy been read?", "Why wasn't its policy checked?",
    "why is the policy not checked"]) {
    const r = await ask(q, ["Why did anthropic.com get a C?"]);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /^PrivaC hasn't read anthropic\.com's privacy policy yet/, `${q} -> ${r.answer}`);
    assert.doesNotMatch(r.answer, /mail\.yahoo\.com/);
    assert.doesNotMatch(r.answer, /\byou (?:have not|haven't) (?:yet )?checked/i, "it's PrivaC's job, not the person's");
  }
});

test("the answer gives the real reasons, the setting's name, and how high the grade could go", async () => {
  const r = await ask("Why isnt the privacy policy checked yet", ["Why did anthropic.com get a C?"]);
  assert.match(r.answer, /links to its privacy policy/);
  assert.match(r.answer, /once a week/);
  assert.match(r.answer, /PDF/);
  assert.match(r.answer, /"Read privacy policies with Gemma"/);
  const s = browsing.sites.find((x) => x.domain === "anthropic.com");
  assert.match(r.answer, new RegExp(`as high as ${s.range.max} out of 100`));
});

test("naming the site works without history, and a policy that was read but says neither is explained", async () => {
  const named = await ask("Why hasn't anthropic.com's privacy policy been checked?");
  assert.match(named.answer, /^PrivaC hasn't read anthropic\.com's privacy policy yet/);
  const read = await ask("why is zara.com's privacy policy not checked", []);
  assert.strictEqual(read.calls, 0);
  assert.match(read.answer, /PrivaC read zara\.com's privacy policy on Oct 24/);
  assert.match(read.answer, /doesn't say clearly whether it sells or shares/);
});

test("with no site named or asked about, it explains how policy reading works in general", async () => {
  const r = await ask("why isn't the privacy policy checked?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /PrivaC reads a site's privacy policy by itself/);
  assert.doesNotMatch(r.answer, /mail\.yahoo\.com|anthropic\.com/);
});

// G14 (real Gemma, main ad603c0): after "Does nytimes share my data?" the same question went to Gemma, which said the
// policy wasn't checked and brought up a breach, though nytimes.com's policy was read. A policy that was read and
// answered fell through ("other answers cover it"); now C says it was read, what it says, and whether it's in the grade.
test("a policy that was read and answered says so, after a sell/share question or named", async () => {
  const withNyt = { sites: [...browsing.sites, ...[site("nytimes.com", { source: "https://help.nytimes.com/privacy", checkedAt: "2026-10-25T09:00:00Z", sells: false, shares: true,
    quotes: { shares: "We share information with advertising partners." } }, [{ company: "Google", category: "Advertising", country: "US" }])]
    .map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) }))] };
  for (const [q, before] of [["Why isnt the privacy policy checked yet", ["Does nytimes share my data?"]], ["why hasn't nytimes.com's privacy policy been checked?", []]]) {
    let calls = 0;
    const r = await A.answer(q, { load: async () => withNyt, history: before.map((question) => ({ question, answer: "An earlier answer." })),
      ask: async () => { calls++; return "You haven't checked the privacy policy yet. This site has a data breach."; } });
    assert.strictEqual(calls, 0, q);
    assert.match(r.answer, /^PrivaC already read nytimes\.com's privacy policy on Oct 25, 2026: it says it doesn't sell personal information and shares personal information with partners for advertising \[Privacy policy\]\./, `${q} -> ${r.answer}`);
    assert.match(r.answer, /already counted in nytimes\.com's grade/);
    assert.doesNotMatch(r.answer, /breach/i);
  }
});
