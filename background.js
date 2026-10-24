// PrivaC background service worker.
// For now: answers "Ask C" questions from the dashboard using Gemma via Ollama.
// Also loads background/tracking.js, which records each tab's trackers into privacData.
// background/toolbar.js decides what the toolbar button opens (the rounded panel on a website, or Chrome's pop-up).
self.window = self; // shared/*.js attach themselves to window
importScripts("shared/settings.js", "shared/lists.js", "shared/cookies.js", "shared/data.js", "shared/gemma.js", "shared/askc.js", "shared/policy.js", "shared/state-media.js", "shared/ipgeo.js", "shared/stats.js", "background/tracking.js", "background/alerts.js", "background/policy-reader.js", "background/stats.js", "background/toolbar.js", "background/frames.js");

// Download the public breach and data-broker lists: at startup and once a day.
// Whole files only; nothing about your browsing is sent (see shared/lists.js).
function refreshLists() { PrivaCLists.refresh().catch(e => console.warn("PrivaC: list refresh failed", e)); }
chrome.runtime.onInstalled.addListener(() => { PrivaCLists.refresh({ force: true }); });
chrome.runtime.onStartup.addListener(refreshLists);
chrome.alarms.create("privac-lists", { periodInMinutes: 24 * 60 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "privac-lists") refreshLists(); });

// What Ask C needs to answer. onToken (optional) receives Gemma's answer while it's being written.
// history: the last few questions and answers from the Ask C panel (C's short memory).
function askDeps(onToken, signal, history) {
  return { load: PrivaCData.load, lists: PrivaCLists.load, atlas: () => ATLAS, signal, history,
           ask: onToken ? (q, o) => PrivaCGemma.ask(q, { ...o, onToken }) : PrivaCGemma.ask };
}

// Speed: load Gemma before the first question (the dashboard and popup say they're open). At most once a minute.
let lastWarm = 0;
function warmGemma() {
  if (Date.now() - lastWarm < 60000) return;
  lastWarm = Date.now();
  PrivaCGemma.warm();
}

// Streaming Ask C (dashboard/ask-c.js): the answer appears word by word instead of all at the end.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "privac-ask") return;
  let open = true;
  const hangUp = new AbortController();   // the Ask C tab closed or gave up: stop Gemma so it's free again
  port.onDisconnect.addListener(() => { open = false; hangUp.abort(); });
  port.onMessage.addListener(msg => {
    if (!msg || msg.type !== "ask") return;
    const post = (m) => { if (open) try { port.postMessage(m); } catch (e) { open = false; } };
    post({ type: "start" });               // tells the panel streaming works, so it never asks twice
    PrivaCAskC.answer(msg.question, askDeps((piece, text) => post({ type: "token", text }), hangUp.signal, msg.history))
      .then(result => post({ type: "done", result }))
      .catch(() => post({ type: "done", result: { error: "I couldn't reach Gemma. Is Ollama running?" } }));
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "askC") {
    PrivaCAskC.answer(msg.question, askDeps(null, null, msg.history))
      .then(sendResponse)
      .catch(() => sendResponse({ error: "I couldn't reach Gemma. Is Ollama running?" }));
    return true; // keep the channel open for the async reply
  }
  if (msg && (msg.type === "privac-warm" || msg.type === "privac-tab-site")) warmGemma();   // the popup asks for its tab's site when it opens
  if (msg && msg.type === "refreshLists") {
    PrivaCLists.refresh({ force: true }).then(l => sendResponse({ ok: true, breaches: Object.keys((l.hibp || {}).byDomain || {}).length, brokers: ((l.brokers || {}).list || []).length }));
    return true;
  }
  if (msg && msg.type === "cookieChoice") {
    updateCookieChoice(msg.domain, msg.choice);
  }
});
