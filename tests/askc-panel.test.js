// Run with: node --test
// Tests the pure parts of the dashboard's Ask C panel (dashboard/ask-c.js).
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../dashboard/ask-c.js");
const { sampleFor, renderAnswer, questionFromUrl } = window.PrivaCAsk;

test("source tags become colored labels and other brackets stay as text", () => {
  const html = renderAnswer("LiveRamp loaded here. [Seen on your visit] It is a broker. [CA Broker Registry] [not a source]");
  assert.match(html, /<span class="src src-seen">Seen on your visit<\/span>/);
  assert.match(html, /<span class="src src-broker">CA Broker Registry<\/span>/);
  assert.match(html, /\[not a source\]/);
});

test("answer text is escaped so Gemma can't inject HTML", () => {
  const html = renderAnswer('<img src=x onerror="alert(1)"> [HIBP]');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /src-hibp/);
});

test("suggested questions have sample answers, ignoring case, spacing and .example", () => {
  assert.ok(sampleFor("Who is LiveRamp and should I worry?"));
  assert.ok(sampleFor("  who is liveramp and   should i worry?  "));
  assert.ok(sampleFor("Why did flightdeals.example get an F?"));
});

test("other questions have no sample answer", () => {
  assert.strictEqual(sampleFor("What is the weather?"), null);
  assert.strictEqual(sampleFor(""), null);
});

test("the popup can pass a question in the dashboard address", () => {
  assert.strictEqual(questionFromUrl("?ask=Why%20did%20news.example%20get%20a%20D%3F"), "Why did news.example get a D?");
  assert.strictEqual(questionFromUrl(""), "");
  assert.strictEqual(questionFromUrl("?site=x"), "");
});
