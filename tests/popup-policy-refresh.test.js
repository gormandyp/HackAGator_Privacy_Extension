// Preston, 2026-10-25: the privacy policy reading sometimes didn't show when the pop-up was opened. The policy is read in
// the background (up to 7 AI calls, about a minute) and the pop-up drew once, so an answer that arrived while it was open
// stayed hidden until it was closed and opened again. Now the pop-up redraws when this site's policy answer is saved.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const js = fs.readFileSync(__dirname + "/../popup/popup.js", "utf8");

// Pull out the refresh function and run it with a fake Chrome.
function load() {
  const m = js.match(/\n  (function redrawWhenPolicyRead\(site, reading\) \{[\s\S]*?\n  \})\n/);
  assert.ok(m, "popup.js has redrawWhenPolicyRead(site, reading)");
  const listeners = [];
  const ctx = { reloads: 0, chrome: { storage: { onChanged: { addListener: (f) => listeners.push(f) } } } };
  ctx.location = { reload: () => { ctx.reloads++; } };
  vm.runInNewContext(m[1] + "\nthis.redrawWhenPolicyRead = redrawWhenPolicyRead;", ctx);
  const fire = (sites, area = "local") => listeners.forEach((f) => f({ privacData: { newValue: { sites } } }, area));
  return { ctx, fire };
}

test("the pop-up redraws when this site's policy answer is saved while it is open", () => {
  const { ctx, fire } = load();
  ctx.redrawWhenPolicyRead({ domain: "news.example", policy: { sells: null, shares: null, source: null } });
  fire([{ domain: "news.example", policy: { sells: null, shares: null, source: null }, trackers: [{ domain: "t.example" }] }]);
  assert.strictEqual(ctx.reloads, 0, "a tracker save alone doesn't redraw");
  fire([{ domain: "other.example", policy: { sells: true, checkedAt: "2026-10-25T16:00:00Z" } }]);
  assert.strictEqual(ctx.reloads, 0, "another site's policy doesn't redraw");
  fire([{ domain: "news.example", policy: { sells: false, checkedAt: "2026-10-25T16:00:00Z" } }], "session");
  assert.strictEqual(ctx.reloads, 0, "only privacData in local storage counts");
  fire([{ domain: "news.example", policy: { sells: false, shares: true, source: "https://news.example/privacy", checkedAt: "2026-10-25T16:00:00Z" } }]);
  assert.strictEqual(ctx.reloads, 1, "the new answer redraws the pop-up");
});

test("an already-read policy doesn't make the pop-up redraw again", () => {
  const { ctx, fire } = load();
  const policy = { sells: false, shares: true, checkedAt: "2026-10-20T10:00:00Z" };
  ctx.redrawWhenPolicyRead({ domain: "news.example", policy });
  fire([{ domain: "news.example", policy: { ...policy } }]);
  assert.strictEqual(ctx.reloads, 0);
});

test("the pop-up turns the refresh on only for the real site, not a ?site= preview", () => {
  assert.match(js, /if \(inExtension && !preview\) redrawWhenPolicyRead\(site, !!reading\[site\.domain\]\);/);
});
