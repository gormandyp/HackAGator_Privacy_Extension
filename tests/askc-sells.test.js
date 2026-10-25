// "Does wired.com sell my data?" (G14 real-Gemma run, Oct 25, Q3): Gemma answered "Yes, wired.com has a privacy policy that
// says they sell personal information [Privacy policy]", but PrivaC had never read wired.com's policy. A question about
// whether a site you visited sells or shares your data is now answered instantly from the site's own policy record:
// its quoted sentence when PrivaC read one, a plain "I don't know yet" when it didn't, plus what was seen on your visit
// (advertising companies and registered data brokers), without claiming a tracker proves a sale (docs/SPEC.md Honesty rules).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const A = window.PrivaCAskC;

const T = (company, category, domain, broker) => ({ company, category, country: "US", domain, ...(broker ? { broker } : {}) });
const site = (domain, policy, trackers = []) => ({ domain, cookieChoice: "none", lastVisit: "2026-10-25T05:00:00Z", policy, trackers });
const sites = [
  site("wired.com", { sells: null, shares: null, source: null }, [T("Google", "Advertising", "doubleclick.net"), T("Criteo", "Advertising", "criteo.com"),
    T("LiveRamp", "Advertising", "rlcdn.com", "LiveRamp Holdings, Inc."), T("Chartbeat", "Analytics", "chartbeat.com")]),
  site("shop.example", { sells: true, shares: true, checkedAt: "2026-10-24T05:00:00.000Z", optOut: true,
    quotes: { sells: "We sell personal information to data brokers and advertising partners.", shares: "We share your personal information with advertising partners for targeted advertising.",
      optOut: "You can opt out of the sale of your personal information by clicking Do Not Sell My Personal Information." } }),
  site("github.com", { sells: false, shares: true, checkedAt: "2026-10-25T06:10:35.388Z",
    quotes: { sells: "GitHub does not sell your personal data.", shares: "We may share your data with advertising partners for interest-based advertising." } }),
  site("bbc.com", { sells: null, shares: null, checkedAt: "2026-10-25T06:06:42.184Z", quotes: {} }, [T("Google", "Advertising", "doubleclick.net")])
].map((s) => ({ ...s, ...window.PrivaCData.computeScore(s) }));

async function ask(q) {
  let calls = 0;
  const r = await A.answer(q, { load: async () => ({ sites }), lists: async () => ({ brokers: { fetchedAt: "2026-10-25T04:00:00Z", list: [] } }), atlas: () => null,
    ask: async () => { calls++; return "Yes, wired.com's privacy policy says they sell personal information. [Privacy policy]"; } });
  return { ...r, calls };
}

test("a policy PrivaC never read: \"I don't know yet\", never a made-up yes", async () => {
  for (const q of ["Does wired.com sell my data?", "does wired sell my personal information", "Is wired.com selling my info?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 0, `${q}: answered from PrivaC's records, not Gemma`);
    assert.match(r.answer, /^I don't know yet: PrivaC hasn't read wired\.com's privacy policy/, q);
    assert.doesNotMatch(r.answer, /\bYes\b|says it sells/, q);
    assert.match(r.answer, /Partly checked/, "the grade doesn't count the unknown as safe");
    assert.match(r.answer, /3 advertising companies \(Google, Criteo and LiveRamp\) \[Seen on your visit\] \[Tracker Radar\]/);
    assert.match(r.answer, /registered California data broker[^\n]*LiveRamp Holdings, Inc\.[^\n]*\[CA Broker Registry\]/);
    assert.match(r.answer, /doesn't prove your data was sold/);
  }
});

test("a policy that says it sells: yes, with its own sentence quoted", async () => {
  const r = await ask("Does shop.example sell my data?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^Yes, by its own words\. shop\.example's privacy policy says it sells personal information: "We sell personal information to data brokers and advertising partners\." \[Privacy policy\]/);
  assert.match(r.answer, /It also says it shares personal information with partners for advertising: "We share your personal information/);
  assert.match(r.answer, /It explains how to opt out: "You can opt out of the sale/);
  assert.doesNotMatch(r.answer, /Partly checked/);
});

test("says it doesn't sell but does share: both, quoted, in the order asked", async () => {
  const sells = await ask("Does github.com sell my data?");
  assert.match(sells.answer, /^github\.com's privacy policy says it doesn't sell personal information: "GitHub does not sell your personal data\." \[Privacy policy\]/);
  assert.match(sells.answer, /But it says it shares personal information with partners for advertising: "We may share your data/);
  const shares = await ask("Does github share my data?");
  assert.match(shares.answer, /^Yes, by its own words\. github\.com's privacy policy says it shares personal information with partners for advertising: "We may share/);
  assert.match(shares.answer, /It says it doesn't sell personal information: "GitHub does not sell/);
});

test("a policy read with no clear answer says so, with the date it was read", async () => {
  const r = await ask("Does bbc.com sell my data?");
  assert.match(r.answer, /^bbc\.com's privacy policy \(read on Oct 25, 2026\) doesn't say clearly whether it sells or shares your personal information \[Privacy policy\]\./);
  assert.match(r.answer, /1 advertising company \(Google\) \[Seen on your visit\] \[Tracker Radar\]/);
});

test("a site PrivaC hasn't seen: its policy hasn't been read, said plainly", async () => {
  const r = await ask("Does tiktok.com sell my data?");
  assert.strictEqual(r.calls, 0);
  assert.match(r.answer, /^I don't know: PrivaC hasn't seen tiktok\.com on your visits in the last 7 days, so it hasn't read its privacy policy\./);
});

test("questions that aren't about one site still go to Gemma", async () => {
  for (const q of ["Which sites sell my data?", "What does selling data mean?", "Do data brokers sell my data?"]) {
    const r = await ask(q);
    assert.strictEqual(r.calls, 1, q);
  }
});
