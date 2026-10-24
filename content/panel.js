// PrivaC's toolbar pop-up with rounded corners (PLAN R10).
// Chrome draws an extension's pop-up window as a plain rectangle and extensions can't change its shape. So when
// you click PrivaC's toolbar button on a website, background/toolbar.js asks this script to float the same
// pop-up page (popup/popup.html) over the top right of the page in a rounded glass panel instead.
// The website can't read or change what's inside: it's PrivaC's own page in a frame, under a closed shadow root.
// It closes like Chrome's pop-up: click the button again, press Escape, click the page, or switch tabs.
// Where it can't float (not an http/https page, a page showing a modal dialog, full screen) it answers no and
// the background opens Chrome's own pop-up window instead. Messages from the panel carry only its size and look.
(function () {
  // A copy left from before PrivaC was reloaded can't hear the button any more, so a fresh one takes over.
  const alive = (p) => { try { return !!(p && p.runtimeId && p.runtimeId === chrome.runtime.id); } catch (e) { return false; } };
  if (window.top !== window || alive(window.PrivaCPanel)) return;

  const GAP = 10;        // px from the window's top and right edges, under the toolbar button
  const WAIT = 4000;     // ms for PrivaC's page to draw before giving up and asking for Chrome's window
  const ORIGIN = "chrome-extension://" + chrome.runtime.id;
  const HOST_STYLE = "all: initial !important; position: fixed !important; inset: 0 auto auto 0 !important; " +
    "width: 0 !important; height: 0 !important; display: block !important; z-index: 2147483647 !important; " +
    "pointer-events: none !important;";
  const CSS = `
    .box {
      position: fixed; top: ${GAP}px; right: ${GAP}px;
      width: 392px; max-width: calc(100vw - ${GAP * 2}px); height: 160px; box-sizing: border-box;
      border-radius: 26px; overflow: hidden; isolation: isolate;
      background: rgba(240, 242, 247, .68);
      -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);
      box-shadow: 0 0 0 .5px rgba(0, 0, 0, .14), 0 3px 10px rgba(0, 0, 0, .08), 0 24px 64px -12px rgba(0, 0, 0, .34);
      opacity: 0; transform: translateY(-8px) scale(.97); transform-origin: 100% 0; pointer-events: none;
      transition: opacity 160ms ease-out, transform 260ms cubic-bezier(.2, .9, .3, 1.04);
    }
    .box.shown { opacity: 1; transform: none; pointer-events: auto; }
    .box.dark {
      background: rgba(24, 27, 36, .64);
      box-shadow: 0 0 0 .5px rgba(0, 0, 0, .5), 0 3px 10px rgba(0, 0, 0, .22), 0 24px 64px -12px rgba(0, 0, 0, .6);
    }
    /* The glass rim: a bright top edge and a hairline all round, drawn over the page inside. */
    .box::after {
      content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .75), inset 0 0 0 .5px rgba(255, 255, 255, .5);
    }
    .box.dark::after { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .13), inset 0 0 0 .5px rgba(255, 255, 255, .08); }
    .box.clean { background: #f5f6f8; -webkit-backdrop-filter: none; backdrop-filter: none; }
    .box.clean.dark { background: #13161c; }
    iframe { display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: transparent; color-scheme: light; }
    @media (prefers-reduced-motion: reduce) { .box { transform: none; transition: opacity 120ms linear; } }
    @media (prefers-reduced-transparency: reduce) {
      .box { background: #f5f6f8; -webkit-backdrop-filter: none; backdrop-filter: none; }
      .box.dark { background: #13161c; }
    }`;

  // Why the panel can't float on this page ("" = it can).
  function blocked(doc, loc) {
    if (!/^https?:$/.test(loc.protocol)) return "page";
    const root = doc.documentElement;
    if (!root || root.namespaceURI !== "http://www.w3.org/1999/xhtml" || !doc.body || doc.body.tagName !== "BODY") return "page";
    // A modal dialog makes everything outside it unclickable, so the panel would be stuck behind it.
    try { if (doc.querySelector("dialog:modal")) return "modal"; } catch (e) { /* no :modal in this Chrome */ }
    if (doc.fullscreenElement) return "fullscreen";
    return "";
  }

  // The panel's height: what the pop-up page needs, never closer than GAP to the window's bottom.
  function fit(height, vh) {
    const room = Math.max(160, vh - GAP * 2);
    const want = Math.ceil(Number(height) || 0);
    return want > 0 ? Math.min(want, room) : room;
  }

  // Only PrivaC's own page in the panel counts; a website's script can't fake where a message came from.
  function fromPanel(e, win) {
    return !!(e && win && e.source === win && e.origin === ORIGIN && e.data && e.data.privacPanel === 1);
  }

  let cur = null;   // the open panel

  function open() {
    const host = document.createElement("privac-panel");
    host.setAttribute("style", HOST_STYLE);
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    const box = document.createElement("div");
    box.className = "box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "PrivaC");
    const frame = document.createElement("iframe");
    frame.setAttribute("title", "PrivaC");
    frame.src = chrome.runtime.getURL("popup/popup.html") + "?panel=1";
    box.appendChild(frame);
    root.appendChild(style);
    root.appendChild(box);

    const s = { host, box, frame, height: 0, shown: false, before: document.activeElement, off: [], timer: 0 };
    cur = s;   // first, so close() can undo whatever follows if something fails
    const on = (target, name, fn, opts) => {
      target.addEventListener(name, fn, opts);
      s.off.push(() => target.removeEventListener(name, fn, opts));
    };
    on(window, "message", (e) => {
      if (!fromPanel(e, frame.contentWindow)) return;
      const d = e.data;
      if (d.type === "close") { close(); return; }
      if (d.type !== "size") return;
      const dark = d.theme === "dark";
      box.classList.toggle("dark", dark);
      box.classList.toggle("clean", d.style === "clean");
      frame.style.colorScheme = dark ? "dark" : "light";   // Chrome only lets a frame be see-through when this matches
      s.height = d.height;
      box.style.height = fit(s.height, innerHeight) + "px";
      if (d.ready && !s.shown) {
        s.shown = true;
        clearTimeout(s.timer);
        box.classList.add("shown");
        try { frame.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      }
    });
    on(window, "keydown", (e) => { if (e.key === "Escape") close(); }, true);
    on(window, "pointerdown", (e) => {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (!path.includes(host)) close();
    }, true);
    on(document, "visibilitychange", () => { if (document.visibilityState === "hidden") close(); });
    on(window, "pagehide", () => close());
    on(window, "resize", () => { if (s.height) box.style.height = fit(s.height, innerHeight) + "px"; });
    s.timer = setTimeout(() => {
      if (cur !== s || s.shown) return;
      close();
      try {
        const p = chrome.runtime.sendMessage({ type: "privac-panel-failed" });
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (err) { /* PrivaC was reloaded */ }
    }, WAIT);
    document.documentElement.appendChild(host);
  }

  function close() {
    const s = cur;
    cur = null;
    if (!s) return;
    clearTimeout(s.timer);
    for (const off of s.off) off();
    const hadFocus = document.activeElement === s.host;
    s.host.remove();
    // Give the keyboard back to what you were using on the page.
    const b = s.before;
    if (hadFocus && b && b !== document.body && b.isConnected && typeof b.focus === "function") {
      try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "privac-panel") return;
    if (cur && cur.host.isConnected) { close(); sendResponse({ ok: true, open: false }); return; }
    if (cur) close();   // the website removed it; start fresh
    const why = blocked(document, location);
    if (why) { sendResponse({ ok: false, why }); return; }
    try {
      open();
      sendResponse({ ok: true, open: true });
    } catch (e) {
      close();
      sendResponse({ ok: false, why: "error" });
    }
  });

  window.PrivaCPanel = { blocked, fit, isOpen: () => !!cur, close: () => close(), runtimeId: chrome.runtime.id };
})();
