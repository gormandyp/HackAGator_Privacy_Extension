// RegTrack line for C's cookie pop-up (for Matthew's content/c-prompt.js).
// Usage inside the pop-up:  const line = await PrivaCRegTrack.line();  // "" if the file can't load
// Text comes from shared/regtrack-facts.json (checked by Max, with page numbers).
(function () {
  if (window.PrivaCRegTrack) return;
  let cache = null;
  async function facts() {
    if (!cache) cache = fetch(chrome.runtime.getURL("shared/regtrack-facts.json")).then(r => r.json()).catch(() => null);
    return cache;
  }
  // The Ohio figure fits US visitors; RegTrack never measured rejecting, so the line is about accepting.
  async function line(id = "accept-us") {
    const f = await facts();
    const fact = f && f.facts && f.facts.find(x => x.id === id);
    return fact ? `${fact.text} (RegTrack study, 2026, p. ${fact.page})` : "";
  }
  window.PrivaCRegTrack = { line, facts };
})();
