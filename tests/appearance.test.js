// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/appearance.js");
const { normalize, resolveMode, DEFAULTS, ACCENTS } = window.PrivaCAppearance;

test("missing or broken saved settings fall back to defaults", () => {
  assert.deepStrictEqual(normalize(null), DEFAULTS);
  assert.deepStrictEqual(normalize("not json"), DEFAULTS);
  assert.deepStrictEqual(normalize('{"mode":"neon","accent":"pink","text":"huge"}'), DEFAULTS);
});

test("valid saved settings are kept", () => {
  const s = normalize('{"mode":"dark","accent":"forest","text":"large"}');
  assert.deepStrictEqual(s, { mode: "dark", accent: "forest", text: "large" });
});

test("system mode follows the computer's setting; light and dark are fixed", () => {
  assert.strictEqual(resolveMode("system", true), "dark");
  assert.strictEqual(resolveMode("system", false), "light");
  assert.strictEqual(resolveMode("dark", false), "dark");
  assert.strictEqual(resolveMode("light", true), "light");
});

test("navy is the default accent so the original look is unchanged", () => {
  assert.strictEqual(DEFAULTS.accent, "navy");
  assert.strictEqual(DEFAULTS.mode, "system");
  assert.ok(ACCENTS.some((a) => a.id === "navy"));
});
