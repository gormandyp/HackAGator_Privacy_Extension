// Run with: node --test
// Ask C panel streaming (dashboard/ask-c.js): C's words show while Gemma writes them.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../dashboard/ask-c.js");
const { partialText, askStreaming, renderAnswer } = window.PrivaCAsk;

test("half-written answers hide markdown marks and an unfinished [tag", () => {
  assert.strictEqual(partialText("**Criteo** is an `ad` company. [Tracker Rad"), "Criteo is an ad company. ");
  assert.match(renderAnswer(partialText("It loaded here. [Seen on your visit] It")), /src-seen/);
  assert.strictEqual(partialText("The user's data"), "your data");
});

// A fake extension port: answers "ask" with two pieces of text and a final result.
function fakeRuntime(behavior) {
  const port = { listeners: [], gone: [], onMessage: { addListener: (f) => port.listeners.push(f) },
    onDisconnect: { addListener: (f) => port.gone.push(f) }, disconnect() {},
    postMessage(m) { setTimeout(() => behavior(m, port), 0); } };
  return { connect: () => port };
}

test("streaming passes the text so far, then resolves with the finished answer", async () => {
  globalThis.chrome = { runtime: fakeRuntime((m, port) => {
    for (const text of ["Criteo is", "Criteo is an ad company."]) port.listeners.forEach((f) => f({ type: "token", text }));
    port.listeners.forEach((f) => f({ type: "done", result: { answer: "Criteo is an ad company. [Tracker Radar]", trace: [] } }));
  }) };
  const seen = [];
  const res = await askStreaming("Who is Criteo?", (t) => seen.push(t));
  assert.deepStrictEqual(seen, ["Criteo is", "Criteo is an ad company."]);
  assert.strictEqual(res.answer, "Criteo is an ad company. [Tracker Radar]");
});

test("an older background without streaming resolves null, so the panel asks the normal way", async () => {
  globalThis.chrome = { runtime: fakeRuntime((m, port) => port.gone.forEach((f) => f())) };
  assert.strictEqual(await askStreaming("Hi", () => {}), null);
  delete globalThis.chrome;
});
