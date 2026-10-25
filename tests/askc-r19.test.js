// PLAN R19g/h/i/k (Max, real Gemma on the demo Mac, 2026-10-24 9-9:30 PM): "tik tok" and "you tube" weren't recognized,
// "Is YouTube safe?" ignored YouTube's grade, "Is FaceBook safe?" made up a breach history, "Check the ive been pwned list"
// lost the subject, and C said "no record" of the malware tracker the dashboard shows. Run with: node --test
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
const A = window.PrivaCAskC, L = window.PrivaCLists;
const atlas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "atlas.json"), "utf8"));

const mk = (Name, Domain, BreachDate, PwnCount, DataClasses) => ({ Name, Title: Name, Domain, BreachDate, AddedDate: BreachDate + "T00:00:00Z", PwnCount, DataClasses });
const lists = { hibp: { fetchedAt: "2026-10-24T08:00:00Z", byDomain: L.compactBreaches([
  mk("LinkedIn", "linkedin.com", "2012-05-05", 164611595, ["Email addresses", "Passwords"]),
  mk("Wired", "wired.com", "2025-11-01", 2300000, ["Email addresses", "Names"])]) } };
const T = (company, category, country, domain, extra) => ({ company, category, country, domain, ...extra });
const site = (domain, trackers, extra) => ({ domain, lastVisit: "2026-10-24", cookieChoice: "accepted", policy: {}, trackers, ...extra });
const ads = (i) => [T("Google", "Advertising", "US", "doubleclick.net"), T("Facebook", "Advertising", "US", "facebook.net"), T(`AdCo${i}`, "Advertising", "US", `adco${i}.com`)];
const sites = [
  site("youtube.com", [T("Google", "Advertising", "US", "doubleclick.net"), T("Google", "Analytics", "US", "google-analytics.com")], { cookieChoice: "none" }),
  site("cnn.com", [...ads(0), T("ByteDance", "Tracking", "CN", "bytegoofy.com")]),
  site("tass.com", [T("Yandex", "Analytics", "RU", "mc.yandex.ru"), T("ECO PC - Complex Solutions", "Malware", null, "yadro.ru")]),
  ...Array.from({ length: 30 }, (_, i) => site(`site${i}.com`, ads(i + 1)))
].map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) }));
const data = { sites };

async function ask(q, history, gemmaSays = "OK. [Seen on your visit]") {
  let calls = 0, seen = null;
  const r = await A.answer(q, { load: async () => data, lists: async () => lists, atlas: () => atlas, history,
    ask: async (x, o) => { calls++; seen = { q: x, ...o }; return gemmaSays; } });
  return { ...r, calls, seen };
}

// ---------- R19g / R19i.1: names typed with a space or a small typo ----------
test("\"tik tok\", \"you tube\", \"linkdin\", \"face book\", \"what's app\" are recognized like the one-word names", async () => {
  const tt = await ask("Has tik tok had any data breaches recently?");
  assert.strictEqual(tt.calls, 0, "answered from the breach list, not Gemma");
  assert.match(tt.answer, /no breach on record for TikTok \(owned by ByteDance\) \[HIBP\]/);
  assert.deepStrictEqual(tt.trace.map((t) => t.label), ["Have I Been Pwned"]);
  const li = await ask("was linkdin hacked");
  assert.match(li.answer, /LinkedIn \(linkedin\.com\) has 1 data breach on record/);
  const fb = await ask("was face book hacked");
  assert.match(fb.answer, /no breach on record for Facebook/);
  const wa = await ask("Was what's app ever breached?");
  assert.match(wa.answer, /no breach on record for WhatsApp \(owned by Facebook\)/);
  const yt = await ask("Is you tube safe?");
  assert.strictEqual(yt.calls, 0);
  assert.match(yt.answer, /youtube\.com/);
});

test("ordinary words never turn into company names", async () => {
  for (const q of ["Was my crypto exchange hacked?", "Is it safe to accept cookies?", "Should I trust trackers?", "Is my space safe to use?",
    "Is the website I visit safe?", "Was my school breached?", "Are cookies dangerous?", "Is it okay to use public wifi?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, `${q} -> ${r.answer}`);
  }
  const mine = await ask("Did any site I visited get hacked?");
  assert.match(mine.answer, /sites you visited in the last 7 days/, "your own sites, as before");
});

test("\"Check the ive been pwned list\" right after a breach question checks the same company", async () => {
  const history = [{ question: "Has tik tok had any data breaches recently?", answer: "PrivaC has no record of any recent data breaches for TikTok." }];
  for (const q of ["Check the ive been pwned list", "check HIBP", "look it up on have i been pwned"]) {
    const r = await ask(q, history);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /no breach on record for TikTok \(owned by ByteDance\)/, q);
  }
});

