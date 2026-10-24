#!/usr/bin/env node
/*
  Builds shared/ip-countries.json for PLAN F3 (server location), keeping only the 7 countries on the
  U.S. Commerce foreign-adversary list (15 CFR 7.4): CN, HK, RU, IR, CU, KP, VE.
  Source: the regional internet registries' public "delegated-extended" statistics files:
    RIPE NCC (Russia, Iran)   https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-extended-latest
    APNIC (China, HK, N. Korea) https://ftp.apnic.net/stats/apnic/delegated-apnic-extended-latest
    LACNIC (Cuba, Venezuela)  https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest
  Download them whole (through Chrome; the cloud workspace can't reach them), then:
    node scripts/build-ip-countries.js <file> <file> <file>
  Line format: registry|cc|type|start|value|date|status  (ipv4: value = number of addresses; ipv6: prefix length)
*/
const fs = require("fs");
const path = require("path");

const KEEP = new Set(["CN", "HK", "RU", "IR", "CU", "KP", "VE"]);

function v4ToNum(ip) { const p = ip.split(".").map(Number); return ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3]; }
function v6ToHex(ip) {
  const [h, t = ""] = ip.split("::");
  const head = h ? h.split(":") : [], rest = t ? t.split(":") : [];
  const groups = ip.includes("::") ? [...head, ...Array(8 - head.length - rest.length).fill("0"), ...rest] : head;
  return groups.map(g => g.padStart(4, "0")).join("");
}

function parse(texts) {
  const v4 = [], v6 = [], dates = {}, seen = new Set();
  for (const text of texts) {
    for (const line of text.split("\n")) {
      const p = line.trim().split("|");
      if (/^\d/.test(p[0]) && p.length >= 6 && !p[1].includes("*")) { dates[p[1]] = p[5]; continue; }   // version line: registry, date
      if (p.length < 7 || !KEEP.has(p[1]) || !["allocated", "assigned"].includes(p[6])) continue;
      seen.add(p[0]);
      if (p[2] === "ipv4") v4.push([v4ToNum(p[3]), Number(p[4]), p[1]]);
      else if (p[2] === "ipv6") v6.push([v6ToHex(p[3]), Number(p[4]), p[1]]);
    }
  }
  v4.sort((a, b) => a[0] - b[0]);
  const merged = [];            // join neighbouring blocks of the same country to keep the file small
  for (const r of v4) {
    const last = merged[merged.length - 1];
    if (last && last[2] === r[2] && last[0] + last[1] === r[0]) last[1] += r[1];
    else merged.push([...r]);
  }
  v6.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const registries = [...new Set([...Object.keys(dates), ...seen])].sort().map(r => dates[r] ? `${r} (${dates[r]})` : r);
  return { v4: merged, v6, registries };
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("Usage: node scripts/build-ip-countries.js <delegated files...>"); process.exit(1); }
  const { v4, v6, registries } = parse(files.map(f => fs.readFileSync(f, "utf8")));
  const out = {
    builtAt: new Date().toISOString().slice(0, 10),
    source: "Regional internet registries' delegated-extended statistics: " + registries.join(", ") + ". Country = where the address holder is registered.",
    countries: [...KEEP],
    v4, v6
  };
  const file = path.join(__dirname, "..", "shared", "ip-countries.json");
  fs.writeFileSync(file, JSON.stringify(out));
  const by = {}; for (const r of [...v4, ...v6]) by[r[2]] = (by[r[2]] || 0) + 1;
  console.log(`Wrote ${file}: ${v4.length} IPv4 ranges, ${v6.length} IPv6 blocks ${JSON.stringify(by)}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
module.exports = { parse };
