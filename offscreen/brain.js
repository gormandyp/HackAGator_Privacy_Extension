// Offscreen page that runs C's in-browser brain (shared/brain-core.js) with the LiteRT-LM web runtime.
// The background (shared/ai.js) sends { target: "privac-brain", cmd, ... } messages; progress and streamed text
// go back as { type: "privac-brain-status" | "privac-brain-token" } messages.
import * as LM from "../vendor/litert-lm/litert-lm.mjs";

const brain = PrivaCBrainCore.create({
  lm: LM,
  wasmUrl: chrome.runtime.getURL("vendor/litert-lm/wasm/litertlm_wasm_internal.js"),
  bundledModelUrl: chrome.runtime.getURL("models/" + PrivaCBrainCore.MODEL.file),
  caches,
  fetch: (url, init) => fetch(url, init),
  gpu: navigator.gpu,
  jspi: typeof WebAssembly.Suspending === "function",
  post: (msg) => chrome.runtime.sendMessage(msg).catch(() => {})
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "privac-brain") return;
  brain.handle(msg).then(sendResponse, (e) => sendResponse({ error: String((e && e.message) || e), code: "FAILED" }));
  return true;   // answers after Gemma is done
});
