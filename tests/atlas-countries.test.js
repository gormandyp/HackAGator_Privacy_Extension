// F4: more company countries (Russian counters, Chinese ad networks) in shared/atlas.json.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { country } = require("../scripts/build-atlas.js");
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
