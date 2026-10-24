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
