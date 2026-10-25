// Run with: node --test
// The privacy-policy reader's pure logic (shared/policy.js, PLAN R3).
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/policy.js");
const P = window.PrivaCPolicy;
const MAP = require("../shared/knowledge-map.json");

const POLICY = `
<html><head><title>Privacy Policy</title><style>.x{color:red}</style><script>var sell = "do not read me";</script></head>
<body><nav>Home | Shop</nav>
<h1>Privacy Policy</h1>
<p>Last updated January 1, 2026. This policy explains how Example Shop collects and uses your information.</p>
<p>We collect your name, email address and purchase history when you create an account.</p>
<p>We share personal information with advertising partners for cross-context behavioral advertising and targeted advertising.</p>
<p>We do not sell your personal information for money.</p>
<p>To opt out of sharing, click the &quot;Do Not Sell or Share My Personal Information&quot; link in our footer.</p>
<p>We retain account information for 24 months after your last purchase, then delete it.</p>
<p>Our hosting company stores data on our behalf.</p>
${"<p>Filler paragraph about shipping and returns that has nothing to do with privacy questions at all.</p>".repeat(30)}
</body></html>`;

test("picks the privacy policy link on the same site, not the 'privacy choices' link", () => {
  const links = [
    { href: "https://www.example.com/help", text: "Help" },
    { href: "https://www.example.com/privacy-choices", text: "Your Privacy Choices" },
    { href: "https://www.example.com/legal/privacy-policy?ref=footer#top", text: "Privacy Policy" },
    { href: "https://other.com/privacy", text: "Privacy" }
  ];
  assert.strictEqual(P.pickPolicyLink(links, "example.com"), "https://www.example.com/legal/privacy-policy");
});

test("a policy on a sister subdomain counts; another company's site doesn't", () => {
  assert.strictEqual(P.pickPolicyLink([{ href: "https://privacy.example.com/notice", text: "Privacy Notice" }], "shop.example.com"), "https://privacy.example.com/notice");
  assert.strictEqual(P.pickPolicyLink([{ href: "https://tracker.net/privacy", text: "Privacy Policy" }], "example.com"), null);
  assert.strictEqual(P.pickPolicyLink([{ href: "javascript:void(0)", text: "Privacy Policy" }], "example.com"), null);
});

test("HTML becomes plain paragraphs without scripts, styles or entities", () => {
  const text = P.htmlToText(POLICY);
  assert.doesNotMatch(text, /do not read me|color:red|<p>/);
  assert.match(text, /click the "Do Not Sell or Share My Personal Information" link/);
  assert.ok(text.split("\n").length > 5);
});

test("only paragraphs matching a question's words (plus neighbors) go to Gemma", () => {
  const text = P.htmlToText(POLICY);
  const sells = MAP.checks.find((c) => c.id === "sells");
  const passage = P.passagesFor(text, sells, 1200);
  assert.match(passage, /We do not sell your personal information/);
  assert.doesNotMatch(passage, /shipping and returns.*shipping and returns.*shipping and returns/s);
  assert.ok(passage.length <= 1200);
});

test("a quote only counts if it is really in the policy (spacing, case and curly quotes ignored)", () => {
  const text = P.htmlToText(POLICY);
  assert.ok(P.verifyQuote("we  do not SELL your personal information for money.", text));
  assert.ok(P.verifyQuote("click the “Do Not Sell or Share My Personal Information” link", text));
  assert.ok(!P.verifyQuote("We sell your data to anyone who pays.", text));
  assert.ok(!P.verifyQuote("We", text), "too short to prove anything");
});

