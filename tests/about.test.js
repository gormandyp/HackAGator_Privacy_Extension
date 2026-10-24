// dashboard "About" tab: lists the technology and data PrivaC is built on that was first made public in the
// 12 months before Gator Hack V (Oct 23, 2026), so judges can find the "Fresh off the frontier" answer fast.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const HTML = fs.readFileSync(__dirname + "/../dashboard/dashboard.html", "utf8");
const TABS = fs.readFileSync(__dirname + "/../dashboard/tabs.js", "utf8");
const HACK_START = Date.parse("2026-10-23");
const YEAR_BEFORE = Date.parse("2025-10-23");

const panel = () => {
  const start = HTML.indexOf('id="panel-about"');
  assert.ok(start > 0, "the About panel exists");
  return HTML.slice(start, HTML.indexOf("</section>", start));
};
const items = () => [...panel().matchAll(/<li[^>]*data-released="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)]
  .map(([, date, body]) => ({ date, body }));

test("the dashboard has an About tab that the tab switcher knows", () => {
  assert.match(HTML, /<button role="tab" id="tab-about" aria-controls="panel-about" data-tab="about">About<\/button>/);
  assert.match(TABS, /const TABS = \[[^\]]*"about"[^\]]*\]/);
});

test("every 'new' item was first public in the 12 months before the hackathon, with a link to proof", () => {
  const list = items();
  assert.ok(list.length >= 5, `at least 5 recent items, found ${list.length}`);
  for (const { date, body } of list) {
    const t = Date.parse(date);
    assert.ok(t >= YEAR_BEFORE && t <= HACK_START, `${date} is within Oct 23 2025 - Oct 23 2026`);
    assert.match(body, /<a href="https:\/\/[^"]+"/, "links to its source");
    assert.match(body, /<code>[^<]+<\/code>/, "names where PrivaC uses it");
  }
});

test("the central pieces are listed: Gemma 4, LiteRT-LM, RegTrack, the 1260H list, the 2026 data broker registry", () => {
  const text = items().map((i) => i.body).join(" ");
  for (const name of ["Gemma 4", "LiteRT-LM", "RegTrack", "1260H", "Data Broker Registry"]) {
    assert.ok(text.includes(name), name);
  }
});
