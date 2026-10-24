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
  const choice = (c) => send({ type: "cookieChoice", domain: domain(), choice: c });

  function label(el) {
    return ((el.innerText || el.value || (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "") + "").trim().replace(/\s+/g, " ");
  }

  // cookie-detector.js clicks this link itself, then shows acceptOnly(); that page did offer a choice.
  function hasOptOut() {
    return [...document.querySelectorAll('button, [role="button"], input[type="button"]')]
      .some(b => /^do not sell or share my personal information$/i.test(label(b)));
  }

  // Run `before` (counting), then the original pop-up exactly as it was.
  function wrap(name, before) {
    const orig = P[name];
    if (typeof orig !== "function") return;
    P[name] = function (...args) {
      try { before(...args); } catch (e) { /* counting must never break C */ }
      return orig.apply(this, args);
    };
  }

  wrap("cookie", (opts) => {
    event("popup-cookie");
    if (!opts) return;
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
  });
  wrap("acceptOnly", () => { event("popup-accept-only"); if (!hasOptOut()) choice("no-reject"); });
  wrap("adversary", () => event("popup-adversary"));
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
