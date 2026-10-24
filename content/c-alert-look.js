// Look of C's foreign-adversary pop-up (repo owner, 2026-10-24): bottom-right corner, C climbing up from the
// bottom edge of the screen (matches the push-up pose and the slide-up animation), with the uneasy face.
// Matthew's c-prompt.js opens it at the top-left with the cookie pose; this adjusts it right after it opens,
// without changing his file. (Matthew can move these few lines into c-prompt.js later.)
(function () {
  if (window.PrivaCAlertLook || !window.PrivaCPrompt) return;
  window.PrivaCAlertLook = true;
  const P = window.PrivaCPrompt;
  const original = P.adversary;
  if (typeof original !== "function") return;

  P.adversary = function (...args) {
    const result = original.apply(this, args);
    try { placeBottomRight(); } catch (e) { /* never break C */ }
    return result;
  };

  function placeBottomRight() {
    const hosts = document.querySelectorAll("privac-prompt");
    const host = hosts[hosts.length - 1];
    const root = host && host.shadowRoot;
    const wrap = root && root.querySelector(".wrap");
    if (!wrap) return;
    // Corner: C's feet on the bottom edge, speech card to his left (its arrow already points right, at C).
    wrap.style.left = "auto";
    wrap.style.top = "auto";
    wrap.style.right = "12px";
    wrap.style.bottom = "0px";
    // The pose is 120 x 104 with C's hands drawn as a ledge on its bottom line. Size the box to the drawing
    // (no letterbox gap) so his hands rest exactly on the browser's bottom edge, as if pushing up on it.
    const c = root.querySelector(".c");
    if (c) { c.style.height = "104px"; c.style.overflow = "visible"; }
    const img = root.querySelector(".c img");
    if (img) {
      img.src = chrome.runtime.getURL("c-poses/mascot-push-up-uneasy.svg");
      img.alt = "Uneasy C mascot";
      img.style.objectPosition = "bottom";
      img.style.display = "block";
    }
    // Lower the speech card so its arrow points at C's face, not above his head.
    const card = root.querySelector(".card");
    if (card) card.style.marginBottom = "14px";
  }
})();
