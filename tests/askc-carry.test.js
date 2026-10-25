// Ask C keeps the topic across short follow-ups (Max, real Gemma on the Mac, 2026-10-25): after "Was google hacked?"
// and "What about quest diagnostics?", "What about puffco?" went to Gemma, because C only looked one question back and
// that one had no breach word. "Was google hacked?" was also answered about docs.google.com (a site he visited)
// instead of Google. Now "what about X?" takes the last real question from the last 3 (skipping other "what about"s)
// and asks it about X, so the same database lookups answer it. Run with: node --test
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
  { Name: "Wired", Title: "WIRED", Domain: "wired.com", BreachDate: "2025-11-01", AddedDate: "2025-12-01T00:00:00Z", PwnCount: 2300000, DataClasses: ["Email addresses", "Names"] }
]);
const lists = { hibp: { fetchedAt: "2026-10-25T08:00:00Z", byDomain: hibp } };
const atlas = { domains: { "google-analytics.com": ["Google", "Analytics", "US", 40], "doubleclick.net": ["Google", "Advertising", "US", 30],
  "klaviyo.com": ["Klaviyo", "Marketing", "US", 5] } };
const site = (domain, trackers, policy = {}) => ({ domain, lastVisit: "2026-10-25", cookieChoice: "accepted", policy, trackers });
const browsing = { sites: [
  site("docs.google.com", [{ company: "Google", category: "Analytics", country: "US" }]),
  site("puffco.com", [{ company: "Google", category: "Advertising", country: "US" }, { company: "Klaviyo", category: "Advertising", country: "US" },
    { company: "Criteo", category: "Advertising", country: "FR" }, { company: "LiveRamp", category: "Data broker", country: "US" }], { sells: "yes" })
].map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) })) };

async function ask(q, questions = []) {
  let calls = 0, seen = null;
  const history = questions.map((question) => ({ question, answer: "An earlier answer." }));
  const r = await A.answer(q, { load: async () => browsing, lists: async () => lists, atlas: () => atlas, history,
    ask: async (x, o) => { calls++; seen = { x, ...o }; return "Gemma's answer. [Seen on your visit]"; } });
  return { ...r, calls, seen };
}

test("\"What about puffco?\" two follow-ups after \"Was google hacked?\" is still a breach question, answered from the list", async () => {
  const r = await ask("What about puffco?", ["Was google hacked?", "What about quest diagnostics?"]);
  assert.strictEqual(r.calls, 0, r.answer);
  assert.match(r.answer, /Have I Been Pwned's list \(updated Oct 25, 2026\) has no breach on record for puffco\.com \[HIBP\]/);
});

test("a follow-up about a site that is on the breach list gets its breaches", async () => {
  const r = await ask("and wired?", ["Was linkedin.com hacked?"]);
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /WIRED \(wired\.com\) has 1 data breach on record/);
});

test("the topic carries for grades, selling and who-is questions too", async () => {
  const grade = await ask("what about puffco?", ["Why did docs.google.com get an A?"]);
  assert.strictEqual(grade.calls, 0, grade.answer);
  assert.match(grade.answer, /puffco\.com/);
  assert.doesNotMatch(grade.answer, /docs\.google\.com/);
  const sells = await ask("what about puffco", ["Does docs.google.com sell my data?"]);
  assert.match(sells.answer, /puffco\.com/);
  assert.doesNotMatch(sells.answer, /docs\.google\.com/);
  const who = await ask("how about Klaviyo?", ["Who is Google?"]);
  assert.match(who.seen.x, /^Who is Klaviyo\?$/);
});

test("only the last 3 questions count, and a real follow-up (it, them, that) is left alone", async () => {
  const old = await ask("what about puffco?", ["Was google hacked?", "What is a tracker?", "What is a cookie?", "What is fingerprinting?"]);
  assert.doesNotMatch(old.answer, /Have I Been Pwned/, "a breach question 4 back is too old to carry");
  const it = await ask("what about its cookies?", ["Was linkedin.com hacked?"]);
  assert.doesNotMatch(it.answer, /no breach on record for (?:Its|its)/);
});

test("\"Was google hacked?\" is about Google, not a Google page you visited", async () => {
  const r = await ask("Was google hacked?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /no breach on record for Google \[HIBP\]/);
  assert.doesNotMatch(r.answer, /docs\.google\.com/);
  const page = await ask("Was docs.google.com hacked?");
  assert.match(page.answer, /no breach on record for docs\.google\.com/, "naming the page itself still gets the page");
});
