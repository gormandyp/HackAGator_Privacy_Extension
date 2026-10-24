// Paints the saved light/dark + glass/clean look before the page draws (no flash), then applies the real
// settings and follows the Mac switching between light and dark. Load right after shared/settings.js.
(function () {
  const el = document.documentElement;
  try {
    const look = JSON.parse(localStorage.getItem("privacLook") || "null");
    if (look && look.theme) { el.dataset.theme = look.theme; el.dataset.style = look.style; }
    else if (matchMedia("(prefers-color-scheme: dark)").matches) el.dataset.theme = "dark";
  } catch (e) { /* first visit */ }
  if (!window.PrivaCSettings) return;
  PrivaCSettings.load().then(PrivaCSettings.applyTheme);
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => PrivaCSettings.load().then(PrivaCSettings.applyTheme));
  } catch (e) { /* older browsers */ }
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.privacSettings) PrivaCSettings.applyTheme(PrivaCSettings.merge(c.privacSettings.newValue)); });
  }
})();
