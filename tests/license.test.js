// The repo carries an open-source license (MIT) for the team's own code, so judges and MLH's
// "Best Open Source Project" prize can see it, while the data files keep their own licenses.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const ROOT = __dirname + "/../";

test("LICENSE is the MIT license with the team's copyright", () => {
  const text = fs.readFileSync(ROOT + "LICENSE", "utf8");
  assert.match(text, /^MIT License/);
  assert.match(text, /Copyright \(c\) 2026 The PrivaC team/);
  assert.match(text, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

// GitHub only shows "MIT license" when LICENSE is the standard text and nothing else (2026-10-25: the data list
// after it hid the license from GitHub). The data files' own licenses live in THIRD_PARTY_LICENSES.md.
test("LICENSE is only the standard MIT text, so GitHub detects it", () => {
  const text = fs.readFileSync(ROOT + "LICENSE", "utf8").trim();
  assert.ok(text.endsWith("OTHER DEALINGS IN THE\nSOFTWARE."), "nothing after the MIT text");
  assert.doesNotMatch(text, /Third-party|Tracker Radar/);
});

test("THIRD_PARTY_LICENSES.md says the data files keep their own licenses", () => {
  const text = fs.readFileSync(ROOT + "THIRD_PARTY_LICENSES.md", "utf8");
  for (const name of ["Tracker Radar", "CC BY-NC-SA 4.0", "Have I Been Pwned", "Open Cookie Database", "Gemma", "LiteRT-LM"]) {
    assert.ok(text.includes(name), "THIRD_PARTY_LICENSES.md names " + name);
  }
});

test("README points to the license", () => {
  const readme = fs.readFileSync(ROOT + "README.md", "utf8");
  assert.match(readme, /## License/);
  assert.match(readme, /\[MIT\]\(LICENSE\)/);
  assert.match(readme, /\(THIRD_PARTY_LICENSES\.md\)/);
});
