/*
  Example browsing for demos (Settings > "Show example data", Preston 2026-10-25): PrivaC normally needs days of
  browsing before the dashboard fills up. While the switch is on, PrivaCData.load() adds these sites next to the
  real ones; privacData itself is never changed, and the dashboard says "Example data".

  Honesty: the sites are made up (".example" names), so nothing here is a claim about a real website. The
  companies on them are real Tracker Radar entries and the cookies are real Open Cookie Database entries, copied
  exactly (tests/example-data.test.js checks both), so what C says about a company or a cookie stays true.
*/
(function () {
  // Tracker Radar rows used below (shared/atlas.json): domain -> [company, category, country, fingerprinting].
  const ATLAS = {
    "doubleclick.net": ["Google", "Advertising", "US", 3],
    "google-analytics.com": ["Google", "Advertising", "US", 1],
    "googletagmanager.com": ["Google", "Advertising", "US", 2],
    "facebook.net": ["Facebook", "Advertising", "US", 2],
    "amazon-adsystem.com": ["Amazon.com", "Advertising", "US", 3],
    "criteo.com": ["Criteo", "Advertising", "FR", 1],
    "scorecardresearch.com": ["comScore", "Analytics", "US", 1],
    "hotjar.com": ["Hotjar", "Session recording", "MT", 2],
    "rlcdn.com": ["LiveRamp", "Advertising", "US", 1],
    "pinterest.com": ["Pinterest", "Social", "US", 1],
    "yandex.ru": ["Yandex", "Session recording", "RU", 3],
    "baidu.com": ["Baidu", "Tracking", "CN", 2],
    "tiktok.com": ["ByteDance", "Tracking", "CN", 1],
    "qq.com": ["Tencent", "Tracking", "CN", 3],
    "taboola.com": ["Taboola", "Advertising", "US", 2],
    "outbrain.com": ["Outbrain", "Advertising", "US", 2],
    "adnxs.com": ["Microsoft", "Advertising", "US", 1],
    "rubiconproject.com": ["Magnite", "Advertising", "US", 1],
    "quantserve.com": ["Quantcast", "Advertising", "US", 1],
    "demdex.net": ["Adobe", "Advertising", "US", 1],
    "adsrvr.org": ["The Trade Desk", "Advertising", "US", 1],
    "clarity.ms": ["Microsoft", "Tracking", "US", 3],
    "bing.com": ["Microsoft", "Advertising", "US", 2],
    "fullstory.com": ["FullStory", "Session recording", "US", 2],
    "mouseflow.com": ["Mouseflow", "Session recording", "DK", 2],
    "pubmatic.com": ["PubMatic", "Advertising", "US", 2],
    "casalemedia.com": ["Index Exchange", "Advertising", "CA", 1],
    "agkn.com": ["TransUnion", "Advertising", "US", 0],
    "tapad.com": ["Tapad", "Advertising", "US", 0],
    "sc-static.net": ["Snap", "Advertising", "US", 2],
    "linkedin.com": ["Microsoft", "Advertising", "US", 1],
    "doubleverify.com": ["DoubleVerify", "Advertising", "US", 3],
    "segment.com": ["Segment.io", "Advertising", "US", 2],
    "amplitude.com": ["Amplitude", "Analytics", "US", 2],
    "newrelic.com": ["New Relic", "Analytics", "US", 2],
    "adobedtm.com": ["Adobe", "Advertising", "US", 3],
    "omtrdc.net": ["Adobe", "Advertising", "US", 1],
    "yahoo.com": ["Verizon Media", "Advertising", "US", 1],
    "teads.tv": ["Teads", "Advertising", "FR", 1],
    "hs-analytics.net": ["HubSpot", "Advertising", "US", 3],
    "ads-twitter.com": ["Twitter", "Advertising", "US", 3],
    "redditstatic.com": ["Reddit", "Advertising", null, 2]
  };

  // Open Cookie Database rows used below (shared/cookie-db.json): name -> [category, company, purpose, days kept].
  const COOKIES = {
    _ga: ["Analytics", "Google", "ID used to identify users", 730],
    _gid: ["Analytics", "Google", "ID used to identify users for 24 hours after last activity", 1],
    _fbp: ["Marketing", "Facebook", "Used by Facebook to deliver a series of advertisement products such as real time bidding from third party advertisers", 120],
    IDE: ["Marketing", "Google", "This cookie is used for targeting, analyzing and optimisation of ad campaigns in DoubleClick/Google Marketing Suite", 730],
    _gcl_au: ["Marketing", "Google", "Used by Google AdSense for experimenting with advertisement efficiency across websites using their services.", 90],
    OptanonConsent: ["Functional", "OneTrust", "This cookie is set by the cookie compliance solution from OneTrust.", 365],
    _hjid: ["Analytics", "Hotjar", "Hotjar cookie.", 365],
    _uetvid: ["Marketing", "Microsoft", "This is a cookie utilised by Microsoft Bing Ads and is a tracking cookie.", 16],
    MUID: ["Marketing", "Microsoft", "Identifies unique web browsers visiting Microsoft sites.", 365],
    _clck: ["Analytics", "Microsoft", "This cookie is installed by Microsoft Clarity to store information of how visitors use a website and help in creating an analytics report of", 365],
    _pin_unauth: ["Marketing", "Pinterest", "Registers a unique ID that identifies and recognizes the user.", 1],
    _ttp: ["Marketing", "TikTok", "Tracking cookie used by TikTok to identify a visitor", 389],
    _ym_uid: ["Analytics", "Yandex", "Used for identifying site users", 365],
    HMACCOUNT: ["Analytics", "Baidu", "Used to send data to Baidu about the visitors device and behaviour.", 365],
    bcookie: ["Marketing", "LinkedIn", "Used by LinkedIn to track the use of embedded services.", 365],
    s_fid: ["Analytics", "Adobe", "Alternative cookie with unique user ID / timestamp when the s_vi cookie can not be set for technical reasons", 1825],
    _scid: ["Marketing", "Snapchat", "Used to help identify a visitor.", 365],
    __qca: ["Marketing", "Quantcast", "This cookie is set by Quantcast, who present targeted advertising.", 365],
    _rdt_uuid: ["Marketing", "Reddit", "This cookie is set by Reddit and is used for remarketing on reddit.com.", 90],
    PHPSESSID: ["Functional", "PHP.net", "Cookie generated by applications based on the PHP language.", 0]
  };

  // [domain, hours since the last visit, cookie choice, policy, tracker domains, cookies ("name" on the site itself,
  // "name@domain" set by an outside company)]. Policy: [sells, shares] as read from the site's privacy policy (null = not read).
  const SITES = [
    ["dailynews.example", 1, "declined", [false, true], ["doubleclick.net", "google-analytics.com", "googletagmanager.com", "facebook.net", "amazon-adsystem.com", "criteo.com", "scorecardresearch.com", "rlcdn.com", "taboola.com", "outbrain.com", "rubiconproject.com", "adsrvr.org"], ["_ga", "_gid", "OptanonConsent", "IDE@doubleclick.net"]],
    ["weathernow.example", 3, "accepted", [true, true], ["doubleclick.net", "facebook.net", "amazon-adsystem.com", "scorecardresearch.com", "rlcdn.com", "hotjar.com", "pubmatic.com", "casalemedia.com", "yahoo.com", "tiktok.com"], ["_ga", "_fbp", "_gcl_au", "_hjid", "IDE@doubleclick.net", "_ttp@tiktok.com"]],
    ["shopmart.example", 5, "declined", [false, true], ["doubleclick.net", "googletagmanager.com", "facebook.net", "bing.com", "clarity.ms", "criteo.com", "pinterest.com", "sc-static.net", "rlcdn.com"], ["_ga", "_gcl_au", "_clck", "OptanonConsent", "MUID@bing.com"]],
    ["flightdeals.example", 9, "accepted", [true, true], ["doubleclick.net", "facebook.net", "yandex.ru", "baidu.com", "criteo.com", "rlcdn.com", "hotjar.com", "amazon-adsystem.com"], ["_ga", "_fbp", "_ym_uid", "HMACCOUNT", "_hjid"]],
    ["campuslibrary.example", 20, "none", [false, false], ["google-analytics.com"], ["_ga", "_gid"]],
    ["recipebox.example", 27, "none", [null, null], ["doubleclick.net", "google-analytics.com", "facebook.net", "pinterest.com", "criteo.com", "amazon-adsystem.com", "hotjar.com"], ["_ga", "_fbp", "_pin_unauth"]],
    ["videostream.example", 32, "accepted", [true, true], ["doubleclick.net", "googletagmanager.com", "facebook.net", "tiktok.com", "adnxs.com", "adsrvr.org", "demdex.net", "doubleverify.com"], ["_ga", "_fbp", "IDE@doubleclick.net", "_ttp@tiktok.com"]],
    ["openencyclopedia.example", 44, "none", [false, false], [], []],
    ["jobboard.example", 52, "declined", [false, true], ["googletagmanager.com", "linkedin.com", "hs-analytics.net", "segment.com", "newrelic.com"], ["_ga", "bcookie@linkedin.com"]],
    ["techgadgets.example", 70, "no-reject", [null, null], ["doubleclick.net", "amazon-adsystem.com", "facebook.net", "quantserve.com", "teads.tv", "agkn.com", "tapad.com"], ["_ga", "_fbp", "__qca", "IDE@doubleclick.net"]],
    ["bankingtips.example", 85, "declined", [false, false], ["googletagmanager.com", "adobedtm.com", "omtrdc.net", "newrelic.com"], ["_ga", "s_fid", "OptanonConsent"]],
    ["gamerhub.example", 101, "accepted", [false, true], ["doubleclick.net", "qq.com", "facebook.net", "ads-twitter.com", "redditstatic.com", "mouseflow.com"], ["_ga", "_fbp", "_rdt_uuid"]],
    ["fitnesslog.example", 122, "declined", [null, true], ["googletagmanager.com", "facebook.net", "amplitude.com", "fullstory.com", "segment.com"], ["_ga", "_fbp"]],
    ["localforum.example", 140, "none", [null, null], ["google-analytics.com", "redditstatic.com", "quantserve.com"], ["_ga", "__qca", "PHPSESSID"]]
  ];

  // Fresh copies each time, with visit times counted back from now, so the sites always look like this week's.
  function sites(now = Date.now()) {
    return SITES.map(([domain, hours, cookieChoice, [sells, shares], trackers, cookies]) => ({
      domain, example: true, cookieChoice,
      lastVisit: new Date(now - hours * 3600000).toISOString(),
      policy: { sells, shares, source: null },
      trackers: trackers.map((d) => { const [company, category, country, fingerprinting] = ATLAS[d]; return { domain: d, company, category, country, fingerprinting }; }),
      cookies: cookies.map((c) => {
        const [name, from] = c.split("@");
        const [category, company, purpose, days] = COOKIES[name];
        return { name, domain: from || domain, firstParty: !from, category, company, purpose, days };
      })
    }));
  }

  const root = typeof window !== "undefined" ? window : self;
  root.PrivaCExample = { sites };
})();
