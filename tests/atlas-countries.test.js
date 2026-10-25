// F4: more company countries (Russian counters, Chinese ad networks) in shared/atlas.json.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { country, readable } = require("../scripts/build-atlas.js");
const atlas = JSON.parse(fs.readFileSync(__dirname + "/../shared/atlas.json", "utf8"));

test("headquarters countries for Russian and Chinese tracker companies", () => {
  for (const o of ["Internest-holding", "MegaFon", "Sberbank of Russia", "Mobile TeleSystems Public Joint Stock Company", "Retail Rocket", "AO Kaspersky Lab"]) assert.strictEqual(country(o), "RU", o);
  for (const o of ["Qihoo 360", "Mobvista", "BiliBili", "Zhihu", "Beijing Jingdong Century Trading", "Bejing Kuaishou Technology", "上海聚效广告有限公司"]) assert.strictEqual(country(o), "CN", o);
  assert.strictEqual(country("Cheetah Digital"), null);           // US company, not Cheetah Mobile
  assert.strictEqual(country("Pinduoduo"), null);                 // wording pending with Max (PDD Holdings is registered in Ireland)
});

test("atlas.json carries the new countries", () => {
  assert.strictEqual(atlas.domains["adriver.ru"][2], "RU");
  assert.strictEqual(atlas.domains["mintegral.com"][2], "CN");
  assert.strictEqual(atlas.domains["360.cn"][2], "CN");
  assert.strictEqual(atlas.domains["sputnik.ru"][2], "RU");
  assert.strictEqual(atlas.domains["google-analytics.com"][2], "US");   // nothing else changed
  assert.strictEqual(Object.keys(atlas.domains).length, 3721);
});

// G14, Oct 25: "Is wired.com safe?" said "CDNWIDGET.COM (cdnwidget.com): Tracker Radar labels it as high-risk".
// Five Tracker Radar companies are named with their web address in capitals; PrivaC writes those in lower case.
test("company names that are a web address in capitals are written in lower case", () => {
  assert.strictEqual(readable("CDNWIDGET.COM"), "cdnwidget.com");
  assert.strictEqual(readable("NIC.UA"), "nic.ua");
  assert.strictEqual(readable("Google LLC"), "Google LLC");
  assert.strictEqual(readable("IBM"), "IBM", "an all-caps name without a dot stays");
  assert.strictEqual(readable("R.T.I"), "R.T.I", "initials with dots stay (Mediaset's company)");
  assert.strictEqual(readable("Booking.com"), "Booking.com", "mixed case stays");
  const shouting = Object.values(atlas.domains).map((v) => v[0]).concat(Object.keys(atlas.entities)).filter((n) => readable(n) !== n);
  assert.deepStrictEqual(shouting, []);
  assert.strictEqual(atlas.domains["cdnwidget.com"][0], "cdnwidget.com");
  assert.deepStrictEqual(atlas.entities["cdnwidget.com"], ["cdnwidget.com"]);
});
