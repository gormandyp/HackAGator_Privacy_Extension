// PrivaC's toolbar button (PLAN R10). Loaded by /background.js after shared/settings.js.
// Chrome draws an extension's pop-up window as a plain rectangle, and extensions can't change its shape. So on
// a website, clicking the button floats the same pop-up page over the page in a rounded panel instead
// (content/panel.js). Everywhere the panel can't go (Chrome's own pages, the Web Store, PDFs, a page showing a
// modal dialog, a tab that was open before PrivaC was installed or reloaded), and when Settings > Toolbar
// pop-up is "Chrome's", Chrome's usual pop-up window opens.
(function () {
  const POPUP = "popup/popup.html";

  async function mode() {
    try { return (await PrivaCSettings.load()).toolbar; } catch (e) { return "panel"; }
  }

  // Chrome's own pop-up for this tab: set it for the tab, then open it. If Chrome can't open it right now,
  // it stays set, so the next click on this tab opens it the usual way.
  async function openWindow(tab) {
    try { await chrome.action.setPopup({ tabId: tab.id, popup: POPUP }); } catch (e) { return "none"; }
    try { await chrome.action.openPopup({ windowId: tab.windowId }); return "window"; } catch (e) { return "window-next-click"; }
  }

  async function click(tab) {
    if (!tab || typeof tab.id !== "number" || tab.id < 0) return "none";
    if ((await mode()) !== "window") {
      try {
        const r = await chrome.tabs.sendMessage(tab.id, { type: "privac-panel" }, { frameId: 0 });
        if (r && r.ok) return "panel";   // opened, or closed by this second click
      } catch (e) { /* PrivaC isn't running on this page */ }
    }
    return openWindow(tab);
  }

  // Back to "no pop-up set" for this tab, so its next click comes here and can try the rounded panel.
  function forget(tabId) {
    return chrome.action.setPopup({ tabId, popup: "" }).catch(() => {});
  }

  chrome.action.onClicked.addListener((tab) => { click(tab); });

  // A new page in the tab.
  if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
    chrome.webNavigation.onCommitted.addListener((d) => { if (d.frameId === 0) forget(d.tabId); });
  }

  // The panel couldn't load PrivaC's page on that website.
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.type === "privac-panel-failed" && sender && sender.tab) openWindow(sender.tab);
  });

  // Settings switched back to the rounded panel: tabs that were using Chrome's window try the panel again.
  chrome.storage.onChanged.addListener((changes, area) => {
    const c = area === "local" && changes.privacSettings;
    if (!c) return;
    const now = PrivaCSettings.merge(c.newValue).toolbar, was = PrivaCSettings.merge(c.oldValue).toolbar;
    if (now === "panel" && was !== "panel") {
      chrome.tabs.query({}).then((tabs) => { for (const t of tabs) forget(t.id); }).catch(() => {});
    }
  });

  self.PrivaCToolbar = { click, openWindow, forget };
})();
