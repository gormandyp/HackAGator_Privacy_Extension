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

test("if PrivaC restarts mid-answer, the panel says so instead of asking Gemma a second time", async () => {
  globalThis.chrome = { runtime: fakeRuntime((m, port) => {
    port.listeners.forEach((f) => f({ type: "start" }));
    port.listeners.forEach((f) => f({ type: "token", text: "Criteo is" }));
    port.gone.forEach((f) => f());
  }) };
  const res = await askStreaming("Who is Criteo?", () => {});
  assert.match(res.error, /stopped answering/);
  delete globalThis.chrome;
});

test("a finished answer with no text shows a message instead of 'the AI isn't connected'", async () => {
  globalThis.chrome = { runtime: fakeRuntime((m, port) => {
    port.listeners.forEach((f) => f({ type: "start" }));
    port.listeners.forEach((f) => f({ type: "done", result: { trace: [] } }));
  }) };
  const res = await askStreaming("Hi", () => {});
  assert.match(res.error, /didn't find an answer/);
  delete globalThis.chrome;
});

test("the panel sends the last few questions and answers with a new question (C's short memory)", async () => {
  let sent = null;
  globalThis.chrome = { runtime: fakeRuntime((m, port) => {
    sent = m;
    port.listeners.forEach((f) => f({ type: "done", result: { answer: "ok", trace: [] } }));
  }) };
  const history = [{ question: "Who is Criteo?", answer: "An ad company. [Tracker Radar]" }];
  await askStreaming("Where did it follow me?", () => {}, history);
  assert.deepStrictEqual(sent, { type: "ask", question: "Where did it follow me?", history });
  delete globalThis.chrome;
});

test("the panel keeps only the last 3 answered turns, never errors or sample answers", () => {
  const { remember } = window.PrivaCAsk;
  let h = [];
  for (let i = 1; i <= 5; i++) h = remember(h, `Q${i}?`, { answer: `A${i}.` });
  h = remember(h, "Q6?", { error: "Gemma is off" });
  h = remember(h, "Q7?", { answer: "Sample.", sample: true });
  assert.deepStrictEqual(h.map((t) => t.question), ["Q3?", "Q4?", "Q5?"]);
});
