#!/usr/bin/env node
/*
  Builds shared/cookie-db.json from the Open Cookie Database (Apache 2.0):
  https://github.com/jkwakman/Open-Cookie-Database
  Usage: node scripts/build-cookie-db.js ../Open-Cookie-Database/open-cookie-database.csv
*/
const fs = require("fs");
const path = require("path");
const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/build-cookie-db.js <open-cookie-database.csv>"); process.exit(1); }

function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const short = (s) => { s = String(s || "").replace(/\s+/g, " ").trim(); const m = s.match(/^.{0,140}?[.!?](\s|$)/); return (m ? m[0] : s.slice(0, 140)).trim(); };

const [head, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
const col = (n) => head.findIndex(h => h.trim().toLowerCase().startsWith(n));
const iP = col("platform"), iC = col("category"), iN = col("cookie"), iD = col("description"), iR = col("retention"), iO = col("data controller"), iW = col("wildcard");
const exact = {}, prefix = [];
for (const r of rows) {
  const name = (r[iN] || "").trim(); if (!name) continue;
  // [platform, category, what it does, how long it lasts, company]
  const v = [r[iP].trim(), r[iC].trim(), short(r[iD]), r[iR].trim(), r[iO].trim()];
  if (r[iW] && r[iW].trim() === "1") prefix.push([name, ...v]); else if (!exact[name]) exact[name] = v;
}
prefix.sort((a, b) => b[0].length - a[0].length);
const out = { builtAt: new Date().toISOString().slice(0, 10), source: "Open Cookie Database, Apache 2.0, https://github.com/jkwakman/Open-Cookie-Database",
  fields: ["platform", "category", "purpose", "retention", "company"], exact, prefix };
const dest = path.join(__dirname, "..", "shared", "cookie-db.json");
fs.writeFileSync(dest, JSON.stringify(out));
const cats = {}; for (const v of [...Object.values(exact), ...prefix.map(p => p.slice(1))]) cats[v[1]] = (cats[v[1]] || 0) + 1;
console.log(`Wrote ${dest}: ${Object.keys(exact).length} cookies + ${prefix.length} name patterns, ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`, cats);
