// Unsafe-site warning (PLAN R5, SPEC F6): a site graded F that also loads a company from a listed foreign-adversary
// country or the Pentagon's 1260H list, or had a data breach reported in the last year, gets C's warning with
// "Go back" and "Continue anyway". It warns; it never blocks. The background decides (background/alerts.js
// unsafeReasons), with the same numbers the popup shows. Once per site a day; Settings > C on websites >
// "Unsafe-site warnings" turns it off. Remembers only site names and days, never addresses.
// Matthew's pop-up file (content/c-prompt.js) stays as it is: this box copies its look.
(function () {
  if (window.top !== window || window.PrivaCUnsafe) return;

  const DELAY = 5000;    // ms after the page loads: after the grade settles and the grade box has had its turn
  const WAIT_MAX = 30;   // seconds to wait while another C pop-up (cookies, foreign-adversary) is still showing

  const domainOf = (host) => String(host || "").replace(/^www\./, "");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // What to warn about, or null (turned off, already warned today, or nothing found).
  // info = { grade, reasons } from the background.
  function pick(store, domain, today, info) {
    const popups = ((store && store.privacSettings) || {}).popups || {};
    if (popups.unsafe === false) return null;
    if (((store && store.privacUnsafeSeen) || {})[domain] === today) return null;
    if (!info || !Array.isArray(info.reasons) || !info.reasons.length) return null;
    return info;
  }

  function card(info) {
    return `
      <button class="close" data-a="stay" aria-label="Dismiss">×</button>
      <p class="who">C from PrivaC</p>
      <p class="title">Careful: PrivaC grades this site ${esc(info.grade)}.</p>
      <ul>${info.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      <p class="small">You can still go on. Open PrivaC for the full grade.</p>
      <div class="row"><button class="primary" data-a="back">Go back</button><button class="ghost" data-a="stay">Continue anyway</button></div>`;
  }

  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; display: flex; align-items: flex-end; gap: 4px;
      font-family: "Figtree", "Segoe UI", system-ui, -apple-system, sans-serif; color: #16233f;
      animation: in 480ms cubic-bezier(.3,1.4,.5,1) both; }
    .wrap.out { animation: out 220ms ease-in both; }
    .card { width: 300px; background: #fff; border: 2px solid #b4232a; border-radius: 16px; padding: 14px 16px;
      box-shadow: 6px 6px 0 #b4232a; position: relative; margin-bottom: 52px; }
    .card::after { content: ""; position: absolute; right: -11px; bottom: 22px; width: 16px; height: 16px; background: #fff;
      border-right: 2px solid #b4232a; border-top: 2px solid #b4232a; transform: rotate(45deg); }
    .who { font-size: 12px; font-weight: 700; color: #b4232a; margin: 0 0 4px; }
    p, li { margin: 0; font-size: 14px; line-height: 1.45; font-weight: 500; }
    .title { font-weight: 700; }
    ul { margin: 6px 0 0; padding-left: 18px; }
    li + li { margin-top: 4px; }
    .small { font-size: 12.5px; color: #4e586d; margin-top: 8px; }
    .row { display: flex; gap: 8px; margin-top: 12px; }
    button { font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; border-radius: 999px; padding: 8px 14px; border: 0; }
    .primary { background: #16233f; color: #fff; }
    .primary:hover { background: #24345a; }
    .ghost { background: transparent; color: #16233f; box-shadow: inset 0 0 0 1.5px #c9d0dc; }
    .close { position: absolute; top: 6px; right: 8px; background: none; padding: 4px 8px; font-size: 18px; line-height: 1; color: #7d879c; }
    button:focus-visible { outline: 3px solid #fa4616; outline-offset: 2px; }
    .c { flex: none; width: 120px; height: 120px; }
    .c img { width: 100%; height: 100%; object-fit: contain; }
    @keyframes in { from { transform: translateY(140%); } to { transform: none; } }
    @keyframes out { to { transform: translateY(140%); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .wrap, .wrap.out { animation: none; } }`;

  function show(info) {
    const host = document.createElement("privac-unsafe");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="wrap" role="dialog" aria-label="PrivaC warning">
        <div class="card">${card(info)}</div>
        <div class="c"><img src="${chrome.runtime.getURL("c-poses/mascot-alarmed-yield-wave.svg")}" alt="C holding a yield sign"></div>
      </div>`;
    document.documentElement.appendChild(host);
    const close = () => {
      document.removeEventListener("keydown", onKey, true);
      root.querySelector(".wrap").classList.add("out");
      setTimeout(() => host.remove(), 230);
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-a]");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.a === "back") { try { chrome.runtime.sendMessage({ type: "privac-go-back" }).catch(() => {}); } catch (err) { /* PrivaC was reloaded */ } }
      close();
    });
  }

  // Another C pop-up already on the page: wait for a cookie offer to finish. A foreign-adversary alert names the same
  // companies this warning does, so the warning takes its place instead of stacking a second C.
  async function whenCIsFree() {
    for (let i = 0; i < WAIT_MAX; i++) {
      const other = document.querySelector("privac-prompt");
      if (!other) return true;
      if (other.shadowRoot && other.shadowRoot.querySelector(".card.alert") && window.PrivaCPrompt) { PrivaCPrompt.hide(); return true; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  async function run() {
    if (!/^https?:$/.test(location.protocol)) return;
    const domain = domainOf(location.hostname);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const store = await chrome.storage.local.get(["privacSettings", "privacUnsafeSeen"]);
      if (!pick(store, domain, today, { reasons: ["check"] })) return;   // turned off or warned today: don't ask the background
      const info = pick(store, domain, today, await chrome.runtime.sendMessage({ type: "privac-site-unsafe", domain }));
      if (!info || !(await whenCIsFree())) return;
      const seen = window.PrivaCGradeChip ? PrivaCGradeChip.remember(store.privacUnsafeSeen, domain, today) : { [domain]: today };
      await chrome.storage.local.set({ privacUnsafeSeen: seen });
      show(info);
      chrome.runtime.sendMessage({ type: "privac-event", event: "popup-unsafe", domain }).catch(() => {});
    } catch (e) { /* PrivaC was reloaded or storage isn't there: no warning */ }
  }

  window.PrivaCUnsafe = { pick, card };
  const start = () => setTimeout(run, DELAY);
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
})();
