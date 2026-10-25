// Overnight backtest (2026-10-25: 60 judge-style questions through the real shared/askc.js with a stand-in Gemma).
// A short new question carried the last question's company facts ("Who owns zara.com?" got Baidu's), C told people to
// let him decline cookies on sites with no banner or no reject option, "Is wired.com safe?" named the same
// foreign-adversary companies twice, and Gemma had no facts about PrivaC itself: what "Protect me" does, that PrivaC
// doesn't block ads, what "Partly checked" means, or what C did this week (the dashboard's own suggested questions).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/stats.js");
require("../shared/askc.js");
const A = window.PrivaCAskC, L = window.PrivaCLists, S = window.PrivaCStats;
const atlas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "atlas.json"), "utf8"));
const flagged = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "flagged-companies.json"), "utf8"));

const B = (Name, Domain, BreachDate, AddedDate) => ({ Name, Title: Name, Domain, BreachDate, AddedDate: AddedDate + "T00:00:00Z", PwnCount: 1000000, DataClasses: ["Email addresses"] });
const lists = { hibp: { fetchedAt: "2026-10-25T04:00:00Z", byDomain: L.compactBreaches([
  B("Wired", "wired.com", "2025-11-01", "2025-12-20"),
  B("LinkedIn", "linkedin.com", "2012-05-05", "2016-05-21"),
  B("Adobe", "adobe.com", "2013-10-04", "2013-12-04"),
  B("Canva", "canva.com", "2019-05-24", "2019-06-06"),
  B("Dropbox", "dropbox.com", "2012-07-01", "2016-08-31")]) } };
const T = (company, category, country, domain) => ({ company, category, country, domain });
const site = (domain, cookieChoice, trackers, extra) => ({ domain, cookieChoice, lastVisit: "2026-10-25T05:00:00Z", policy: {}, trackers, ...extra });
const sites = [
  site("cnn.com", "no-reject", [T("Google", "Advertising", "US", "doubleclick.net"), T("Facebook", "Advertising", "US", "facebook.net")]),
  site("wired.com", "none", [T("Google", "Advertising", "US", "doubleclick.net"), T("ByteDance", "Tracking", "CN", "tiktok.com"), T("Baidu", "Tracking", "CN", "baidu.com")]),
  site("marksandspencer.com", "accepted", [T("Criteo", "Advertising", "FR", "criteo.com"), T("Google", "Advertising", "US", "doubleclick.net")]),
  site("gov.uk", "declined", []),
  site("zara.com", "none", [T("Google", "Advertising", "US", "googletagmanager.com")]),
  site("baidu.com", "none", [T("Baidu", "Tracking", "CN", "baidu.com")], { owner: { company: "Baidu", country: "CN" } }),
  site("tass.com", "none", [T("Yandex", "Analytics", "RU", "yandex.ru")], { owner: { company: "TASS", country: "RU", stateMedia: { classification: "SC", updated: "2026-01" } } })
].map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) }));
const data = { sites };

async function ask(q, history, more) {
  let calls = 0, seen = null;
  const r = await A.answer(q, { load: async () => data, lists: async () => lists, atlas: () => atlas, history, facts: async () => ({ flagged }),
    ask: async (x, o) => { calls++; seen = o; return "OK. [Seen on your visit]"; }, ...more });
  return { ...r, calls, context: seen ? seen.context : "" };
}
const factsIn = (ctx) => (String(ctx).split("Facts about what you asked:\n")[1] || "").split("\n\n")[0];

// ---------- a new question doesn't inherit the last question's company ----------
test("a short new question with its own subject doesn't get the last question's company facts", async () => {
  const cases = [
    ["Who owns zara.com?", "Why is baidu.com flagged?", /Baidu/],
    ["What is fingerprinting?", "Who is Criteo?", /Criteo/],
    ["Can you block trackers?", "Is TikTok sending my data to China?", /ByteDance/],
    ["What is a cookie?", "Who is Criteo?", /Criteo/]
  ];
  for (const [q, before, wrong] of cases) {
    const r = await ask(q, [{ question: before, answer: "Earlier answer. [Tracker Radar]" }]);
    assert.strictEqual(r.calls, 1, q);
    assert.doesNotMatch(factsIn(r.context), wrong, `${q} (after "${before}")`);
  }
});

test("real follow-ups still keep the company: \"Should I worry?\", \"Does it fingerprint me?\", \"tell me more\"", async () => {
  const history = [{ question: "Who is Criteo?", answer: "Criteo is an advertising company based in France. [Tracker Radar]" }];
  for (const q of ["Should I worry?", "Does it fingerprint me?", "tell me more", "How bad is that?"]) {
    const r = await ask(q, history);
    assert.match(factsIn(r.context), /^- Criteo runs/m, q);
  }
});

