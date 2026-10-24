/*
  C's on-page prompt. Runs inside websites as a content script (load shared/mascot.js first).
  Styles live in a Shadow DOM so the website's CSS can't break the prompt.

  HOW TO USE (for whoever writes the cookie-banner detection):

    PrivaCPrompt.cookie({
      onDecline: async () => { ...click the site's "reject" button...; return true; }, // true = success
      onChoose:  () => { ...open the site's cookie settings... }
    });

    PrivaCPrompt.adversary({ companies: ["Yandex (Russia)", "Baidu (China)"] });

    PrivaCPrompt.hide();
*/
(function () {
  if (window.PrivaCPrompt) return;

  const CSS = `
    :host { all: initial; }
    .wrap {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      display: flex; align-items: flex-end; gap: 4px;
      font-family: "Figtree", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #16233f;
      animation: in 480ms cubic-bezier(.3,1.4,.5,1) both;
    }
    .wrap.out { animation: out 220ms ease-in both; }
    .card {
      width: 290px;
      background: #fff;
      border: 2px solid #16233f;
      border-radius: 16px;
      padding: 14px 16px 14px;
      box-shadow: 6px 6px 0 #16233f;
      position: relative;
      margin-bottom: 52px;
    }
    .card.alert { border-color: #b4232a; box-shadow: 6px 6px 0 #b4232a; }
    .card::after {
      content: ""; position: absolute; right: -11px; bottom: 22px;
      width: 16px; height: 16px; background: #fff;
      border-right: 2px solid #16233f; border-top: 2px solid #16233f;
      transform: rotate(45deg);
    }
    .card.alert::after { border-color: #b4232a; }
    .who { font-size: 12px; font-weight: 700; color: #fa4616; margin: 0 0 4px; }
    .card.alert .who { color: #b4232a; }
    p { margin: 0; font-size: 14px; line-height: 1.45; font-weight: 500; }
    .row { display: flex; gap: 8px; margin-top: 12px; }
    button {
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
      border-radius: 999px; padding: 8px 14px; border: 0;
    }
    .primary { background: #16233f; color: #fff; }
    .primary:hover { background: #24345a; }
    .ghost { background: transparent; color: #16233f; box-shadow: inset 0 0 0 1.5px #c9d0dc; }
    .close {
      position: absolute; top: 6px; right: 8px; background: none; padding: 4px 8px;
      font-size: 18px; line-height: 1; color: #7d879c;
    }
    button:focus-visible { outline: 3px solid #fa4616; outline-offset: 2px; }
    .c { flex: none; }
    @keyframes in { from { transform: translateY(140%); } to { transform: none; } }
    @keyframes out { to { transform: translateY(140%); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .wrap, .wrap.out { animation: none; } }
  `;

  let host = null;

  function mount(html, mood, opts = {}) {
    hide(true);
    host = document.createElement("privac-prompt");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="wrap" role="dialog" aria-label="PrivaC">
        <div class="card ${opts.alert ? "alert" : ""}">
          <button class="close" aria-label="Dismiss">×</button>
          ${html}
        </div>
        <div class="c">${window.PrivaCMascot ? PrivaCMascot.svg(mood, { size: 120 }) : ""}</div>
      </div>`;
    document.documentElement.appendChild(host);
    root.querySelector(".close").addEventListener("click", () => hide());
    return root;
  }

  function hide(instant) {
    if (!host) return;
    const h = host;
    host = null;
    if (instant) return h.remove();
    const w = h.shadowRoot.querySelector(".wrap");
    w.classList.add("out");
    setTimeout(() => h.remove(), 230);
  }

  function cookie({ onDecline, onChoose } = {}) {
    const root = mount(`
      <p class="who">C from PrivaC</p>
      <p>This site wants to use cookies that can track you. Want me to decline the extra ones?</p>
      <div class="row">
        <button class="primary" data-a="decline">Decline extras</button>
        <button class="ghost" data-a="choose">Let me choose</button>
      </div>`, "wave");

    root.querySelector('[data-a="decline"]').addEventListener("click", async () => {
      
      let result = "failed";

      try {
        result = onDecline ? await onDecline() : "failed";
      } catch (e) {
        console.error("PrivaC: Cookie rejection failed", e);
      }

      // Support our existing true/false results.
      if (result === true) result = "confirmed";
      if (result === false) result = "failed";

      const card = root.querySelector(".card");

      if (result === "confirmed") {
        card.innerHTML = `
          <p class="who">C from PrivaC</p>
          <p>Nice! Your optional cookie preferences were saved as declined.</p>
        `;
        root.querySelector(".c").innerHTML =
          PrivaCMascot.svg("happy", { size: 120 });

        setTimeout(() => hide(), 2600);

      } else if (result === "unverified") {
        card.innerHTML = `
          <button class="close" aria-label="Dismiss">×</button>
          <p class="who">C from PrivaC</p>
          <p>I clicked the rejection button, but couldn't verify that the website saved your choice.</p>
        `;

        card.querySelector(".close").addEventListener("click", () => hide());
        root.querySelector(".c").innerHTML =
          PrivaCMascot.svg("uneasy", { size: 120 });

      } else {
        card.innerHTML = `
          <button class="close" aria-label="Dismiss">×</button>
          <p class="who">C from PrivaC</p>
          <p>I couldn't complete the cookie rejection. You may need to choose your preferences manually.</p>
        `;

        card.querySelector(".close").addEventListener("click", () => hide());
        root.querySelector(".c").innerHTML =
          PrivaCMascot.svg("uneasy", { size: 120 });
      }
    });

    root.querySelector('[data-a="choose"]').addEventListener("click", () => {
      hide();
      if (onChoose) onChoose();
    });
  }

  function adversary({ companies = [] } = {}) {
    const list = companies.length ? companies.join(" and ") : "a company";
    const root = mount(`
      <p class="who">Foreign-adversary link</p>
      <p>This page connected to ${escapeHtml(list)}, based in ${companies.length > 1 ? "countries" : "a country"} the U.S. Commerce Department lists as ${companies.length > 1 ? "foreign adversaries" : "a foreign adversary"}.</p>
      <div class="row"><button class="primary" data-a="ok">Got it</button></div>`, "alarmed", { alert: true });
    root.querySelector('[data-a="ok"]').addEventListener("click", () => hide());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.PrivaCPrompt = { cookie, adversary, hide };
})();
