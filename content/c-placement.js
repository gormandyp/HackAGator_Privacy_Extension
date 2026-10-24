// Where C stands next to a cookie pop-up (repo owner, 2026-10-24).
// cookie-detector.js hands Matthew's positionAtBanner() the nearest element named like a cookie banner. On
// many real sites that is only the Reject button or its row (Tesco, John Lewis, Waitrose), so C's speech
// card covered the pop-up's own buttons, and under a banner across the top of the page C hung in mid-air.
// This finds the pop-up the person actually sees, then puts C on its edge: hanging under it when it starts
// in the top half of the window, peeking over it otherwise, lined up with the Reject button. He never covers
// the pop-up's buttons or links, and his speech card never covers the pop-up. With no room above or below (a
// tall pop-up), he stands in a window corner that covers none of its buttons. He follows the pop-up while it
// slides in, and when the page scrolls or the window resizes; when his answer is shorter than the question,
// he keeps his footing.
// Wraps PrivaCPrompt; c-prompt.js and cookie-detector.js are unchanged (Matthew can fold this in later).
(function () {
  if (window.PrivaCPlacement || !window.PrivaCPrompt) return;
  const P = window.PrivaCPrompt;

  const M = 8;        // gap from the window's edges
  const GAP = 4;      // between the speech card and C (c-prompt.js .wrap gap)
  const LIFT = 52;    // the card sits this far from the edge C holds (c-prompt.js .card margin-bottom)
  const GRIP = 7;     // hanging: C's hands are drawn this far below the top of his box
  const LEDGE = 1;    // peeking over: his hands overlap the pop-up's top edge by this much

  // ---- Pure geometry -----------------------------------------------------------------------------------
  // panel/button: rects in window pixels ({left, top, right, bottom, width, height}) or null. controls: rects
  // of the pop-up's other buttons and links. card/c: sizes of the speech card and of C's box. kind: "ask" (the
  // cookie question) or "warn" (this site may still track you). edge: keep this edge (C is mid-reaction).
  // prefer: the edge he's on now (he stays there while it still fits). Returns the wrap's spot and the boxes.
  function place({ panel, button, controls, card, c, vw, vh, kind = "ask", edge: keep, prefer }) {
    const W = card.width + GAP + c.width;
    const H = Math.max(card.height + LIFT, c.height);
    const has = !!panel && panel.width > 0 && panel.height > 0;
    const blockers = (controls || []).concat(button ? [button] : []);   // what he must never cover
    const aim = button ? (button.left + button.right) / 2
      : has ? panel.right - 35 - c.width / 2                   // where c-prompt.js puts him
      : vw - M - c.width / 2;
    const clampX = (x) => Math.max(M, Math.min(x, vw - W - M));
    const clampY = (y) => Math.max(0, Math.min(y, vh - H));
    const lineUp = () => {
      const left = aim - (W - c.width / 2);                   // card on C's left, C over the button
      if (left < M && aim - c.width / 2 + W <= vw - M) return { left: Math.max(M, aim - c.width / 2), flip: true };
      return { left: clampX(left), flip: false };
    };
    const result = (edge, top, left, flip) => {
      top = Math.round(top); left = Math.round(left);
      const cx = flip ? left : left + card.width + GAP;
      const kx = flip ? left + c.width + GAP : left;
      const below = edge === "below";
      return {
        edge, flip, top, left, width: W, height: H,
        cBox: rect(cx, below ? top : top + H - c.height, c.width, c.height),
        cardBox: rect(kx, below ? top + LIFT : top + H - LIFT - card.height, card.width, card.height)
      };
    };
    const covered = (x) => blockers.reduce((sum, b) => sum + area(x.cBox, b) + area(x.cardBox, b), 0);
    const corner = () => {
      // In a corner of the window, covering as little of the pop-up's buttons as possible: standing on the
      // bottom edge (right side first, like the foreign-adversary alert), or hanging from the top edge only
      // when both bottom corners would cover a button; then covering as little of the pop-up as possible.
      // His warning pose stands, so it only goes on the bottom edge. A window shorter than C keeps his card's
      // top (and its close button) on screen.
      const bottom = Math.max(0, vh - H);
      const spots = [["corner", bottom, vw - W - M, false], ["corner", bottom, M, true]];
      if (kind !== "warn") spots.push(["below", 0, vw - W - M, false], ["below", 0, M, true]);
      const cost = (x) => [covered(x), x.edge === "below" ? 1 : 0, has ? area(x.cBox, panel) + area(x.cardBox, panel) : 0];
      const less = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
      let best = null, bestCost = null;
      for (const [edge, top, left, flip] of spots) {
        const x = result(edge, top, Math.max(M, left), flip), k = cost(x);
        if (!best || less(k, bestCost)) { best = x; bestCost = k; }
      }
      return best;
    };
    if (!has) return corner();

    const lined = lineUp();
    const cx = lined.flip ? lined.left : lined.left + card.width + GAP;
    const onEdge = (b) => b.bottom > panel.bottom - GRIP && b.top < panel.bottom && b.right > cx && b.left < cx + c.width;
    const grip = blockers.some(onEdge) ? 0 : GRIP;                     // never lay his hands over a button
    const belowTop = Math.max(0, panel.bottom - grip);                  // off the top: hang from the window's top
    const aboveTop = Math.min(panel.top, vh) + LEDGE - H;               // off the bottom: peek up from its bottom
    const fitsBelow = panel.bottom <= vh && belowTop + H <= vh - M;
    const fitsAbove = aboveTop >= M;
    const hang = () => result("below", clampY(belowTop), lined.left, lined.flip);
    const peek = () => result("above", clampY(aboveTop), lined.left, lined.flip);

    if (keep === "below") return hang();
    if (keep === "above") return peek();
    if (keep === "corner") return corner();
    if (kind === "warn") return fitsAbove ? peek() : corner();          // his warning pose stands, it can't hang
    if (prefer === "below" && fitsBelow) return hang();                 // no jumping sides while you scroll
    if (prefer === "above" && fitsAbove) return peek();
    if (panel.top < vh / 2) return fitsBelow ? hang() : fitsAbove ? peek() : corner();
    return fitsAbove ? peek() : fitsBelow ? hang() : corner();
  }
  function rect(left, top, width, height) { return { left, top, width, height, right: left + width, bottom: top + height }; }
  function overlaps(a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; }
  function area(a, b) {
    if (!a || !b) return 0;
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }

  // ---- Finding the pop-up you see, from the button the detector found ---------------------------------------
  const KEY = /cookie|consent|privacy|gdpr|ccpa|onetrust|didomi|cookiebot|cmp/i;
  const nameOf = (n) => (n.id || "") + " " + (typeof n.className === "string" ? n.className : (n.getAttribute && n.getAttribute("class")) || "");
  function up(n) {                                                      // the parent you see (through slots and shadow roots)
    if (n.assignedSlot) return n.assignedSlot;
    if (n.parentElement) return n.parentElement;
    const r = n.getRootNode && n.getRootNode();
    return (r && r.host) || null;                                       // out of a shadow root
  }
  function alpha(color) {
    const s = String(color || "").trim();
    if (!s || s === "transparent") return 0;
    const slash = /\/\s*([\d.]+%?)\s*\)$/.exec(s);
    if (slash) return slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    const m = /^rgba\(([^)]+)\)$/.exec(s);
    if (m) { const parts = m[1].split(","); return parts.length > 3 ? parseFloat(parts[3]) : 1; }
    return 1;
  }
  function skinned(cs) {
    return alpha(cs.backgroundColor) >= 0.3 || (cs.backgroundImage && cs.backgroundImage !== "none") ||
      (cs.boxShadow && cs.boxShadow !== "none") || (cs.backdropFilter && cs.backdropFilter !== "none") ||
      (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && alpha(cs.borderTopColor) >= 0.3);
  }
  function floating(n, cs) {
    const role = n.getAttribute && n.getAttribute("role");
    return cs.position === "fixed" || cs.position === "sticky" || n.tagName === "DIALOG" ||
      role === "dialog" || role === "alertdialog" || (n.getAttribute && n.getAttribute("aria-modal") === "true");
  }
  function dialogish(n) {
    const role = n.getAttribute && n.getAttribute("role");
    return n.tagName === "DIALOG" || role === "dialog" || role === "alertdialog" || (n.getAttribute && n.getAttribute("aria-modal") === "true");
  }
  // A page's modal <dialog> sits above everything else and makes the rest of the page unclickable, so C goes
  // inside it.
  function modalAround(n) {
    for (let x = n; x && x.nodeType === 1; x = up(x)) {
      if (x.tagName !== "DIALOG") continue;
      try { return x.matches(":modal") ? x : null; } catch (e) { return null; }
    }
    return null;
  }

  // The box the person sees: inside the outermost floating container (fixed, sticky or a dialog), the
  // outermost element that has a background, border or shadow and doesn't cover the whole window (so a
  // dimmed full-screen overlay gives the white box inside it). In the page's own flow, the outermost element
  // named like a cookie banner. null when nothing looks like a pop-up.
  function findPanel(start, hint) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const chain = [];
    for (let n = start; n && n.nodeType === 1 && n !== document.body && n !== document.documentElement; n = up(n)) chain.push(n);
    if (!chain.length) return null;
    const styles = chain.map((n) => window.getComputedStyle(n) || {});
    let top = -1;
    chain.forEach((n, i) => { if (floating(n, styles[i])) top = i; });
    if (top < 0) {
      chain.forEach((n, i) => { if (KEY.test(nameOf(n))) top = i; });
      top = Math.max(top, hint ? chain.indexOf(hint) : -1, 0);
    }
    let best = null, plain = null, big = null;
    for (let i = 0; i <= top; i++) {
      if (/^(BUTTON|A|INPUT|SELECT|LABEL)$/.test(chain[i].tagName) || (chain[i].getAttribute && chain[i].getAttribute("role") === "button")) continue;
      const r = chain[i].getBoundingClientRect();
      if (r.width < 40 || r.height < 20) continue;
      if (r.width >= vw * 0.95 && r.height >= vh * 0.85) {             // a full-window overlay, not the box...
        if (!big && dialogish(chain[i]) && skinned(styles[i])) big = chain[i];   // ...unless it's a dialog box filling a small window
        continue;
      }
      plain = chain[i];
      if (skinned(styles[i])) best = chain[i];
    }
    return best || big || plain;
  }

  // ---- C's pop-up -------------------------------------------------------------------------------------
  const BUTTONS = 'button, [role="button"], input[type="button"]';
  const CONTROLS = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"]';
  const REJECT = [/^reject all(?: cookies)?$/i, /^reject optional(?: cookies)?$/i, /^reject non-essential(?: cookies)?$/i,
    /^decline all(?: cookies)?$/i, /^decline optional(?: cookies)?$/i, /^decline non-essential(?: cookies)?$/i,
    /^deny all(?: cookies)?$/i, /^refuse all(?: cookies)?$/i, /^disallow all(?: cookies)?$/i, /^only necessary(?: cookies)?$/i,
    /^only essential(?: cookies)?$/i, /^essential cookies only$/i, /^necessary cookies only$/i, /^accept only essential cookies$/i,
    /^accept only necessary cookies$/i, /^use essential cookies only$/i, /^use necessary cookies only$/i,
    /^continue without accepting$/i, /^continue without consent$/i, /^save necessary cookies only$/i,
    /^reject all optional cookies$/i, /^reject all non-essential cookies$/i, /^deny cookies$/i,
    /^reject additional cookies$/i, /^allow recommended cookies only$/i];       // same as cookie-detector.js
  const label = (e) => String(e.innerText || e.value || (e.getAttribute && e.getAttribute("aria-label")) || "").trim().replace(/\s+/g, " ");
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function rejectButtonIn(el) {
    if (!el || !el.querySelectorAll) return null;
    const list = (el.matches && el.matches(BUTTONS) ? [el] : []).concat(Array.from(el.querySelectorAll(BUTTONS)));
    return list.find((b) => shown(b) && REJECT.some((p) => p.test(label(b)))) || null;
  }
  // The pop-up's own buttons and links, so C doesn't stand on any of them.
  function controlsIn(el, skip) {
    const out = [];
    if (!el || !el.querySelectorAll) return out;
    for (const n of el.querySelectorAll(CONTROLS)) {
      if (skip && skip.contains(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push(r);
      if (out.length >= 60) break;
    }
    return out;
  }

  const STYLE = `
    .wrap { pointer-events: none; }
    .wrap > .card, .wrap > .c { pointer-events: auto; }
    .wrap[data-moved]:not(.out) { animation: none; }
    .wrap[data-edge] .c img { object-position: bottom; }
    .wrap[data-edge="below"] { align-items: flex-start; }
    .wrap[data-edge="below"] .card { margin-bottom: 0; margin-top: ${LIFT}px; }
    .wrap[data-edge="below"] .card::after { bottom: auto; top: 22px; }
    .wrap[data-edge="below"] .c img { object-position: top; }
    .wrap[data-edge="below"] .card.intro { transform-origin: right top; }
    .wrap[data-flip] { flex-direction: row-reverse; }
    .wrap[data-flip] .card::after { right: auto; left: -11px; border-top: 0; border-right: 0;
      border-left: 2px solid #16233f; border-bottom: 2px solid #16233f; }
    .wrap[data-flip] .card.intro { transform-origin: left bottom; }
    .wrap[data-flip][data-edge="below"] .card.intro { transform-origin: left top; }
    [data-privac-probe] { position: fixed; width: 0; height: 0; padding: 0; border: 0; visibility: hidden; pointer-events: none; }
    [data-privac-probe="a"] { left: 0; top: 0; }
    [data-privac-probe="b"] { right: 0; bottom: 0; }
    @media (prefers-reduced-motion: reduce) { .c img, .card.intro { animation: none !important; } }
  `;
  const POSE = { below: "mascot-cliff-hang.svg", above: "mascot-push-up.svg", corner: "mascot-push-up.svg" };
  const poseOf = (img) => { const m = /([\w-]+\.svg)$/.exec(String((img && img.getAttribute("src")) || "")); return m ? m[1] : ""; };
  const newest = () => { const all = document.querySelectorAll("privac-prompt"); return all[all.length - 1] || null; };
  // Layout size, not the on-screen box: the speech card pops in from 15% scale, and C must not drift with it.
  const sizeOf = (e) => ({ width: e.offsetWidth, height: e.offsetHeight });
  const live = (n) => !!n && n.isConnected && shown(n);
  // Clicks, taps and keys on C stay with C: a site that closes its dialog on clicks outside it, or that takes
  // any click as "you accepted", doesn't see them.
  const STOP = ["click", "dblclick", "auxclick", "contextmenu", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "keydown", "keyup", "keypress"];
  const LIFTED = ["display", "position", "inset", "width", "height", "margin", "padding", "border", "background", "overflow"];

  let current = null;
  const placed = new WeakSet();

  function setPose(root, edge, animate) {
    const c = root.querySelector(".c");
    const img = c && c.querySelector("img");
    const file = poseOf(img);
    if (file !== POSE.below && file !== POSE.above) return;            // warning pose or a reaction: leave it
    if (file === POSE[edge]) return;
    const next = document.createElement("img");
    next.src = chrome.runtime.getURL("c-poses/" + POSE[edge]);
    next.alt = "C mascot";
    img.replaceWith(next);
    c.classList.remove("hanging", "rising");
    if (!animate) return;
    const cls = edge === "below" ? "hanging" : "rising";
    c.classList.add(cls);
    next.addEventListener("animationend", () => c.classList.remove(cls), { once: true });
  }

  // The window's size without its scroll bars.
  function viewport() {
    const e = document.compatMode === "BackCompat" && document.body ? document.body : document.documentElement;
    return { w: (e && e.clientWidth) || window.innerWidth, h: (e && e.clientHeight) || window.innerHeight };
  }
  // Where C's position:fixed coordinates start and end, in window pixels, measured with two invisible markers
  // next to him: normally the window itself; inside a site's dialog that is moved with a CSS transform,
  // translate, scale, filter or similar, that dialog's box (and anything outside it is cut off).
  function frameOf(root, view) {
    const a = root.querySelector('[data-privac-probe="a"]'), b = root.querySelector('[data-privac-probe="b"]');
    if (!a || !b) return { left: 0, top: 0, right: view.w, bottom: view.h };
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return { left: ra.left, top: ra.top, right: rb.left, bottom: rb.top };
  }
  const framed = (f, view) => Math.abs(f.left) > 1.5 || Math.abs(f.top) > 1.5 || Math.abs(f.right - view.w) > 1.5 || Math.abs(f.bottom - view.h) > 1.5;

  // Put the wrap at r (window pixels), counted from frame f. Hanging, he's held by his hands at the top;
  // standing or peeking, by his feet at the bottom, so a shorter answer than the question doesn't sink him.
  function pin(wrap, r, f) {
    wrap.style.left = Math.round(r.left - f.left) + "px";
    if (r.edge === "below") {
      wrap.style.top = Math.round(r.top - f.top) + "px";
      wrap.style.bottom = "auto";
    } else {
      wrap.style.top = "auto";
      wrap.style.bottom = Math.round(f.bottom - (r.top + r.height)) + "px";
    }
  }

  // Into the top layer, above the site's dialog, so its transform and edges don't apply to him. He stays inside
  // the dialog in the page, so the dialog doesn't make him unclickable.
  function lift(s) {
    const h = s.host;
    if (s.lifted || typeof h.showPopover !== "function") return !!s.lifted;
    try {
      h.setAttribute("popover", "manual");
      for (const [k, v] of [["display", "block"], ["position", "fixed"], ["inset", "0 auto auto 0"], ["width", "0"], ["height", "0"],
        ["margin", "0"], ["padding", "0"], ["border", "0"], ["background", "transparent"], ["overflow", "visible"]]) h.style.setProperty(k, v, "important");
      h.showPopover();
      s.lifted = true;
      if (!document.querySelector("style[data-privac-backdrop]")) {
        const st = document.createElement("style");
        st.setAttribute("data-privac-backdrop", "");
        st.textContent = "privac-prompt::backdrop { background: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }";
        (document.head || document.documentElement).appendChild(st);
      }
    } catch (e) {
      h.removeAttribute("popover");
      for (const k of LIFTED) h.style.removeProperty(k);
      if (s.dialog) h.style.setProperty("display", "contents", "important");
      s.lifted = false;
    }
    return s.lifted;
  }
  function unlift(s) {
    const h = s.host;
    if (!s.lifted) return;
    s.lifted = false;
    try { if (h.matches(":popover-open")) h.hidePopover(); } catch (e) { /* already hidden */ }
    h.removeAttribute("popover");
    for (const k of LIFTED) h.style.removeProperty(k);
  }

  // Inside a dialog he can't leave (lifting didn't work): a corner inside it that covers none of its
  // controls, in window pixels; null when there's no such room.
  function innerSpot(s, card, c, f) {
    const d = s.dialog, ds = window.getComputedStyle(d) || {};
    const b = d.getBoundingClientRect();
    const pad = { left: b.left + (parseFloat(ds.borderLeftWidth) || 0), top: b.top + (parseFloat(ds.borderTopWidth) || 0) };
    const inner = place({ panel: null, button: null, card: sizeOf(card), c: sizeOf(c), vw: d.clientWidth, vh: d.clientHeight, kind: s.kind, edge: "corner" });
    if (inner.width + 2 * M > d.clientWidth || inner.height > d.clientHeight) return null;
    const controls = controlsIn(d, s.host);
    const spots = [inner, Object.assign({}, inner, { left: M, flip: true })].map((x) => {
      const cx = x.flip ? x.left : x.left + x.width - inner.cBox.width;
      const kx = x.flip ? x.left + inner.cBox.width + GAP : x.left;
      return Object.assign({}, x, {
        left: pad.left + x.left, top: pad.top + x.top,
        cBox: rect(pad.left + cx, pad.top + inner.cBox.top, inner.cBox.width, inner.cBox.height),
        cardBox: rect(pad.left + kx, pad.top + inner.cardBox.top, inner.cardBox.width, inner.cardBox.height)
      });
    });
    return spots.find((x) => !controls.some((k) => overlaps(k, x.cBox) || overlaps(k, x.cardBox))) || null;
  }

  // The pop-up went away (C is answering): stay put, but keep him in the window if it's resized.
  function keepOnScreen(wrap, card, c, view) {
    const k = card.getBoundingClientRect(), m = c.getBoundingClientRect();
    let b = { left: Math.min(k.left, m.left), right: Math.max(k.right, m.right), top: Math.min(k.top, m.top), bottom: Math.max(k.bottom, m.bottom) };
    if (b.right - b.left > view.w - 2 * M) b = k;                      // no room for both: keep his card (and its ×)
    if (!(k.width > 0)) return;
    const dx = b.right > view.w - M ? view.w - M - b.right : b.left < M ? M - b.left : 0;
    const dy = b.bottom > view.h ? view.h - b.bottom : b.top < 0 ? -b.top : 0;
    if (dx) wrap.style.left = (parseFloat(wrap.style.left) || 0) + Math.round(dx) + "px";
    if (!dy) return;
    if (wrap.style.top && wrap.style.top !== "auto") wrap.style.top = (parseFloat(wrap.style.top) || 0) + Math.round(dy) + "px";
    else wrap.style.bottom = (parseFloat(wrap.style.bottom) || 0) - Math.round(dy) + "px";
  }

  function apply(s, first) {
    const root = s.host.shadowRoot;
    const wrap = root && root.querySelector(".wrap");
    const card = root && root.querySelector(".card");
    const c = root && root.querySelector(".c");
    if (!wrap || !card || !c) return;
    const view = viewport();
    if (!first && s.panel && !live(s.panel)) { keepOnScreen(wrap, card, c, view); return; }
    const reacting = s.kind === "ask" && !root.querySelector('[data-a="decline"]');
    let f = frameOf(root, view);
    let r = null;
    if (s.dialog && framed(f, view)) {
      // A dialog moved with a transform (or similar) would cut him off at its edges.
      if (lift(s)) f = frameOf(root, view);
      if (framed(f, view)) {
        const ds = window.getComputedStyle(s.dialog) || {};
        if (ds.overflowX !== "visible" || ds.overflowY !== "visible") {
          r = innerSpot(s, card, c, f);
          const hide = r ? "" : "hidden";                               // no room: better no C than a C in the way
          if (s.host.style.visibility !== hide) s.host.style.visibility = hide;
          if (!r) return;
        }
      }
    }
    if (!r) {
      if (s.host.style.visibility === "hidden") s.host.style.visibility = "";
      r = place({
        panel: live(s.panel) ? s.panel.getBoundingClientRect() : null,
        button: live(s.button) ? s.button.getBoundingClientRect() : null,
        controls: controlsIn(s.panel, s.host),
        card: sizeOf(card), c: sizeOf(c), vw: view.w, vh: view.h, kind: s.kind,
        edge: reacting ? s.edge : undefined, prefer: first ? undefined : s.edge
      });
    }
    if (r.edge !== s.edge || first) {
      wrap.dataset.edge = r.edge;
      wrap.classList.toggle("top-banner", r.edge === "below");          // no slide-up when hanging from a top edge
      if (!reacting) setPose(root, r.edge, first);
      s.edge = r.edge;
    }
    if (r.flip) wrap.dataset.flip = ""; else delete wrap.dataset.flip;
    pin(wrap, r, f);
    s.last = { edge: r.edge, left: r.left, top: r.top, height: r.height };
  }

  function begin(host, el, kind) {
    const root = host.shadowRoot;
    if (!root || root.querySelector(".card.alert")) return;             // the foreign-adversary alert has its own spot
    if (current && current.host !== host) current.stop();
    if (current && current.host === host) { current.edge = null; apply(current, false); return; }   // placed again: re-apply
    if (!root.querySelector("style[data-privac-placement]")) {
      const st = document.createElement("style");
      st.setAttribute("data-privac-placement", "");
      st.textContent = STYLE;
      root.appendChild(st);
      for (const k of ["a", "b"]) {
        const probe = document.createElement("i");
        probe.setAttribute("data-privac-probe", k);
        probe.setAttribute("aria-hidden", "true");
        root.appendChild(probe);
      }
      const stop = (e) => e.stopPropagation();
      for (const t of STOP) host.addEventListener(t, stop, /^touch/.test(t) ? { passive: true } : false);
    }
    const button = kind === "ask" ? (rejectButtonIn(el) || (el ? null : rejectButtonIn(document.body))) : null;
    const start = button || el;
    const s = { host, kind, button, panel: start ? findPanel(start, el) : null, edge: null, dialog: null, lifted: false, last: null };
    const dialog = modalAround(s.panel || start);
    if (dialog) {
      if (host.parentNode !== dialog) dialog.appendChild(host);
      host.style.setProperty("display", "contents", "important");      // no box of his own in the dialog's layout
      s.dialog = dialog;
    }
    placed.add(host);
    current = s;
    apply(s, true);

    // Follow the pop-up: every frame while it settles (many slide in), then now and then, and whenever the
    // page scrolls, the window resizes, the pop-up changes size or his speech card does (his answer).
    let frame = 0;
    const tick = () => guard(() => { if (!host.isConnected) { s.stop(); return; } apply(s, false); });
    const soon = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; tick(); }); };
    const settleUntil = Date.now() + 1800;
    const settle = () => { frame = 0; tick(); if (current === s && Date.now() < settleUntil) frame = requestAnimationFrame(settle); };
    frame = requestAnimationFrame(settle);
    const timers = [2500, 4000, 6000].map((t) => setTimeout(tick, t));
    const alive = setInterval(() => guard(() => { if (!host.isConnected) s.stop(); }), 1000);   // gone: stop listening
    window.addEventListener("scroll", soon, { capture: true, passive: true });
    window.addEventListener("resize", soon, { passive: true });
    let ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(soon);
      if (s.panel) ro.observe(s.panel);
      const card = root.querySelector(".card");
      if (card) ro.observe(card);
    }
    // C lives inside a modal dialog: when the site closes it, or deletes it (John Lewis removes the whole
    // dialog after "Reject all"), step back out onto the page so his answer stays visible where he was.
    // If the site shows the dialog again, step back on top of it.
    let watch = null, gone = null;
    if (dialog) {
      const isOpen = () => { try { return dialog.isConnected && dialog.open && dialog.matches(":modal"); } catch (e) { return false; } };
      const leave = () => {
        if (watch) watch.disconnect();
        if (gone) gone.disconnect();
        if (host.parentNode !== dialog) return;                         // closed on purpose (hide() took him away)
        const wrap = host.shadowRoot.querySelector(".wrap");
        if (wrap) wrap.dataset.moved = "";                               // no slide-in replay
        unlift(s);
        host.style.removeProperty("display");
        s.dialog = null;
        document.documentElement.appendChild(host);
        if (wrap && s.last) { const view = viewport(); pin(wrap, s.last, { left: 0, top: 0, right: view.w, bottom: view.h }); }
      };
      // Closed, or shown again (then it's on top of him: step back on top of it).
      watch = new MutationObserver(() => guard(() => {
        if (host.parentNode !== dialog) { leave(); return; }
        if (!isOpen()) { leave(); return; }
        if (s.lifted) {
          const wrap = host.shadowRoot.querySelector(".wrap");
          if (wrap) wrap.dataset.moved = "";
          try { if (host.matches(":popover-open")) host.hidePopover(); host.showPopover(); } catch (e) { /* ignore */ }
        }
      }));
      watch.observe(dialog, { attributes: true, attributeFilter: ["open"] });
      // Deleted (John Lewis removes the whole dialog after "Reject all"): no measuring, just this check.
      gone = new MutationObserver(() => guard(() => { if (!dialog.isConnected || host.parentNode !== dialog) leave(); }));
      gone.observe(document, { childList: true, subtree: true });
    }
    s.stop = () => {
      timers.forEach(clearTimeout);
      clearInterval(alive);
      window.removeEventListener("scroll", soon, { capture: true });
      window.removeEventListener("resize", soon);
      if (ro) ro.disconnect();
      if (watch) watch.disconnect();
      if (gone) gone.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (current === s) current = null;
    };
  }

  const kindOf = (root) => (root.querySelector('[data-a="decline"]') ? "ask" : "warn");
  const guard = (f) => { try { f(); } catch (e) { /* placement must never break C */ } };

  // C asks once. On a page with both a "Do not sell or share my personal information" link and a Reject
  // button (Zara), cookie-detector.js alternates between the two, and each new pop-up set off the next check:
  // C opened 28 times in 10 seconds. So while C is asking and untouched, another pop-up isn't opened or
  // moved; the cookie question may replace the "may still track you" warning, not the other way round; and
  // after you pick "Let me choose", he doesn't ask again on this page. A C hidden for lack of room doesn't count.
  let quiet = false;
  let skipMove = false;
  const showing = () => {
    const h = newest();
    const r = h && h.isConnected && h.shadowRoot;
    const w = r && r.querySelector(".wrap");
    const hidden = h && h.style && h.style.visibility === "hidden";
    return w && !hidden && !w.classList.contains("out") && !r.querySelector(".card.alert") ? r : null;
  };
  const skip = () => { skipMove = true; Promise.resolve().then(() => { skipMove = false; }); };

  if (typeof P.positionAtBanner === "function") {
    const original = P.positionAtBanner;
    P.positionAtBanner = function (banner, ...rest) {
      if (skipMove) { skipMove = false; return; }                     // that pop-up wasn't opened
      const host = newest();
      if (host && host.shadowRoot && host.shadowRoot.querySelector(".card.alert")) return;   // don't move the alert
      const result = original.call(this, banner, ...rest);
      guard(() => { if (host && host.isConnected) begin(host, banner, kindOf(host.shadowRoot)); });
      return result;
    };
  }

  // cookie-detector.js only places C when it finds a container around the button. Without one, C would stay
  // in the top-left corner over the site's header; place him from the button (or in the corner) instead.
  for (const [name, kind] of [["cookie", "ask"], ["acceptOnly", "warn"]]) {
    const original = P[name];
    if (typeof original !== "function") continue;
    P[name] = function (...args) {
      let open = null;
      guard(() => { open = showing(); });
      if (quiet || (open && (kind === "warn" || open.querySelector('[data-a="decline"]')))) { skip(); return; }
      const before = newest();
      const result = original.apply(this, args);
      guard(() => {
        const host = newest();
        if (!host || host === before) return;                          // turned off in Settings: nothing opened
        const choose = host.shadowRoot && host.shadowRoot.querySelector('[data-a="choose"]');
        if (choose) choose.addEventListener("click", () => { quiet = true; });
        Promise.resolve().then(() => guard(() => { if (host.isConnected && !placed.has(host)) begin(host, null, kind); }));
      });
      return result;
    };
  }

  window.PrivaCPlacement = { place, findPanel };
})();