test("a topic question is answered the same way whatever was asked before it", async () => {
  const fresh = await ask("What is fingerprinting?");
  const after = await ask("What is fingerprinting?", [{ question: "Who is Criteo?", answer: "Criteo is an ad company. [Tracker Radar]" }]);
  assert.strictEqual(after.context, fresh.context);
});

// ---------- advice that fits the site's own cookie banner ----------
const stepsOf = (text) => (String(text).split("What you can do:")[1] || "");

test("no reject option or no banner: C doesn't offer to decline; the site's data can be cleared from PrivaC's pop-up instead", async () => {
  for (const q of ["Should I trust cnn?", "Is wired.com safe?", "Is tass.com safe?", "Is zara.com safe?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.doesNotMatch(stepsOf(r.answer), /let C decline|Protect me/i, q);
    assert.match(stepsOf(r.answer), /Clear [a-z.]+'s data/, q);
  }
});

test("all cookies accepted: clearing the site's data lets its banner ask again", async () => {
  const r = await ask("Is marksandspencer.com safe?");
  assert.match(stepsOf(r.answer), /Clear marksandspencer\.com's data[^\n]*asks again/);
});

test("Gemma reads the cookie banner in plain words, never as a code like \"no-reject\"", async () => {
  const r = await ask("What can I do about trackers on cnn.com?");
  assert.match(r.context, /- cnn\.com, visited [^\n]*cookie banner: had no reject option/);
  assert.match(r.context, /- wired\.com, visited [^\n]*cookie banner: none seen/);
  assert.doesNotMatch(r.context, /cookies (no-reject|none|accepted|declined) \[/);
  assert.match(r.context, /cookie banner has a reject option/, "the steps say when C can decline");
});

// ---------- no repeated names in "Is X safe?" ----------
test("\"Is wired.com safe?\" names its foreign-adversary links once", async () => {
  const r = await ask("Is wired.com safe?");
  const body = r.answer.split("What you can do:")[0];
  assert.strictEqual((body.match(/ByteDance/g) || []).length, 1, body);
  assert.match(body, /Baidu[^\n]*1260H/, "the 1260H listing is still said");
});

test("\"Is tass.com safe?\" says it's state-run media once and still names the Russian tracker", async () => {
  const r = await ask("Is tass.com safe?");
  const body = r.answer.split("What you can do:")[0];
  assert.strictEqual((body.match(/TASS/g) || []).length, 1, body);
  assert.match(body, /Yandex \(Russia\)/);
});

// ---------- facts about PrivaC itself ----------
test("questions about C's own features get PrivaC's facts: Protect me, Beware, alerts, warnings, clearing, Partly checked, blocking", async () => {
  const cases = [
    ["What does C's offer to decline cookies do, and what happens when I say yes?", /consent record/],
    ["How does C check that a site really accepted my 'decline'?", /consent record/],
    ["Why does C warn me about cookie banners that only have an Accept button?", /only an Accept button/],
    ["What is a foreign-adversary alert, and what should I do when C shows one?", /Foreign-adversary alert/],
    ["Why does C warn me before I stay on some sites graded F?", /Go back/],
    ["what does partly checked mean?", /"Partly checked" means/],
    ["Does PrivaC block ads?", /doesn't block trackers or ads/],
    ["Can you block trackers?", /doesn't block trackers or ads/],
    ["What happens when I click Protect me?", /consent record/],
    ["Why should I trust your grade?", /PrivaC's own rubric/]
  ];
  for (const [q, fact] of cases) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
    assert.match(r.context, fact, q);
  }
  const other = await ask("Who is Criteo?");
  assert.doesNotMatch(other.context, /About PrivaC itself/, "left out when the question isn't about PrivaC");
});

test("\"What did C do for me this week?\" gets the same numbers as the dashboard's C's impact", async () => {
  const stats = S.addEvents(null, { "popup-cookie": 4, "popup-accept-only": 2, "popup-adversary": 1, "decline-click": 3, "decline-confirmed": 2, "accepted-on-site": 1 });
  const r = await ask("What did C do for me this week?", [], { stats: async () => stats });
  assert.match(r.context, /What C did for you in the last 7 days[^\n]*C stepped in 7 times/);
  assert.match(r.context, /4 offers to decline cookies, 2 warnings about banners with no reject option, 1 foreign-adversary alert, 0 unsafe-site warnings/);
  assert.match(r.context, /declined cookies for you 3 times[^\n]*confirmed 2/);
  const none = await ask("What did C do for me this week?", [], { stats: async () => null });
  assert.match(none.context, /C hasn't shown any pop-ups in the last 7 days/);
  const unrelated = await ask("Who is Criteo?", [], { stats: async () => stats });
  assert.doesNotMatch(unrelated.context, /What C did for you/);
});

// ---------- "How many breaches go unnoticed?" (a guiding question) ----------
test("how long breaches stay unknown: a figure worked out from Have I Been Pwned's own list, with its tag", async () => {
  const r = await ask("How many data breaches happen without people knowing?");
  assert.match(factsIn(r.context), /Have I Been Pwned's list[^\n]*5 breaches[^\n]*half[^\n]*at least 2 months after[^\n]*\[HIBP\]/);
  assert.match(factsIn(r.context), /2 of the 5 \(40%\) more than a year later/);
  assert.match(factsIn(r.context), /can't count breaches nobody has found yet/);
  const other = await ask("Who is Criteo?");
  assert.doesNotMatch(factsIn(other.context), /half/);
});

// ---------- G14, real Gemma 4 E2B in Chrome (2026-10-25) ----------
test("\"Who is ByteDance?\": the evidence says plainly it isn't on the 1260H list, and a sentence saying it is gets taken out", async () => {
  const r = await ask("Who is ByteDance?");
  assert.match(factsIn(r.context), /ByteDance \(TikTok\) is not on the Pentagon's Section 1260H list/);
  let said = null;
  const reply = "ByteDance is a company based in China [Tracker Radar]. ByteDance is also listed on the Pentagon's Section 1260H list of Chinese military companies [Government list].";
  const out = await A.answer("Who is ByteDance?", { load: async () => data, lists: async () => lists, atlas: () => atlas, history: [], facts: async () => ({ flagged }),
    ask: async (x, o) => { said = o; return reply; } });
  assert.ok(said);
  assert.strictEqual(out.answer, "ByteDance is a company based in China [Tracker Radar].");
  const tt = await ask("Is TikTok sending my data to China?");
  assert.match(factsIn(tt.context), /ByteDance \(TikTok\) is not on the Pentagon's Section 1260H list/);
  const baidu = await ask("Who is Baidu?");
  assert.match(factsIn(baidu.context), /Baidu is on the Pentagon's Section 1260H list/);
});

test("\"Does my browsing leave my computer?\" gets C's own answer: no, and what PrivaC does download", async () => {
  for (const q of ["Does my browsing leave my computer?", "Does PrivaC track me?", "Can C see my passwords?", "Does my data leave this computer?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, q);
    assert.match(r.answer, /^No\. What PrivaC learns about your browsing stays on this computer/, q);
    assert.match(r.answer, /never reads your passwords/);
    assert.match(r.answer, /whole public lists/);
  }
  assert.strictEqual((await ask("Does wired.com send my data to Google?")).calls, 1, "a question about a site's trackers still goes to Gemma");
});

// G14, Oct 25 (Q9 "Is wired.com safe?"): "CDNWIDGET.COM (cdnwidget.com): Tracker Radar labels it as high-risk". The atlas now
// writes that company in lower case; a company named after its own web address isn't written twice.
test("a high-risk company named after its web address isn't repeated in brackets", async () => {
  const s = { domain: "risky.example", cookieChoice: "none", lastVisit: "2026-10-25T05:00:00Z", policy: {}, trackers: [T("cdnwidget.com", "High-risk", null, "cdnwidget.com"), T("Shady Ads", "Malware", null, "shady.example")] };
  const r = await A.answer("Is risky.example safe?", { load: async () => ({ sites: [{ ...s, ...window.PrivaCData.computeScore(s) }] }), lists: async () => null, atlas: () => atlas, ask: async () => "unused" });
  assert.match(r.answer, /cdnwidget\.com: Tracker Radar labels it as high-risk; Shady Ads \(shady\.example\): Tracker Radar labels it as malware/);
  assert.doesNotMatch(r.answer, /cdnwidget\.com \(cdnwidget\.com\)/);
});

// G14 real-Gemma run, Oct 25 (Q24): "why?" right after "Should I trust cnn?" went to Gemma, which made up "You also accepted
// all cookies on some sites" and gave the person cnn's grade. A bare "why?" right after a question about one site's safety or
// grade is answered from that site's own score lines instead.
test("a bare \"why?\" after \"Should I trust cnn?\" explains cnn.com's grade from its score lines", async () => {
  for (const why of ["why?", "Why", "how come?", "why is that?"]) {
    const r = await ask(why, [{ question: "Should I trust cnn?", answer: "cnn.com got a C from PrivaC... [Seen on your visit]" }]);
    assert.strictEqual(r.calls, 0, why);
    assert.match(r.answer, /^cnn\.com got an? [A-F]: an exposure score of \d+ out of 100/, why);
    assert.match(r.answer, /What added points:/, why);
  }
  const g = await ask("why?", [{ question: "Why did wired.com get an F?", answer: "wired.com got an F... [Seen on your visit]" }]);
  assert.match(g.answer, /^wired\.com got an? [A-F]:/);
  // The G14's exact order: "why?" came right after "What can I do about trackers on cnn.com?".
  const t = await ask("why?", [{ question: "What can I do about trackers on cnn.com?", answer: "You can ... [Seen on your visit]" }]);
  assert.strictEqual(t.calls, 0);
  assert.match(t.answer, /^cnn\.com got an? [A-F]:/);
});

test("\"why?\" after other questions still goes to Gemma with the conversation", async () => {
  for (const before of ["Was linkedin.com hacked?", "Who is Criteo?", "What is fingerprinting?", "Does wired.com sell my data?", "Was wired.com breached?"]) {
    const r = await ask("why?", [{ question: before, answer: "Earlier answer. [Tracker Radar]" }]);
    assert.strictEqual(r.calls, 1, before);
  }
});

// G14 Q25: "and espn?" after "why?" (after "Should I trust cnn?") went to Gemma. "and <site>?" after a site's safety question,
// a grade question or a bare "why?" gets that site's grade lines, like after a grade question.
test("\"and espn?\" after a safety question or a bare \"why?\" gets that site's grade lines", async () => {
  for (const history of [
    [{ question: "Should I trust cnn?", answer: "cnn.com got a C... [Seen on your visit]" }],
    [{ question: "Should I trust cnn?", answer: "cnn.com got a C... [Seen on your visit]" }, { question: "why?", answer: "cnn.com got a C... [Seen on your visit]" }]
  ]) {
    const r = await ask("and wired?", history);
    assert.strictEqual(r.calls, 0, history.map((h) => h.question).join(" / "));
    assert.match(r.answer, /^wired\.com got an? [A-F]:/);
  }
});

// "Who is Google and should I worry?" is the dashboard's second suggestion (dashboard/ask-c.js). Real Gemma (G14, Oct 25)
// answered "Because of its size, it is involved in advertising and data brokering [Tracker Radar]": Google isn't a
// registered data broker, and Tracker Radar doesn't say so. It's answered from the records now, like "Is Meta safe?".
test("\"Who is Google and should I worry?\" is answered from the records: who it is, where it was seen, no made-up broker claim", async () => {
  const r = await ask("Who is Google and should I worry?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^Google runs \d+ tracker domains, the biggest on about [\d.]+% of popular websites; based in the United States \[Tracker Radar\]\./);
  assert.match(r.answer, /PrivaC saw trackers from Google on 4 of your 7 sites this week/);
  assert.match(r.answer, /could see your IP address[^\n]*it doesn't prove your data was sold\./);
  assert.match(r.answer, /no breach on record for Google \[HIBP\]/);
  assert.doesNotMatch(r.answer, /data brok/i);
  assert.match(r.answer, /What you can do:/);
});

test("\"Who is Criteo and should I worry?\": a registered California data broker says so, with the registry's name", async () => {
  const withBrokers = { ...lists, brokers: { list: [{ name: "Criteo Corp.", site: "criteo.com" }] } };
  const r = await ask("Who is Criteo and should I worry?", null, { lists: async () => withBrokers });
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^Criteo runs \d+ tracker domains?, the biggest on about [\d.]+% of popular websites; based in France \[Tracker Radar\]\./);
  assert.match(r.answer, /Criteo is registered as a data broker in California \(as "Criteo Corp\."\) \[CA Broker Registry\]/);
  assert.ok(r.trace.some((t) => t.label === "CA Broker Registry"));
});

test("other \"should I worry\" questions still go to Gemma: a follow-up, no company named, a tracker on a site", async () => {
  for (const q of ["Should I worry?", "Who is tracking me the most, and should I worry?", "What does Criteo (criteo.com) do on cnn.com, and should I worry?"]) {
    const r = await ask(q, [{ question: "Who is Criteo?", answer: "Criteo is an advertising company based in France. [Tracker Radar]" }]);
    assert.strictEqual(r.calls, 1, q);
  }
});
