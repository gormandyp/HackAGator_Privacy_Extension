// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;           // mascot.js attaches PrivaCMascot to window
require("../shared/mascot.js");
const { svg, POSES } = window.PrivaCMascot;

test("the three popup poses are listed", () => {
  for (const pose of ["climb", "point-down", "hook"]) {
    assert.ok(POSES.includes(pose), `${pose} missing from POSES`);
  }
});

test("every pose draws C (the orange arc) with its face and limbs", () => {
  for (const pose of POSES) {
    const out = svg(pose, { size: 140 });
    assert.match(out, /^<svg /, `${pose} should start with <svg`);
    assert.match(out, /M86\.9 31\.1 A38 38 0 1 0 86\.9 84\.9/, `${pose} should draw the C arc`);
    assert.strictEqual((out.match(/<circle/g) || []).length, 4, `${pose} should have 2 eyes and 2 pupils`);
    assert.match(out, /height="140"/, `${pose} should respect size`);
    assert.match(out, /aria-label="[^"]+"/, `${pose} needs a text label for screen readers`);
  }
});

test("poses that reach past the usual frame get a taller or wider viewBox", () => {
  const vb = (pose) => svg(pose).match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  assert.ok(vb("climb")[1] < 0, "climb's hands reach above the C, so the viewBox must start above 0");
  assert.ok(vb("hook")[1] < 0, "hook's hand reaches above the C, so the viewBox must start above 0");
});

test("the original moods still draw the same", () => {
  for (const mood of ["happy", "uneasy", "alarmed", "wave"]) {
    assert.match(svg(mood), /viewBox="0 0 120 130"/);
  }
});
