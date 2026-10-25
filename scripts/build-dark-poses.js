// Makes the white-limbed copies of C for dark websites: c-poses/*.svg -> c-poses/dark/*.svg.
// Run after adding or changing any pose file (and after scripts/freeze-pose.js):
//   node scripts/build-dark-poses.js
// tests/c-ink.test.js fails if a copy is missing or out of date.
const fs = require("fs");
const path = require("path");
const { darkenSvg } = require("../shared/c-ink.js");

const src = path.join(__dirname, "..", "c-poses");
const out = path.join(src, "dark");
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(src).filter((f) => f.endsWith(".svg"));
for (const f of files) {
  fs.writeFileSync(path.join(out, f), darkenSvg(fs.readFileSync(path.join(src, f), "utf8")));
}
console.log(`Wrote ${files.length} white-limbed poses to c-poses/dark/`);
