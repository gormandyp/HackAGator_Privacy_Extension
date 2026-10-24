// shared/liquid-glass.js: the refraction map behind the Liquid glass style.
// The map tells the browser where each pixel of glass looks through to: R is the sideways shift,
// G the up/down shift, and 128 means "straight through". Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/liquid-glass.js");
const { bezelMap } = window.PrivaCLiquid;

const px = (m, w, x, y) => { const i = (y * w + x) * 4; return [m[i], m[i + 1], m[i + 2], m[i + 3]]; };
const STRAIGHT = [128, 128, 128, 255];

test("the flat middle of the glass passes light straight through", () => {
  const w = 200, h = 120, m = bezelMap(w, h, 24, 16);
  assert.strictEqual(m.length, w * h * 4);
  assert.deepStrictEqual(px(m, w, 100, 60), STRAIGHT);
  assert.deepStrictEqual(px(m, w, 40, 40), STRAIGHT);          // just inside the bezel
});

test("near each edge the glass bends the view inward, strongest at the rim", () => {
  const w = 200, h = 120, m = bezelMap(w, h, 24, 16);
  const left = px(m, w, 0, 60), right = px(m, w, 199, 60), top = px(m, w, 100, 0), bottom = px(m, w, 100, 119);
  assert.ok(left[0] > 200 && left[1] === 128, `left ${left}`);       // looks to the right
  assert.ok(right[0] < 56 && right[1] === 128, `right ${right}`);    // looks to the left
  assert.ok(top[1] > 200 && top[0] === 128, `top ${top}`);           // looks down
  assert.ok(bottom[1] < 56 && bottom[0] === 128, `bottom ${bottom}`); // looks up
  const a = px(m, w, 2, 60)[0], b = px(m, w, 8, 60)[0], c = px(m, w, 14, 60)[0];
  assert.ok(a > b && b > c && c >= 128, `fades across the bezel: ${a} ${b} ${c}`);
});

test("rounded corners bend toward the corner's center; outside the corner nothing moves", () => {
  const w = 200, h = 120, m = bezelMap(w, h, 24, 16);
  const c = px(m, w, 8, 8);
  assert.ok(c[0] > 150 && c[1] > 150, `corner ${c}`);
  assert.ok(Math.abs(c[0] - c[1]) <= 1, "on the diagonal the sideways and up/down bends match");
  assert.deepStrictEqual(px(m, w, 0, 0), STRAIGHT);              // cut away by the rounded corner
});

test("the map is mirror-symmetric and stays inside the byte range", () => {
  const w = 160, h = 90, m = bezelMap(w, h, 20, 14);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = px(m, w, x, y), q = px(m, w, w - 1 - x, y), r = px(m, w, x, h - 1 - y);
    assert.ok(Math.abs((p[0] - 128) + (q[0] - 128)) <= 1, `left-right mirror at ${x},${y}`);
    assert.ok(Math.abs((p[1] - 128) + (r[1] - 128)) <= 1, `top-bottom mirror at ${x},${y}`);
    assert.ok(p[0] >= 1 && p[0] <= 255 && p[1] >= 1 && p[1] <= 255);
  }
});

test("a radius past half the height makes a capsule (toolbars) and tiny sizes don't break", () => {
  const w = 300, h = 44, m = bezelMap(w, h, 999, 12);
  assert.strictEqual(m.length, w * h * 4);
  assert.deepStrictEqual(px(m, w, 150, 22), STRAIGHT);
  const end = px(m, w, 1, 22);
  assert.ok(end[0] > 200, "the rounded end bends inward too");
  assert.strictEqual(bezelMap(1, 1, 10, 10).length, 4);
  assert.strictEqual(bezelMap(0, 10, 10, 10).length, 0);
});
