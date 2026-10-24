// content/c-reaction-look.js: after you pick "Let me choose" (or a decline doesn't work), C says his line
// holding still instead of starting the push-up animation over. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function setup() {
  const hosts = [];
  const observers = [];
  function makeHost() {
    const removed = [];
    const c = { classList: { remove: (...n) => removed.push(...n) } };
    const img = { src: "chrome-extension://x/c-poses/mascot-push-up.svg", getAttribute() { return this.src; } };
    const root = { querySelector: (sel) => ({ ".c": c, ".c img": img })[sel] || null };
    return { shadowRoot: root, c, img, removed };
  }
  const calls = [];
  const P = {
    cookie: (o) => { calls.push("cookie"); if (o && o.off) return; hosts.push(makeHost()); },
    adversary: () => { calls.push("adversary"); hosts.push(makeHost()); }
  };
  class FakeObserver { constructor(cb) { this.cb = cb; observers.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } }
  const ctx = { document: { querySelectorAll: () => hosts.slice() }, MutationObserver: FakeObserver, chrome: { runtime: { getURL: (p) => "chrome-extension://x/" + p } } };
  ctx.window = ctx; ctx.window.PrivaCPrompt = P;
  vm.runInNewContext(fs.readFileSync(__dirname + "/../content/c-reaction-look.js", "utf8"), ctx);
  return { P, hosts, observers, calls };
}

test("when C switches to an uneasy pose after your choice, he holds still instead of pushing up again", () => {
  const { P, hosts, observers, calls } = setup();
  P.cookie({});
  assert.deepStrictEqual(calls, ["cookie"]);
  assert.strictEqual(observers.length, 1, "watches the new pop-up");
  assert.strictEqual(observers[0].target, hosts[0].shadowRoot);
  const h = hosts[0];
  observers[0].cb([]);                                      // the first pose is left alone
  assert.strictEqual(h.img.src, "chrome-extension://x/c-poses/mascot-push-up.svg");
  h.img.src = "chrome-extension://x/c-poses/mascot-push-up-uneasy.svg";   // c-prompt.js after "Let me choose"
  observers[0].cb([]);
  assert.strictEqual(h.img.src, "chrome-extension://x/c-poses/mascot-push-up-uneasy-still.svg");
  assert.deepStrictEqual(h.removed.sort(), ["hanging", "rising"], "no slide-in replay either");
  h.img.src = "chrome-extension://x/c-poses/mascot-cliff-hang-uneasy.svg"; // banner at the top of the page
  observers[0].cb([]);
  assert.strictEqual(h.img.src, "chrome-extension://x/c-poses/mascot-cliff-hang-uneasy-still.svg");
});

test("a cookie pop-up that's turned off in Settings adds nothing, and the adversary pop-up keeps its motion", () => {
  const { P, observers } = setup();
  P.cookie({ off: true });
  assert.strictEqual(observers.length, 0);
  P.adversary({ companies: [] });
  assert.strictEqual(observers.length, 0);
});
