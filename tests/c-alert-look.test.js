// content/c-alert-look.js: C's foreign-adversary pop-up sits bottom-right with the uneasy pose.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

test("the adversary pop-up moves to the bottom-right corner with the uneasy push-up pose; the cookie pop-up is untouched", () => {
  const wrap = { style: { left: "20px", top: "20px" } };
  const img = { src: "chrome-extension://x/c-poses/mascot-push-up.svg", alt: "C mascot" };
  const host = { shadowRoot: { querySelector: (sel) => (sel === ".wrap" ? wrap : sel === ".c img" ? img : null) } };
  const calls = [];
  const P = { adversary: (o) => { calls.push(["adversary", o]); return "shown"; }, cookie: () => calls.push(["cookie"]) };
  const ctx = { document: { querySelectorAll: () => [host] }, chrome: { runtime: { getURL: (p) => "chrome-extension://x/" + p } } };
  ctx.window = ctx; ctx.window.PrivaCPrompt = P;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../content/c-alert-look.js", "utf8"), ctx);
  assert.strictEqual(P.adversary({ companies: ["Baidu (China)"] }), "shown");
  assert.deepStrictEqual([wrap.style.left, wrap.style.top, wrap.style.right, wrap.style.bottom], ["auto", "auto", "16px", "0px"]);
  assert.strictEqual(img.src, "chrome-extension://x/c-poses/mascot-push-up-uneasy.svg");
  P.cookie();
  assert.deepStrictEqual(calls.map(c => c[0]), ["adversary", "cookie"]);
});
