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
    
    @keyframes cSpeak {
      from {
        opacity: 0;
        transform: scale(0.15);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .card.intro {
      transform-origin: right bottom;
      animation: cSpeak 350ms ease-out 650ms both;
    }
    
    @keyframes cRise {
      from {
        transform: translateY(120px);
      }
      to {
        transform: translateY(0);
      }
    }

    @keyframes cDrop {
      from {
        transform: translateY(-120px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .c.hanging {
      overflow: hidden;
    }

    .c.hanging img {
      animation: cDrop 650ms ease-out both;
    }

    .c.rising {
      overflow: hidden;
    }

    .c.rising img {
      animation: cRise 650ms ease-out both;
    }
    .wrap {
      position: fixed;
      left: 20px;
      top: 20px;
      z-index: 2147483647;

      display: flex;
      align-items: flex-end;
      gap: 4px;

      font-family: "Figtree", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #16233f;

      animation: in 480ms cubic-bezier(.3,1.4,.5,1) both;
    }
    .wrap.top-banner {
      animation: none;
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
    .c {
      flex: none;
      width: 120px;
      height: 120px;
    }

    .c img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    @keyframes in { from { transform: translateY(140%); } to { transform: none; } }
    @keyframes out { to { transform: translateY(140%); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .wrap, .wrap.out { animation: none; } }
  `;

  let host = null;


  let reacting = false;

  function isReacting() {
    return reacting;
  }

  let celebrating = false;

  function isCelebrating() {
    return celebrating;
  }

  function ignored() {
    if (!host) return;

    const root = host.shadowRoot;
    if (!root) return;

    const card = root.querySelector(".card");
    const mascot = root.querySelector(".c");
    card.classList.remove("intro");

    if (!card || !mascot) return;

    reacting = true;

    card.innerHTML = `
      <p class="who">C from PrivaC</p>
      <p>Okay, I C how it is.</p>
    `;

    // Switch back to C's original standing pose.
    mascot.innerHTML = PrivaCMascot.svg("uneasy", { size: 120 });

    // Lower C slightly without moving the speech bubble.
    mascot.style.transform = "translateY(0px)";

    setTimeout(() => {
      reacting = false;
      hide();
    }, 2200);
  }
  
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
        <div class="c">
          <img
            src="${chrome.runtime.getURL("c-poses/mascot-push-up.svg")}"
            alt="C mascot"
          >
        </div>
      </div>`;

    document.documentElement.appendChild(host);



    root.querySelector(".close").addEventListener("click", () => hide());

    return root;
  }

  function positionAtBanner(banner) {
    if (!host || !banner) return;

    const root = host.shadowRoot;
    const wrap = root.querySelector(".wrap");
    const rect = banner.getBoundingClientRect();


    const nearTop = rect.top < window.innerHeight / 2;

    if (nearTop) {
      wrap.classList.add("top-banner");
    }

    const pose = nearTop
      ? "mascot-cliff-hang.svg"
      : "mascot-push-up.svg";

    const mascot = root.querySelector(".c");


    const isAlarmed = mascot.querySelector("img")?.src.includes("mascot-alarmed-yield-wave.svg");

    if (!isAlarmed) {
      mascot.innerHTML = `
        <img src="${chrome.runtime.getURL("c-poses/" + pose)}" alt="C mascot">
      `;
    }

    if (!isAlarmed) {
      if (nearTop) {
        mascot.classList.add("hanging");

        mascot.querySelector("img")?.addEventListener("animationend", () => {
          mascot.classList.remove("hanging");
        }, { once: true });

      } else {
        mascot.classList.add("rising");

        mascot.querySelector("img")?.addEventListener("animationend", () => {
          mascot.classList.remove("rising");
        }, { once: true });
      }
    }

    const wrapWidth = wrap.getBoundingClientRect().width;
    const wrapHeight = wrap.getBoundingClientRect().height;
    wrap.style.minHeight = wrapHeight + "px";

    wrap.style.left = Math.max(
      8,
      Math.min(rect.right - wrapWidth - 35, window.innerWidth - wrapWidth - 8)
    ) + "px";

    wrap.style.top = (
      nearTop
        ? Math.min(rect.bottom, window.innerHeight - wrapHeight - 8)
        : Math.max(8, rect.top - wrapHeight + 5)
    ) + "px";
  }

  function hide(instant) {
    if (!host) return;
    celebrating = false;
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
    
    root.querySelector(".card").classList.add("intro");

    root.querySelector('[data-a="decline"]').addEventListener("click", async () => {
      root.querySelector(".card").classList.remove("intro");

      celebrating = true;
      
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
        root.querySelector(".c").classList.remove("rising", "hanging");
        root.querySelector(".c").style.overflow = "visible";
        root.querySelector(".c").style.transform = "translateY(0px)";

        setTimeout(() => hide(), 2600);

      } else if (result === "unverified") {
        card.innerHTML = `
          <button class="close" aria-label="Dismiss">×</button>
          <p class="who">C from PrivaC</p>
          <p>I clicked the rejection button, but couldn't verify that the website saved your choice.</p>
        `;

        card.querySelector(".close").addEventListener("click", () => hide());
        root.querySelector(".c").innerHTML =
          PrivaCMascot.svg("neutral", { size: 120 });

      } else {
        card.innerHTML = `
          <button class="close" aria-label="Dismiss">×</button>
          <p class="who">C from PrivaC</p>
          <p>I couldn't complete the cookie rejection. You may need to choose your preferences manually.</p>
        `;

        card.querySelector(".close").addEventListener("click", () => hide());
        root.querySelector(".c").innerHTML =
          `<img src="${chrome.runtime.getURL("c-poses/mascot-push-up-uneasy.svg")}" alt="Uneasy C mascot">`
      }
    });


    root.querySelector('[data-a="choose"]').addEventListener("click", () => {
      root.querySelector(".card").classList.remove("intro");

      if (onChoose) onChoose();

      const card = root.querySelector(".card");

      card.innerHTML = `
        <p class="who">C from PrivaC</p>
        <p>Oh, so we're doing this ourselves now?</p>
      `;

      const mascot = root.querySelector(".c");
      const currentImage = mascot.querySelector("img");
      const isHanging = currentImage?.src.includes("mascot-cliff-hang.svg");

      const uneasyPose = isHanging
        ? "mascot-cliff-hang-uneasy.svg"
        : "mascot-push-up-uneasy.svg";

      mascot.innerHTML = `
        <img src="${chrome.runtime.getURL("c-poses/" + uneasyPose)}" alt="Uneasy C mascot">
      `;
      
      root.querySelector(".c").style.transform = "translateY(0px)";

      setTimeout(() => hide(), 2200);
    });

  }

  function acceptOnly() {
    const root = mount(`
      <p class="who">C from PrivaC</p>
      <p>Beware! This site may still use cookies to track your activity.</p>
    `, "alarmed");

    root.querySelector(".c").innerHTML = `
      <img src="${chrome.runtime.getURL("c-poses/mascot-alarmed-yield-wave.svg")}" alt="Alarmed C mascot">
    `;

    const currentHost = host;

    setTimeout(() => {
      if (host === currentHost) hide();
    }, 6500);
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

  window.PrivaCPrompt = {
    cookie,
    acceptOnly,
    adversary,
    hide,
    ignored,
    isReacting,
    isCelebrating,
    positionAtBanner
  };
})();
