// The Grades tab's "Explain this grading rule" buttons (Max, main 85007e5) hit C's instant record answers on the G14:
// "Advertising, data brokering & screen recording" got the screen-recording site list, "Listed country or company ties"
// read "15 CFR 7.4" as a site, and "Site's data breaches" listed breached sites. Each rule now gets C's own explanation
// from the scoring rules in shared/data.js, with an example. The questions are built here the way dashboard.js builds
// them, from the table in dashboard.html. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
globalThis.window = globalThis;
require("../shared/lists.js");
require("../shared/cookies.js");
require("../shared/data.js");
require("../shared/askc.js");
const A = window.PrivaCAskC;
const { RULES } = window.PrivaCData;

const html = fs.readFileSync(__dirname + "/../dashboard/dashboard.html", "utf8");
const body = html.split('<table id="rubric">')[1].split("</tbody>")[0].split("<tbody>")[1];
const text = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").trim();
const rows = body.split("<tr>").slice(1).map((r) => text(r.split("</td>")[0]));
const data = { sites: [{ domain: "news.example", score: 70, grade: "D", cookieChoice: "accepted", policy: {}, trackers: [{ company: "Hotjar", category: "Session Replay", country: "MT" }] }] };
const KEYS = ["trackers", "ads", "cookies", "flag", "policy", "breach"];

test("every \"Explain this grading rule\" button gets that rule's explanation with an example, without asking Gemma", async () => {
  assert.strictEqual(rows.length, 6);
  for (const [i, rule] of rows.entries()) {
    let calls = 0;
    const r = await A.answer(`Explain this grading rule in plain words, with an example: "${rule}"`,
      { load: async () => data, ask: async () => { calls++; return "Recording your screen..."; } });
    assert.strictEqual(calls, 0, rule);
    assert.ok(r.answer.includes(RULES[KEYS[i]]), `${rule.slice(0, 40)} -> ${r.answer.slice(0, 120)}`);
    assert.match(r.answer, /For example,/, rule);
    assert.doesNotMatch(r.answer, /tracker addresses on|haven't seen 7\.4|news\.example/, rule);
  }
});

test("an ordinary question that mentions a rule isn't taken for a button", async () => {
  let calls = 0;
  await A.answer("Explain the breaches on news.example", { load: async () => data, ask: async () => { calls++; return "x"; } });
  const r = await A.answer("Which sites recorded my screen?", { load: async () => data, ask: async () => { calls++; return "x"; } });
  assert.doesNotMatch(r.answer, /For example, if Criteo/);
});
