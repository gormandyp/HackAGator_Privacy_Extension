// PrivaC: counts C's pop-ups and button clicks for the impact dashboard, and reports cookie choices to the
// background (which owns privacData). Loaded right after content/c-prompt.js; it wraps PrivaCPrompt so
// Matthew's c-prompt.js and cookie-detector.js stay unchanged. Sends event names and the site name only.
(function () {
  if (window.PrivaCEvents || !window.PrivaCPrompt) return;
  window.PrivaCEvents = true;
  const P = window.PrivaCPrompt;
  const domain = () => location.hostname.replace(/^www\./, "");

  function send(msg) {
    try { chrome.runtime.sendMessage(msg); } catch (e) { /* extension reloaded; ignore */ }
  }
  const event = (name) => send({ type: "privac-event", event: name, domain: domain() });

  // Settings: which of C's pop-ups may show (dashboard > Settings > C on websites). Default: all on.
  const allowed = { cookie: true, acceptOnly: true, adversary: true };
  let auto = false;   // Settings > "Protect me automatically": decline without asking
  let ready = false, whenReady = [];
  function useSettings(s) {
    const p = (s && s.popups) || {};
    for (const k of Object.keys(allowed)) allowed[k] = p[k] !== false;
    auto = !!(s && s.autoDecline === true);
    ready = true;
    const later = whenReady; whenReady = [];
    later.forEach((f) => { try { f(); } catch (e) { /* never break C */ } });
  }
  try {
    chrome.storage.local.get("privacSettings").then((r) => useSettings(r && r.privacSettings)).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.privacSettings) useSettings(changes.privacSettings.newValue);
    });
  } catch (e) { /* storage unavailable: keep defaults */ }
  const choice = (c) => send({ type: "cookieChoice", domain: domain(), choice: c });

  function label(el) {
    return ((el.innerText || el.value || (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "") + "").trim().replace(/\s+/g, " ");
  }

  // cookie-detector.js clicks this link itself, then shows acceptOnly(); that page did offer a choice.
  function hasOptOut() {
    return [...document.querySelectorAll('button, [role="button"], input[type="button"]')]
      .some(b => /^do not sell or share my personal information$/i.test(label(b)));
  }

  // Run `before` (counting), then the original pop-up exactly as it was, unless that pop-up is turned off
  // in Settings (`setting`); then nothing shows and nothing is counted. Cookie choices are still recorded.
  // `setting` is a key of `allowed`, or a function that says whether the pop-up may show.
  function wrap(name, before, setting, always) {
    const orig = P[name];
    if (typeof orig !== "function") return;
    const on = () => (typeof setting === "function" ? setting() : !setting || allowed[setting]);
    P[name] = function (...args) {
      if (!on()) { try { if (always) always(...args); } catch (e) { /* ignore */ } return; }
      try { before(...args); } catch (e) { /* counting must never break C */ }
      return orig.apply(this, args);
    };
  }

  wrap("cookie", (opts) => {
    event("popup-cookie");
    if (!opts) return;
    if (auto) { opts.auto = true; event("auto-decline"); }
    if (typeof opts.onDecline === "function") {
      const decline = opts.onDecline;
      opts.onDecline = async (...a) => {
        event("decline-click");
        const result = await decline(...a);
        if (result === "confirmed" || result === true) { event("decline-confirmed"); choice("declined"); }
        return result;
      };
    }
    if (typeof opts.onChoose === "function") {
      const choose = opts.onChoose;
      opts.onChoose = (...a) => { event("choose-click"); return choose(...a); };
    }
  }, () => allowed.cookie || auto);   // automatic protection works even with the question turned off

  // The detector's first check can run before the saved settings are read. Then C asks as usual, and if
  // "Protect me automatically" turns out to be on, he presses "Protect me" himself.
  const askedCookie = P.cookie;
  P.cookie = function (...args) {
    const result = askedCookie.apply(this, args);
    if (!ready) {
      const all = document.querySelectorAll("privac-prompt");
      const host = all[all.length - 1];
      whenReady.push(() => {
        const button = auto && host && host.shadowRoot && host.shadowRoot.querySelector('[data-a="decline"]');
        if (button) button.click();
      });
    }
    return result;
  };
  const noReject = () => { if (!hasOptOut()) choice("no-reject"); };
  wrap("acceptOnly", () => { event("popup-accept-only"); noReject(); }, "acceptOnly", noReject);
  wrap("adversary", () => event("popup-adversary"), "adversary");
  wrap("ignored", () => { event("rejected-on-site"); choice("declined"); });   // you clicked the site's own Reject

  // You clicked a cookie banner's "Accept all" yourself.
  const ACCEPT = [/^accept(?: all)?(?: cookies)?$/i, /^allow(?: all)?(?: cookies)?$/i, /^agree(?: and (?:close|continue))?$/i,
    /^i agree$/i, /^i accept$/i, /^accept and (?:close|continue)$/i, /^yes,? i(?:'|’)?m happy$/i, /^ok(?:ay)?$/i, /^got it$/i];
  function inCookieBanner(el) {
    for (let n = el, i = 0; n && i < 8; n = n.parentElement, i++) {
      if (/cookie|consent|gdpr|onetrust|didomi|cmp/i.test((n.id || "") + " " + (typeof n.className === "string" ? n.className : ""))) return true;
      if (i >= 2 && n.innerText && n.innerText.length < 3000 && /cookie/i.test(n.innerText)) return true;
    }
    return false;
  }
  let acceptedOnce = false;
  document.addEventListener("click", (e) => {
    if (acceptedOnce || !e.isTrusted || !e.target || !e.target.closest) return;
    const el = e.target.closest('button, [role="button"], input[type="button"], a');
    if (el && ACCEPT.some(p => p.test(label(el))) && inCookieBanner(el)) { acceptedOnce = true; choice("accepted"); event("accepted-on-site"); }
  }, true);
})();
