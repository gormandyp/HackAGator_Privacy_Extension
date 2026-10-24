// "Uncaught (in promise) Error: Extension context invalidated" on chrome://extensions (Oct 24): after PrivaC is
// reloaded, Chrome leaves the old content scripts running in open tabs, and their messages to the background fail.
// Each content script's messages must fail quietly. (content/c-events.js and content/cookie-detector.js have their
// own tests for this; content/grade-chip.js and content/panel.js already catch theirs.)
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

// Runs a content script whose every message to the background fails, the way the old copy's do.
async function runCutOff(file, document = {}) {
  const unhandled = [];
  const note = (e) => unhandled.push(e);
  process.on("unhandledRejection", note);
  let thrown = null;
  for (const fail of [() => Promise.reject(new Error("Extension context invalidated.")),
                      () => { throw new Error("Extension context invalidated."); }]) {
    const ctx = {
      console, setTimeout: () => 0, location: { hostname: "www.shop.example" }, document,
      chrome: { runtime: { sendMessage: fail, onMessage: { addListener() {} } } }
    };
    ctx.window = ctx;
    ctx.top = ctx;
    try { vm.runInNewContext(fs.readFileSync(__dirname + "/../content/" + file, "utf8"), ctx); } catch (e) { thrown = e; }
  }
  await new Promise((r) => setTimeout(r, 20));
  process.off("unhandledRejection", note);
  return { unhandled, thrown };
}

test("content/policy-link.js: a message the background can't take fails quietly", async () => {
  const link = { href: "https://www.shop.example/privacy", textContent: "Privacy notice", getAttribute: () => "/privacy" };
  const r = await runCutOff("policy-link.js", { querySelectorAll: () => [link] });
  assert.strictEqual(r.thrown, null);
  assert.deepStrictEqual(r.unhandled, []);
});

test("content/alerts.js: a message the background can't take fails quietly", async () => {
  const r = await runCutOff("alerts.js");
  assert.strictEqual(r.thrown, null);
  assert.deepStrictEqual(r.unhandled, []);
});
