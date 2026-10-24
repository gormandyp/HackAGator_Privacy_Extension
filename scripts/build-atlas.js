#!/usr/bin/env node
/*
  Builds shared/atlas.json: which company owns each known tracker domain and what it's for.
  Source: DuckDuckGo Tracker Radar (CC BY-NC-SA 4.0), US crawl.

  Usage:
    git clone --depth 1 --filter=blob:none --sparse https://github.com/duckduckgo/tracker-radar.git ../tracker-radar
    (cd ../tracker-radar && git sparse-checkout set domains/US entities)
    node scripts/build-atlas.js ../tracker-radar

  Countries are NOT in Tracker Radar. They come from COUNTRY below (headquarters, hand-checked).
  Unknown = null, which never triggers a foreign-adversary flag.
*/
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) { console.error("Usage: node scripts/build-atlas.js <path to tracker-radar>"); process.exit(1); }

// Tracker Radar category -> PrivaC category, in priority order. Anything else (CDN, payments, embeds) is not a tracker.
const CATEGORY_MAP = [
  ["Malware", "Malware"],
  ["Unknown High Risk Behavior", "High-risk"],
  ["Session Replay", "Session recording"],
  ["Advertising", "Advertising"],
  ["Ad Motivated Tracking", "Advertising"],
  ["Action Pixels", "Advertising"],
  ["Third-Party Analytics Marketing", "Analytics"],
  ["Audience Measurement", "Analytics"],
  ["Analytics", "Analytics"],
  ["Social Network", "Social"],
  ["Social - Share", "Social"],
  ["Social - Comment", "Social"],
  ["Obscure Ownership", "Obscure ownership"]
];

// Headquarters country for companies people ask about most. Keep it short and certain.
const COUNTRY = {
  "Google": "US", "Facebook": "US", "Meta": "US", "Amazon": "US", "Amazon.com": "US", "Microsoft": "US", "Apple": "US",
  "Adobe": "US", "Oracle": "US", "Twitter": "US", "X Corp": "US", "Pinterest": "US", "Snap": "US", "LinkedIn": "US",
  "Comscore": "US", "comScore": "US", "Nielsen": "US", "LiveRamp": "US", "The Trade Desk": "US", "Quantcast": "US",
  "Taboola": "US", "Outbrain": "US", "Salesforce": "US", "HubSpot": "US", "Yahoo": "US", "Verizon Media": "US",
  "Magnite": "US", "PubMatic": "US", "Index Exchange": "CA", "OpenX": "US", "Xandr": "US", "AppNexus": "US",
  "Lotame": "US", "Neustar": "US", "TransUnion": "US", "Experian": "IE", "Acxiom": "US", "Epsilon": "US",
  "New Relic": "US", "Mixpanel": "US", "Segment": "US", "Amplitude": "US", "Heap": "US", "FullStory": "US",
  "Optimizely": "US", "Mouseflow": "DK", "Smartlook": "CZ", "Hotjar": "MT", "Criteo": "FR", "Teads": "FR",
  "Sizmek": "US", "Integral Ad Science": "US", "DoubleVerify": "US", "Moat": "US", "Tapad": "US", "Zeta Global": "US",
  "Yandex": "RU", "Mail.ru": "RU", "Mail.Ru Group": "RU", "VK": "RU", "Rambler": "RU",
  "Baidu": "CN", "Alibaba": "CN", "Tencent": "CN", "ByteDance": "CN", "TikTok": "CN", "Sina": "CN", "Sohu": "CN",
  "NetEase": "CN", "Huawei": "CN", "Xiaomi": "CN", "JD.com": "CN", "Kuaishou": "CN", "CNZZ": "CN", "Umeng": "CN",
  "Naver": "KR", "Kakao": "KR"
};

function country(owner) {
  if (!owner) return null;
  if (COUNTRY[owner]) return COUNTRY[owner];
  const key = Object.keys(COUNTRY).find(k => owner.toLowerCase().startsWith(k.toLowerCase()));
  return key ? COUNTRY[key] : null;
}

const dir = path.join(src, "domains", "US");
const domains = {};
const owners = new Set();
for (const f of fs.readdirSync(dir)) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const owner = (j.owner && (j.owner.displayName || j.owner.name)) || null;
  let hit = CATEGORY_MAP.find(([tr]) => (j.categories || []).includes(tr));
  // Uncategorized but behaves like a tracker (fingerprinting or sets cookies) and has a known owner.
  if (!hit && !(j.categories || []).length && owner && ((j.fingerprinting || 0) >= 1 || (j.cookies || 0) > 0)) hit = [null, "Tracking"];
  if (!hit) continue;
  // [company, category, country, prevalence %]
  domains[j.domain] = [owner || j.domain, hit[1], country(owner), Math.round((j.prevalence || 0) * 10000) / 100];
  if (owner) owners.add(owner);
}

// Which domains each company owns, so a company's own site isn't counted as tracking itself.
const entities = {};
for (const f of fs.readdirSync(path.join(src, "entities"))) {
  const e = JSON.parse(fs.readFileSync(path.join(src, "entities", f), "utf8"));
  const name = e.displayName || e.name;
  if (owners.has(name)) entities[name] = e.properties || [];
}

const out = {
  builtAt: new Date().toISOString().slice(0, 10),
  source: "DuckDuckGo Tracker Radar (US crawl), CC BY-NC-SA 4.0, https://github.com/duckduckgo/tracker-radar",
  fields: ["company", "category", "country", "prevalencePercent"],
  domains,
  entities
};
const file = path.join(__dirname, "..", "shared", "atlas.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`Wrote ${file}: ${Object.keys(domains).length} tracker domains, ${Object.keys(entities).length} companies, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
