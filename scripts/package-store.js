// Makes the Chrome Web Store upload: dist/privac-<version>.zip with only the files the extension runs.
// Leaves out tests, docs, build scripts and a bundled AI model (models/, 2 GB; users download it in Ask C).
// Run: node scripts/package-store.js   (needs the `zip` command, built into macOS and Linux)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
// Everything the manifest and pages load. A test (tests/store-ready.test.js) checks nothing the extension needs is missing.
const INCLUDE = ["manifest.json", "background.js", "background", "content", "shared", "popup", "dashboard",
  "offscreen", "welcome", "preview", "vendor", "icons", "c-poses", "PRIVACY.md", "TERMS.md"];
const EXCLUDE = ["*.DS_Store", "*/README.md"];

function files() {
  const out = [];
  const walk = (rel) => {
    const full = path.join(root, rel);
    if (fs.statSync(full).isDirectory()) for (const f of fs.readdirSync(full).sort()) walk(path.join(rel, f));
    else if (!/\.DS_Store$|(^|\/)README\.md$/.test(rel) || rel === "PRIVACY.md") out.push(rel);
  };
  INCLUDE.filter((rel) => fs.existsSync(path.join(root, rel))).forEach(walk);
  return out;
}

if (require.main === module) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  const zip = path.join("dist", `privac-${version}.zip`);
  try { fs.unlinkSync(path.join(root, zip)); } catch (e) { /* first build */ }
  execFileSync("zip", ["-q", "-X", "-r", zip, ...INCLUDE.filter((rel) => fs.existsSync(path.join(root, rel))), "-x", ...EXCLUDE], { cwd: root, stdio: "inherit" });
  const mb = (fs.statSync(path.join(root, zip)).size / 1e6).toFixed(1);
  console.log(`Wrote ${zip} (${mb} MB, ${files().length} files). Upload it at https://chrome.google.com/webstore/devconsole`);
}

module.exports = { INCLUDE, files };
