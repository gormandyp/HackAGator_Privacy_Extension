// Run with: node --test
// Ask C sees the privacy-policy reader's answers (site.policy, filled by background/policy-reader.js).
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/askc.js");
const { buildContext } = window.PrivaCAskC;

const site = (policy) => ({ domain: "shop.example", grade: "C", score: 50, cookieChoice: "none", trackers: [], policy });

test("policy answers reach Gemma with the quoted sentence and the [Privacy policy] tag", () => {
  const ctx = buildContext({ sites: [site({
    sells: false, shares: true, optOut: true, gpc: null, retention: false, preciseLocation: true, sensitive: null, otherSources: true,
    quotes: { shares: "We share personal information with advertising partners.", preciseLocation: "We collect precise geolocation from your device." },
    source: "https://shop.example/privacy", checkedAt: "2026-10-24T05:00:00.000Z"
  })] }, "2026-10-24", []);
  assert.match(ctx, /says it shares with partners for advertising \("We share[^)]*"\) \[Privacy policy\]/);
  assert.match(ctx, /"We share personal information with advertising partners\."/);
  assert.match(ctx, /explains how to opt out/);
  assert.match(ctx, /no time limit for keeping your data/);
  assert.match(ctx, /collects your precise location/);
  assert.match(ctx, /gets data about you from other companies/);
  assert.doesNotMatch(ctx, /Global Privacy Control/, "unknown answers aren't stated as facts");
});

test("a policy that was never read still says 'not reviewed yet'", () => {
  const ctx = buildContext({ sites: [site({ sells: null, shares: null, source: null })] }, "2026-10-24", []);
  assert.match(ctx, /privacy policy not reviewed yet/);
});

test("a read policy with no clear answers says so instead of 'not reviewed'", () => {
  const ctx = buildContext({ sites: [site({ sells: null, shares: null, quotes: {}, source: "https://shop.example/privacy", checkedAt: "2026-10-24T05:00:00.000Z" })] }, "2026-10-24", []);
  assert.match(ctx, /privacy policy read on 2026-10-24, no clear answer about selling or sharing \[Privacy policy\]/);
});
