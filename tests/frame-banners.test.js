// Cookie pop-ups that live in an iframe (Sourcepoint, TrustArc and other consent tools draw theirs in a frame
// from another website). The detector also runs inside frames: it finds the Reject button there, and the
// background passes messages between that frame and the top page, where C shows. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(__dirname + "/../content/cookie-detector.js", "utf8");
// Objects made inside the test page are copied out, so deepStrictEqual compares only their contents.
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const OFF = "OptanonConsent=isGpcEnabled=0&groups=C0001%3A1%2CC0002%3A0%2CC0004%3A0";

function control(label) {
  return {
    innerText: label, value: "", isConnected: true, clicks: 0, scrolled: 0,
    getAttribute: () => null,
    matches: () => true,   // every fake control here is a button
    getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 100, right: 220, width: 120, height: 40 }),
    closest: () => null,
    click() { this.clicks++; },
    addEventListener() {},
    scrollIntoView() { this.scrolled++; }
  };
}

// Loads the detector in a frame (inFrame) or on the top page. `reply` answers the top page's messages.
function load(labels, { inFrame = false, cookie = "", reply } = {}) {
  const controls = labels.map(control);
  const calls = [], sent = [];
  let listener = null;
  const ctx = {
    console: { log() {}, warn() {}, table() {}, error() {} },
    document: { cookie, documentElement: {}, querySelectorAll: (sel) => (sel === "*" ? [] : controls) },
    location: { hostname: "www.news.example" }, innerWidth: 1440, innerHeight: 900,
    MutationObserver: class { observe() {} },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    setTimeout: (fn, ms) => { if (ms <= 200) setImmediate(fn); return 0; },
    clearTimeout() {},
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    chrome: {
      storage: { local: { get: async () => ({ privacData: { sites: [] } }), set: async () => {} } },
      runtime: {
        id: "privac-test",
        sendMessage: (msg) => { sent.push(plain(msg)); return reply ? reply(msg) : Promise.resolve(); },
        onMessage: { addListener: (fn) => { listener = fn; } }
      }
    }
  };
  ctx.window = ctx;
  ctx.top = inFrame ? {} : ctx;
  if (!inFrame) {
    ctx.PrivaCPrompt = {
      cookie(opts) { calls.push(["cookie", opts]); }, acceptOnly() { calls.push(["acceptOnly"]); },
      positionAtBanner() {}, hide() { calls.push(["hide"]); }, ignored() {},
      isReacting: () => false, isCelebrating: () => false
    };
  }
  vm.runInNewContext(SRC, ctx);
  // Delivers a message the way Chrome does; resolves with what the listener answered.
  const deliver = (msg) => new Promise((resolve) => {
    const kept = listener(msg, {}, (a) => resolve(plain(a)));
    if (kept !== true) setImmediate(() => resolve(undefined));
  });
  return { controls, calls, sent, ctx, deliver, kinds: () => calls.map((c) => c[0]) };
}

test("in a frame: a Reject button is reported once to the background, and no pop-up is drawn in the frame", () => {
  const frame = load(["Accept all", "Reject all"], { inFrame: true });
  frame.ctx.PrivaCCookieCheck();
  frame.ctx.PrivaCCookieCheck();
  assert.deepStrictEqual(frame.sent, [{ type: "privac-frame-banner" }]);
});

test("in a frame with no Reject button: nothing is sent", () => {
  const frame = load(["Play video", "Subscribe"], { inFrame: true });
  assert.deepStrictEqual(frame.sent, []);
});

test("in a frame: \"Protect me\" clicks the frame's Reject button and says whether the pop-up went away", async () => {
  const frame = load(["Accept all", "Reject all"], { inFrame: true });
  const reject = frame.controls[1];
  reject.click = () => { reject.clicks++; reject.isConnected = false; };
  assert.deepStrictEqual(await frame.deliver({ type: "privac-frame-decline" }), { dismissed: true });
  assert.strictEqual(reject.clicks, 1);

  const stuck = load(["Accept all", "Reject all"], { inFrame: true });
  assert.deepStrictEqual(await stuck.deliver({ type: "privac-frame-decline" }), { dismissed: false });
});

test("in a frame: \"Let me choose\" scrolls the frame's pop-up into view", async () => {
  const frame = load(["Accept all", "Reject all"], { inFrame: true });
  await frame.deliver({ type: "privac-frame-choose" });
  assert.strictEqual(frame.controls[1].scrolled, 1);
});

test("in a frame: when the Reject button goes away (you chose on the site), the top page is told", () => {
  const frame = load(["Accept all", "Reject all"], { inFrame: true });
  frame.controls[1].isConnected = false;
  frame.ctx.PrivaCCookieCheck();
  assert.deepStrictEqual(frame.sent, [{ type: "privac-frame-banner" }, { type: "privac-frame-gone" }]);
});

