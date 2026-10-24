// scripts/freeze-pose.js: still copies of C's animated pose files, for moments when C should hold still
// (his reaction after "Let me choose"). Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { freeze, STILL } = require("../scripts/freeze-pose.js");

const POSES = path.join(__dirname, "..", "c-poses");

test("each animation is removed and the shape it moved is set to its frame at that moment", () => {
  const svg = `<svg><path d="A" stroke="x"><animate attributeName="d" values="A;B;B;A" keyTimes="0;0.45;0.7;1" dur="2s"/></path>
    <g transform="translate(0 26)"><animateTransform attributeName="transform" type="translate" values="0 26;0 10;0 10;0 26" keyTimes="0;0.45;0.7;1"/><circle r="1"/></g>
    <path d="L"><animateTransform attributeName="transform" type="rotate" values="7 50 96;-7 50 96;7 50 96" begin="-0.4s"/></path></svg>`;
  const still = freeze(svg, 0.5);
  assert.ok(!/<animate/.test(still));
  assert.match(still, /<path d="B" stroke="x">\s*<\/path>/);
  assert.match(still, /<g transform="translate\(0 10\)">\s*<circle r="1"\/><\/g>/);
  assert.match(still, /<path d="L" transform="rotate\(-7 50 96\)">\s*<\/path>/);
  assert.match(freeze(svg, 0), /<path d="A" stroke="x">/, "time 0 is the first frame");
});

test("C's uneasy push-up pose freezes with him up over the edge (hands on the ledge, face showing)", () => {
  const src = fs.readFileSync(path.join(POSES, "mascot-push-up-uneasy.svg"), "utf8");
  const still = freeze(src, 0.5);
  assert.ok(!/<animate/.test(still));
  assert.match(still, /<g transform="translate\(0 10\)">/);
  assert.match(still, /d="M21 60 L15 81 L12 102"/);
  assert.strictEqual((still.match(/<path\b/g) || []).length, (src.match(/<path\b/g) || []).length, "same drawing, nothing lost");
  assert.strictEqual((still.match(/<circle\b/g) || []).length, (src.match(/<circle\b/g) || []).length);
});

test("the still pose files in c-poses match Matthew's animated originals", () => {
  for (const [from, to] of Object.entries(STILL)) {
    const expected = freeze(fs.readFileSync(path.join(POSES, from), "utf8"), 0.5);
    assert.strictEqual(fs.readFileSync(path.join(POSES, to), "utf8"), expected, `${to} is out of date: run node scripts/freeze-pose.js`);
  }
});
