// Offscreen page that runs C's in-browser brain (shared/brain-core.js) with the LiteRT-LM web runtime.
// The background (shared/ai.js) sends { target: "privac-brain", cmd, ... } messages; progress and streamed text
// go back as { type: "privac-brain-status" | "privac-brain-token" | "privac-brain-busy" } messages.
import * as LM from "../vendor/litert-lm/litert-lm.mjs";

// If the graphics chip resets (a GPU crash, a driver update, sometimes waking from sleep), the runtime keeps its
// dead GPU connection for good. Starting this page fresh lets the next question load Gemma again.
let watched = null;
function watchGpu() {
  try {
    const device = LM.getGlobalLiteRtLm().liteRtLmWasm.preinitializedWebGPUDevice;
    if (!device || device === watched || !device.lost) return;
    watched = device;
    device.lost.then((info) => { if (!info || info.reason !== "destroyed") location.reload(); });
  } catch (e) { /* the runtime isn't loaded yet */ }
}

// The runtime reads this when it starts: its routine lines go to the console as plain logs, not as extension errors.
self.Module = { printErr: (line) => console[PrivaCBrainCore.logLevel(line)](line) };

const brain = PrivaCBrainCore.create({
  lm: LM,
  wasmUrl: chrome.runtime.getURL("vendor/litert-lm/wasm/litertlm_wasm_internal.js"),
  bundledModelUrl: chrome.runtime.getURL("models/" + PrivaCBrainCore.MODEL.file),
  caches,
  fetch: (url, init) => fetch(url, init),
  gpu: navigator.gpu,
  jspi: typeof WebAssembly.Suspending === "function",
  post: (msg) => {
    if (msg.type === "privac-brain-status" && msg.status && msg.status.state === "ready") watchGpu();
    return chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "privac-brain") return;
  brain.handle(msg).then(sendResponse, (e) => sendResponse({ error: String((e && e.message) || e), code: "FAILED" }));
  return true;   // answers after Gemma is done
});