test("reads a policy: real quotes kept, made-up quote becomes unknown, no Gemma call when nothing matches", async () => {
  const calls = [];
  const fakeAsk = async (q, opts) => {
    calls.push(q);
    assert.strictEqual(opts.json, true);
    const answers = [];
    if (/"sells"/.test(q)) answers.push({ id: "sells", answer: "no", quote: "We do not sell your personal information for money." });
    if (/"shares"/.test(q)) answers.push({ id: "shares", answer: "yes", quote: "We share personal information with advertising partners for cross-context behavioral advertising and targeted advertising." });
    if (/"opt_out"/.test(q)) answers.push({ id: "opt_out", answer: "yes", quote: "click the \"Do Not Sell or Share My Personal Information\" link in our footer" });
    if (/"retention"/.test(q)) answers.push({ id: "retention", answer: "yes", quote: "We keep data forever unless you ask." }); // made up
    return { answers };
  };
  const policy = await P.readPolicy({ html: POLICY, url: "https://www.example.com/privacy" }, MAP, fakeAsk, { now: Date.parse("2026-10-24T12:00:00Z") });
  assert.strictEqual(policy.sells, false);
  assert.strictEqual(policy.shares, true);
  assert.strictEqual(policy.optOut, true);
  assert.strictEqual(policy.retention, null, "made-up quote must become unknown");
  assert.strictEqual(policy.preciseLocation, null);
  assert.match(policy.quotes.shares, /advertising partners/);
  assert.strictEqual(policy.quotes.retention, undefined);
  assert.strictEqual(policy.source, "https://www.example.com/privacy");
  assert.strictEqual(policy.checkedAt, "2026-10-24T12:00:00.000Z");
  // GPC and precise location have no matching words in this policy, so Gemma isn't asked about them.
  assert.ok(!calls.some((q) => /"gpc"|"precise_location"/.test(q)), "should skip questions with no matching passage");
  // At most 2 questions per Gemma call (E4B is more accurate with short prompts).
  for (const q of calls) assert.ok((q.match(/"id": "/g) || []).length <= 2, q);
});

test("an answer with no quote is unknown; 'yes' without proof never counts", async () => {
  const policy = await P.readPolicy({ html: POLICY, url: "https://example.com/p" }, MAP,
    async () => ({ answers: [{ id: "sells", answer: "yes", quote: "" }, { id: "shares", answer: "maybe", quote: "x" }] }));
  assert.strictEqual(policy.sells, null);
  assert.strictEqual(policy.shares, null);
});

test("if Gemma can't be reached at all, reading fails so it can be retried later", async () => {
  await assert.rejects(P.readPolicy({ html: POLICY, url: "https://example.com/p" }, MAP, async () => { throw new Error("offline"); }));
});

test("a page too short to be a privacy policy is rejected", async () => {
  await assert.rejects(P.readPolicy({ html: "<p>Page not found</p>", url: "https://example.com/p" }, MAP, async () => ({ answers: [] })), /policy/i);
});

test("policy source is saved without query string or fragment", () => {
  assert.strictEqual(P.cleanUrl("https://a.example.com/privacy?utm=x#s2"), "https://a.example.com/privacy");
  assert.strictEqual(P.cleanUrl("not a url"), null);
});

// G14 test with real Gemma (Oct 25 2026): the saved "sells" answers for linkedin, bbc, nytimes and github came from
// sentences that don't say the company sells your data, dailymail's "doesn't sell or share" from its opt-out link's
// name, and its "collects sensitive information" from the menu words "Sports Health Science".
const REAL = {
  linkedin: "We sell premium Services that provide our customers and subscribers with customized-search functionality and tools (including messaging and activity alerts) as part of our talent, marketing and sales solutions.",
  bbc: "We sell premium advertising space on our services directly to our advertising clients.",
  nytimes: "Residents of certain states have the right to instruct us not to “sell” or “share” their personal information and/or to opt out of “targeted advertising” and \"sales\" (as defined under applicable law).",
  github: "We might disclose Personal Data within the limits of the law and in accordance with this Privacy Statement for strategic business transactions such as sales or a merger.",
  link: "Do not sell or share my personal information"
};

test("a 'sells' answer needs a sentence that says the company sells personal information", () => {
  for (const [site, q] of Object.entries(REAL)) assert.strictEqual(P.quoteFits("sells", "yes", q), false, site);
  assert.strictEqual(P.quoteFits("sells", "yes", "We may sell your personal information to data brokers and advertising partners."), true);
  assert.strictEqual(P.quoteFits("sells", "yes", "In the past 12 months we have sold the following categories of personal information: identifiers and internet activity."), true);
  assert.strictEqual(P.quoteFits("sells", "no", "We do not sell your personal information for money."), true);
  assert.strictEqual(P.quoteFits("sells", "no", REAL.link), false, "a link's name isn't a promise");
  assert.strictEqual(P.quoteFits("sells", "no", "We sell your personal information to partners."), false, "no denial");
});

test("a 'shares' answer needs advertising or marketing in the sentence, and a 'no' needs a real denial", () => {
  assert.strictEqual(P.quoteFits("shares", "yes", "We share your data across our different Services and LinkedIn affiliated entities."), false);
  assert.strictEqual(P.quoteFits("shares", "yes", "We may share your data with these partners and resellers where allowed, and with your consent when required."), false);
  assert.strictEqual(P.quoteFits("shares", "yes", "By “sharing”, we mean a disclosure of personal information to a third party for cross-context behavioural advertising or other purposes covered by applicable law."), false, "a definition");
  assert.strictEqual(P.quoteFits("shares", "yes", "We may share your personal information with third parties as described in this Privacy Policy, including data analytics providers, advertising technology vendors, and social media platforms."), true);
  assert.strictEqual(P.quoteFits("shares", "yes", "We share personal information with advertising partners for cross-context behavioral advertising and targeted advertising."), true);
  assert.strictEqual(P.quoteFits("shares", "yes", "We do not sell your personal information, but we share it with advertising partners for targeted ads."), true, "a 'no' about selling isn't a 'no' about sharing");
  assert.strictEqual(P.quoteFits("shares", "no", REAL.link), false);
  assert.strictEqual(P.quoteFits("shares", "no", "We do not sell or share your personal information."), true);
});

test("a 'quote' of 4 words or fewer (menu text like \"Sports Health Science\") proves nothing", () => {
  assert.strictEqual(P.quoteFits("sensitive", "yes", "Sports Health Science"), false);
  assert.strictEqual(P.quoteFits("sensitive", "yes", "We collect sensitive information about you, such as health data."), true);
  assert.strictEqual(P.quoteFits("optOut", "yes", REAL.link), true, "an opt-out link does show there is a way to opt out");
});

test("reading a policy applies the same checks: bbc's 'We sell premium advertising space' is unknown, not 'sells'", async () => {
  const html = `<h1>Privacy Policy</h1><p>${REAL.bbc}</p>` + "<p>We describe here how we look after the information you give us when you use the site.</p>".repeat(12);
  const policy = await P.readPolicy({ html, url: "https://www.bbc.com/privacy" }, MAP,
    async (q) => ({ answers: /"sells"/.test(q) ? [{ id: "sells", answer: "yes", quote: REAL.bbc }] : [] }));
  assert.strictEqual(policy.sells, null);
  assert.strictEqual(policy.quotes.sells, undefined);
});

test("answers saved before these checks are checked again: one that fails becomes unknown, the rest stay", () => {
  const stored = { sells: true, shares: true, optOut: true, sensitive: true, checkedAt: "2026-10-25T06:06:42.184Z",
    quotes: { sells: REAL.bbc, shares: "We may share your personal information with advertising technology vendors.", optOut: REAL.link, sensitive: "Sports Health Science" } };
  const p = P.recheck(stored);
  assert.strictEqual(p.sells, null);
  assert.strictEqual(p.quotes.sells, undefined);
  assert.strictEqual(p.shares, true);
  assert.strictEqual(p.optOut, true);
  assert.strictEqual(p.sensitive, null);
  assert.strictEqual(p.checkedAt, stored.checkedAt);
  assert.strictEqual(stored.sells, true, "the saved object itself isn't changed");
  const fine = { sells: false, quotes: { sells: "We do not sell your personal information to anyone." } };
  assert.strictEqual(P.recheck(fine), fine, "nothing to fix: the same object back");
});
