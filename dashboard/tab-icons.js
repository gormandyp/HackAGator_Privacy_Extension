// Top bar tabs as icons (Max, 2026-10-24). Each tab keeps its name: hovering shows it in a small glass
// label (CSS: #tabs.icon-tabs button::after), and screen readers read it from aria-label and .tab-label.
// Ask C is C himself. Runs before tabs.js so the sliding highlight measures the icon widths.
(function () {
  const ICONS = {
    overview: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z"/>',
    sites: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.3 2.3 3.4 5 3.4 8.2s-1.1 5.9-3.4 8.2c-2.3-2.3-3.4-5-3.4-8.2S9.7 6.1 12 3.8Z"/>',
    impact: '<path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2Z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/>',
    safety: '<path d="M4 19.5h16"/><path d="M5.5 15.5 9.5 11l3 3 6-6.5"/><path d="M15.5 7.5h3v3"/>',
    grades: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="m8.6 15.6 3.4-8 3.4 8M9.9 12.8h4.2"/>',
    about: '<circle cx="12" cy="12" r="8.2"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r=".6" fill="currentColor"/>'
  };
  const line = (paths) => `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const nav = document.getElementById("tabs");
  if (!nav) return;
  const M = window.PrivaCMascot;
  for (const b of nav.querySelectorAll("button[data-tab]")) {
    const name = b.textContent.trim();
    const tab = b.dataset.tab;
    let icon = null;
    if (tab === "ask" && M) icon = `<span class="tab-c" aria-hidden="true">${M.svg("happy", { body: false, size: 20, label: "C" })}</span>`;
    else if (ICONS[tab]) icon = line(ICONS[tab]);
    if (!icon) continue; // a tab we don't know keeps its words
    b.setAttribute("aria-label", name);
    b.dataset.tip = name;
    b.innerHTML = `${icon}<span class="tab-label">${esc(name)}</span>`;
  }
  nav.classList.add("icon-tabs");
})();
