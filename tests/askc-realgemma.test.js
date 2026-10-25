// Ask C on real Gemma (G14 run, 2026-10-25): what the backtest's stand-in for Gemma couldn't show. Gemma made up a
// breach on a follow-up, answered "which site" with a company, and gave two different answers to the same question
// because the earlier questions changed its prompt. Run with: node --test
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

async function ask(question, history, reply = "OK. [Seen on your visit]") {
  let calls = 0, seen = null;
  const r = await A.answer(question, { load: async () => data, lists: async () => lists, atlas: () => atlas, history,
    ask: async (q, o) => { calls++; seen = o; return reply; } });
  return { ...r, calls, context: (seen && seen.context) || "", seen };
}
const factsIn = (context) => ((context.split("Facts about what you asked:\n")[1] || "").split("\n\n")[0]);


test("a follow-up to \"Was LinkedIn hacked?\" can't add a breach the breach list doesn't have", async () => {
  const history = [{ question: "Was LinkedIn hacked?", answer: "LinkedIn (linkedin.com) has 1 data breach on record in Have I Been Pwned [HIBP]: ..." }];
  const gemma = "In May 2012, LinkedIn lost 164.6 million email addresses and passwords. [HIBP] Zara.com also had a data breach recently. [HIBP] " +
    "Zara was hacked too. Wired.com had a breach in November 2025. [HIBP]";
  for (const q of ["yes tell me more", "tell me more", "more please"]) {
    const r = await ask(q, history, gemma);
    assert.match(r.answer, /LinkedIn lost 164\.6 million/, q);
    assert.doesNotMatch(r.answer, /Zara/, q);
    assert.match(r.answer, /Wired\.com had a breach/, "a breach that is on the list stays");
    assert.match(r.context, /For this question: they want more about LinkedIn's breach record/, q);
  }
});

test("breach sentences that say there's no breach, or explain what a breach is, are kept", async () => {
  const gemma = "A data breach is when a company loses your data. [Tracker Radar] Criteo has no breach on record. [HIBP]";
  const r = await ask("What is a data breach and does Criteo have one?", [], gemma);
  assert.strictEqual(r.calls, 0, "Criteo with no breach is answered from the list");
  const g = await ask("What does a data leak mean?", [], gemma);
  assert.match(g.answer, /A data breach is when/);
});

test("\"Which site tracks me the most?\" names a site, in every wording, the same way", async () => {
  for (const q of ["Which site tracks me the most?", "What website tracked me the most?", "Which of my sites has the most trackers?",
    "Which site has the most trackers?", "what site tracks me most", "Most tracked site?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /^cnn\.com tracked you the most: it loaded 5 trackers from 5 companies \(Google, Facebook, Criteo, Amazon\.com and LiveRamp\) \[Seen on your visit\]\./, q);
    assert.match(r.answer, /Next were (espn\.com and wired\.com|wired\.com and espn\.com), with 2 trackers each\./, q);
  }
  const who = await ask("Who tracked me the most?");
  assert.strictEqual(who.calls, 1, "\"who\" asks about a company: Gemma answers from the overview");
});

test("the same standalone question gets the same prompt, whatever was asked before", async () => {
  const fresh = await ask("Who is Meta?");
  for (const history of [[{ question: "Was LinkedIn hacked?", answer: "LinkedIn (linkedin.com) has 1 data breach on record." }],
    [{ question: "Who is Meta?", answer: "Meta runs Facebook's trackers. [Tracker Radar]" }, { question: "Why did cnn.com get a D?", answer: "cnn.com got a D: ..." }]]) {
    const again = await ask("Who is Meta?", history);
    assert.strictEqual(again.context, fresh.context);
  }
  const follow = await ask("Does it fingerprint me?", [{ question: "Who is Criteo?", answer: "Criteo is an ad company. [Tracker Radar]" }]);
  assert.match(follow.context, /Earlier in this conversation/, "a follow-up that names nothing still sees the conversation");
  const andAbout = await ask("And Google?", [{ question: "Does Criteo fingerprint me?", answer: "No. [Tracker Radar]" }]);
  assert.match(andAbout.context, /Earlier in this conversation/, "\"And Google?\" needs the earlier question to know what's asked");
});
