// Ask C backtest (repo owner, 2026-10-24): many wordings of the same question, and follow-ups, through the real
// shared/askc.js with a recording stand-in for Gemma. Each test is a root cause of C giving different answers to
// similar questions, repeating himself, or saying less than PrivaC knows. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const L = window.PrivaCLists, A = window.PrivaCAskC, D = window.PrivaCData;
const atlas = JSON.parse(fs.readFileSync(__dirname + "/../shared/atlas.json", "utf8"));

const T = (domain) => { const a = atlas.domains[domain]; return { domain, company: a[0], category: a[1], country: a[2], fingerprinting: a[4] || 0 }; };
const B = (Name, Title, Domain, BreachDate, PwnCount, DataClasses) => ({ Name, Title, Domain, BreachDate, AddedDate: BreachDate + "T00:00:00Z", PwnCount, DataClasses });
const lists = { hibp: { fetchedAt: "2026-10-24T08:00:00Z", byDomain: L.compactBreaches([
  B("LinkedIn", "LinkedIn", "linkedin.com", "2012-05-05", 164611595, ["Email addresses", "Passwords"]),
  B("Wired", "WIRED", "wired.com", "2025-11-01", 2300000, ["Email addresses", "Names"]),
  B("Adobe", "Adobe", "adobe.com", "2013-10-04", 152445165, ["Email addresses", "Passwords"])
]) } };
const sites = [
  { domain: "cnn.com", cookieChoice: "accepted", policy: {}, trackers: ["doubleclick.net", "facebook.net", "criteo.com", "amazon-adsystem.com", "rlcdn.com"].map(T) },
  { domain: "linkedin.com", cookieChoice: "declined", policy: {}, trackers: ["doubleclick.net"].map(T) },
  { domain: "wired.com", cookieChoice: "declined", policy: {}, trackers: ["doubleclick.net", "criteo.com"].map(T) },
  { domain: "espn.com", cookieChoice: "accepted", policy: {}, trackers: ["doubleclick.net", "facebook.net"].map(T) },
  { domain: "wikipedia.org", cookieChoice: "none", policy: { sells: false, shares: false, checkedAt: "2026-10-20" }, trackers: [] }
].map((s) => ({ lastVisit: "2026-10-24T12:00:00Z", ...s }));
const data = { sample: false, sites };
L.annotate(data, lists, null);
data.sites = data.sites.map((s) => ({ ...s, ...D.computeScore(s) }));
const grade = (d) => data.sites.find((s) => s.domain === d).grade;

async function ask(question, history) {
  let calls = 0, seen = null;
  const r = await A.answer(question, { load: async () => data, lists: async () => lists, atlas: () => atlas, history,
    ask: async (q, o) => { calls++; seen = o; return "OK. [Seen on your visit]"; } });
  return { ...r, calls, context: (seen && seen.context) || "", seen };
}
const factsIn = (context) => ((context.split("Facts about what you asked:\n")[1] || "").split("\n\n")[0]);

test("every wording of \"why did cnn.com get its grade?\" gets the same instant breakdown", async () => {
  const g = grade("cnn.com");
  for (const q of [`Why did cnn.com get a ${g}?`, "explain cnn.com's grade", "why is cnn so bad", "what made cnn.com's score go up",
    "cnn grade?", "What grade did cnn.com get?", "What is cnn's grade?", "How is CNN graded?", "cnn.com rating", "What's the score for cnn.com?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, new RegExp(`^cnn\\.com got ${g === "A" || g === "F" ? "an" : "a"} ${g}: an exposure score`), q);
  }
});

test("\"a\" in \"have a bad grade\" is a word, not the letter A", async () => {
  const r = await ask("Why does CNN have a bad grade?");
  assert.strictEqual(r.calls, 0);
  assert.doesNotMatch(r.answer, /not an A/);
  const upper = await ask("Why didn't cnn.com get an A?");
  if (grade("cnn.com") !== "A") assert.match(upper.answer, /not an A/, "a capital A asked for still counts");
});

test("after a grade question, \"and espn?\" or \"what about wired.com?\" gets that site's grade the same way", async () => {
  const history = [{ question: "Why did cnn.com get a D?", answer: "cnn.com got a D: ..." }];
  for (const [q, d] of [["and espn?", "espn.com"], ["what about wired.com?", "wired.com"], ["How about linkedin?", "linkedin.com"]]) {
    const r = await ask(q, history);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, new RegExp(`^${d.replace(".", "\\.")} got an? ${grade(d)}:`), q);
  }
});

