// Dashboard tabs, segmented controls and the Settings sheet.
// Tabs: Overview, Sites, C's impact, Safety, Ask C, Grades. The open tab is kept in the address as #/sites
// (not #sites: that would match the element with id="sites" and make Chrome jump to it), so reloading or a
// link lands on the right tab.
(function () {
  const $ = (id) => document.getElementById(id);
  const TABS = ["overview", "sites", "impact", "safety", "ask", "grades"];
  const tabFromHash = () => location.hash.replace(/^#\/?/, "");

  // ---- Segmented controls: a glass thumb slides under the selected button ----
  function placeThumb(seg) {
    const thumb = seg.querySelector(".seg-thumb");
    const on = seg.querySelector('button[aria-selected="true"], button[aria-checked="true"]');
    if (!thumb || !on) return;
    thumb.style.width = on.offsetWidth + "px";
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
  }
  function select(seg, button) {
    const isTab = button.getAttribute("role") === "tab";
    for (const b of seg.querySelectorAll("button")) {
      const on = b === button;
      b.setAttribute(isTab ? "aria-selected" : "aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    }
    placeThumb(seg);
  }
  // Arrow keys move between segments, like macOS.
  document.addEventListener("keydown", (e) => {
    const seg = e.target.closest && e.target.closest(".segmented");
    if (!seg || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const buttons = [...seg.querySelectorAll("button")];
    const i = buttons.indexOf(e.target);
    const next = buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
    next.focus();
    next.click();
    e.preventDefault();
  });
  window.addEventListener("resize", () => document.querySelectorAll(".segmented").forEach(placeThumb));

  // ---- Tabs ----
  const tabs = $("tabs");
  function show(name, opts = {}) {
    if (!TABS.includes(name)) name = "overview";
    select(tabs, tabs.querySelector(`[data-tab="${name}"]`));
    for (const t of TABS) {
      const panel = $("panel-" + t);
      const on = t === name;
      if (on && panel.hidden) { panel.hidden = false; panel.classList.remove("enter"); void panel.offsetWidth; panel.classList.add("enter"); }
      else if (!on) panel.hidden = true;
    }
    // Controls inside a panel that was hidden couldn't be measured; place their thumbs now.
    $("panel-" + name).querySelectorAll(".segmented").forEach(placeThumb);
    if (!opts.keepHash && location.hash !== "#/" + name) history.replaceState(null, "", "#/" + name);
    if (!opts.keepScroll) window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent("privac-tab", { detail: name }));
  }
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) show(b.dataset.tab);
  });
  window.addEventListener("hashchange", () => show(tabFromHash(), { keepHash: true }));

  // The popup's "Ask C why" opens the dashboard with ?ask=... : start on Ask C.
  const startTab = new URLSearchParams(location.search).get("ask") ? "ask" : tabFromHash();
  show(startTab || "overview", { keepScroll: true });
  // Fonts settle a moment after load; re-measure the thumbs once they have.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll(".segmented").forEach(placeThumb));

  // ---- Time-range controls on C's impact and Safety ----
  for (const seg of document.querySelectorAll("[data-range-for]")) {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-range]");
      if (!b) return;
      select(seg, b);
      if (window.PrivaCActivity) window.PrivaCActivity.setRange(seg.dataset.rangeFor, b.dataset.range);
    });
    select(seg, seg.querySelector('[data-range="week"]'));
  }

  // ---- Settings sheet ----
  const sheet = $("settings"), scrim = $("settings-scrim");
  let lastFocus = null;
  function openSettings() {
    lastFocus = document.activeElement;
    sheet.hidden = false; scrim.hidden = false;
    requestAnimationFrame(() => { sheet.classList.add("open"); scrim.classList.add("open"); sheet.querySelectorAll(".segmented").forEach(placeThumb); });
    $("close-settings").focus();
  }
  function closeSettings() {
    sheet.classList.remove("open"); scrim.classList.remove("open");
    const done = () => { sheet.hidden = true; scrim.hidden = true; };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else setTimeout(done, 260);
    if (lastFocus) lastFocus.focus();
  }
  $("open-settings").addEventListener("click", openSettings);
  $("close-settings").addEventListener("click", closeSettings);
  scrim.addEventListener("click", closeSettings);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSettings(); });

  // Fill the controls from saved settings, and save on every change.
  PrivaCSettings.load().then((s) => {
    for (const seg of sheet.querySelectorAll("[data-setting]")) {
      select(seg, seg.querySelector(`[data-value="${s[seg.dataset.setting]}"]`));
      seg.addEventListener("click", async (e) => {
        const b = e.target.closest("button[data-value]");
        if (!b) return;
        select(seg, b);
        PrivaCSettings.applyTheme(await PrivaCSettings.save({ [seg.dataset.setting]: b.dataset.value }));
        document.querySelectorAll(".segmented").forEach(placeThumb);
      });
    }
    for (const sw of sheet.querySelectorAll("[data-popup]")) {
      sw.checked = s.popups[sw.dataset.popup];
      sw.addEventListener("change", () => PrivaCSettings.save({ popups: { [sw.dataset.popup]: sw.checked } }));
    }
    for (const sw of sheet.querySelectorAll("[data-setting-bool]")) {
      sw.checked = s[sw.dataset.settingBool];
      sw.addEventListener("change", () => PrivaCSettings.save({ [sw.dataset.settingBool]: sw.checked }));
    }
  });

  // The popup's gear opens the dashboard with ?settings: show the sheet right away.
  if (new URLSearchParams(location.search).has("settings")) openSettings();

  window.PrivaCTabs = { show, openSettings };
})();
