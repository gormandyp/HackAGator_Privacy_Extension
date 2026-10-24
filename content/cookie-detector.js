
(function () {
  if (window.PrivaCCookieDetector) return;
  window.PrivaCCookieDetector = true;
  console.log("PrivaC cookie detector is running!");


    const ACCEPT_LABELS = [
        /^accept all(?: cookies)?$/i,
        /^accept cookies$/i,
        /^allow all(?: cookies)?$/i,
        /^agree(?: and continue)?$/i,
        /^i agree$/i,
        /^got it$/i,
        /^ok(?:ay)?$/i
    ];

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
        /^reject all non-essential cookies$/i,
        /^deny cookies$/i,                     // Superdrug
        /^reject additional cookies$/i,        // gov.uk
        /^allow recommended cookies only$/i
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

    function findAcceptButtons() {
        return [...document.querySelectorAll(
            'button, [role="button"], input[type="button"]'
        )].filter(element => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;

            const label = (
                element.innerText ||
                element.value ||
                element.getAttribute("aria-label") ||
                ""
            ).trim().replace(/\s+/g, " ");

            return ACCEPT_LABELS.some(pattern => pattern.test(label));
        });
    }


    function findAcceptOnlyBanner() {
        for (const button of findAcceptButtons()) {
            const banner = button.closest(
            '[role="dialog"], [aria-modal="true"], ' +
            '[id*="cookie" i], [class*="cookie" i], ' +
            '[id*="consent" i], [class*="consent" i], ' +
            '#onetrust-banner-sdk'
            );

            if (!banner) continue;

            const text = banner.innerText || "";

            if (!/cookie|consent|privacy|tracking/i.test(text)) continue;

            const controls = banner.querySelectorAll(
            'button, [role="button"], input[type="button"], a'
            );

            const hasAlternative = [...controls].some(control => {
            const label = (
                control.innerText ||
                control.value ||
                control.getAttribute("aria-label") ||
                ""
            ).trim();

            return /reject|decline|deny|refuse|necessary|essential|preferences|settings|customize|manage|options/i.test(label);
            });

            if (!hasAlternative) return { banner, button };
        }

        return null;
    }


    function findPrivacyOptOutButton() {
        const buttons = document.querySelectorAll(
            'button, [role="button"], input[type="button"]'
        );

        for (const button of buttons) {
            const rect = button.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;

            const label = (
            button.innerText ||
            button.getAttribute("aria-label") ||
            button.getAttribute("title") ||
            ""
            ).trim().replace(/\s+/g, " ");

            if (/^do not sell or share my personal information$/i.test(label)) {
            return button;
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

    if (
    !window.PrivaCPrompt?.isReacting?.() &&
    !window.PrivaCPrompt?.isCelebrating?.()
    ) {
    PrivaCPrompt.hide();
    }

    promptedFor = null;

    }

    if (!window.PrivaCPrompt) return;

    const optOutButton = findPrivacyOptOutButton();

    if (optOutButton && optOutButton !== promptedFor) {
        promptedFor = optOutButton;

        const banner = optOutButton.closest(
            '[id*="privacy" i], [class*="privacy" i], ' +
            '[id*="consent" i], [class*="consent" i], ' +
            '[role="dialog"]'
        );

        optOutButton.click();

        PrivaCPrompt.acceptOnly();

        if (banner) {
            PrivaCPrompt.positionAtBanner(banner);
        }

        return;
    }

    const button = findRejectButton();

    if (!button) {
        const acceptOnly = findAcceptOnlyBanner();

        if (acceptOnly && acceptOnly.button !== promptedFor) {
            promptedFor = acceptOnly.button;
            PrivaCPrompt.acceptOnly();
            PrivaCPrompt.positionAtBanner(acceptOnly.banner);
        }

        return;
    }

    if (button === promptedFor) return;

    promptedFor = button;

    // Find the cookie banner surrounding the rejection button.
    const banner = button.closest(
      '[role="dialog"], [aria-modal="true"], ' +
      '[id*="cookie" i], [class*="cookie" i], ' +
      '[id*="consent" i], [class*="consent" i], ' +
      '#onetrust-banner-sdk'
    );

    if (banner) {

      const rect = banner.getBoundingClientRect();

      console.table({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      });
    } else {
      console.log("PrivaC: Could not identify banner container.");
    }

    // React when the user clicks the website's own reject button.
    button.addEventListener("click", (event) => {
      if (!event.isTrusted) return;

      if (window.PrivaCPrompt) {
        PrivaCPrompt.ignored();
      }
    }, { once: true });


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
    if (banner) {
        PrivaCPrompt.positionAtBanner(banner);
    }
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

  // Lets the tests run a re-check (tests/cookie-detector.test.js).
  window.PrivaCCookieCheck = checkForCookieBanner;

  checkForCookieBanner();
  setTimeout(checkForCookieBanner, 1500);
  setTimeout(checkForCookieBanner, 4000);
})();
