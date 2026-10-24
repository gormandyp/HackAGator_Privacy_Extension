// F3: server location from the regional internet registries' lists (7 listed countries only).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/ipgeo.js");
require("../shared/data.js");
const { parse } = require("../scripts/build-ip-countries.js");
const { computeScore } = window.PrivaCData;

const RIPE = [
  "2|ripencc|1792792799|261085|19700101|20261023|+0200",
  "ripencc|*|ipv4|*|1|summary",
  "ripencc|RU|ipv4|95.173.128.0|4096|20080101|allocated|abc",
  "ripencc|RU|ipv4|95.173.144.0|4096|20080101|allocated|abc",    // next to the one above: merged
  "ripencc|DE|ipv4|5.1.0.0|65536|20100101|allocated|xyz",          // not a listed country: dropped
  "ripencc|IR|ipv6|2a01:5ec0::|29|20120101|allocated|def",
  "ripencc|RU|ipv4|10.0.0.0|256|20120101|reserved|x"                  // not allocated: dropped
].join("\n");
const APNIC = "2|apnic|20261024|1|19830613|20261023|+1000\napnic|CN|ipv4|1.0.1.0|256|20110414|allocated|A\napnic|HK|ipv6|2400:8500::|32|20100101|assigned|B";

window.PrivaCIP.setData(parse([RIPE, APNIC]));
const { countryOfIp } = window.PrivaCIP;

test("build keeps only the 7 countries and merges neighbouring blocks", () => {
  const d = parse([RIPE, APNIC]);
  assert.deepStrictEqual(d.v4.map(r => r[2]), ["CN", "RU"]);
  assert.strictEqual(d.v4[1][1], 8192);
  assert.strictEqual(d.v6.length, 2);
  assert.match(d.registries.join(" "), /ripencc \(20261023\)/);
});

test("looks up IPv4 and IPv6 addresses", () => {
  assert.strictEqual(countryOfIp("95.173.136.70"), "RU");
  assert.strictEqual(countryOfIp("95.173.159.255"), "RU");
  assert.strictEqual(countryOfIp("95.173.160.0"), null);
  assert.strictEqual(countryOfIp("1.0.1.9"), "CN");
  assert.strictEqual(countryOfIp("5.1.2.3"), null);
  assert.strictEqual(countryOfIp("2a01:5ec0:1::5"), "IR");
  assert.strictEqual(countryOfIp("[2400:8500:ffff::1]"), "HK");
  assert.strictEqual(countryOfIp("2400:8501::1"), null);
  assert.strictEqual(countryOfIp("::ffff:95.173.136.70"), null);   // mapped addresses are rare; not in the v6 list
  assert.strictEqual(countryOfIp("not an ip"), null);
  assert.strictEqual(countryOfIp(""), null);
});

test("the site's own server in a listed country is the single 15-point line, naming the registry", () => {
  const r = computeScore({ domain: "presstv.co.uk", server: { country: "IR" }, trackers: [], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 15);
  assert.match(r.parts.find(p => p.points === 15).label, /server address is registered in Iran/);
  assert.strictEqual(r.serverFlag.country, "IR");
});

test("never doubled with the web address or a tracker", () => {
  const r = computeScore({ domain: "en.irna.ir", server: { country: "IR" },
    trackers: [{ domain: "mc.yandex.ru", company: "Yandex", category: "Analytics", country: "RU" }], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 5 + 15);
  assert.strictEqual(r.parts.filter(p => p.points === 15).length, 1);
});

test("outside servers registered in a listed country are a 0-point label", () => {
  const r = computeScore({ domain: "news.example", foreignServers: [{ host: "cdn.example", country: "CN" }], trackers: [], cookieChoice: "declined", policy: {} });
  assert.strictEqual(r.score, 0);
  const line = r.parts.find(p => /registered in a listed country/.test(p.label));
  assert.strictEqual(line.points, 0);
  assert.match(line.label, /cdn\.example \(China\)/);
  assert.match(r.parts.at(-1).label, /breach/);
});
