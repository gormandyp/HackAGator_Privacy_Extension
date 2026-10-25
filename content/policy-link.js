// Finds the page's "Privacy" links and hands them to the background (background/policy-reader.js),
// which reads the site's own privacy policy with Gemma on this computer. Sends nothing anywhere else.
// Runs as soon as the page is ready (manifest: document_end), so the policy read starts before the page finishes loading.
(function () {
  if (window.PrivaCPolicyLinks || window.top !== window) return;
  window.PrivaCPolicyLinks = true;
  const WATCH_MS = 15000;   // footers that a page adds later still count, for up to 15 s

  function collect() {
    return [...document.querySelectorAll("a[href]")]
      .filter((a) => /privacy/i.test((a.textContent || "") + " " + (a.getAttribute("href") || "")))
      .slice(0, 40)
      .map((a) => ({ href: a.href, text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) }));
  }

  function send() {
    const links = collect();
    if (!links.length) return false;
    try {
      chrome.runtime.sendMessage({ type: "privac-policy-links", domain: location.hostname.replace(/^www\./, ""), links }).catch(() => {});
    } catch (e) { /* extension was reloaded */ }
    return true;
  }

  if (send()) return;
  // No Privacy link yet (the footer loads late): look again when the page changes, at most every half second.
  let pending = null;
  const watch = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      if (send()) stop();
    }, 500);
  });
  function stop() { watch.disconnect(); clearTimeout(pending); clearTimeout(giveUp); }
  watch.observe(document.documentElement, { childList: true, subtree: true });
  const giveUp = setTimeout(stop, WATCH_MS);
})();
