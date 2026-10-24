
(function () {
  if (window.PrivaCCookieDetector) return;
  window.PrivaCCookieDetector = true;
  console.log("PrivaC cookie detector is running!");


    const REJECT_LABELS = [
        /^reject all(?: cookies)?$/i,
        /^reject optional(?: cookies)?$/i,
        /^reject non-essential(?: cookies)?$/i,
        /^decline all(?: cookies)?$/i,
        /^decline optional(?: cookies)?$/i,
        /^decline non-essential(?: cookies)?$/i,
        /^deny all(?: cookies)?$/i,
        /^refuse all(?: cookies)?$/i,
        /^disallow all(?: cookies)?$/i,
        /^only necessary(?: cookies)?$/i,
        /^only essential(?: cookies)?$/i,
        /^essential cookies only$/i,
        /^necessary cookies only$/i,
        /^accept only essential cookies$/i,
        /^accept only necessary cookies$/i,
        /^use essential cookies only$/i,
        /^use necessary cookies only$/i,
        /^continue without accepting$/i,
        /^continue without consent$/i,
        /^save necessary cookies only$/i,
        /^reject all optional cookies$/i,
        /^reject all non-essential cookies$/i
    ];

  let promptedFor = null;
  let timer = null;

  function findRejectButton() {
    const elements = document.querySelectorAll(
      'button, [role="button"], input[type="button"]'
    );

    for (const element of elements) {
      // Ignore invisible buttons.
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;

      const label = (
        element.innerText ||
        element.value ||
        element.getAttribute("aria-label") ||
        ""
      ).trim().replace(/\s+/g, " ");

      if (REJECT_LABELS.some(pattern => pattern.test(label))) {
        return element;
      }
    }

    return null;
  }

  function checkForCookieBanner() {

    // If the original cookie button disappeared,
    // remove C's popup automatically.
    if (promptedFor && (
      !promptedFor.isConnected ||
      promptedFor.getBoundingClientRect().width === 0 ||
      promptedFor.getBoundingClientRect().height === 0
    )) {
      PrivaCPrompt.hide();
      promptedFor = null;
    }

    if (!window.PrivaCPrompt) return;

    const button = findRejectButton();
    if (!button || button === promptedFor) return;

    promptedFor = button;

    PrivaCPrompt.cookie({
      onDecline: async () => {
        
        if (!button.isConnected) return false;

        // Click the website's reject button.
        button.click();

        // Wait up to 3 seconds for the button to disappear.
        let bannerDismissed = false;

        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));

          if (!button.isConnected) {
            bannerDismissed = true;
            break;
          }

          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);

          if (
            rect.width === 0 ||
            rect.height === 0 ||
            style.display === "none" ||
            style.visibility === "hidden"
          ) {
            bannerDismissed = true;
            break;
          }
        }

        if (!bannerDismissed) {
            console.warn("PrivaC: Cookie banner did not disappear.");
            return "failed";
        }

        

        let verification = "unverified";

        // Check whether OneTrust saved the cookie preferences.
        const consentCookie = document.cookie
          .split("; ")
          .find(cookie => cookie.startsWith("OptanonConsent="));

        if (consentCookie) {
          try {
            const cookieValue = decodeURIComponent(
              consentCookie.substring("OptanonConsent=".length)
            );

            const groupsMatch = cookieValue.match(/(?:^|&)groups=([^&]+)/);

            if (groupsMatch) {
              const groups = decodeURIComponent(groupsMatch[1])
                .split(",")
                .map(group => group.split(":"));

              const optionalGroups = groups.filter(
                ([id]) => id !== "C0001"
              );

              if (
                optionalGroups.length > 0 &&
                optionalGroups.every(([, enabled]) => enabled === "0")
              ) {
                verification = "confirmed";
                console.log("PrivaC: OneTrust rejection verified!");
              }
            }
          } catch (e) {
            console.warn("PrivaC: Could not verify OneTrust consent", e);
          }
        }

        // Only record a confirmed rejection in the privacy score.
        if (verification === "confirmed") {
          try {
            const domain = location.hostname.replace(/^www\./, "");
            const result = await chrome.storage.local.get("privacData");
            const data = result.privacData;

            if (data && Array.isArray(data.sites)) {
              const site = data.sites.find(s => s.domain === domain);

              if (site) {
                site.cookieChoice = "declined";
                await chrome.storage.local.set({ privacData: data });
              }
            }
          } catch (e) {
            console.warn("PrivaC: Could not save cookie choice", e);
          }
        }

        return verification;
      },

      onChoose: () => {
        // Leave the site's banner available for manual selection.
        button.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    });
  }

  // Cookie banners often load after the webpage itself.
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(checkForCookieBanner, 350);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  checkForCookieBanner();
  setTimeout(checkForCookieBanner, 1500);
  setTimeout(checkForCookieBanner, 4000);
})();
