// "Was linkedin.com hacked?" (Max, real Gemma, 2026-10-24): C said it had no information, although Have I Been Pwned
// lists LinkedIn's 2012 breach (164.6 million emails and passwords) and its 2021 scraped data. The follow-up
// "tell me about past data breaches involving linked in" got "Earlier I told you..." and nothing else.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const L = window.PrivaCLists, A = window.PrivaCAskC;

const hibp = L.compactBreaches([
  { Name: "LinkedIn", Title: "LinkedIn", Domain: "linkedin.com", BreachDate: "2012-05-05", AddedDate: "2016-05-21T21:35:40Z", PwnCount: 164611595, DataClasses: ["Email addresses", "Passwords"] },
  { Name: "LinkedInScrape", Title: "LinkedIn Scraped Data (2021)", Domain: "linkedin.com", BreachDate: "2021-04-08", AddedDate: "2021-10-02T21:39:21Z", PwnCount: 125698496, DataClasses: ["Email addresses", "Job titles", "Names"] },
  { Name: "Wired", Title: "WIRED", Domain: "wired.com", BreachDate: "2025-11-01", AddedDate: "2025-12-01T00:00:00Z", PwnCount: 2300000, DataClasses: ["Email addresses", "Names"] }
]);
const lists = { hibp: { fetchedAt: "2026-10-24T08:00:00Z", byDomain: hibp } };
const data = { sites: [{ domain: "cnn.com", lastVisit: "2026-10-24", cookieChoice: "accepted", policy: {}, trackers: [{ company: "LinkedIn", category: "Advertising", country: "US" }] }]
  .map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) })) };

async function ask(q, history, lst = lists) {
  let calls = 0, seen = null;
  const r = await A.answer(q, { load: async () => data, lists: async () => lst, history,
    ask: async (x, o) => { calls++; seen = o; return "Here you go. [HIBP] [Tracker Radar]"; } });
  return { ...r, calls, seen };
}

test("compactBreaches keeps what each earlier breach exposed, so every breach can be described", () => {
  assert.strictEqual(hibp["linkedin.com"].title, "LinkedIn Scraped Data (2021)");
  assert.deepStrictEqual(hibp["linkedin.com"].earlier[0].dataClasses, ["Email addresses", "Passwords"]);
});

test("\"Was X hacked?\" is answered from Have I Been Pwned itself, listing every breach, without Gemma", async () => {
  for (const q of ["Was linkedin.com hacked?", "Was LinkedIn hacked?", "has linkedin had a data breach", "Was www.linkedin.com breached?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /LinkedIn \(linkedin\.com\) has 2 data breaches on record in Have I Been Pwned/, q);
    assert.match(r.answer, /May 2012[^\n]*164\.6 million accounts[^\n]*email addresses, passwords/i, q);
    assert.match(r.answer, /April 2021[^\n]*LinkedIn Scraped Data \(2021\)[^\n]*125\.7 million/i, q);
    assert.match(r.answer, /\[HIBP\]/);
    assert.match(r.answer, /What you can do:[^\n]*change[^\n]*password/i, "breach steps, not cookie tips");
    assert.deepStrictEqual(r.trace.map((t) => t.label), ["Have I Been Pwned"]);
  }
});

test("a follow-up (\"yes, tell me about past breaches involving linked in\") gets the same answer", async () => {
  const history = [{ question: "Was linkedin.com hacked?", answer: "I do not have information about a hack on linkedin.com. [HIBP]" }];
  for (const q of ["Okay yes tell me about past data breaches involving linked in", "yes tell me about its breaches"]) {
    const r = await ask(q, history);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /LinkedIn \(linkedin\.com\) has 2 data breaches/, q);
  }
});

test("a site that isn't in the breach list says so honestly, never \"safe\"", async () => {
  const r = await ask("Was example-shop.com hacked?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /Have I Been Pwned's list \(updated Oct 24, 2026\) has no breach on record for example-shop\.com/);
  assert.match(r.answer, /doesn't prove it was never breached/);
  assert.doesNotMatch(r.answer, /\bsafe\b/i);
});

test("without the breach list (not downloaded yet), breach questions go to Gemma and C doesn't claim a check", async () => {
  const r = await ask("Was linkedin.com hacked?", null, null);
  assert.strictEqual(r.calls, 1);
  assert.ok(!r.trace.some((t) => t.label === "Have I Been Pwned"), "no HIBP check mark without HIBP evidence");
  assert.doesNotMatch(r.answer, /\[HIBP\]/, "a source tag with no evidence behind it is removed");
});

test("other questions that name LinkedIn get all its breaches in the evidence, found by name or with a space", async () => {
  for (const q of ["Who is LinkedIn and should I worry?", "what does linked in track"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
    assert.match(r.seen.context, /164\.6 million accounts/, q);
    assert.match(r.seen.context, /125\.7 million accounts/, q);
  }
});

test("Gemma's rules: scraped or leaked data counts as a breach; a \"yes\" to C's offer gets the thing offered", () => {
  assert.match(A.SYSTEM_PROMPT, /scraped/i);
  assert.match(A.SYSTEM_PROMPT, /says yes/i);
  assert.match(A.SYSTEM_PROMPT, /change that password/i);
});

// "Was google hacked?" (real Gemma, 2026-10-24 7 PM): Google has no breach in the list and the question has no web address,
// so it went to Gemma, which answered "I do not have information... I stick to your privacy" and listed every step.
const atlas = { domains: { "google-analytics.com": ["Google", "Analytics", "US", 40], "doubleclick.net": ["Google", "Advertising", "US", 30],
  "licdn.com": ["LinkedIn", "Advertising", "US", 6] } };
const browsing = { sites: ["cnn.com", "tass.com"].map((domain) => ({ domain, lastVisit: "2026-10-24", cookieChoice: "accepted", policy: {},
  trackers: [{ company: "Google", category: "Advertising", country: "US" }] })).map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) })) };
