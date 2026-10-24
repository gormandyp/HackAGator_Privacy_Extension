// Chrome Web Store requirements we can check in code (docs/STORE.md has the full list).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const manifest = JSON.parse(read("manifest.json"));

test("manifest: the Store's limits (name up to 75 characters, description up to 132)", () => {
  assert.ok(manifest.name.length <= 75, manifest.name);
  assert.ok(manifest.description.length <= 132, `description is ${manifest.description.length} characters`);
  assert.match(manifest.version, /^\d+(\.\d+){0,3}$/);
  assert.ok(fs.existsSync(path.join(root, manifest.icons["128"])), "128px store icon");
});

test("manifest: only permissions the code uses (activeTab isn't; full site access already covers it)", () => {
  assert.ok(!manifest.permissions.includes("activeTab"));
  for (const p of manifest.permissions) {
    if (p === "unlimitedStorage") { assert.match(read("shared/brain-core.js"), /caches\.open/); continue; }
    const used = ["background.js", "background", "shared", "content", "popup", "dashboard", "offscreen"].some((d) => {
      const full = path.join(root, d);
      const files = fs.statSync(full).isDirectory() ? fs.readdirSync(full).filter((f) => f.endsWith(".js")).map((f) => path.join(full, f)) : [full];
      return files.some((f) => fs.readFileSync(f, "utf8").includes(`chrome.${p}`));
    });
    assert.ok(used, `${p} is declared but no code uses chrome.${p}`);
  }
});

test("no stylesheet or script is loaded from the internet (fonts are bundled)", () => {
  const files = ["shared/theme.css", "shared/ui.css", "popup/popup.css", "dashboard/dashboard.css", "popup/popup.html", "dashboard/dashboard.html", "welcome/welcome.html"];
  for (const f of files) {
    const text = read(f);
    assert.doesNotMatch(text, /@import\s+url\(\s*["']?https?:/i, f);
    assert.doesNotMatch(text, /<(script|link)[^>]+(src|href)="https?:/i, f);
  }
  assert.match(read("shared/theme.css"), /@font-face[\s\S]*url\("fonts\//);
});

test("a privacy policy with the Limited Use statement is in the repo", () => {
  const p = read("PRIVACY.md");
  assert.match(p, /Limited Use/);
  assert.match(p, /never sells?/i);
  for (const thing of ["haveibeenpwned.com", "cppa.ca.gov", "huggingface.co", "localhost:11434"]) assert.ok(p.includes(thing), `names ${thing}`);   // same policy on every branch
});

test("on first install PrivaC opens the welcome page that says what it records", () => {
  assert.match(read("background.js"), /reason === "install"[\s\S]{0,200}welcome\/welcome\.html/);
  const w = read("welcome/welcome.html");
  for (const words of [/site names/i, /7 days/, /90 days/, /never/i, /Do not sell/i, /Settings/]) assert.match(w, words);
  assert.doesNotMatch(w, /<script>[^<]/, "no inline scripts (extension pages block them)");
});

test("the store package includes every file the manifest, pages and scripts load", () => {
  const { files } = require("../scripts/package-store.js");
  const packed = new Set(files().map((f) => f.split(path.sep).join("/")));
  const needed = [manifest.background.service_worker, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap((c) => c.js)];
  const bg = read("background.js").match(/importScripts\(([^)]*)\)/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  needed.push(...bg);
  // offscreen/ and vendor/ exist only in the in-browser AI version (main), not on ui-glass or ollama.
  for (const page of ["popup/popup.html", "dashboard/dashboard.html", "offscreen/brain.html", "welcome/welcome.html"].filter((f) => fs.existsSync(path.join(root, f)))) {
    needed.push(page);
    for (const m of read(page).matchAll(/(?:src|href)="(\.\.\/)?([^"#?:]+\.(?:js|css|mjs))"/g)) {
      needed.push(path.posix.normalize(path.posix.join(path.posix.dirname(page), (m[1] || "") + m[2])));
    }
  }
  needed.push("shared/fonts/bricolage-grotesque.woff2", "shared/fonts/figtree.woff2");
  if (fs.existsSync(path.join(root, "vendor"))) needed.push("vendor/litert-lm/wasm/litertlm_wasm_internal.wasm");
  for (const f of needed) assert.ok(packed.has(f), `missing from the store zip: ${f}`);
  for (const f of packed) assert.ok(!/^(tests|docs|scripts|models)\//.test(f), `shouldn't ship: ${f}`);
});

test("the privacy policy names every outside address the extension's code contacts", () => {
  const dirs = ["background.js", "background", "shared", "offscreen"];
  const hosts = new Set();
  for (const d of dirs) {
    const full = path.join(root, d);
    const files = fs.statSync(full).isDirectory() ? fs.readdirSync(full).filter((f) => f.endsWith(".js")).map((f) => path.join(full, f)) : [full];
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/["'`](https?:\/\/([^/"'`]+)[^"'`]*)["'`]/g)) {
        if (/w3\.org$/.test(m[2])) continue;   // XML namespaces, never fetched
        hosts.add(m[2].replace(/^www\./, ""));
      }
    }
  }
  assert.ok(hosts.size >= 4, [...hosts].join(", "));
  const p = read("PRIVACY.md");
  for (const h of hosts) assert.ok(p.includes(h), `PRIVACY.md doesn't mention ${h}`);
  assert.match(p, /IP address/, "says that any download shows the server your IP address");
});

test("terms of use exist, point to the privacy policy and keep the data licenses' rules", () => {
  const t = read("TERMS.md");
  assert.match(t, /PRIVACY\.md/);
  assert.match(t, /as is/i);
  assert.match(t, /not legal advice/i);
  assert.match(t, /non-commercial/i, "Tracker Radar is CC BY-NC-SA: PrivaC must stay free");
  assert.match(read("welcome/welcome.html"), /TERMS\.md/);
});
