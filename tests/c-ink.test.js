// shared/c-ink.js: C's arms and legs turn white on dark websites so he stays visible next to a dark cookie
// banner. These are the color rules and the white-limbed copies of the pose files. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = globalThis;
require("../shared/c-ink.js");
const Ink = window.PrivaCInk;

const ROOT = path.join(__dirname, "..");
const NAVY = "#16233f";
const POSES = path.join(ROOT, "c-poses");
const DARK = path.join(POSES, "dark");
const poseFiles = () => fs.readdirSync(POSES).filter((f) => f.endsWith(".svg"));

test("reads the colors a browser reports for backgrounds", () => {
  assert.deepStrictEqual(Ink.parseColor("rgb(17, 24, 39)"), { r: 17, g: 24, b: 39, a: 1 });
  assert.deepStrictEqual(Ink.parseColor("rgba(0, 0, 0, 0.5)"), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.deepStrictEqual(Ink.parseColor("rgb(255 255 255 / 0.25)"), { r: 255, g: 255, b: 255, a: 0.25 });
  assert.deepStrictEqual(Ink.parseColor("#16233f"), { r: 22, g: 35, b: 63, a: 1 });
  assert.strictEqual(Ink.parseColor("transparent").a, 0);
  assert.strictEqual(Ink.parseColor("not a color"), null);
});

test("picks white limbs on dark backgrounds and navy limbs on light ones", () => {
  const ink = (css) => Ink.inkFor(Ink.parseColor(css));
  assert.strictEqual(ink("rgb(255, 255, 255)"), "navy");
  assert.strictEqual(ink("rgb(221, 221, 221)"), "navy");
  assert.strictEqual(ink("rgb(250, 204, 21)"), "navy", "yellow banner");
  assert.strictEqual(ink("rgb(0, 0, 0)"), "white");
  assert.strictEqual(ink("rgb(17, 24, 39)"), "white", "a typical dark-mode page");
  assert.strictEqual(ink("rgb(51, 51, 51)"), "white");
  assert.strictEqual(ink("rgb(30, 64, 175)"), "white", "a deep blue banner");
});

test("see-through layers are mixed with what's under them", () => {
  const halfBlack = Ink.parseColor("rgba(0, 0, 0, 0.6)");
  const white = Ink.parseColor("rgb(255, 255, 255)");
  const mixed = Ink.over(halfBlack, white);
  assert.strictEqual(mixed.a, 1);
  assert.ok(mixed.r > 95 && mixed.r < 110, "60% black over white is a mid-dark grey, got " + mixed.r);
  assert.strictEqual(Ink.inkFor(mixed), "white");
});

test("C's face stays navy; arms, hands, fingers and legs are limbs", () => {
  const attrs = (o) => (n) => o[n];
  // Face: brows, mouths, eyes, pupils, the alarmed mouth.
  assert.ok(Ink.isFacePart("path", attrs({ d: "M48 43 L57 39.5 M72 43 L63 39.5" })), "uneasy brows");
  assert.ok(Ink.isFacePart("path", attrs({ d: "M47 37 Q52 33 57 35" })), "alarmed brows");
  assert.ok(Ink.isFacePart("path", attrs({ d: "M51 66 Q60 75 69 66" })), "smile");
  assert.ok(Ink.isFacePart("path", attrs({ d: "M52 68 Q60 65 68 68" })), "flat mouth");
  assert.ok(Ink.isFacePart("circle", attrs({ r: "6.5" })), "eye");
  assert.ok(Ink.isFacePart("circle", attrs({ r: "3.2" })), "pupil");
  assert.ok(Ink.isFacePart("ellipse", attrs({})), "alarmed mouth");
  // The yield sign's border and lettering sit on yellow.
  assert.ok(Ink.isFacePart("path", attrs({ d: "M84 -20 L152 -20 L118 36 Z", fill: "#ffcc00" })));
  assert.ok(Ink.isFacePart("path", attrs({ d: "M93 -14 L143 -14 L118 27 Z" })));
  assert.ok(Ink.isFacePart("text", attrs({})));
  // Limbs.
  assert.ok(!Ink.isFacePart("path", attrs({ d: "M23 66 L10 82" })), "arm");
  assert.ok(!Ink.isFacePart("path", attrs({ d: "M50 96 L45 124 L38 125" })), "leg");
  assert.ok(!Ink.isFacePart("path", attrs({ d: "M30 7 L30 2 Q30 -1 34 -1" })), "fingers over an edge");
  assert.ok(!Ink.isFacePart("circle", attrs({ r: "4.6" })), "hand holding the sign");
});

test("darkenSvg turns only the limbs white", () => {
  const svg = `<svg><path d="M23 66 L10 82" stroke="${NAVY}" stroke-width="4"/>` +
    `<path d="M51 66 Q60 75 69 66" fill="none" stroke="${NAVY}" stroke-width="4"/>` +
    `<circle cx="53" cy="52" r="6.5" fill="#fff" stroke="${NAVY}"/></svg>`;
  const out = Ink.darkenSvg(svg);
  assert.ok(out.includes(`<path d="M23 66 L10 82" stroke="#ffffff" stroke-width="4"/>`), out);
  assert.ok(out.includes(`<path d="M51 66 Q60 75 69 66" fill="none" stroke="${NAVY}"`), "mouth untouched");
  assert.ok(out.includes(`r="6.5" fill="#fff" stroke="${NAVY}"`), "eye untouched");
});

test("darkenSvg puts a white face disc behind the C, so his navy brows and mouth show on a dark page", () => {
  const svg = `<svg><path d="M86.9 31.1 A38 38 0 1 0 86.9 84.9" stroke="#fa4616"/><path d="M51 66 Q60 75 69 66" stroke="${NAVY}"/></svg>`;
  const out = Ink.darkenSvg(svg);
  assert.ok(out.includes(Ink.FACE_DISC + '<path d="M86.9 31.1'), out);
  assert.strictEqual(out.split(Ink.FACE_DISC).length, 2, "only one disc");
  assert.strictEqual(Ink.darkenSvg(out), out, "running it twice changes nothing");
});

test("every pose file has an up-to-date white-limbed copy in c-poses/dark/ (rebuild: node scripts/build-dark-poses.js)", () => {
  const files = poseFiles();
  assert.ok(files.length >= 7, "found the pose files");
  for (const f of files) {
    const dark = path.join(DARK, f);
    assert.ok(fs.existsSync(dark), "missing c-poses/dark/" + f);
    const want = Ink.darkenSvg(fs.readFileSync(path.join(POSES, f), "utf8"));
    assert.strictEqual(fs.readFileSync(dark, "utf8"), want, "c-poses/dark/" + f + " is out of date");
  }
});

test("the white-limbed copies keep C's face navy on a white face disc and have no navy limbs left", () => {
  for (const f of poseFiles()) {
    const text = fs.readFileSync(path.join(DARK, f), "utf8");
    assert.ok(text.includes("#ffffff"), f + " has white limbs");
    assert.ok(text.includes(Ink.FACE_DISC + '<path d="M86.9 31.1'), f + " has a white face disc right behind the C");
    for (const m of text.matchAll(/<(path|circle|ellipse|text|rect)\b([^>]*)>/g)) {
      if (!m[2].includes(NAVY)) continue;
      const get = (n) => { const a = new RegExp(`\\s${n}="([^"]*)"`).exec(m[2]); return a ? a[1] : undefined; };
      assert.ok(Ink.isFacePart(m[1], get), f + ": a navy limb is left: " + m[0].slice(0, 60));
    }
    assert.ok(!text.includes("\r"), f + " keeps \\n line endings");
  }
});

test("the manifest loads the color rules and the background check, and pages may show the dark copies", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const main = m.content_scripts.find((c) => c.js.includes("content/c-prompt.js"));
  const at = (f) => main.js.indexOf(f);
  assert.ok(at("shared/c-ink.js") >= 0 && at("content/c-contrast.js") >= 0);
  assert.ok(at("shared/c-ink.js") < at("content/c-contrast.js"), "rules load first");
  assert.ok(at("content/c-prompt.js") < at("content/c-contrast.js"), "hooks into C's pop-up after it exists");
  const shared = m.web_accessible_resources.flatMap((w) => w.resources);
  assert.ok(shared.includes("c-poses/dark/*.svg"));
});
