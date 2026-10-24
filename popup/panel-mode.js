// When the pop-up page floats over a website in content/panel.js's rounded panel (opened there as
// popup.html?panel=1 in a frame), it tells the panel how tall it is, its light/dark mode and style, and when it
// has finished drawing (popup.js fires "privac-popup-ready"); Escape, or opening the dashboard, closes it.
// The messages carry only the size and the look, never the site or its grade. Opened the usual way, this does nothing.
(function () {
  if (window.top === window || !/[?&]panel=1(&|$)/.test(location.search)) return;
  const root = document.documentElement;
  root.classList.add("in-panel");   // popup.css: no wallpaper, so the website shows through the glass
  let ready = false, last = "";

  function post(msg) {
    try { parent.postMessage({ privacPanel: 1, ...msg }, "*"); } catch (e) { /* the page went away */ }
  }
  function report() {
    const msg = {
      type: "size",
      height: Math.ceil(document.body.getBoundingClientRect().height),
      theme: root.dataset.theme === "dark" ? "dark" : "light",
      style: root.dataset.style === "clean" ? "clean" : "glass",
      ready
    };
    const key = JSON.stringify(msg);
    if (key === last) return;
    last = key;
    post(msg);
  }

  new ResizeObserver(report).observe(document.body);
  new MutationObserver(report).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-style"] });
  document.addEventListener("privac-popup-ready", () => { ready = true; report(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") post({ type: "close" }); });
  // These open the dashboard in a new tab (popup.js); Chrome's pop-up closes then, and so does the panel.
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("#open-dashboard, #open-dashboard-top, #open-settings, #ask-site")) post({ type: "close" });
  });
})();
