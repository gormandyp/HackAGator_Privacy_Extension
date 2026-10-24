// Run with: node --test
// Ask C uses the hand-checked fact files: the 1260H list and RegTrack (shared/*.json).
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/askc.js");
const { buildContext, answer } = window.PrivaCAskC;
const facts = {
  flagged: require("../shared/flagged-companies.json"),
  regtrack: require("../shared/regtrack-facts.json")
};

const site = (domain, trackers) => ({ domain, grade: "D", score: 60, cookieChoice: "none", trackers });
const tracker = (company, country) => ({ domain: `${company.toLowerCase()}.example`, company, category: "Analytics", country });

test("RegTrack facts reach Gemma with page numbers and the [RegTrack] tag", () => {
  const ctx = buildContext({ sites: [] }, "2026-10-24", [], facts);
  assert.match(ctx, /48\.5 to 56\.2.*p\. 4\) \[RegTrack\]/);
  assert.match(ctx, /did not measure rejecting/i);
});

test("a tracker from a 1260H company is marked with the list and its date", () => {
  const ctx = buildContext({ sites: [site("news.example", [tracker("Baidu", "CN")])] }, "2026-10-24", [], facts);
  assert.match(ctx, /Baidu \(Analytics, based in China\) \[Tracker Radar\], on the Pentagon's Section 1260H list of Chinese military companies \(June 2026\) \[Government list\]/);
});

test("Alibaba is flagged with its court challenge; ByteDance is never called a 1260H company", () => {
  const ctx = buildContext({ sites: [site("shop.example", [tracker("Alibaba", "CN"), tracker("ByteDance", "CN")])] }, "2026-10-24", [], facts);
  assert.match(ctx, /Alibaba[^;]*1260H[^;]*contesting this in court/);
  assert.doesNotMatch(ctx, /ByteDance \([^)]*\) \[Tracker Radar\], on the Pentagon/);
});

test("without the fact files, context still builds (no RegTrack lines)", () => {
  const ctx = buildContext({ sites: [site("a.example", [tracker("Baidu", "CN")])] }, "2026-10-24", []);
  assert.doesNotMatch(ctx, /\[RegTrack\]/);
});

test("an answer quoting RegTrack shows RegTrack in the 'C checked' trace", async () => {
  const res = await answer("Should I accept cookies?", {
    load: async () => ({ sites: [] }),
    ask: async () => "Accepting all raised tracking in a big study. [RegTrack]",
    facts: async () => facts
  });
  assert.ok(res.trace.some((t) => t.label === "RegTrack"));
});
