// Run with: node --test
// The "C's brain" card on the dashboard (dashboard/brain-card.js): what it says in each state.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../dashboard/brain-card.js");
const { view, html, warmAfter, sameShape } = window.PrivaCBrainCard;

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

test("a model file packed inside the extension isn't offered for deletion (the card can't delete it)", () => {
  for (const state of ["ready", "downloaded"]) {
    assert.ok(!view({ use: "browser", status: { state, where: "bundled" } }).actions.some((a) => a[0] === "ask-remove"));
    assert.ok(view({ use: "browser", status: { state, where: "downloaded" } }).actions.some((a) => a[0] === "ask-remove"));
  }
});

test("speed: when the download finishes, Gemma starts loading right away (but not after it was unloaded for being idle)", () => {
  assert.strictEqual(warmAfter("downloading", "downloaded"), true);
  assert.strictEqual(warmAfter("ready", "downloaded"), false);
  assert.strictEqual(warmAfter("downloaded", "downloaded"), false);
});

test("during the download only the numbers change, so a focused Cancel button keeps keyboard focus", () => {
  const a = view({ use: "browser", status: { state: "downloading", loaded: 1e9, total: 2008432640 } });
  const b = view({ use: "browser", status: { state: "downloading", loaded: 1.2e9, total: 2008432640 } });
  assert.strictEqual(sameShape(a, b), true);
  assert.strictEqual(sameShape(a, view({ use: "browser", status: { state: "downloaded" } })), false);
  assert.strictEqual(sameShape(view({ status: { state: "none" } }), view({ status: { state: "none" }, ollama: true })), false);
});

// On the team's G14 (2026-10-24), Chrome on Windows ignored the request for the fast graphics chip and ran Gemma on
// the slow built-in one: answers took 18-70 s instead of about 2 s on the laptop's NVIDIA chip.
test("Windows: once C's brain is there, the card says how to put Chrome on the fast graphics chip", () => {
  for (const state of ["ready", "downloaded"]) {
    const v = view({ use: "browser", status: { state } }, { windows: true });
    assert.match(v.text, /two graphics chips/);
    assert.match(v.text, /Settings > System > Display > Graphics/);
    assert.match(v.text, /High performance/);
  }
  assert.doesNotMatch(view({ use: "browser", status: { state: "ready" } }, {}).text, /graphics chips/, "Mac and others: no Windows tip");
});

// Preston re-downloaded the 2 GB brain several times (Oct 24). Tested in Chromium (Oct 25): the reload arrow and a
// Chrome restart keep it; Remove deletes it, and loading the folder from somewhere else starts a separate copy.
test("downloaded: the card says reloading PrivaC keeps C's brain, and that removing PrivaC deletes it", () => {
  for (const state of ["ready", "downloaded"]) {
    const v = view({ use: "browser", status: { state, where: "downloaded" } });
    assert.match(v.text, /reloading PrivaC/i);
    assert.match(v.text, /removing PrivaC deletes it/i);
    assert.match(view({ use: "browser", status: { state, where: "downloaded" } }, { windows: true }).text, /reloading PrivaC.*High performance/s, "both lines on Windows");
  }
  assert.match(view({ use: "browser", status: { state: "ready", where: "bundled" } }).text, /models folder/, "the copy packed in the folder survives Remove");
});

test("downloading: the card warns that reloading or removing PrivaC before the end starts the download over", () => {
  const v = view({ use: "browser", status: { state: "downloading", loaded: 5e8, total: 2008432640 } });
  assert.match(v.text, /One time only/);
  assert.match(v.text, /reloading or removing PrivaC/i);
});