async function askAll(q, history) {
  let calls = 0;
  const r = await A.answer(q, { load: async () => browsing, lists: async () => lists, atlas: () => atlas, history,
    ask: async () => { calls++; return "I do not have information. I stick to your privacy. [HIBP]"; } });
  return { ...r, calls };
}

test("a company or site PrivaC knows but the breach list doesn't: an honest \"no breach on record\", not Gemma", async () => {
  for (const q of ["Was google hacked?", "has Google ever had a data breach", "did google get hacked"]) {
    const r = await askAll(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /Have I Been Pwned's list \(updated Oct 24, 2026\) has no breach on record for Google \[HIBP\]/, q);
    assert.match(r.answer, /doesn't prove it was never breached/);
    assert.match(r.answer, /Google's trackers were on 2 of your 2 sites this week \[Seen on your visit\]/, "what PrivaC did see");
    assert.match(r.answer, /What you can do: use a different password for each site and turn on two-step sign-in/);
    assert.doesNotMatch(r.answer, /\bsafe\b|stick to your privacy/i);
    assert.deepStrictEqual(r.trace.map((t) => t.label), ["Have I Been Pwned"]);
  }
  const site = await askAll("was tass hacked");   // a site you visited, named without .com
  assert.strictEqual(site.calls, 0);
  assert.match(site.answer, /no breach on record for tass\.com/);
});

test("\"what about google?\" right after a breach question is a breach question too", async () => {
  const history = [{ question: "Was linkedin.com hacked?", answer: "LinkedIn (linkedin.com) has 2 data breaches on record in Have I Been Pwned [HIBP]" }];
  const r = await askAll("what about google?", history);
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /no breach on record for Google/);
  const asked = await askAll("And linkedin?", [{ question: "Was google hacked?", answer: "no breach on record for Google" }]);
  assert.match(asked.answer, /LinkedIn \(linkedin\.com\) has 2 data breaches/);
});

// "what about quest diagnostics?" after "Was linked in hacked?" got LinkedIn's breaches again (Max, real Gemma, 2026-10-25):
// a name PrivaC doesn't know counted as "names nothing", so C reused the last question's site.
test("\"what about <a name PrivaC doesn't know>?\" after a breach question is about that name, never the last site", async () => {
  const history = [{ question: "Was linked in hacked?", answer: "LinkedIn (linkedin.com) has 2 data breaches on record in Have I Been Pwned [HIBP]" }];
  for (const [q, name] of [["what about quest diagnostics?", "Quest Diagnostics"], ["What about Quest Diagnostics", "Quest Diagnostics"],
    ["and the home depot?", "The Home Depot"], ["how about Ticketmaster", "Ticketmaster"], ["what about eBay?", "eBay"]]) {
    const r = await askAll(q, history);
    assert.doesNotMatch(r.answer, /LinkedIn/, `${q} -> ${r.answer}`);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, new RegExp(`Have I Been Pwned's list \\(updated Oct 24, 2026\\) has no breach on record for ${name} \\[HIBP\\]`), q);
    assert.match(r.answer, /doesn't prove it was never breached/);
  }
  const bank = await askAll("what about my bank?", history);   // not a name: Gemma answers, and it isn't LinkedIn's list
  assert.strictEqual(bank.calls, 1);
  assert.doesNotMatch(bank.answer, /LinkedIn \(linkedin\.com\) has 2 data breaches/);
});

test("\"what about it?\" and other real follow-ups after a breach question still mean the last site", async () => {
  const history = [{ question: "Was linked in hacked?", answer: "LinkedIn (linkedin.com) has 2 data breaches on record in Have I Been Pwned [HIBP]" }];
  for (const q of ["what about it?", "what about their passwords?", "and that one?"]) {
    const r = await askAll(q, history);
    assert.match(r.answer, /LinkedIn \(linkedin\.com\) has 2 data breaches/, q);
  }
});

test("something PrivaC doesn't know at all still goes to Gemma, and Gemma's rules keep it on topic", async () => {
  const r = await askAll("Was my bank hacked?");
  assert.strictEqual(r.calls, 1);
  assert.doesNotMatch(A.SYSTEM_PROMPT, /suggest a privacy question instead/, "the rule text Gemma parroted is gone");
  assert.match(A.SYSTEM_PROMPT, /hacks, breaches[^\n]*always on topic/i);
  assert.match(A.SYSTEM_PROMPT, /only the 2 or 3 steps that fit the question/i);
});
