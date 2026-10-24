// Shows C's foreign-adversary pop-up (Matthew's PrivaCPrompt.adversary) when the background says so.
// The look and wording of the pop-up live in content/c-prompt.js.
(function () {
  if (window.PrivaCAlerts) return;
  window.PrivaCAlerts = true;
  let shown = false;
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "privac-adversary" || shown || !window.PrivaCPrompt) return;
    if (msg.domain && location.hostname.replace(/^www\./, "") !== msg.domain) return;
    shown = true;
    PrivaCPrompt.adversary({ companies: msg.companies });
  });
  try { chrome.runtime.sendMessage({ type: "privac-get-adversary" }).catch(() => {}); } catch (e) { /* extension reloaded */ }
})();
