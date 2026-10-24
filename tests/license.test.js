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

test("LICENSE says the data files keep their own licenses", () => {
  const text = fs.readFileSync(ROOT + "LICENSE", "utf8");
  for (const name of ["Tracker Radar", "CC BY-NC-SA 4.0", "Have I Been Pwned", "Open Cookie Database", "Gemma", "LiteRT-LM"]) {
    assert.ok(text.includes(name), "LICENSE names " + name);
  }
});

test("README points to the license", () => {
  const readme = fs.readFileSync(ROOT + "README.md", "utf8");
  assert.match(readme, /## License/);
  assert.match(readme, /\[MIT\]\(LICENSE\)/);
});
