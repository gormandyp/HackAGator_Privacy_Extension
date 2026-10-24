// Run with: node --test
// Speed checks for the data paths that run every time the popup, dashboard or Ask C opens.
// Each speed-up must give exactly the same answers as the simple version it replaced.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/lists.js");
const L = window.PrivaCLists;

// The original one-by-one scan (before the speed-up), kept here as the reference answer.
function slowBrokerFor(company, trackerDomain, lists, ownedDomains) {
  const list = lists && lists.brokers && lists.brokers.list;
  if (!list || !company) return null;
  const c = L.norm(company);
  const p = String(trackerDomain || "").split("."); const sfx = [];
  for (let i = 0; i < p.length - 1; i++) sfx.push(p.slice(i).join("."));
  const domains = new Set([...(ownedDomains || []), ...sfx]);
  for (const b of list) {
    if (b.site && domains.has(b.site)) return b;
    for (const n of [b.name, b.dba]) {
      const x = L.norm(n);
      if (!x) continue;
      if (x === c || (c.length >= 5 && x.startsWith(c + " "))) return b;
    }
  }
  return null;
}

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const WORDS = ["Data", "Acme", "LiveRamp", "Criteo", "People", "Search", "Info", "Media", "Blue", "Ad", "Lead", "Point", "Graph"];
const ENDS = [", Inc.", " LLC", " Corp.", " Holdings, Inc.", " Group", "", " & Co"];
function makeBrokers(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const words = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(WORDS)).join(" ");
    out.push({
      name: rnd() < 0.03 ? "" : words + pick(ENDS),
      dba: rnd() < 0.3 ? pick(WORDS) + " " + pick(WORDS) : "",
      site: rnd() < 0.5 ? (pick(WORDS) + pick(WORDS)).toLowerCase() + pick([".com", ".net", ".io"]) : null
    });
  }
  return out;
}

test("data-broker matching gives the same answer as the one-by-one scan", () => {
  for (let round = 0; round < 6; round++) {
    const lists = { brokers: { list: makeBrokers(300) } };
    for (let q = 0; q < 400; q++) {
      const company = rnd() < 0.05 ? pick(["", "Inc.", "The Group", null]) :
        Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => pick(WORDS)).join(" ") + (rnd() < 0.2 ? pick(ENDS) : "");
      const host = pick(["cdn.", "", "a.b."]) + (pick(WORDS) + pick(WORDS)).toLowerCase() + pick([".com", ".net", ".io"]);
      const owned = rnd() < 0.3 ? [(pick(WORDS) + pick(WORDS)).toLowerCase() + ".com"] : undefined;
      assert.strictEqual(L.brokerFor(company, host, lists, owned), slowBrokerFor(company, host, lists, owned),
        `company=${company} host=${host} owned=${owned}`);
    }
  }
});

test("annotating 3,000 trackers against 560 registered brokers takes a blink (was over half a second)", () => {
  const lists = { hibp: { byDomain: {} }, brokers: { list: makeBrokers(560) } };
  const data = { sites: Array.from({ length: 150 }, (_, i) => ({
    domain: `site${i}.example`,
    trackers: Array.from({ length: 20 }, () => ({ company: pick(WORDS) + " " + pick(WORDS), domain: (pick(WORDS) + pick(WORDS)).toLowerCase() + ".com" }))
  })) };
  const t0 = performance.now();
  L.annotate(data, lists, null);
  const ms = performance.now() - t0;
  assert.ok(ms < 150, `took ${ms.toFixed(0)} ms`);
});
