// Cookie pop-ups inside frames (content/cookie-detector.js runs in every frame). Loaded by /background.js.
// Passes messages between a frame and the top page of the same tab: the frame says it has a pop-up with a Reject
// button, the top page's C asks you, and "Protect me" goes back to that frame. Nothing leaves the computer.
(function () {
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    const tabId = sender && sender.tab && sender.tab.id;
    if (!msg || typeof tabId !== "number") return;

    // From a frame to the top page, with which frame it was.
    if ((msg.type === "privac-frame-banner" || msg.type === "privac-frame-gone") && sender.frameId > 0) {
      chrome.tabs.sendMessage(tabId, { type: msg.type, frameId: sender.frameId }, { frameId: 0 }).catch(() => {});
    }

    // From the top page to that frame.
    if ((msg.type === "privac-frame-decline" || msg.type === "privac-frame-choose") &&
        sender.frameId === 0 && typeof msg.frameId === "number") {
      const sent = chrome.tabs.sendMessage(tabId, { type: msg.type }, { frameId: msg.frameId });
      if (msg.type === "privac-frame-decline") {
        sent.then(reply, () => reply({ dismissed: false }));
        return true;   // answers once the frame has
      }
      sent.catch(() => {});
    }
  });
})();
