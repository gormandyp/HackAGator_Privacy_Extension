// "Clear this site's data" in the popup (IDEA.md: a clear-cache button with an explanation). Loaded by /background.js.
// Forgets one site's own cookies, storage and cache in Chrome, so the site can't link your next visit to earlier ones
// (other companies' tracking cookies stay; the popup says so). Never touches history, passwords or downloads.
// Only PrivaC's own pages can ask.
(function () {
  const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== "privac-clear-site") return;
    if (!sender || !String(sender.url || "").startsWith(`chrome-extension://${chrome.runtime.id}/`)) return;
    const domain = String(msg.domain || "").toLowerCase().replace(/^www\./, "");
    if (!DOMAIN.test(domain)) { reply({ ok: false }); return; }
    const origins = [];
    for (const scheme of ["https", "http"]) for (const host of [domain, "www." + domain]) origins.push(`${scheme}://${host}`);
    chrome.browsingData.remove({ origins }, {
      cookies: true, localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true, cache: true
    }).then(() => reply({ ok: true }), () => reply({ ok: false }));
    return true;   // answers once Chrome is done
  });
})();
