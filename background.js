// PrivaC background service worker.
// For now: answers "Ask C" questions from the dashboard using Gemma via Ollama.
// Also loads background/tracking.js, which records each tab's trackers into privacData.
self.window = self; // shared/*.js attach themselves to window
importScripts("shared/data.js", "shared/gemma.js", "shared/askc.js", "background/tracking.js");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "askC") {
    PrivaCAskC.answer(msg.question, { load: PrivaCData.load, ask: PrivaCGemma.ask })
      .then(sendResponse)
      .catch(() => sendResponse({ error: "I couldn't reach Gemma. Is Ollama running?" }));
    return true; // keep the channel open for the async reply
  }
});
