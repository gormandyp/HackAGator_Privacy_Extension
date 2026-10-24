/*
  PrivaC settings ("privacSettings" in chrome.storage.local). Read by the dashboard, the popup,
  content/c-events.js (which C pop-ups may show) and background/policy-reader.js.
    appearance: "system" | "light" | "dark"   (system follows the Mac's light/dark mode)
    style:      "glass" | "clean"              (Liquid glass, or solid panels)
    popups:     { cookie, acceptOnly, adversary }  (true = C may show that pop-up on websites)
    policyReader: true                          (Gemma reads privacy policies on this computer)
  Outside the extension (opening the HTML file directly) settings live in localStorage so the look can be previewed.
*/
(function () {
  const DEFAULTS = {
    appearance: "system",
    style: "glass",
    popups: { cookie: true, acceptOnly: true, adversary: true },
    policyReader: true
  };
  const APPEARANCES = ["system", "light", "dark"];
  const STYLES = ["glass", "clean"];

  // Fill gaps with defaults and drop unknown values, so a bad or old saved copy can't break anything.
  function merge(saved) {
    const s = saved && typeof saved === "object" ? saved : {};
    const popups = { ...DEFAULTS.popups };
    for (const k of Object.keys(popups)) if (s.popups && typeof s.popups[k] === "boolean") popups[k] = s.popups[k];
    return {
      appearance: APPEARANCES.includes(s.appearance) ? s.appearance : DEFAULTS.appearance,
      style: STYLES.includes(s.style) ? s.style : DEFAULTS.style,
      popups,
      policyReader: typeof s.policyReader === "boolean" ? s.policyReader : DEFAULTS.policyReader
    };
  }

  function hasStorage() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }

  async function load() {
    try {
      if (hasStorage()) return merge((await chrome.storage.local.get("privacSettings")).privacSettings);
      return merge(JSON.parse(localStorage.getItem("privacSettings") || "null"));
    } catch (e) { return merge(null); }
  }

  // patch: { style: "clean" } or { popups: { adversary: false } }
  async function save(patch) {
    const cur = await load();
    const next = merge({ ...cur, ...patch, popups: { ...cur.popups, ...((patch && patch.popups) || {}) } });
    try {
      if (hasStorage()) await chrome.storage.local.set({ privacSettings: next });
      else localStorage.setItem("privacSettings", JSON.stringify(next));
    } catch (e) { /* keep working with the in-memory copy */ }
    return next;
  }

  function isDark(s) {
    if (s.appearance === "dark") return true;
    if (s.appearance === "light") return false;
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // Sets <html data-theme="light|dark" data-style="glass|clean">; pages style themselves from those.
  function applyTheme(s, doc) {
    const el = (doc || document).documentElement;
    el.dataset.theme = isDark(s) ? "dark" : "light";
    el.dataset.style = s.style;
    // Remember the look so the next page can paint it instantly (shared/theme-boot.js).
    try { localStorage.setItem("privacLook", JSON.stringify({ theme: el.dataset.theme, style: s.style, appearance: s.appearance })); } catch (e) { /* ignore */ }
  }

  const root = typeof window !== "undefined" ? window : self;
  root.PrivaCSettings = { DEFAULTS, merge, load, save, isDark, applyTheme };
})();
