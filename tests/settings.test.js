// shared/settings.js: appearance, style and which of C's pop-ups may show.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/settings.js");
const S = window.PrivaCSettings;

test("defaults: follow the Mac, liquid glass, every pop-up on, policy reading on", () => {
  assert.deepStrictEqual(S.merge(null), { appearance: "system", style: "glass", popups: { cookie: true, acceptOnly: true, adversary: true }, policyReader: true });
});

test("saved choices are kept; unknown or broken values fall back to defaults", () => {
  const s = S.merge({ appearance: "dark", style: "clean", popups: { adversary: false, cookie: "no", made_up: false }, policyReader: false, extra: 1 });
  assert.deepStrictEqual(s, { appearance: "dark", style: "clean", popups: { cookie: true, acceptOnly: true, adversary: false }, policyReader: false });
  assert.strictEqual(S.merge({ appearance: "purple", style: "neon" }).appearance, "system");
});

test("light / dark / system decide the theme", () => {
  globalThis.matchMedia = (q) => ({ matches: q === "(prefers-color-scheme: dark)" });
  assert.strictEqual(S.isDark(S.merge({ appearance: "system" })), true);
  assert.strictEqual(S.isDark(S.merge({ appearance: "light" })), false);
  assert.strictEqual(S.isDark(S.merge({ appearance: "dark" })), true);
  const doc = { documentElement: { dataset: {} } };
  S.applyTheme(S.merge({ appearance: "light", style: "clean" }), doc);
  assert.deepStrictEqual({ ...doc.documentElement.dataset }, { theme: "light", style: "clean" });
});

test("save merges into what's stored (outside Chrome it uses localStorage)", async () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
  await S.save({ style: "clean" });
  const s = await S.save({ popups: { adversary: false } });
  assert.strictEqual(s.style, "clean");
  assert.deepStrictEqual(s.popups, { cookie: true, acceptOnly: true, adversary: false });
});
