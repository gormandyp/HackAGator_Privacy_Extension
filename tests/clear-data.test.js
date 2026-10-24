// "Clear my PrivaC data" (Settings) must remove every list that names sites you visited (PRIVACY.md, "Deleting your data").
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
const removed = [];
globalThis.chrome = { storage: { local: { remove: async (keys) => { removed.push(...[].concat(keys)); } } } };
require("../shared/data.js");

test("clearAll removes site history, daily totals and the grade box's list of sites", async () => {
  await window.PrivaCData.clearAll();
  for (const key of ["privacData", "privacStats", "privacChipSeen"]) assert.ok(removed.includes(key), `${key} is not cleared`);
  assert.ok(!removed.includes("privacSettings"), "settings stay");
});
