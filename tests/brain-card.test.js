// Run with: node --test
// The "C's brain" card on the dashboard (dashboard/brain-card.js): what it says in each state.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../dashboard/brain-card.js");
const { view, html } = window.PrivaCBrainCard;

test("before the download: one clear offer with the real size", () => {
  const v = view({ use: "browser", status: { state: "none", total: 2008432640 }, ollama: false });
  assert.match(v.title, /Gemma 4/);
  assert.match(v.text, /2\.0 GB/);
  assert.deepStrictEqual(v.actions.map((a) => a[0]), ["download"]);
});

test("Ollama running: Ask C already works, and Ollama is offered", () => {
  const v = view({ use: "browser", status: { state: "none" }, ollama: true });
  assert.match(v.text, /Ollama is running/);
  assert.ok(v.actions.some((a) => a[0] === "use-ollama"));
});

test("downloading shows progress and can be cancelled", () => {
  const v = view({ use: "browser", status: { state: "downloading", loaded: 1004216320, total: 2008432640 } });
  assert.strictEqual(v.progress, 50);
  assert.match(v.title, /1\.0 of 2\.0 GB/);
  assert.match(html(v), /role="progressbar"/);
  assert.deepStrictEqual(v.actions.map((a) => a[0]), ["cancel"]);
});

test("ready: a quiet line saying Gemma runs in the browser", () => {
  const v = view({ use: "browser", status: { state: "ready", name: "Gemma 4 E2B" } });
  assert.strictEqual(v.tone, "quiet");
  assert.match(v.title, /running in your browser/);
});

test("a browser that can't run it says why and that everything else still works", () => {
  const v = view({ use: "browser", status: { state: "unsupported", error: "This browser can't run C's brain: it needs WebGPU." }, ollama: false });
  assert.match(v.text, /needs WebGPU/);
  assert.match(v.text, /everything else in PrivaC works/);
});

test("text from errors is escaped", () => {
  assert.doesNotMatch(html(view({ status: { state: "error", error: "<img src=x onerror=alert(1)>" } })), /<img/);
});

test("deleting the 2 GB download asks once, right in the card (no pop-up dialog)", () => {
  const ready = { use: "browser", status: { state: "ready" } };
  assert.ok(view(ready).actions.some((a) => a[0] === "ask-remove"));
  const confirm = view(ready, { confirmRemove: true });
  assert.match(confirm.title, /Delete C's brain/);
  assert.deepStrictEqual(confirm.actions.map((a) => a[0]), ["remove", "keep"]);
});
