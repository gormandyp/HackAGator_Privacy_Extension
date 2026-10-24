// C holds still while he reacts (repo owner, 2026-10-24). After "Let me choose" (or a decline that didn't
// go through), Matthew's c-prompt.js switches C to an uneasy pose. Those pose files loop the push-up
// ("poking over the edge") motion, so C looked like he was popping up all over again instead of saying his
// line and dropping away. This swaps in still copies of the same drawings (c-poses/*-still.svg, made by
// scripts/freeze-pose.js) the moment they appear, before the page paints. Wraps PrivaCPrompt.cookie only,
// without changing c-prompt.js; the foreign-adversary pop-up keeps its motion.
(function () {
  if (window.PrivaCReactionLook || !window.PrivaCPrompt) return;
  window.PrivaCReactionLook = true;
  const P = window.PrivaCPrompt;
  const original = P.cookie;
  if (typeof original !== "function") return;

  const STILL = {
    "mascot-push-up-uneasy.svg": "mascot-push-up-uneasy-still.svg",
    "mascot-cliff-hang-uneasy.svg": "mascot-cliff-hang-uneasy-still.svg"
  };
  const newest = () => { const all = document.querySelectorAll("privac-prompt"); return all[all.length - 1] || null; };

  function holdStill(root) {
    const c = root.querySelector(".c");
    const img = root.querySelector(".c img");
    if (!c || !img) return;
    const file = String(img.getAttribute("src") || img.src || "").split("/").pop();
    if (!STILL[file]) return;
    img.src = chrome.runtime.getURL("c-poses/" + STILL[file]);
    c.classList.remove("rising", "hanging");      // and no slide-in replay
  }

  P.cookie = function (...args) {
    const before = newest();
    const result = original.apply(this, args);
    try {
      const host = newest();
      // Only a pop-up that just opened (it may be turned off in Settings, and then nothing opens).
      if (host && host !== before && host.shadowRoot) {
        new MutationObserver(() => holdStill(host.shadowRoot)).observe(host.shadowRoot, { childList: true, subtree: true });
      }
    } catch (e) { /* never break C */ }
    return result;
  };
})();
