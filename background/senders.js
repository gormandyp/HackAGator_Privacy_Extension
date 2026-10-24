// Who sent a message to the background (docs/STORE.md section 6, fix 4). Loaded first by /background.js.
// fromPrivaCPage: PrivaC's own pages (popup, dashboard, also the popup shown in the rounded panel on a website).
//   Only these may read your PrivaC data (Ask C, which site a tab is on) or control C's AI.
// fromPrivaC: also PrivaC's own scripts inside websites, which may only report what they saw (a cookie choice).
// Other extensions and websites can't message PrivaC at all (no "externally_connectable"); this is a second lock.
function fromPrivaC(sender) {
  return !!(sender && sender.id && sender.id === chrome.runtime.id);
}

function fromPrivaCPage(sender) {
  return fromPrivaC(sender) && typeof sender.url === "string" && sender.url.startsWith("chrome-extension://" + chrome.runtime.id + "/");
}
