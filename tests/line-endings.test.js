// Windows: GitHub Desktop / Git for Windows turn "\n" into "\r\n" on checkout (core.autocrlf=true).
// Files that tests compare byte-for-byte (like the wallpapers) must stay "\n" everywhere.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

test(".gitattributes keeps text files with \\n line endings on every computer (Windows too)", () => {
  const file = path.join(__dirname, "..", ".gitattributes");
  assert.ok(fs.existsSync(file), ".gitattributes is missing");
  const rules = fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim());
  assert.ok(rules.includes("* text=auto eol=lf"), 'needs the line "* text=auto eol=lf"');
});

test("the wallpapers have no Windows line endings", () => {
  const dir = path.join(__dirname, "..", "shared", "wallpapers");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
    assert.ok(!fs.readFileSync(path.join(dir, f), "utf8").includes("\r"), f);
  }
});
