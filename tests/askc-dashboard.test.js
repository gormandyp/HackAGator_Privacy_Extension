// PLAN R19l/m/n (Preston, 2026-10-25, real Gemma): C couldn't say which sites the dashboard's "Recording your screen" and
// "Labelled malware" trackers came from, gave different answers to "which sites I visited had recent data breaches?" (one
// wording was answered about a breach named "Recent" on a site never visited), and answered "How safe are you PrivaC?"
// like a chatbot ("it helps you block trackers": PrivaC doesn't block anything). Questions asking where a dashboard item
// came from are answered from the records, naming every match and what was checked and didn't match; questions about
// PrivaC itself get PrivaC's own answers. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/highlights.js");
require("../shared/askc.js");
const A = window.PrivaCAskC, L = window.PrivaCLists, D = window.PrivaCData, H = window.PrivaCHighlights;
const atlas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "atlas.json"), "utf8"));
const flagged = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "flagged-companies.json"), "utf8"));

const NOW = Date.parse("2026-10-25T12:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString().slice(0, 10);
const T = (domain) => { const a = atlas.domains[domain]; return { domain, company: a[0], category: a[1], country: a[2], fingerprinting: a[4] || 0 }; };
const B = (Name, Title, Domain, BreachDate, AddedDate) => ({ Name, Title, Domain, BreachDate, AddedDate: AddedDate + "T00:00:00Z", PwnCount: 250000, DataClasses: ["Email addresses", "Passwords"] });
const lists = {
  hibp: { fetchedAt: "2026-10-25T08:00:00Z", byDomain: L.compactBreaches([
    B("Zara", "Zara", "zara.com", daysAgo(200), daysAgo(160)),               // reported in the last 12 months
    B("Wired", "WIRED", "wired.com", daysAgo(420), daysAgo(300)),            // happened earlier, reported in the last 12 months
    B("LinkedIn", "LinkedIn", "linkedin.com", "2012-05-05", "2016-05-21"),   // old
    B("Recent", "RecentCorp", "recentcorp.com", daysAgo(100), daysAgo(90)),  // everyday-word names on sites never visited
    B("Verified", "Verified", "verified.cm", daysAgo(50), daysAgo(40))
  ]) },
  brokers: { fetchedAt: "2026-10-25T08:00:00Z", list: [{ name: "Criteo Corp.", dba: "", site: "criteo.com" }] }
};
const cookie = (name, company, category, days) => ({ name, domain: "puffco.com", firstParty: true, category, company, purpose: null, days });
const site = (domain, cookieChoice, trackers, extra) => ({ domain, cookieChoice, lastVisit: "2026-10-25T10:00:00Z", policy: {}, trackers: trackers.map(T), ...extra });
const raw = [
  site("puffco.com", "accepted", ["hotjar.com", "klaviyo.com", "doubleclick.net", "facebook.net", "tiktok.com"],
    { cookies: [cookie("_hjid", "Hotjar", "Analytics", 365), cookie("_hjSessionUser_2207", "Hotjar", "Analytics", 365), cookie("_ga", "Google", "Analytics", 730), cookie("_fbp", "Facebook", "Marketing", 90), cookie("cart", null, "Functional", 14)] }),
  site("weather.com", "none", ["contentsquare.net", "doubleclick.net", "criteo.com", "baidu.com"]),
  site("tass.com", "none", ["yandex.ru", "yadro.ru"], { owner: { company: "TASS", country: "RU", stateMedia: { classification: "SC", updated: "2026-01" } } }),
  site("wired.com", "declined", ["doubleclick.net", "criteo.com", "tiktok.com"]),
  site("zara.com", "no-reject", ["googletagmanager.com"]),
  site("linkedin.com", "declined", ["doubleclick.net"]),
  site("risky.example", "none", ["cdnwidget.com"]),
  site("gov.uk", "declined", []),
  site("github.com", "none", [])
];
function build(listsIn) {
  const data = { sample: false, sites: raw.map((s) => ({ ...s, trackers: s.trackers.map((t) => ({ ...t })) })) };
  L.annotate(data, listsIn, atlas);
  D.annotateListed(data, flagged);
  data.sites = data.sites.map((s) => ({ ...s, ...D.computeScore(s, NOW) }));
  data.lists = { breachesAsOf: listsIn.hibp.fetchedAt, brokersAsOf: listsIn.brokers ? listsIn.brokers.fetchedAt : null };
  return data;
}
const data = build(lists);

async function ask(q, history, more) {
  let calls = 0, seen = null;
  const r = await A.answer(q, { load: async () => data, lists: async () => lists, atlas: () => atlas, history, facts: async () => ({ flagged }), now: NOW,
    ask: async (x, o) => { calls++; seen = o; return "OK. [Seen on your visit]"; }, ...more });
  return { ...r, calls, context: seen ? seen.context : "" };
}
const factsIn = (ctx) => (String(ctx).split("Facts about what you asked:\n")[1] || "").split("\n\n")[0];
const labels = (r) => (r.trace || []).map((t) => t.label);

// ---------- R19l: where each dashboard item came from ----------
test("\"What websites were using the screen recording tracker cookies?\" names every site and company, and the sites without one", async () => {
  const r = await ask("What websites were using the screen recording tracker cookies?");
  assert.strictEqual(r.calls, 0, "answered from the records");
  assert.match(r.answer, /^Recording your screen \(session recording\): 3 tracker addresses on 3 of your 9 sites this week \[Seen on your visit\] \[Tracker Radar\]:/);
  assert.match(r.answer, /^- Hotjar \(hotjar\.com\) on puffco\.com$/m);
  assert.match(r.answer, /^- ContentSquare \(contentsquare\.net\) on weather\.com$/m);
  assert.match(r.answer, /^- Yandex \(yandex\.ru, based in Russia\) on tass\.com$/m);
  assert.match(r.answer, /None of your other 6 sites loaded one\./);
  assert.match(r.answer, /Cookies from these companies on those sites \[Cookie Database\]: _hjid and _hjSessionUser_2207 \(Hotjar\) on puffco\.com\./);
  assert.match(r.answer, /it doesn't prove/);
  assert.deepStrictEqual(labels(r), ["Your browsing", "Tracker Radar", "Cookie Database"]);
});

test("every wording of \"where did the screen recording come from?\" gets the same list", async () => {
  const first = await ask("Where did the screen recording trackers come from?");
  const list = first.answer.split("\n\n")[0];
  for (const q of ["Which sites recorded my screen?", "Did any site record my screen?", "Who recorded my screen?", "Which session recording trackers did I run into?",
    "What do trackers used for \"recording your screen\" do with what they see?", "What is session recording?", "show me the screen recorders", "Is screen recording dangerous?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.strictEqual(r.answer.split("\n\n")[0].replace(/\nCookies from[^\n]*/, ""), list.replace(/\nCookies from[^\n]*/, ""), q);
  }
  const worry = await ask("Is screen recording dangerous?");
  assert.match(worry.answer, /What you can do:\n- /, "a risk question gets steps");
  const plain = await ask("Which sites recorded my screen?");
  assert.doesNotMatch(plain.answer, /What you can do/, "a where question doesn't");
});

test("\"Which trackers were labelled malware and what websites did they originate from?\" names ECO PC on tass.com", async () => {
  for (const q of ["Which trackers were labelled malware and what websites did they originate from?", "Which sites had labeled malware?",
    "Was there malware on any site I visited?", "What is the malware on my dashboard?", "tell me about the labelled malware",
    "What do trackers used for \"labelled malware\" do with what they see?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /^Labelled malware: 1 tracker address on 1 of your 9 sites this week \[Seen on your visit\] \[Tracker Radar\]:\n- ECO PC - Complex Solutions \(yadro\.ru\) on tass\.com\nNone of your other 8 sites loaded one\./, q);
  }
  const hr = await ask("Which sites had high-risk trackers?");
  assert.match(hr.answer, /^- cdnwidget\.com on risky\.example$/m, "a company named after its address isn't written twice");
});

test("the counts are the dashboard's own: every purpose on \"What the trackers were for\" lists the same number of tracker addresses", async () => {
  for (const p of H.aggregate(data.sites).purposes) {
    const r = await ask(`What do trackers used for "${p.label.toLowerCase()}" do with what they see?`);
    assert.strictEqual(r.calls, 0, p.label);
    assert.match(r.answer, new RegExp(`^${p.label.replace(/[()]/g, "\\$&")}[^\\n]*: ${p.n} tracker address${p.n === 1 ? "" : "es"} on \\d+ of your 9 sites`), p.label);
  }
});

test("a site or a company in the question narrows the list, and says so when it had none", async () => {
  const on = await ask("Did puffco.com record my screen?");
  assert.strictEqual(on.calls, 0);
  assert.match(on.answer, /^- Hotjar \(hotjar\.com\) on puffco\.com$/m);
  assert.doesNotMatch(on.answer, /ContentSquare/);
  const none = await ask("Did github.com record my screen?");
  assert.match(none.answer, /^github\.com loaded no tracker that Tracker Radar labels as session recording \("recording your screen"\) \[Seen on your visit\] \[Tracker Radar\]\./);
  for (const q of ["Where did Hotjar record my screen?", "Which sites did Hotjar record me on?"]) {
    const co = await ask(q);
    assert.strictEqual(co.calls, 0, q);
    assert.match(co.answer, /^- Hotjar \(hotjar\.com\) on puffco\.com$/m, q);
    assert.doesNotMatch(co.answer, /ContentSquare/, q);
  }
});

test("nothing found is said plainly, with how many sites were checked", async () => {
  const clean = { sites: data.sites.filter((s) => s.domain !== "tass.com") };
  const r = await ask("Which sites had malware?", null, { load: async () => clean });
  assert.match(r.answer, /^None of your 8 sites this week loaded a tracker that Tracker Radar labels as malware \("labelled malware"\) \[Seen on your visit\] \[Tracker Radar\]\./);
  // With nothing found there's no "on those sites" advice and no "a tracker loading means..." (backtest, Oct 25).
  const worry = await ask("Is there malware on my sites, and should I worry?", null, { load: async () => clean });
  assert.match(worry.answer, /^None of your 8 sites/);
  assert.match(worry.answer, /Tracker Radar gives the malware label to addresses linked to harmful software/);
  assert.doesNotMatch(worry.answer, /What you can do|those sites|A tracker loading means/);
  const hidden = await ask("Which sites had \"Hidden owner\" trackers?");
  assert.match(hidden.answer, /labels as having a hidden owner \[Seen on your visit\]/, "the label isn't repeated in brackets");
  assert.match(hidden.answer, /Tracker Radar uses this label when it can't find out who owns a tracker\./);
});

test("registered data brokers: who, under which registered name, and on which sites; no registry means C says it can't tell", async () => {
  const r = await ask("Which data brokers have seen me?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^Data brokers: 1 tracker address on 2 of your 9 sites this week \[Seen on your visit\] \[CA Broker Registry\]:\n- Criteo \(criteo\.com\), registered as "Criteo Corp\.", on weather\.com and wired\.com$/m);
  assert.ok(labels(r).includes("CA Broker Registry"));
  const noRegistry = { hibp: lists.hibp };
  const n = await ask("Which data brokers have seen me?", null, { load: async () => build(noRegistry), lists: async () => noRegistry });
  assert.match(n.answer, /hasn't downloaded California's Data Broker Registry yet/);
});

test("which sites fingerprinted me: the same companies as the dashboard's fingerprinting fact, with their sites", async () => {
  const r = await ask("Which sites fingerprinted me?");
  assert.strictEqual(r.calls, 0);
  const fp = H.aggregate(data.sites).companies.filter((c) => c.fingerprinting >= 2);
  assert.match(r.answer, new RegExp(`^Device fingerprinting: ${fp.length} companies on \\d+ of your 9 sites this week \\[Seen on your visit\\] \\[Tracker Radar\\]:`));
  for (const c of fp) assert.match(r.answer, new RegExp(`^- ${c.name.replace(/[.()]/g, "\\$&")} \\(`, "m"), c.name);
  assert.match(r.answer, /^- Hotjar \(hotjar\.com\) on puffco\.com$/m);
  assert.match(r.answer, /Clearing cookies doesn't stop it/);
});

test("other questions about these purposes go to Gemma with the full list as facts, after any follow-up facts", async () => {
  const r = await ask("Can malware steal my passwords?");
  assert.strictEqual(r.calls, 1);
  assert.match(factsIn(r.context), /^- Labelled malware on your sites \[Seen on your visit\] \[Tracker Radar\]: ECO PC - Complex Solutions \(yadro\.ru\) on tass\.com; none on your other 8 sites$/m);
  const fp = await ask("What is fingerprinting?");
  assert.match(factsIn(fp.context), /^- Device fingerprinting on your sites \[Seen on your visit\] \[Tracker Radar\]: [^\n]*Hotjar \(hotjar\.com\) on puffco\.com/m);
  const follow = await ask("Does it fingerprint me?", [{ question: "Who is Criteo?", answer: "Criteo is an ad company. [Tracker Radar]" }]);
  assert.match(factsIn(follow.context), /^- Criteo runs/m, "the follow-up keeps Criteo's facts");
});

test("questions that don't ask about a dashboard item get exactly the evidence they got before", async () => {
  for (const q of ["Who is Criteo?", "What is a tracker?", "How do I block trackers?", "Why do I see so many ads?", "Who tracked me the most?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
    assert.doesNotMatch(factsIn(r.context), /on your sites \[Seen on your visit\]/, q);
  }
});

// ---------- R19m: data breaches on the sites you visited ----------
test("\"What sites have I been to that have had recent data breaches?\": the recent ones, the older ones, and the rest", async () => {
  const r = await ask("What sites have I been to that have had recent data breaches?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^2 of the 9 sites you visited in the last 7 days had a data breach reported in the last 12 months, in Have I Been Pwned's list \(updated Oct 25, 2026\) \[HIBP\]:\n- zara\.com: [^\n]*Zara: 250 thousand accounts; exposed email addresses, passwords \(added [A-Z][a-z]{2} \d+, 2026\)\.\n- wired\.com: [^\n]*WIRED/);
  assert.match(r.answer, /Older breaches on record for sites you visited: linkedin\.com \(May 2012, LinkedIn\)\./);
  assert.match(r.answer, /The other 6 sites you visited have no breach on record\./);
  assert.match(r.answer, /the same rule as PrivaC's grade and alerts/);
  assert.doesNotMatch(r.answer, /RecentCorp|Verified/, "breaches whose names are everyday words aren't read into the question");
  assert.deepStrictEqual(labels(r), ["Have I Been Pwned"]);
});

test("every wording of \"recent breaches on my sites\" gets the same answer", async () => {
  const first = (await ask("What sites have I been to that have had recent data breaches?")).answer;
  for (const q of ["Which of my sites had a breach recently?", "Have any sites I visited been hacked lately?", "Any recent breaches on sites I've been to?",
    "Which websites I visited had data breaches in the last year?", "Did any of the sites I use get breached this year?", "Were any of my sites in a recent data breach?",
    "Which verified breaches hit sites I visited recently?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.strictEqual(r.answer, first, q);
  }
});

test("\"Did any site I visit get hacked?\" lists every breached site, marks the recent ones, and says how many had none", async () => {
  const r = await ask("Did any site I visit get hacked?");
  assert.match(r.answer, /^3 of the 9 sites you visited in the last 7 days are in Have I Been Pwned's list/);
  assert.match(r.answer, /^- zara\.com \(reported in the last 12 months\): /m);
  assert.match(r.answer, /^- linkedin\.com: May 2012, LinkedIn/m);
  assert.match(r.answer, /The other 6 sites you visited have no breach on record\./);
  const none = await ask("What sites have I been to that have had recent data breaches?", null, { load: async () => ({ sites: data.sites.filter((s) => !["zara.com", "wired.com"].includes(s.domain)) }) });
  assert.match(none.answer, /^None of the 7 sites you visited in the last 7 days had a data breach reported in the last 12 months/);
  assert.match(none.answer, /Older breaches on record for sites you visited: linkedin\.com \(May 2012, LinkedIn\)\./);
});

// ---------- R19n: questions about PrivaC itself ----------
test("\"How safe are you PrivaC?\" gets PrivaC's own answer: on this computer, what it keeps, its permissions, and that it blocks nothing", async () => {
  for (const q of ["How safe are you PrivaC?", "Is PrivaC safe?", "Is this extension safe?", "Can I trust PrivaC?", "Can I trust you?", "Is it safe to use PrivaC?",
    "Is my data safe with you?", "Are you safe?", "How secure is PrivaC?", "What permissions does PrivaC need?", "Why does PrivaC need to read all my websites?", "Is PrivaC spyware?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /on this computer/, q);
    assert.match(r.answer, /no servers/);
    assert.match(r.answer, /never reads your passwords/);
    assert.match(r.answer, /"Read and change all your data on all websites"/);
    assert.match(r.answer, /doesn't block trackers or ads/);
    assert.doesNotMatch(r.answer, /helps you (?:manage cookies and )?block/i);
  }
});

test("\"What can you do?\", \"What is PrivaC?\", \"How do you work?\": what PrivaC does, what C can do, and how", async () => {
  for (const q of ["What can you do?", "What is PrivaC?", "What does PrivaC do?", "What are your features?", "What else can you do?", "What can PrivaC do for me?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /^I'm C, PrivaC's privacy guide/, q);
    for (const fact of [/A to F/, /"Protect me"/, /"Beware!"/, /foreign-adversary/, /"Clear/, /dashboard/, /doesn't block trackers or ads/, /Gemma 4/]) assert.match(r.answer, fact, `${q}: ${fact}`);
  }
  for (const q of ["How do you work?", "How does PrivaC work?", "how does this extension work", "How do you decide a grade?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    for (const fact of [/Tracker Radar/, /Have I Been Pwned/, /exposure score/, /Gemma 4/, /on this computer/]) assert.match(r.answer, fact, `${q}: ${fact}`);
  }
});

test("questions about one feature, or about a site, still go to Gemma with PrivaC's facts", async () => {
  // Feature questions keep the Oct 25 decision (tests/askc-oct25.test.js): Gemma answers them from PrivaC's facts.
  for (const q of ["Does PrivaC block ads?", "Why should I trust your grade?", "What happens when I click Protect me?", "Are you able to block trackers on cnn.com?",
    "What can you do about trackers on cnn.com?", "Is it safe to accept cookies?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
  }
});
