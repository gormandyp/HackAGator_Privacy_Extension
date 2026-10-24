// dashboard/tab-icons.js: the top bar's tabs show an icon and the name; narrow windows show icons with the name on hover; Ask C is C himself.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// A tiny stand-in for the dashboard's tab buttons.
function fakeTabs(names) {
  const buttons = names.map(([tab, text]) => {
    const b = { dataset: { tab }, attrs: {}, innerHTML: "", textContent: text, classList: { add() {} } };
    b.setAttribute = (k, v) => { b.attrs[k] = v; };
    return b;
  });
  return { buttons, doc: { getElementById: (id) => (id === "tabs" ? { querySelectorAll: () => buttons, classList: { add() {} } } : null) } };
}

test("every tab gets an icon, keeps its name for screen readers, and shows it on hover", () => {
  const names = [["overview", "Overview"], ["sites", "Sites"], ["impact", "C's impact"], ["safety", "Safety"], ["ask", "Ask C"], ["grades", "Grades"], ["about", "About"]];
  const { buttons, doc } = fakeTabs(names);
  global.window = { PrivaCMascot: { svg: (mood, o) => `<svg data-mascot="${mood}" aria-label="${o.label}"></svg>` } };
  global.document = doc;
  delete require.cache[require.resolve("../dashboard/tab-icons.js")];
  require("../dashboard/tab-icons.js");
  for (const [i, b] of buttons.entries()) {
    const name = names[i][1];
    assert.strictEqual(b.attrs["aria-label"], name);
    assert.strictEqual(b.dataset.tip, name);
    assert.match(b.innerHTML, /<svg/);
    assert.match(b.innerHTML, new RegExp(`class="tab-label">${name.replace("'", "'")}<`), "the name stays in the page, visually hidden");
  }
  assert.match(buttons[4].innerHTML, /data-mascot="happy"/, "Ask C is C's face");
  assert.match(buttons[6].innerHTML, /<circle/, "About is the (i) icon");
});

test("the dashboard loads the icons before tabs.js measures the tab widths, and styles the hover label", () => {
  const html = read("dashboard/dashboard.html");
  assert.ok(html.indexOf("tab-icons.js") > 0 && html.indexOf("tab-icons.js") < html.indexOf('src="tabs.js"'));
  assert.ok(html.indexOf("mascot.js") < html.indexOf("tab-icons.js"));
  const css = read("dashboard/dashboard.css");
  // Wide windows: icon and name side by side. Narrower windows: icons only, name in a hover label.
  const narrow = css.slice(css.indexOf("@media (max-width: 1180px)"));
  assert.ok(narrow.length > 30, "a narrow-window rule exists");
  assert.match(narrow, /#tabs\.icon-tabs button::after[\s\S]*attr\(data-tip\)/);
  assert.match(narrow, /\.tab-label\s*\{[^}]*clip/);
  const wide = css.slice(css.indexOf("/* Top bar tabs: icon + name"), css.indexOf("@media (max-width: 1180px)"));
  assert.doesNotMatch(wide, /\.tab-label\s*\{[^}]*clip/, "the name is visible in wide windows");
  assert.match(wide, /button\[aria-selected="true"\] svg \{ color: var\(--focus\)/, "the selected tab's icon turns orange");
});
