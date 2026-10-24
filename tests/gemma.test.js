// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis;
require("../shared/gemma.js");
const { ask, buildRequest } = window.PrivaCGemma;

const fakeFetch = (status, content) => async () => ({
  ok: status >= 200 && status < 300, status,
  json: async () => ({ message: { content } })
});

test("buildRequest puts system, evidence and question in order", () => {
  const b = buildRequest("Why a D?", { system: "You are C.", context: "3 trackers" });
  assert.strictEqual(b.model, "gemma4:e4b");
  assert.strictEqual(b.stream, false);
  assert.strictEqual(b.messages[0].role, "system");
  assert.match(b.messages[1].content, /Evidence:\n3 trackers[\s\S]*Question: Why a D\?/);
});

test("json option asks Ollama for JSON and parses it", async () => {
  const r = await ask("Sells data?", { json: true, fetch: fakeFetch(200, '{"answer":"no","quote":null}') });
  assert.deepStrictEqual(r, { answer: "no", quote: null });
  assert.strictEqual(buildRequest("x", { json: true }).format, "json");
});

test("plain answer is returned as trimmed text", async () => {
  assert.strictEqual(await ask("Hi", { fetch: fakeFetch(200, "  Hello!  ") }), "Hello!");
});

test("403 explains the OLLAMA_ORIGINS fix", async () => {
  await assert.rejects(ask("Hi", { fetch: fakeFetch(403, "") }), /OLLAMA_ORIGINS/);
});

test("network failure says Ollama isn't running", async () => {
  const down = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(ask("Hi", { fetch: down }), /Ollama app running/);
});
