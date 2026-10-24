// Appearance settings: light / dark / match computer, accent color, text size.
// Loaded in the <head> of the popup and dashboard so the right theme is set
// before the page paints (no white flash in dark mode).
// Saved in this browser's localStorage under "privacAppearance". It is a display
// preference only, never browsing data, and nothing is sent anywhere.
// Colors live in shared/appearance.css; this file only sets attributes on <html>
// and adds the small "Aa" button to the page header.
(function () {
  const KEY = "privacAppearance";
  const MODES = ["system", "light", "dark"];
  const TEXTS = ["default", "large"];
  const ACCENTS = [
    { id: "navy", label: "Navy" },
    { id: "forest", label: "Forest" },
    { id: "ocean", label: "Ocean" },
    { id: "plum", label: "Plum" }
  ];
  const DEFAULTS = { mode: "system", accent: "navy", text: "default" };

  // Turn whatever was saved (or nothing) into a valid settings object.
  function normalize(raw) {
    let s = {};
    try { s = JSON.parse(raw) || {}; } catch (e) { s = {}; }
    return {
      mode: MODES.includes(s.mode) ? s.mode : DEFAULTS.mode,
      accent: ACCENTS.some((a) => a.id === s.accent) ? s.accent : DEFAULTS.accent,
      text: TEXTS.includes(s.text) ? s.text : DEFAULTS.text
    };
  }

  // "system" follows the computer's light/dark setting.
  function resolveMode(mode, systemPrefersDark) {
    if (mode === "system") return systemPrefersDark ? "dark" : "light";
    return mode;
  }

  const api = { normalize, resolveMode, DEFAULTS, ACCENTS };
  (typeof window !== "undefined" ? window : self).PrivaCAppearance = api;

  // Everything below only runs on a real page (not in the Node tests).
  if (typeof document === "undefined" || !document.documentElement) return;

  const root = document.documentElement;
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function load() {
    try { return normalize(localStorage.getItem(KEY)); } catch (e) { return { ...DEFAULTS }; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked: still applies for this page */ }
  }

  let current = load();

  function apply(s) {
    current = s;
    root.dataset.theme = resolveMode(s.mode, !!(darkQuery && darkQuery.matches));
    root.dataset.accent = s.accent;
    root.dataset.text = s.text;
    root.style.colorScheme = root.dataset.theme; // native scrollbars and inputs match
    syncPanel();
  }

  function update(patch) {
    const next = { ...current, ...patch };
    save(next);
    apply(next);
  }

  // Popup and dashboard share storage, so a change in one updates the other.
  window.addEventListener("storage", (e) => { if (e.key === KEY) apply(normalize(e.newValue)); });
  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener("change", () => { if (current.mode === "system") apply(current); });
  }

  // ---------- The "Aa" button and its panel ----------
  let panel = null;
  let button = null;

  function segment(name, label, options) {
    const btns = options.map((o) =>
      `<button type="button" role="radio" data-set="${name}" data-value="${o.id}">${o.label}</button>`).join("");
    return `<div class="pc-ap-row"><span class="pc-ap-label" id="pc-ap-${name}">${label}</span>
      <div class="pc-ap-seg" role="radiogroup" aria-labelledby="pc-ap-${name}">${btns}</div></div>`;
  }

  function buildPanel() {
    const swatches = ACCENTS.map((a) =>
      `<button type="button" role="radio" class="pc-ap-swatch" data-set="accent" data-value="${a.id}" data-swatch="${a.id}" aria-label="${a.label}" title="${a.label}"></button>`).join("");
    const el = document.createElement("div");
    el.className = "pc-ap-panel";
    el.id = "pc-ap-panel";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Appearance");
    el.hidden = true;
    el.innerHTML = `
      <p class="pc-ap-title">Appearance</p>
      ${segment("mode", "Theme", [{ id: "system", label: "Auto" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }])}
      <div class="pc-ap-row"><span class="pc-ap-label" id="pc-ap-accent">Accent</span>
        <div class="pc-ap-swatches" role="radiogroup" aria-labelledby="pc-ap-accent">${swatches}</div></div>
      ${segment("text", "Text size", [{ id: "default", label: "Standard" }, { id: "large", label: "Larger" }])}
      <p class="pc-ap-note">C stays orange and grade colors never change, so A–F always mean the same thing.</p>`;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-set]");
      if (b) update({ [b.dataset.set]: b.dataset.value });
    });
    return el;
  }

  function syncPanel() {
    if (!panel) return;
    panel.querySelectorAll("[data-set]").forEach((b) => {
      const on = current[b.dataset.set] === b.dataset.value;
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function open(show) {
    panel.hidden = !show;
    button.setAttribute("aria-expanded", show ? "true" : "false");
    if (show) {
      const first = panel.querySelector('[aria-checked="true"]');
      if (first) first.focus();
    }
  }

  function mount() {
    // Popup header is ".top"; dashboard header is ".top-inner". Adds one element, touches nothing else.
    const header = document.querySelector("header .top-inner") || document.querySelector("header.top");
    if (!header || document.getElementById("pc-ap-btn")) return;

    const wrap = document.createElement("div");
    wrap.className = "pc-ap";
    button = document.createElement("button");
    button.type = "button";
    button.id = "pc-ap-btn";
    button.className = "pc-ap-btn";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "pc-ap-panel");
    button.title = "Appearance";
    button.innerHTML = `<span aria-hidden="true">Aa</span><span class="pc-ap-sr">Appearance</span>`;
    panel = buildPanel();
    wrap.append(button, panel);
    // Sit just left of the header's right-hand button (Dashboard / Clear).
    const last = header.lastElementChild;
    if (last && header.children.length > 1) header.insertBefore(wrap, last);
    else header.appendChild(wrap);

    button.addEventListener("click", () => open(panel.hidden));
    document.addEventListener("click", (e) => { if (!panel.hidden && !wrap.contains(e.target)) open(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) { open(false); button.focus(); }
    });
    syncPanel();
  }

  apply(current);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