test("top page: a frame's pop-up opens C's cookie offer, once per frame", async () => {
  const top = load([]);
  await top.deliver({ type: "privac-frame-banner", frameId: 4 });
  await top.deliver({ type: "privac-frame-banner", frameId: 4 });
  assert.deepStrictEqual(top.kinds(), ["cookie"]);
});

test("top page: C already offering for a Reject button on the page itself ignores the frame", async () => {
  const top = load(["Accept all", "Reject all"]);
  await top.deliver({ type: "privac-frame-banner", frameId: 4 });
  assert.deepStrictEqual(top.kinds(), ["cookie"]);
});

async function declineThroughFrame(answer, cookie = "") {
  const top = load([], { cookie, reply: async (msg) => (msg.type === "privac-frame-decline" ? answer() : undefined) });
  await top.deliver({ type: "privac-frame-banner", frameId: 4 });
  const result = await top.calls[0][1].onDecline();
  return { result, sent: top.sent };
}

test("top page: \"Protect me\" asks that frame to decline, and is honest about the result", async () => {
  const gone = await declineThroughFrame(async () => ({ dismissed: true }));
  assert.deepStrictEqual(gone.sent, [{ type: "privac-frame-decline", frameId: 4 }]);
  assert.strictEqual(gone.result, "unverified", "the pop-up closed, but no consent record to check");
  assert.strictEqual((await declineThroughFrame(async () => ({ dismissed: true }), OFF)).result, "confirmed");
  assert.strictEqual((await declineThroughFrame(async () => ({ dismissed: false }))).result, "failed");
  assert.strictEqual((await declineThroughFrame(async () => { throw new Error("frame closed"); })).result, "failed");
});

test("top page: \"Let me choose\" asks the frame to show its pop-up", async () => {
  const top = load([]);
  await top.deliver({ type: "privac-frame-banner", frameId: 4 });
  top.calls[0][1].onChoose();
  assert.deepStrictEqual(top.sent, [{ type: "privac-frame-choose", frameId: 4 }]);
});

test("top page: the frame's pop-up went away on its own, so C's offer is hidden", async () => {
  const top = load([]);
  await top.deliver({ type: "privac-frame-banner", frameId: 4 });
  await top.deliver({ type: "privac-frame-gone", frameId: 4 });
  assert.deepStrictEqual(top.kinds(), ["cookie", "hide"]);
});

// background/frames.js passes the messages along inside the same tab. Nothing leaves the computer.
function background() {
  const sent = [];
  let listener = null;
  const ctx = {
    self: {},
    chrome: {
      runtime: { onMessage: { addListener: (fn) => { listener = fn; } } },
      tabs: { sendMessage: (tabId, msg, opts) => { sent.push(plain([tabId, msg, opts])); return Promise.resolve({ dismissed: true }); } }
    }
  };
  vm.runInNewContext(fs.readFileSync(__dirname + "/../background/frames.js", "utf8"), ctx);
  return { sent, send: (msg, sender, reply = () => {}) => listener(msg, sender, (a) => reply(plain(a))) };
}

test("background: a frame's pop-up is passed to the top page of the same tab, with which frame it was", () => {
  const bg = background();
  bg.send({ type: "privac-frame-banner" }, { tab: { id: 7 }, frameId: 3 });
  bg.send({ type: "privac-frame-gone" }, { tab: { id: 7 }, frameId: 3 });
  bg.send({ type: "privac-frame-banner" }, { tab: { id: 7 }, frameId: 0 });
  assert.deepStrictEqual(bg.sent, [
    [7, { type: "privac-frame-banner", frameId: 3 }, { frameId: 0 }],
    [7, { type: "privac-frame-gone", frameId: 3 }, { frameId: 0 }]
  ]);
});

test("background: the top page's \"Protect me\" goes to that frame, and its answer comes back", async () => {
  const bg = background();
  const answer = await new Promise((resolve) => {
    assert.strictEqual(bg.send({ type: "privac-frame-decline", frameId: 3 }, { tab: { id: 7 }, frameId: 0 }, resolve), true);
  });
  assert.deepStrictEqual(bg.sent, [[7, { type: "privac-frame-decline" }, { frameId: 3 }]]);
  assert.deepStrictEqual(answer, { dismissed: true });
  bg.send({ type: "privac-frame-choose", frameId: 3 }, { tab: { id: 7 }, frameId: 0 });
  assert.deepStrictEqual(bg.sent[1], [7, { type: "privac-frame-choose" }, { frameId: 3 }]);
});

test("manifest: only the cookie detector runs inside frames, and the background loads the relay", () => {
  const manifest = JSON.parse(fs.readFileSync(__dirname + "/../manifest.json", "utf8"));
  const inFrames = manifest.content_scripts.filter((c) => c.all_frames);
  assert.deepStrictEqual(inFrames.map((c) => c.js), [["content/cookie-detector.js"]]);
  assert.match(fs.readFileSync(__dirname + "/../background.js", "utf8"), /importScripts\([^)]*"background\/frames\.js"/);
});