test("\"did any site I visited get hacked?\" lists the breached sites you visited, in every wording", async () => {
  for (const q of ["Did any site I visit get hacked?", "Which of my sites had data breaches?", "Have any sites I visited been hacked?",
    "Were any of my sites breached?", "Which sites leaked data?", "breached sites?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /2 of the 5 sites you visited/, q);
    assert.match(r.answer, /linkedin\.com[^\n]*May 2012[^\n]*164\.6 million/, q);
    assert.match(r.answer, /wired\.com[^\n]*November 2025/, q);
    assert.doesNotMatch(r.answer, /VISIT/, "the tracker company named VISIT isn't the subject");
  }
});

test("company names that are everyday words (VISIT, Next, Impact, About You) aren't read into ordinary questions", async () => {
  for (const q of ["What happens when I visit a site with trackers?", "What should I do next about cookies?", "What impact did declining have?",
    "Can you tell me about you and cookies?"]) {
    const r = await ask(q);
    assert.doesNotMatch(factsIn(r.context), /VISIT|Next runs|Impact runs|About You/, q);
  }
  const r = await ask("Who is VISIT?");
  assert.match(factsIn(r.context), /VISIT runs/, "written the way the company writes it, it still counts");
});

test("one company matcher for every question: Meta, Instagram, TikTok, Amazon and YouTube find the right tracker company", async () => {
  for (const [q, co] of [["Who is Meta?", "Facebook"], ["Does Instagram track me?", "Facebook"], ["Is TikTok tracking me?", "ByteDance"],
    ["Who is Amazon?", "Amazon.com"], ["Does YouTube follow me?", "Google"], ["What is criteo", "Criteo"]]) {
    const r = await ask(q);
    assert.match(factsIn(r.context), new RegExp(`^- ${co.replace(".", "\\.")}( \\([^)]*\\))? runs`, "m"), q);
  }
});

test("follow-ups keep the company: \"does it fingerprint me?\" after \"Who is Criteo?\" still has Criteo's facts", async () => {
  const history = [{ question: "Who is Criteo?", answer: "Criteo is an advertising company based in France. [Tracker Radar]" }];
  for (const q of ["Does it fingerprint me?", "tell me more", "Is it a data broker?", "should I worry about them?"]) {
    const r = await ask(q, history);
    assert.match(factsIn(r.context), /^- Criteo runs/m, q);
  }
  const fresh = await ask("And Google?", history);
  assert.match(factsIn(fresh.context), /^- Google runs/m);
});

test("C doesn't repeat himself: repeated sentences and \"earlier I told you\" lines are taken out", () => {
  const raw = "Criteo is an ad company. [Tracker Radar] It loaded on 3 sites. [Seen on your visit] Criteo is an ad company. [Tracker Radar] " +
    "Earlier in this conversation, I told you about Criteo. It loaded on 3 sites.";
  assert.strictEqual(A.cleanAnswer(raw), "Criteo is an ad company. [Tracker Radar] It loaded on 3 sites. [Seen on your visit]");
  assert.strictEqual(A.cleanAnswer("As I mentioned earlier, LinkedIn had 2 breaches. [HIBP]"), "LinkedIn had 2 breaches. [HIBP]");
});

test("C's memory leaves out earlier steps, so Gemma doesn't copy the same tips into every answer", () => {
  const ctx = A.buildContext(data, "2026-10-24", [], null, "what about its cookies?",
    [{ question: "Should I worry about Criteo?", answer: "Criteo is an ad company. [Tracker Radar]\n\nWhat you can do: decline extra cookies." }]);
  assert.match(ctx, /You answered: Criteo is an ad company\. \[Tracker Radar\]/);
  assert.doesNotMatch(ctx, /You answered:[^\n]*What you can do/);
});

test("the same question gets the same answer: Gemma is asked with a fixed seed and low temperature", async () => {
  const r = await ask("Who is Criteo?");
  assert.strictEqual(typeof r.seen.options.seed, "number");
  assert.ok(r.seen.options.temperature <= 0.2);
});

test("\"Who tracked me the most?\" has an example that counts sites and uses the browsing tag", () => {
  assert.match(A.SYSTEM_PROMPT, /Question: Who tracked me the most this week\?\nAnswer: [^\n]*on \d+ of your \d+ sites[^\n]*\[Seen on your visit\]/);
});

test("\"what are you able to do\" gets C's own intro, like \"what can you do\"", async () => {
  const r = await ask("what are you able to do");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /I'm C, PrivaC's privacy guide/);
});

test("everyday first words of company names (Better Commerce, Improve Digital, Index Exchange) aren't read into questions", async () => {
  const history = [{ question: "Why did cnn.com get a D?", answer: "cnn.com got a D: ..." }];
  for (const q of ["How can I make it better?", "How do I improve my grade?", "Is there an index of my trackers?", "Can I trade privacy for free content?"]) {
    const r = await ask(q, history);
    assert.doesNotMatch(factsIn(r.context), /Better Commerce|Improve Digital|Index Exchange|Trade Desk/, q);
  }
  const named = await ask("Is Index Exchange tracking me?");
  assert.match(factsIn(named.context), /^- Index Exchange runs/m, "the full name still counts");
});
