
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
        /^ok(?:ay)?$/i,
        /^continue and accept$/i,              // Argos, Sainsbury's
        // Also counted as "you accepted" by content/c-events.js:
        /^accept$/i,
        /^allow(?: cookies)?$/i,
        /^i accept$/i,
        /^accept and (?:close|continue)$/i,
        /^agree and close$/i,
        /^yes,? i(?:'|’)?m happy$/i
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

  // Buttons already handled on this page: the "Do not sell or share" link is clicked once, and the
  // Reject button gets one click listener (Zara alternated between them and re-clicked the link).
  const handled = new WeakSet();

  // Some consent tools (Sourcepoint, TrustArc) draw their pop-up in a frame from another website. This file
  // also runs inside frames: there it only looks for a Reject button and tells the top page, where C asks.
  // background/frames.js passes the messages between the two, inside the same tab.
  const inFrame = window.top !== window;
  let frameShown = null;   // top page: the frame whose pop-up C is offering to decline

  // Elements matching `selector` on the page and inside open shadow roots (Usercentrics puts its banner
  // inside #usercentrics-root, where document.querySelectorAll can't see). C's own pop-up is skipped.
  function queryAll(selector) {
    const found = [];
    const roots = [document];
    while (roots.length) {
      const root = roots.shift();
      found.push(...root.querySelectorAll(selector));
      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot && element.tagName !== "PRIVAC-PROMPT") roots.push(element.shadowRoot);
      }
    }
    return found;
  }

  const BANNER =
    '[role="dialog"], [aria-modal="true"], ' +
    '[id*="cookie" i], [class*="cookie" i], ' +
    '[id*="consent" i], [class*="consent" i], ' +
    '#onetrust-banner-sdk';

  // The cookie pop-up around an element, or null when it isn't in one.
  function cookieBannerAround(element) {
    const banner = element.closest(BANNER);
    return banner && /cookie|consent|privacy|tracking/i.test(banner.innerText || "") ? banner : null;
  }

  // A one-click way to say no whose wording isn't in REJECT_LABELS yet ("Deny", "Disagree and close"):
  // a short label that starts with a no-word, or asks for necessary/essential cookies only. Settings-style
  // buttons still make you do the work yourself, so they don't count.
  function soundsLikeReject(label) {
    if (REJECT_LABELS.some(pattern => pattern.test(label))) return true;
    if (label.split(" ").length > 5) return false;
    if (/settings|manage|choose|choices|customi[sz]e|preferences|options|more|learn|details/i.test(label)) return false;
    return /^(reject|decline|deny|refuse|disagree)\b/i.test(label) ||
      (/\b(necessary|essential)\b/i.test(label) && /\bonly\b/i.test(label));
  }

  function findRejectButton() {
    const elements = queryAll(
      'button, [role="button"], input[type="button"]'
    );
    let other = null;

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

      // Other wording counts only inside a cookie pop-up (a "Decline" on a calendar invite isn't one).
      if (!other && soundsLikeReject(label) && cookieBannerAround(element)) other = element;
    }

    return other;
  }

    function findAcceptButtons() {
        return queryAll(
            'button, [role="button"], input[type="button"]'
        ).filter(element => {
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
            const banner = cookieBannerAround(button);

            if (!banner) continue;

            const controls = banner.querySelectorAll(
            'button, [role="button"], input[type="button"], a'
            );

            const hasAlternative = [...controls].some(control => {
            const label = (
                control.innerText ||
                control.value ||
                control.getAttribute("aria-label") ||
                ""
            ).trim().replace(/\s+/g, " ");

            // Only a one-click way to say no counts. A settings or "Choose cookies" button still makes you
            // do the work yourself (Argos, Trainline), so C keeps the "Beware!" warning. Same rule as the
            // Reject search, so a pop-up always gets either the offer to decline or the warning.
            return soundsLikeReject(label);
            });

            if (!hasAlternative) return { banner, button };
        }

        return null;
    }


    function findPrivacyOptOutButton() {
        const buttons = queryAll(
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



    // Reads the consent tool's own record of your choice, only to answer "are the optional cookies off?".
    // Returns true (all off), false (something optional is on) or null (no record PrivaC knows).
    // Nothing from the cookies is kept or sent anywhere.
    function optionalCookiesOff(cookieString) {
        const jar = new Map();
        for (const part of String(cookieString || "").split(/;\s*/)) {
            const i = part.indexOf("=");
            if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
        }
        const decode = (value) => {
            try { return decodeURIComponent(value); } catch (e) { return value; }
        };
        const answers = [];

        // OneTrust: groups=C0001:1,C0002:0,... (C0001 is the strictly necessary group).
        if (jar.has("OptanonConsent")) {
            const match = decode(jar.get("OptanonConsent")).match(/(?:^|&)groups=([^&]+)/);
            if (match) {
                const optional = decode(match[1]).split(",")
                    .map(group => group.split(":"))
                    .filter(([id]) => id !== "C0001");
                if (optional.length) answers.push(optional.every(([, on]) => on === "0"));
            }
        }

        // Ensighten (John Lewis): one cookie per category, e.g. JOHNLEWIS_ENSIGHTEN_PRIVACY_Advertising=0.
        // Skip its "banner viewed/loaded" flags and the always-on essential category.
        const ensighten = [...jar].filter(([name, value]) =>
            /_ENSIGHTEN_PRIVACY_/.test(name) &&
            !/_(VIEWED|LOADED)$/i.test(name) &&
            !/_ENSIGHTEN_PRIVACY_(essential|necessary|required|strictly)/i.test(name) &&
            /^[01]$/.test(value)
        );
        if (ensighten.length) answers.push(ensighten.every(([, value]) => value === "0"));

        // CookieYes: cookieyes-consent=consentid:...,necessary:yes,functional:no,analytics:no,...
        if (jar.has("cookieyes-consent")) {
            const fields = new Map(decode(jar.get("cookieyes-consent")).split(",")
                .map(pair => pair.split(":")));
            const optional = ["functional", "analytics", "performance", "advertisement", "other"]
                .filter(name => fields.has(name));
            if (optional.length) answers.push(optional.every(name => fields.get(name) === "no"));
        }

        // Cookiebot: CookieConsent={...,preferences:false,statistics:false,marketing:false,...}
        // ("-1" means the visitor's region needs no consent: nothing to check).
        if (jar.has("CookieConsent")) {
            const value = decode(jar.get("CookieConsent"));
            const optional = ["preferences", "statistics", "marketing"]
                .map(name => (value.match(new RegExp("[{,]" + name + ":(true|false)")) || [])[1])
                .filter(Boolean);
            if (optional.length) answers.push(optional.every(on => on === "false"));
        }

        // Didomi: didomi_token is base64 JSON with purposes.enabled / purposes.disabled.
        if (jar.has("didomi_token")) {
            try {
                const token = JSON.parse(atob(decode(jar.get("didomi_token")).replace(/-/g, "+").replace(/_/g, "/")));
                const purposes = token && token.purposes;
                const enabled = (purposes && purposes.enabled) || [];
                const disabled = (purposes && purposes.disabled) || [];
                if (enabled.length || disabled.length) answers.push(enabled.length === 0);
            } catch (e) {
                // Not a token we can read: leave it unverified.
            }
        }

        if (!answers.length) return null;
        return answers.every(Boolean);
    }

  // After clicking Reject: waits up to 3 seconds for the button to disappear (or slide out of view).
  async function waitUntilGone(button) {
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
        style.visibility === "hidden" ||
        // Slid out of the window but still in the page (Tesco's banner slides away).
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth ||
        // Hidden or faded out by a box around it.
        (button.checkVisibility &&
          !button.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
      ) {
        bannerDismissed = true;
        break;
      }
    }
    return bannerDismissed;
  }

  // Says how the decline went: "confirmed" (the consent record says the optional cookies are off),
  // "unverified" (the pop-up went away, no record to check) or "failed".
  async function finishDecline(bannerDismissed) {
    // The banner may stay on screen while the site still saved the choice.
    if (!bannerDismissed && optionalCookiesOff(document.cookie) !== true) {
        console.warn("PrivaC: Cookie banner did not disappear.");
        return "failed";
    }

    // Check whether the site's consent tool saved the optional categories as off.
    const verification =
      optionalCookiesOff(document.cookie) === true ? "confirmed" : "unverified";

    if (verification === "confirmed") {
      console.log("PrivaC: cookie rejection verified!");
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

    if (optOutButton && !handled.has(optOutButton)) {
        handled.add(optOutButton);
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
    const banner = button.closest(BANNER);

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
    if (!handled.has(button)) {
      handled.add(button);
      button.addEventListener("click", (event) => {
        if (!event.isTrusted) return;

        if (window.PrivaCPrompt) {
          PrivaCPrompt.ignored();
        }
      }, { once: true });
    }


    PrivaCPrompt.cookie({
      onDecline: async () => {
        
        if (!button.isConnected) return false;

        // Click the website's reject button.
        button.click();

        return finishDecline(await waitUntilGone(button));
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

  // Sends a message to the background; a missing answer is fine.
  function tell(msg) {
    try {
      const sent = chrome.runtime.sendMessage(msg);
      if (sent && sent.catch) sent.catch(() => {});
    } catch (e) { /* no background */ }
  }

  // Inside a frame: report its Reject button once, and say when it goes away.
  function checkFrame() {
    if (promptedFor) {
      const rect = promptedFor.getBoundingClientRect();
      if (!promptedFor.isConnected || !rect.width || !rect.height) {
        promptedFor = null;
        tell({ type: "privac-frame-gone" });
      }
      return;
    }

    const button = findRejectButton();
    if (!button || handled.has(button)) return;
    handled.add(button);
    promptedFor = button;
    tell({ type: "privac-frame-banner" });
  }

  // Top page: a frame has a cookie pop-up. C offers to decline it, unless C is already asking about one here.
  function offerForFrame(frameId) {
    if (!window.PrivaCPrompt || frameShown === frameId) return;
    if (promptedFor && promptedFor.isConnected) return;
    frameShown = frameId;

    PrivaCPrompt.cookie({
      onDecline: async () => {
        let answer = null;
        try {
          answer = await chrome.runtime.sendMessage({ type: "privac-frame-decline", frameId });
        } catch (e) {
          answer = null;   // the frame closed
        }
        // The consent record is saved on the top page's site, so it's checked here.
        return finishDecline(!!(answer && answer.dismissed));
      },
      onChoose: () => tell({ type: "privac-frame-choose", frameId })
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      if (!msg) return;

      if (inFrame) {
        const button = promptedFor;
        if (!button) return;
        if (msg.type === "privac-frame-decline") {
          button.click();
          waitUntilGone(button).then(dismissed => reply({ dismissed }));
          return true;   // answers after the wait
        }
        if (msg.type === "privac-frame-choose") {
          button.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (typeof msg.frameId !== "number") return;
      if (msg.type === "privac-frame-banner") offerForFrame(msg.frameId);
      if (msg.type === "privac-frame-gone" && msg.frameId === frameShown) {
        frameShown = null;
        if (!PrivaCPrompt.isReacting?.() && !PrivaCPrompt.isCelebrating?.()) PrivaCPrompt.hide();
      }
    });
  }

  const check = inFrame ? checkFrame : checkForCookieBanner;

  // Cookie banners often load after the webpage itself, or are already in the page and shown later by a
  // style or class change. Check at most every 350 ms while the page changes: a timer that restarted on
  // every change never ran on busy pages (a price ticker, a carousel). C moving himself doesn't count.
  const observer = new MutationObserver((records) => {
    if (timer) return;
    if (records.every(r => r.target.closest && r.target.closest("privac-prompt"))) return;
    timer = setTimeout(() => {
      timer = null;
      check();
    }, 350);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "hidden", "open", "aria-hidden"]
  });

  // Lets the tests run a re-check (tests/cookie-detector.test.js).
  window.PrivaCCookieCheck = check;

  check();
  setTimeout(check, 1500);
  setTimeout(check, 4000);
})();
