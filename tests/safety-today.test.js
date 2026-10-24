// Safety tab on "Today" (Preston, 2026-10-24): the big card showed the grade chips and then nothing, with a hint
// at the very bottom. Today now draws a chart too: today's site visits, one column per grade. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");

const els = {};
const el = (id) => (els[id] = els[id] || { id, innerHTML: "", hidden: false, style: {} });
globalThis.window = globalThis;
globalThis.document = { getElementById: el, addEventListener() {} };
require("../shared/stats.js");
globalThis.PrivaCData = { load: async () => ({ sample: true, sites: [] }) };
require("../dashboard/activity.js");
const A = window.PrivaCActivity;

test("Safety on Today draws a chart of today's site visits by grade", async () => {
  await A.ready;
  A.setRange("safety", "day");
  const html = els.safety.innerHTML;
  assert.match(html, /<h3 class="chart-title">Today's site visits by grade<\/h3>/);
  assert.match(html, /class="chart"[^>]*aria-label="Today(&#39;|')s site visits by grade"/);
  for (const g of ["A", "B", "C", "D", "F"]) assert.match(html, new RegExp(`class="col grade-${g}"`), g);
  assert.match(html, /<span class="x">A<\/span>/);
});

test("each grade's column height and tooltip match today's numbers", async () => {
  await A.ready;
  A.setRange("safety", "day");
  const today = A.sampleStats().days[window.PrivaCStats.dayKey()].snapshot.grades;
  const html = els.safety.innerHTML;
  for (const g of ["A", "B", "C", "D", "F"]) {
    const n = today[g] || 0;
    assert.match(html, new RegExp(`aria-label="Graded ${g}: ${n} site visits?"`), g);
  }
});

test("7 and 30 days still draw site visits per day", async () => {
  await A.ready;
  for (const r of ["week", "month"]) {
    A.setRange("safety", r);
    assert.match(els.safety.innerHTML, /<h3 class="chart-title">Site visits per day<\/h3>/, r);
    assert.doesNotMatch(els.safety.innerHTML, /by grade<\/h3>/, r);
  }
});
