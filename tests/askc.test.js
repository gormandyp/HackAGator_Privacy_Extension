// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/askc.js");
const { answer, buildContext } = window.PrivaCAskC;

const data = { sample: true, sites: [{ domain: "news.example", grade: "D", score: 70, cookieChoice: "accepted",
  policy: { sells: true }, trackers: [{ company: "LiveRamp", category: "Data broker", country: "US" }] }] };

test("context lists each site with grade, cookies, policy and trackers", () => {
  const c = buildContext(data);
  assert.match(c, /SAMPLE data/);
  assert.match(c, /news\.example: grade D, exposure 70\/100; cookies accepted; policy says it sells personal info; trackers: LiveRamp \(Data broker, US\)/);
});

test("empty browsing says so", () => {
  assert.match(buildContext({ sites: [] }), /hasn't visited/);
});

test("answer passes evidence to Gemma and returns panel shape", async () => {
  let seen;
  const r = await answer("Who is LiveRamp?", { load: async () => data, ask: async (q, o) => { seen = o; return "A broker. [Tracker Radar]"; } });
  assert.strictEqual(r.answer, "A broker. [Tracker Radar]");
  assert.strictEqual(r.trace[0].label, "Your browsing");
  assert.match(seen.system, /\[Seen on your visit\]/);
  assert.match(seen.context, /LiveRamp/);
});

test("Gemma failure becomes a readable error, not a crash", async () => {
  const r = await answer("Hi", { load: async () => data, ask: async () => { throw new Error("C can't reach Gemma."); } });
  assert.strictEqual(r.error, "C can't reach Gemma.");
});

test("blank question asks the user to type one", async () => {
  assert.match((await answer("  ", { load: async () => data, ask: async () => "x" })).error, /Type a question/);
});

const { cleanAnswer } = window.PrivaCAskC;

test("cleanAnswer maps made-up tags, drops unknown ones, strips backticks", () => {
  const raw = "The site `flightdeals.example` uses Baidu [Sites visited]. It sells data [Privacy policy] [Made up].";
  assert.strictEqual(cleanAnswer(raw), "The site flightdeals.example uses Baidu [Seen on your visit]. It sells data [Privacy policy].");
});

test("context includes sourced background facts for general questions", () => {
  assert.match(buildContext(data), /15 CFR 7\.4[\s\S]*\[Government list\]/);
});

test("using a government fact adds it to the 'C checked' line", async () => {
  const r = await answer("Why China?", { load: async () => data, ask: async () => "Listed country. [Government list]" });
  assert.deepStrictEqual(r.trace.map(t => t.label), ["Your browsing", "Government lists"]);
});