// ---------- R19h: "Is X safe?" from PrivaC's own records ----------
test("\"Is X safe?\" about a site you visited: its grade, what added points, breach record, owner, never a verdict", async () => {
  for (const q of ["Is YouTube safe?", "Is you tube safe?", "is youtube.com safe", "Is YouTube trustworthy?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /^youtube\.com got an? [A-F] from PrivaC: an exposure score of \d+ out of 100/, q);
    assert.match(r.answer, /What added points:|Nothing added points/);
    assert.match(r.answer, /YouTube is owned by Google/);
    assert.match(r.answer, /no breach on record for youtube\.com/);
    assert.match(r.answer, /PrivaC grades how much of your data a site exposes; it doesn't check the site for malware or scams/);
    assert.doesNotMatch(r.answer, /\bis (?:safe|unsafe)\b/i);
    assert.match(r.answer, /What you can do:/);
    assert.ok(r.trace.some((t) => t.label === "Your browsing") && r.trace.some((t) => t.label === "Have I Been Pwned"));
  }
  const cnn = await ask("Should I trust cnn?");
  assert.match(cnn.answer, /^cnn\.com got an? [A-F] from PrivaC/);
  assert.match(cnn.answer, /ByteDance \(China\)/, "foreign-adversary link named");
  const tass = await ask("Is tass.com safe?");
  assert.match(tass.answer, /ECO PC - Complex Solutions[^\n]*labels? (?:it )?as malware/i, "malware tracker named");
});

test("\"Is X safe?\" about a tracker company (not a site you visited): what PrivaC saw and its breach record", async () => {
  for (const [q, label] of [["Is FaceBook safe?", "Facebook"], ["Is Meta safe?", "Meta \\(Tracker Radar lists it as Facebook\\)"]]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, new RegExp(`^PrivaC saw trackers from ${label} on \\d+ of your 33 sites`), q);
    assert.match(r.answer, /no breach on record for (?:Facebook|Meta)/);
    assert.doesNotMatch(r.answer, /history of data breaches|United States, you should/);
  }
});

// ---------- R19i.2: cite-and-check on Gemma's answers ----------
test("a sentence naming a company or site that isn't in C's evidence is dropped; steps are left alone", async () => {
  const r = await ask("Who follows me the most, and should I worry?", null,
    "Google follows you on many sites. [Seen on your visit] Zeta Global also tracks you everywhere. Taboola buys your data from shops.\n\n" +
    "What you can do: In Chrome, Settings > Privacy and security > Third-party cookies > Block third-party cookies.");
  assert.match(r.answer, /Google follows you on many sites/);
  assert.doesNotMatch(r.answer, /Zeta Global|Taboola/);
  assert.match(r.answer, /In Chrome, Settings/);
  const none = await ask("Who follows me the most?", null, "Zeta Global tracks you everywhere.");
  assert.match(none.answer, /PrivaC has no record of that/);
});

test("Gemma's rules: a company's home country is a concern only on the foreign-adversary list", () => {
  assert.match(A.SYSTEM_PROMPT, /home country is a concern only if it's on the foreign-adversary list/i);
});

// ---------- R19k: Ask C sees the same tracker purposes as the dashboard ----------
test("Ask C's evidence lists every tracker purpose with the dashboard's counts; malware is never cut", async () => {
  const r = await ask("Which trackers were labelled malware and what websites did they originate from?");
  const c = r.seen.context;
  assert.match(c, /What the trackers were for \(tracker addresses, same as the dashboard\)/);
  assert.match(c, /Labelled malware 1: ECO PC - Complex Solutions on tass\.com/);
  const agg = window.PrivaCHighlights.aggregate(sites);
  for (const p of agg.purposes) assert.match(c, new RegExp(`${p.label} ${p.n}:`), p.label);
});

test("Ask C's tracker purposes use the same names as the dashboard (shared/highlights.js)", () => {
  assert.deepStrictEqual(A.PURPOSE, window.PrivaCHighlights.PURPOSE);
});

test("cite-and-check keeps a true sentence that mentions a country, and keeps each source tag with its sentence", async () => {
  // "Who is Facebook?" goes to Gemma ("... and should I worry?" is answered from the records since Oct 25, tests/askc-oct25.test.js).
  const r = await ask("Who is Facebook?", null,
    "Facebook is an advertising company based in the United States. [Tracker Radar] Its trackers were on 31 of your sites. [Seen on your visit] Cloudflare also runs part of the web.");
  assert.match(r.answer, /^Facebook is an advertising company based in the United States\. \[Tracker Radar\] Its trackers were on 31 of your sites\./);
  assert.doesNotMatch(r.answer, /Cloudflare/);
  assert.doesNotMatch(r.answer, /^\[/, "no tag left at the start");
});

test("everyday words that are also company names (block, news, booking) don't pull in companies; the capitalised name still does", () => {
  const f = (q) => A.lookupFacts(q, null, atlas).join("\n");
  assert.doesNotMatch(f("How do I block trackers?"), /Block, Inc/);
  assert.doesNotMatch(f("What news sites track me most?"), /^- News/m);
  assert.match(f("Who is Oracle?"), /Oracle/);
});
