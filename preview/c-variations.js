// PrivaC test page (preview/c-variations.html): C on 17 kinds of cookie pop-ups, shaped like the ones on
// real sites (measured October 2026: Tesco, M&S, John Lewis, Waitrose, Halfords, Rightmove, boohoo,
// Trainline, Zara). It runs C's real scripts, the same ones PrivaC adds to websites, so what you see here is
// what you'd see on a site. Nothing on this page is recorded or graded. Open it from Settings > C on websites.
(function () {
  const TYPES = {
"top-bar": {
"title": "Banner across the top (Tesco)",
"look": "C hangs from its bottom edge, right under Reject all. The banner slides in and he follows it.",
"html": "<style>@keyframes down{from{transform:translateY(-100%)}to{transform:none}}</style>\n<div data-root data-panel style=\"position:fixed;top:0;left:0;right:0;z-index:50;background:#fff;box-shadow:0 2px 10px #0003;padding:18px 18px 24px;display:flex;gap:24px;align-items:flex-start;animation:down .7s ease-out .4s both\">\n<section style=\"flex:1\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p><p style='font:13px system-ui;color:#555;margin:10px 0 0'>You can change your mind at any time. Show purposes to see more.</p><p style='font:13px system-ui;color:#555'>Our partners: 18 vendors.</p></section>\n<div class=\"ddsweb-consent-banner__buttons-container\" style=\"display:flex;flex-direction:column;gap:10px;margin-top:40px\">\n<button class=\"ddsweb-consent-banner__button\" data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Accept all</button>\n<button class=\"ddsweb-consent-banner__button\" data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button>\n<button class=\"ddsweb-consent-banner__button\" style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Show purposes</button></div></div>",
"first": false
},
"top-box": {
"title": "Box near the top (M&S)",
"look": "C hangs under the box, lined up with Reject all cookies; his speech card stays off the box.",
"html": "<div id=\"onetrust-consent-sdk\"><div id=\"onetrust-banner-sdk\" data-root data-panel role=\"region\" style=\"position:fixed;top:90px;left:calc(50% - 325px);width:650px;z-index:50;background:#fff;border-radius:10px;box-shadow:0 6px 30px #0004;padding:22px;box-sizing:border-box\">\n<h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p><div id=\"onetrust-button-group\" style=\"display:flex;gap:10px;margin-top:16px;justify-content:flex-end\">\n<button id=\"onetrust-pc-btn-handler\" style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Cookie settings</button><button id=\"onetrust-reject-all-handler\" data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all cookies</button><button id=\"onetrust-accept-btn-handler\" data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all cookies</button></div></div></div>",
"first": false
},
"center-small": {
"title": "Small box in the middle (boohoo)",
"look": "C hangs under the box, under Reject All.",
"html": "<div class=\"cky-consent-container\" data-root data-panel style=\"position:fixed;top:calc(50% - 129px);left:calc(50% - 220px);width:440px;z-index:50;background:#fff;border-radius:6px;box-shadow:0 6px 30px #0004;padding:22px;box-sizing:border-box\">\n<h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p><div class=\"cky-notice-btn-wrapper\" style=\"display:flex;gap:8px;margin-top:16px\"><button style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Customise</button><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject All</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept All</button></div></div>",
"first": false
},
"center-dialog": {
"title": "Window in the middle, dark backdrop",
"look": "C hangs under the white window, under Reject all, not under the dark backdrop.",
"html": "<div data-root style=\"position:fixed;inset:0;z-index:50;background:#0006;display:flex;align-items:center;justify-content:center\">\n<div role=\"dialog\" aria-modal=\"true\" data-panel style=\"width:1200px;max-width:92vw;background:#fff;padding:28px 32px;box-sizing:border-box;border-radius:4px\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p>\n<p style=\"font:14px system-ui;color:#555\">Select 'Reject all' to use only essential cookies, or manage your preferences.</p>\n<div class=\"cookie-consent-buttons\" style=\"display:flex;gap:12px;justify-content:center;margin-top:18px\"><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Allow all</button><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Manage preferences</button></div></div></div>",
"first": false
},
"modal-dialog": {
"title": "Real modal dialog (John Lewis)",
"look": "The page behind can't be clicked, but C can: he stands inside the dialog's layer, under Reject all.",
"html": "<dialog id=\"cd\" data-root data-panel style=\"width:620px;border:0;border-radius:14px;padding:26px;box-shadow:0 10px 40px #0005\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p>\n<div style=\"display:flex;gap:10px;margin-top:16px;justify-content:flex-end\"><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button></div></dialog>",
"first": false
},
"modal-dialog-moved": {
"title": "Modal dialog centred with a CSS transform",
"look": "Newer sites centre dialogs this way. C still stands outside it, fully visible and clickable.",
"html": "<dialog id=\"cd\" data-root data-panel style=\"width:620px;border:0;border-radius:14px;padding:26px;box-shadow:0 10px 40px #0005;margin:0;top:50%;left:50%;transform:translate(-50%,-50%)\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p>\n<div style=\"display:flex;gap:10px;margin-top:16px;justify-content:flex-end\"><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button></div></dialog>",
"first": false
},
"modal-dialog-removed": {
"title": "Dialog the site deletes after a choice (John Lewis)",
"look": "Press Decline extras: the site deletes its dialog, and C's answer stays where it was.",
"html": "<div id=\"jlwrap\"><dialog id=\"cd\" data-root data-remove data-panel style=\"width:620px;border:0;border-radius:14px;padding:26px;box-shadow:0 10px 40px #0005\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p>\n<div style=\"display:flex;gap:10px;margin-top:16px;justify-content:flex-end\"><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button></div></dialog></div>",
"first": false
},
"overlay": {
"title": "Full-screen dimmed overlay (Waitrose)",
"look": "C finds the white box inside the overlay and peeks over it.",
"html": "<div data-root class=\"overlay\" style=\"position:fixed;inset:0;z-index:50;background:#000a;display:flex;align-items:flex-end\">\n<div data-panel style=\"width:100%;background:#fff;padding:26px 72px 30px;box-sizing:border-box\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p>\n<div class=\"cookieButtons\" style=\"display:flex;gap:12px;margin-top:18px\"><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Allow all</button><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Manage cookies</button></div></div></div>",
"first": false
},
"full-wall": {
"title": "Whole-page cookie wall",
"look": "C hangs under the text, never on the Reject button.",
"html": "<div id=\"consent-wall\" data-root style=\"position:fixed;inset:0;z-index:50;background:#f7f7fb;display:flex;align-items:center;justify-content:center\">\n<div data-panel style=\"width:560px\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p><div style=\"display:flex;gap:10px;margin-top:18px\"><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button></div></div></div>",
"first": false
},
"bottom-left": {
"title": "Box in the bottom-left corner (Halfords)",
"look": "C peeks over its top edge, above Reject All, and never covers Accept All Cookies.",
"html": "<div id=\"onetrust-banner-sdk\" data-root data-panel style=\"position:fixed;left:32px;bottom:32px;width:760px;z-index:50;background:#fff;border-radius:12px;box-shadow:0 6px 30px #0004;padding:22px;box-sizing:border-box;display:flex;gap:18px;align-items:center\">\n<div style=\"flex:1\"><h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p></div><div style=\"display:flex;flex-direction:column;gap:8px\"><button id=\"onetrust-reject-all-handler\" data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject All</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept All Cookies</button></div></div>",
"first": false
},
"bottom-bar": {
"title": "Bar along the bottom",
"look": "C peeks over the bar, above Reject all.",
"html": "<div class=\"cookie-bar\" data-root data-panel style=\"position:fixed;left:0;right:0;bottom:0;z-index:50;background:#16233f;color:#fff;padding:20px 28px;display:flex;gap:20px;align-items:center\">\n<p style=\"margin:0;flex:1;font:15px system-ui\">This website uses cookies to improve your experience and for advertising.</p><button style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Settings</button><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer;border-color:#fff\">Accept all</button></div>",
"first": false
},
"bottom-bar-left": {
"title": "Bottom bar with Reject at the far left",
"look": "C stays over Reject all; his speech card flips to his right so it stays on screen.",
"html": "<div class=\"cookie-bar\" data-root data-panel style=\"position:fixed;left:0;right:0;bottom:0;z-index:50;background:#fff;box-shadow:0 -2px 12px #0003;padding:18px 24px;display:flex;gap:16px;align-items:center\">\n<button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button><p style=\"margin:0 0 0 12px;font:15px system-ui\">We use cookies. Choose what you're happy with.</p></div>",
"first": false
},
"tall": {
"title": "Tall pop-up, no room above or below (Rightmove)",
"look": "C stands in a corner of the window, covering none of the pop-up's buttons.",
"html": "<div id=\"onetrust-consent-sdk\"><div class=\"onetrust-pc-dark-filter\" style=\"position:fixed;inset:0;background:#0007;z-index:40\"></div>\n<div id=\"onetrust-banner-sdk\" data-root data-panel role=\"dialog\" style=\"position:fixed;top:116px;left:calc(50% - 243px);width:486px;height:667px;z-index:50;background:#fff;border-radius:8px;padding:24px;box-sizing:border-box;display:flex;flex-direction:column\">\n<h3 style='margin:0 0 6px;font:700 18px system-ui'>We value your privacy</h3><p style='margin:0;font:14px/1.45 system-ui;color:#333'>We and our partners use cookies to personalise ads, measure performance and improve your experience.</p><p style=\"flex:1;font:14px/1.5 system-ui;color:#444\">Purposes: store and/or access information on a device; personalised ads and content, ad and content measurement, audience research and services development. List of partners (vendors)...</p>\n<div style=\"display:flex;flex-direction:column;gap:10px\"><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Manage preferences</button></div></div></div>",
"first": false
},
"inflow-top": {
"title": "Banner inside the page (scrolls away)",
"look": "Scroll: C follows the banner, and doesn't jump from side to side.",
"html": "<div class=\"cookie-notice\" data-root data-panel style=\"background:#ffe9a8;padding:20px 28px;display:flex;gap:16px;align-items:center\">\n<p style=\"margin:0;flex:1;font:15px system-ui\">We use cookies for analytics and advertising.</p><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button></div>",
"first": true
},
"no-container": {
"title": "Banner with no cookie-like names",
"look": "C still finds the banner and stands on it.",
"html": "<div class=\"bar-x9\" data-root data-panel style=\"position:fixed;left:24px;right:24px;bottom:24px;z-index:50;background:#fff;border-radius:16px;box-shadow:0 6px 30px #0004;padding:20px 24px;display:flex;gap:16px;align-items:center\">\n<p style=\"margin:0;flex:1;font:15px system-ui\">We use cookies to make this site work and to show you ads.</p><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept all</button></div>",
"first": false
},
"accept-only-bottom": {
"title": "Only an Accept button (Trainline)",
"look": "No way to say no, so C warns you instead of asking.",
"html": "<div class=\"cookie-notice\" data-root data-panel style=\"position:fixed;left:0;right:0;bottom:0;z-index:50;background:#fff;box-shadow:0 -2px 12px #0003;padding:20px 28px;display:flex;gap:20px;align-items:center\">\n<p style=\"margin:0;flex:1;font:15px system-ui\">By using this site you agree to our use of cookies for tracking and ads.</p><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer\">Accept cookies</button></div>",
"first": false
},
"optout-prefs": {
"title": "\"Do not sell or share\" link and a preferences window (Zara)",
"look": "C asks once. Before, he opened and closed 28 times in 10 seconds here.",
"html": "<div id=\"onetrust-banner-sdk\" style=\"position:fixed;left:32px;bottom:32px;width:375px;z-index:50;background:#fff;box-shadow:0 6px 30px #0004;padding:18px;box-sizing:border-box\">\n<p style=\"font:13px system-ui;margin:0 0 10px\">We use first-party and third-party cookies to understand the uses of our store.</p>\n<button class=\"cookie-setting-link\" style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Do Not Sell Or Share My Personal Information</button></div>\n<div id=\"onetrust-pc-sdk\" data-panel role=\"dialog\" style=\"display:none;position:fixed;top:145px;left:calc(50% - 365px);width:730px;height:610px;z-index:60;background:#fff;box-shadow:0 6px 30px #0006;padding:24px;box-sizing:border-box\">\n<h3 style=\"margin:0 0 12px;font:700 20px system-ui\">Cookies and ad preferences</h3><p style=\"height:380px;font:14px system-ui\">Overview of cookie purposes...</p>\n<button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer;width:100%;margin:4px 0\">Confirm my choices</button><button data-close data-reject style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer;width:100%;margin:4px 0\">Reject all</button><button data-close style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#0b3b8c;color:#fff;cursor:pointer;width:100%;margin:4px 0\">Allow all</button></div>\n<div class=\"slides\" style=\"position:absolute;top:1600px;left:0;right:0\"><div class=\"slide\" style=\"padding:20px\"><button class=\"slider-spot-slide-footer-privacy-links__\" style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Do not sell or share my personal information</button></div>\n<div class=\"slide\" style=\"padding:20px;display:none\"><button class=\"slider-spot-slide-footer-privacy-links__\" style=\"padding:10px 18px;border-radius:22px;font:700 14px system-ui;border:2px solid #0b3b8c;background:#fff;color:#0b3b8c;cursor:pointer\">Do not sell or share my personal information</button></div></div>",
"first": false
}
};
  const SITE = "<header style=\"height:64px;background:#0b3b8c;color:#fff;display:flex;align-items:center;gap:28px;padding:0 28px;font:600 15px system-ui\">\n<b style=\"font-size:22px\">ShopLab</b><span>Groceries</span><span>Clothing</span><span>Home</span><span>Offers</span><span style=\"margin-left:auto\">Basket</span></header>\n<main style=\"padding:28px;font:15px/1.5 system-ui;color:#223\">\n<div style=\"display:grid;grid-template-columns:repeat(4,1fr);gap:18px\"><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#ff7a59,#ffb347);padding:14px;color:#fff;font-weight:700\">Product 0</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#4facfe,#00f2fe);padding:14px;color:#fff;font-weight:700\">Product 1</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#43e97b,#38f9d7);padding:14px;color:#fff;font-weight:700\">Product 2</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#fa709a,#fee140);padding:14px;color:#fff;font-weight:700\">Product 3</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#a18cd1,#fbc2eb);padding:14px;color:#fff;font-weight:700\">Product 4</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#f6d365,#fda085);padding:14px;color:#fff;font-weight:700\">Product 5</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#5ee7df,#b490ca);padding:14px;color:#fff;font-weight:700\">Product 6</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#c471f5,#fa71cd);padding:14px;color:#fff;font-weight:700\">Product 7</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#ff7a59,#ffb347);padding:14px;color:#fff;font-weight:700\">Product 8</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#4facfe,#00f2fe);padding:14px;color:#fff;font-weight:700\">Product 9</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#43e97b,#38f9d7);padding:14px;color:#fff;font-weight:700\">Product 10</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#fa709a,#fee140);padding:14px;color:#fff;font-weight:700\">Product 11</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#a18cd1,#fbc2eb);padding:14px;color:#fff;font-weight:700\">Product 12</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#f6d365,#fda085);padding:14px;color:#fff;font-weight:700\">Product 13</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#5ee7df,#b490ca);padding:14px;color:#fff;font-weight:700\">Product 14</div><div style=\"height:220px;border-radius:14px;background:linear-gradient(135deg,#c471f5,#fa71cd);padding:14px;color:#fff;font-weight:700\">Product 15</div></div>\n<p style=\"height:1400px\">More products...</p><footer id=\"foot\" style=\"padding:30px;background:#eef\">FOOTER</footer></main>";
  const keys = Object.keys(TYPES);
  const type = new URLSearchParams(location.search).get("type");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const link = (k) => "?type=" + encodeURIComponent(k);

  // ---- The list of pop-ups ----
  if (!TYPES[type]) {
    document.title = "C on cookie pop-ups · PrivaC";
    document.body.className = "pv-index";
    document.body.innerHTML = `
      <main>
        <h1>C on ${keys.length} kinds of cookie pop-ups</h1>
        <p class="pv-lead">Each one is shaped like a pop-up on a real site. C's real scripts run on every page, so
          this is what you'd see on that site. Try <b>Decline extras</b>, <b>Let me choose</b>, the <b>×</b>, or the
          pop-up's own buttons. Use the <b>← →</b> keys to go from one to the next.</p>
        <ol class="pv-list">${keys.map((k) => `
          <li><a href="${link(k)}"><b>${esc(TYPES[k].title)}</b><span>${esc(TYPES[k].look)}</span></a></li>`).join("")}
        </ol>
        <p class="pv-foot">Nothing on these pages is recorded or graded.</p>
      </main>`;
    return;
  }

  // ---- One pop-up on a pretend shop ----
  const t = TYPES[type], i = keys.indexOf(type);
  const prev = keys[(i - 1 + keys.length) % keys.length], next = keys[(i + 1) % keys.length];
  document.title = t.title + " · PrivaC test page";
  document.body.className = "pv-page";
  document.body.insertAdjacentHTML("beforeend", t.first ? t.html + SITE : SITE + t.html);
  document.body.insertAdjacentHTML("beforeend", `
    <aside class="pv-note" aria-label="About this test page">
      <p class="pv-kicker">PrivaC test page · ${i + 1} of ${keys.length}</p>
      <h2>${esc(t.title)}</h2>
      <p><b>Look for:</b> ${esc(t.look)}</p>
      <nav><a href="${link(prev)}">‹ Previous</a><a href="?">All pop-ups</a><a href="${link(type)}">Again</a><a href="${link(next)}">Next ›</a></nav>
      <p class="pv-keys">Keys: ← → to move, R to start again</p>
    </aside>`);

  // What the pop-up's buttons do on the real sites: close it (John Lewis deletes its whole dialog), and
  // Reject saves the choice the way OneTrust does (C checks that before saying "Nice!").
  for (const b of document.querySelectorAll("[data-close]")) {
    b.addEventListener("click", () => {
      const p = document.querySelector("[data-root]") || b.closest("[data-panel]");
      if (p.id === "onetrust-pc-sdk") document.getElementById("onetrust-banner-sdk").style.display = "none";
      if (p.hasAttribute("data-remove")) document.getElementById("jlwrap").remove();
      else if (p.tagName === "DIALOG") p.close();
      else p.style.display = "none";
      if (b.hasAttribute("data-reject")) document.cookie = "OptanonConsent=groups%3DC0001%3A1%2CC0002%3A0%2CC0004%3A0; path=/";
    });
  }
  const dialog = document.querySelector("dialog[data-root], #jlwrap dialog");
  if (dialog) dialog.showModal();
  // Zara: "Do not sell or share" opens a preferences window, and a carousel keeps changing the page.
  const optOut = document.querySelector("#onetrust-banner-sdk .cookie-setting-link");
  if (optOut) optOut.addEventListener("click", () => { document.getElementById("onetrust-pc-sdk").style.display = "block"; });
  if (document.querySelector(".slides")) {
    setInterval(() => { for (const s of document.querySelectorAll(".slide")) s.style.display = s.style.display === "none" ? "" : "none"; }, 1000);
  }

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const to = e.key === "ArrowRight" ? next : e.key === "ArrowLeft" ? prev : (e.key === "r" || e.key === "R") ? type : null;
    if (to) location.search = link(to);
  });
})();
