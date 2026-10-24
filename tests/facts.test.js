// Run with: node --test
// Checks the hand-checked fact files: every claim has a source, and no company is on the wrong list.
const test = require("node:test");
const assert = require("node:assert");
const flagged = require("../shared/flagged-companies.json");
const regtrack = require("../shared/regtrack-facts.json");
const atlas = require("../shared/atlas.json");

test("1260H file names its list, date and official source", () => {
  assert.strictEqual(flagged.listDate, "2026-06-08");
  assert.match(flagged.source, /^https:\/\/www\.federalregister\.gov\//);
  assert.ok(flagged.companies.length >= 5);
});

test("every flagged domain is in the Atlas under the same company", () => {
  for (const c of flagged.companies) {
    for (const d of c.domains) {
      const row = atlas.domains[d];
      assert.ok(row, `${d} is missing from atlas.json`);
      assert.strictEqual(row[0], c.atlasCompany, `${d} belongs to ${row[0]}, not ${c.atlasCompany}`);
    }
  }
});

test("companies not on the 1260H list are never flagged as on it", () => {
  const listed = flagged.companies.map((c) => c.atlasCompany.toLowerCase());
  for (const name of ["bytedance", "yandex"]) assert.ok(!listed.includes(name), `${name} is not on the 1260H list`);
});

test("every RegTrack fact has a page number and section", () => {
  for (const f of regtrack.facts) {
    assert.ok(Number.isInteger(f.page) && f.page > 0, `${f.id} needs a page`);
    assert.ok(f.section, `${f.id} needs a section`);
  }
});

test("no RegTrack fact claims rejecting cookies was measured", () => {
  for (const f of regtrack.facts) assert.doesNotMatch(f.text, /\breject/i, `${f.id} mentions rejecting`);
});
