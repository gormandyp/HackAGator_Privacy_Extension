// PrivaC background service worker.
// For now: answers "Ask C" questions from the dashboard using Gemma via Ollama.
// Also loads background/tracking.js, which records each tab's trackers into privacData.
self.window = self; // shared/*.js attach themselves to window
importScripts("shared/lists.js", "shared/cookies.js", "shared/data.js", "shared/gemma.js", "shared/askc.js", "background/tracking.js");

// Download the public breach and data-broker lists: at startup and once a day.
// Whole files only; nothing about your browsing is sent (see shared/lists.js).
function refreshLists() { PrivaCLists.refresh().catch(e => console.warn("PrivaC: list refresh failed", e)); }
chrome.runtime.onInstalled.addListener(() => { PrivaCLists.refresh({ force: true }); });
chrome.runtime.onStartup.addListener(refreshLists);
chrome.alarms.create("privac-lists", { periodInMinutes: 24 * 60 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "privac-lists") refreshLists(); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "askC") {
    PrivaCAskC.answer(msg.question, { load: PrivaCData.load, ask: PrivaCGemma.ask, lists: PrivaCLists.load, atlas: () => ATLAS })
      .then(sendResponse)
      .catch(() => sendResponse({ error: "I couldn't reach Gemma. Is Ollama running?" }));
    return true; // keep the channel open for the async reply
  }
  if (msg && msg.type === "refreshLists") {
    PrivaCLists.refresh({ force: true }).then(l => sendResponse({ ok: true, breaches: Object.keys((l.hibp || {}).byDomain || {}).length, brokers: ((l.brokers || {}).list || []).length }));
    return true;
  }
  if (msg && msg.type === "cookieChoice") {
    updateCookieChoice(msg.domain, msg.choice);
  }
});
