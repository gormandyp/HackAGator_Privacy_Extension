// Finds the page's "Privacy" links and hands them to the background (background/policy-reader.js),
// which reads the site's own privacy policy with Gemma on this computer. Sends nothing anywhere else.
(function () {
  if (window.PrivaCPolicyLinks || window.top !== window) return;
  window.PrivaCPolicyLinks = true;

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
      chrome.runtime.sendMessage({ type: "privac-policy-links", domain: location.hostname.replace(/^www\./, ""), links });
    } catch (e) { /* extension was reloaded */ }
    return true;
  }

  // Footers often load late; try once more after a few seconds.
  if (!send()) setTimeout(send, 4000);
})();
