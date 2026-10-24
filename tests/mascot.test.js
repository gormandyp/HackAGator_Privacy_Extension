// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;           // mascot.js attaches PrivaCMascot to window
require("../shared/mascot.js");
const { svg, POSES } = window.PrivaCMascot;

test("the two behind-the-popup poses are listed", () => {
  assert.deepStrictEqual(POSES, ["push-up", "cliff-hang"]);
});

test("every pose draws C (the orange arc) with its eyes and a screen-reader label", () => {
  for (const pose of POSES) {
    const out = svg(pose, { size: 140 });
    assert.match(out, /^<svg /, `${pose} should start with <svg`);
    assert.match(out, /M86\.9 31\.1 A38 38 0 1 0 86\.9 84\.9/, `${pose} should draw the C arc`);
    assert.strictEqual((out.match(/<circle/g) || []).length, 4, `${pose} should have 2 eyes and 2 pupils`);
    assert.match(out, /height="140"/, `${pose} should respect size`);
    assert.match(out, /aria-label="[^"]+"/, `${pose} needs a text label`);
  }
});

test("poses cut C off at the popup's top edge so the popup hides his body", () => {
  for (const pose of POSES) {
    const out = svg(pose);
    assert.match(out, /<clipPath /, `${pose} should clip at the edge`);
    assert.match(out, /clip-path="url\(#/, `${pose} should apply the clip`);
  }
});

test("poses animate by default and stay still with animate: false", () => {
  for (const pose of POSES) {
    assert.match(svg(pose), /<animateTransform /, `${pose} should animate`);
    assert.doesNotMatch(svg(pose, { animate: false }), /<animate/, `${pose} still version should not animate`);
  }
});

test("the original moods still draw the same", () => {
  for (const mood of ["happy", "uneasy", "alarmed", "wave"]) {
    assert.match(svg(mood), /viewBox="0 0 120 130"/);
    assert.doesNotMatch(svg(mood), /<animate/);
  }
});
