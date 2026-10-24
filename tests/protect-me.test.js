// C's main cookie button says "Protect me" (repo owner, 2026-10-24): the pop-up protects you, it isn't just
// another button to click. "Decline extras" shouldn't appear anywhere people can see. Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("C's cookie pop-up button reads \"Protect me\"", () => {
  assert.match(read("content/c-prompt.js"), /<button class="primary" data-a="decline">Protect me<\/button>/);
});

test("no page people see still says \"Decline extras\"", () => {
  for (const f of ["content/c-prompt.js", "preview/c-variations.js", "preview/demo-site.html", "dashboard/dashboard.html",
    "dashboard/activity.js", "popup/popup.html", "popup/popup.js"]) {
    assert.ok(!/decline extras/i.test(read(f)), f);
  }
});
