// Run with: node --test
// shared/knowledge-map.json: the checks PrivaC runs on every site (docs/SPEC.md, "The Knowledge Map").
// These tests keep it complete, honest, and in step with the real score in shared/data.js.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/data.js");
const { computeScore } = window.PrivaCData;
const map = require("../shared/knowledge-map.json");

const EVIDENCE = ["Observed during your visit", "Disclosed in policy", "Public record"];
const gemma = map.checks.filter((c) => c.answeredBy === "gemma");
const code = map.checks.filter((c) => c.answeredBy === "code");

test("every check has an id, a question, an evidence type and who answers it", () => {
  const ids = new Set();
  for (const c of map.checks) {
    assert.ok(/^[a-z_]+$/.test(c.id), `bad id ${c.id}`);
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    assert.ok(c.question && c.label, `${c.id} needs a question and a short label`);
    assert.ok(EVIDENCE.includes(c.evidence), `${c.id} has evidence "${c.evidence}"`);
    assert.ok(["code", "gemma"].includes(c.answeredBy), `${c.id} answeredBy`);
  }
});

test("Gemma's policy questions say how to find the passage and how to decide", () => {
  assert.ok(gemma.length >= 6);
  for (const c of gemma) {
    assert.strictEqual(c.evidence, "Disclosed in policy", c.id);
    assert.ok(c.policyField, `${c.id} needs policyField`);
    assert.ok(Array.isArray(c.findWords) && c.findWords.length >= 2, `${c.id} needs findWords`);
    assert.ok(c.yesIf && c.noIf && c.unknownIf, `${c.id} needs yesIf / noIf / unknownIf`);
    for (const a of ["yes", "no", "unknown"]) assert.ok(c.says && c.says[a], `${c.id} needs says.${a}`);
    for (const a of ["yes", "no", "unknown"]) assert.ok(Number.isInteger(c.points[a]), `${c.id} needs points.${a}`);
  }
});

test("sells and shares points match the real score in shared/data.js", () => {
  const pts = (policy) => computeScore({ trackers: [], cookieChoice: "declined", policy }).parts.find((p) => p.kind === "disclosed").points;
  const sells = gemma.find((c) => c.policyField === "sells");
  const shares = gemma.find((c) => c.policyField === "shares");
  assert.strictEqual(sells.points.yes, pts({ sells: true, shares: false }));
  assert.strictEqual(shares.points.yes, pts({ sells: false, shares: true }));
  assert.strictEqual(sells.points.unknown, pts({ sells: null, shares: null }));
  assert.strictEqual(sells.points.no + shares.points.no, pts({ sells: false, shares: false }));
});

test("questions that aren't in the score yet carry 0 points", () => {
  for (const c of gemma.filter((c) => !["sells", "shares"].includes(c.policyField))) {
    assert.deepStrictEqual(c.points, { yes: 0, no: 0, unknown: 0 }, c.id);
    assert.strictEqual(c.scored, false, c.id);
  }
});

test("code checks' maximum points match the real score", () => {
  const max = (site) => computeScore({ cookieChoice: "declined", policy: {}, trackers: [], ...site });
  const part = (r, kind, i = 0) => r.parts.filter((p) => p.kind === kind)[i].points;
  const many = Array.from({ length: 12 }, () => ({ domain: "x.com", company: "X", category: "Advertising", country: "US" }));
  const r = max({ trackers: many });
  const byId = Object.fromEntries(code.map((c) => [c.id, c.maxPoints]));
  assert.strictEqual(byId.trackers, part(r, "observed", 0));
  assert.strictEqual(byId.ad_trackers, part(r, "observed", 1));
  assert.strictEqual(byId.cookie_choice, part(max({ cookieChoice: "accepted" }), "observed", 2));
  assert.strictEqual(byId.foreign_adversary, part(max({ trackers: [{ domain: "b.cn", company: "Baidu", category: "Analytics", country: "CN" }] }), "observed", 3));
  assert.strictEqual(byId.breach, part(max({ breach: { name: "X", addedDate: new Date().toISOString().slice(0, 10) } }), "breach"));
});

test("C's lines follow the honesty rules", () => {
  for (const c of gemma) {
    for (const [a, line] of Object.entries(c.says)) {
      assert.doesNotMatch(line, /sold your data|sells your data|sent your data|is illegal|broke the law|violat/i, `${c.id}.${a}: "${line}"`);
    }
    assert.doesNotMatch(c.says.unknown, /\b(doesn't|does not|never)\b/i, `${c.id}: "unknown" must not sound like "no"`);
  }
});

test("Gemma must quote the policy exactly, and the reader checks the quote", () => {
  assert.match(map.answerFormat.rule, /exact/i);
  assert.match(map.answerFormat.rule, /unknown/i);
});
