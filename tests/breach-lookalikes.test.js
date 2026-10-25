// Quest Diagnostics (Justin's report, checked on the G14 2026-10-25): questdiagnostics.com isn't on Have I Been Pwned's
// list, but DentaQuest, Questel and QuestionPro are. A site's breach comes from its exact web address (or a parent
// address), never from a name that merely contains "quest". Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const L = window.PrivaCLists, A = window.PrivaCAskC;
const B = (Name, Title, Domain, BreachDate, PwnCount) => ({ Name, Title, Domain, BreachDate, AddedDate: BreachDate + "T00:00:00Z", PwnCount, DataClasses: ["Email addresses"] });
const lists = { hibp: { fetchedAt: "2026-10-25T00:00:00Z", byDomain: L.compactBreaches([
  B("DentaQuest", "DentaQuest", "dentaquest.com", "2023-04-01", 900000),
  B("Questel", "Questel", "questel.com", "2021-01-01", 50000),
  B("QuestionPro", "QuestionPro", "questionpro.com", "2021-02-01", 22000000)
]) } };

test("questdiagnostics.com and its subdomains don't pick up a look-alike's breach", () => {
  for (const d of ["questdiagnostics.com", "www.questdiagnostics.com", "myquest.questdiagnostics.com", "quest.com"]) assert.strictEqual(L.breachFor(d, lists), null, d);
  assert.strictEqual(L.breachFor("www.dentaquest.com", lists).name, "DentaQuest", "the real site still matches");
});

test("Ask C: \"Was Quest Diagnostics hacked?\" says no breach on record and names no look-alike", async () => {
  for (const q of ["Was Quest Diagnostics hacked?", "Was questdiagnostics.com breached?", "Did Quest have a data breach?"]) {
    const r = await A.answer(q, { load: async () => ({ sample: false, sites: [] }), lists: async () => lists, atlas: () => null,
      ask: async () => "Gemma" });
    assert.doesNotMatch(r.answer || "", /DentaQuest|Questel|QuestionPro/, q);
  }
});
