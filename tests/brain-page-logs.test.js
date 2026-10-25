// offscreen/brain.js: the LiteRT runtime's lines go to the console at the right level, so chrome://extensions
// doesn't list routine ones. The runtime prints through two hooks: Module.printErr (most lines) and a global
// dbg() for its debug prints. With no dbg() it used console.warn, so "mel_filterbank.cc:137 Missing 10 bands"
// was still listed 12 times per run on the G14 with real Gemma (Oct 25).
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const MEL = "W1025 00:01:02.286000 2378752 mel_filterbank.cc:137] Missing 10 bands starting at 0 in mel-frequency design.";

// Runs offscreen/brain.js (its import of the runtime replaced by a stand-in) and returns its page and console.
function loadPage() {
  const said = { log: [], warn: [], error: [] };
  const ctx = {
    console: { log: (...a) => said.log.push(a.join(" ")), warn: (...a) => said.warn.push(a.join(" ")), error: (...a) => said.error.push(a.join(" ")) },
    caches: {}, fetch: async () => ({}), navigator: {}, WebAssembly: {}, Promise, setTimeout, clearTimeout,
    chrome: { runtime: { getURL: (p) => "ext://" + p, sendMessage: async () => {}, onMessage: { addListener() {} } } },
    LM: { getGlobalLiteRtLm() { throw new Error("not loaded"); } }
  };
  ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../shared/brain-core.js", "utf8"), ctx);
  const page = fs.readFileSync(__dirname + "/../offscreen/brain.js", "utf8").replace(/^import \* as LM from .*$/m, "");
  vm.runInContext(page, ctx);
  return { ctx, said };
}

// The runtime's own debug-print function, taken from the vendored file unchanged.
function runtimeDebugPrint(ctx) {
  const src = fs.readFileSync(__dirname + "/../vendor/litert-lm/wasm/litertlm_wasm_internal.js", "utf8");
  const start = src.indexOf("function custom_emscripten_dbgn(");
  assert.ok(start > 0, "the runtime still has its debug-print function");
  const end = src.indexOf("\n}\n", start) + 3;
  vm.runInContext("var UTF8ToString = (s) => s;\n" + src.slice(start, end), ctx);
  return (line) => ctx.custom_emscripten_dbgn(line, line.length);
}

test("the runtime's debug prints (the mel_filterbank warning) are plain logs, not extension warnings", () => {
  const { ctx, said } = loadPage();
  runtimeDebugPrint(ctx)(MEL);
  assert.deepStrictEqual(said.warn, []);
  assert.deepStrictEqual(said.error, []);
  assert.deepStrictEqual(said.log, [MEL]);
});

test("a real error from the runtime's debug prints is still reported as an error", () => {
  const { ctx, said } = loadPage();
  runtimeDebugPrint(ctx)("E1025 00:01:02.286000 2378752 gpu.cc:9] Device lost");
  assert.strictEqual(said.error.length, 1);
});

test("the runtime's other lines (printErr) keep going through the same levels", () => {
  const { ctx, said } = loadPage();
  ctx.Module.printErr("WARNING: [npu_registry.cc:34] NPU accelerator could not be loaded and registered");
  assert.deepStrictEqual(said.warn, []);
  assert.strictEqual(said.log.length, 1);
});
