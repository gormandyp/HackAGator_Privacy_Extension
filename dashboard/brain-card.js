// "C's brain" card at the top of Ask C (in-browser AI version): shows whether Gemma is downloaded and running in
// Chrome, offers the one-time download (about 2 GB) with live progress, and lets you use Ollama instead.
// Talks to the background (shared/ai.js) with { type: "privac-ai", cmd }; progress arrives as
// { type: "privac-brain-status" } messages from the offscreen brain page.
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gb = (bytes) => (bytes / 1e9).toFixed(1);

  // Pure: the card's text and buttons for a state. Exported for tests.
  function view(info, ui = {}) {
    const s = (info && info.status) || {};
    if (ui.confirmRemove && (s.state === "ready" || s.state === "downloaded")) {
      return { tone: "warn", title: "Delete C's brain from this computer?", text: "This frees about 2 GB. You can download it again any time.",
        actions: [["remove", "Delete"], ["keep", "Keep it"]] };
    }
    const total = s.total || 2008432640;
    const ollama = !!(info && info.ollama);
    if (info && info.use === "ollama") {
      return { tone: "quiet", title: "Ask C is using Ollama on this computer.",
        text: "", actions: [["use-browser", "Use the in-browser brain"]] };
    }
    // A model file packed inside the extension folder can't be deleted from here, so only a download is offered.
    const quietActions = [["use-ollama", "Use Ollama instead"]].concat(s.where === "bundled" ? [] : [["ask-remove", "Delete download"]]);
    // Chrome on Windows ignores the request for the faster graphics chip, so a laptop with two runs Gemma on the slow
    // built-in one (team's G14: 18-70 s per answer instead of about 2 s with Chrome forced onto its NVIDIA chip).
    const winTip = ui.windows ? "Laptop with two graphics chips? For much faster answers, set Chrome to High performance in Windows Settings > System > Display > Graphics, then restart Chrome." : "";
    switch (s.state) {
      case "ready":
        return { tone: "quiet", title: `${s.name || "Gemma 4 E2B"} is running in your browser.`,
          text: winTip, actions: quietActions };
      case "loading":
        return { tone: "info", title: "Getting C's brain ready...",
          text: "Loading Gemma into your graphics chip. The very first time can take about 20 seconds.", actions: [], busy: true };
      case "downloaded":
        return { tone: "quiet", title: `${s.name || "Gemma 4 E2B"} is downloaded and loads when you ask.`,
          text: winTip, actions: quietActions };
      case "downloading": {
        const pct = Math.max(0, Math.min(100, Math.round(((s.loaded || 0) / total) * 100)));
        return { tone: "info", title: `Downloading C's brain: ${gb(s.loaded || 0)} of ${gb(total)} GB`,
          text: "One time only. You can keep browsing; grades and C's pop-ups work meanwhile.", progress: pct, actions: [["cancel", "Cancel"]] };
      }
      case "unsupported":
        return { tone: "warn", title: "C's in-browser brain can't run here.",
          text: `${s.error || ""} ${ollama ? "Ask C is using Ollama instead." : "Ask C can use Ollama instead (docs/OLLAMA.md); everything else in PrivaC works."}`, actions: [] };
      case "error":
        return { tone: "warn", title: "C's brain hit a problem.", text: s.error || "", actions: [["download", "Try again"]].concat(ollama ? [["use-ollama", "Use Ollama instead"]] : []) };
      case "none":
      default:
        return { tone: "offer", title: "Give C its brain: Gemma 4, right in Chrome",
          text: `One download of ${gb(total)} GB. It runs on this computer's graphics chip, so your questions and browsing never leave it.` +
            (ollama ? " Ollama is running too, so Ask C works right now." : ""),
          actions: [["download", "Download C's brain"]].concat(ollama ? [["use-ollama", "Use Ollama instead"]] : []) };
    }
  }

  function html(v) {
    return `<div class="brain-card tone-${v.tone}${v.busy ? " busy" : ""}">
      <div class="brain-text"><b>${esc(v.title)}</b>${v.text ? `<span>${esc(v.text)}</span>` : ""}
        ${typeof v.progress === "number" ? `<div class="brain-bar" role="progressbar" aria-valuenow="${v.progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v.progress}%"></i></div>` : ""}
      </div>
      ${v.actions.length ? `<div class="brain-actions">${v.actions.map(([cmd, label], i) => `<button type="button" data-brain="${cmd}" class="${i || v.tone === "quiet" ? "brain-link" : "brain-btn"}">${esc(label)}</button>`).join("")}</div>` : ""}
    </div>`;
  }

  // Speed: when the one-time download finishes, start loading Gemma right away (the very first load takes ~20 s),
  // so the first question doesn't wait for it. Not when it was unloaded for being idle: that would undo it.
  const warmAfter = (was, now) => was === "downloading" && now === "downloaded";

  // Same card with new numbers (the download's progress)? Then only the title and bar change, so the Cancel button
  // keeps keyboard focus and screen readers aren't sent the whole card again every 0.4 s.
  const sameShape = (a, b) => !!(a && b) && a.tone === b.tone && !!a.busy === !!b.busy && a.text === b.text &&
    typeof a.progress === typeof b.progress && JSON.stringify(a.actions) === JSON.stringify(b.actions);

  function hasRuntime() { return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage; }
  function warm(force) { try { chrome.runtime.sendMessage({ type: "privac-warm", force }).catch(() => {}); } catch (e) { /* no background */ } }

  async function init() {
    const host = document.getElementById("ask-c");
    if (!host || !hasRuntime()) return;
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "brain-card.css";
    document.head.appendChild(link);
    const box = document.createElement("div");
    box.id = "brain-card"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
    const thread = document.getElementById("ask-thread");
    if (thread && thread.parentNode) thread.parentNode.insertBefore(box, thread); else host.prepend(box);

    let info = null, shown = null;
    const ui = { confirmRemove: false, windows: /Windows/.test(navigator.userAgent) };
    const render = () => {
      if (!info) return;
      const v = view(info, ui);
      const title = box.querySelector(".brain-text b"), bar = box.querySelector(".brain-bar");
      if (sameShape(shown, v) && title) {
        title.textContent = v.title;
        if (bar) { bar.setAttribute("aria-valuenow", v.progress); bar.firstElementChild.style.width = v.progress + "%"; }
      } else {
        box.innerHTML = html(v);
      }
      shown = v;
    };
    const send = async (cmd, extra) => {
      try { info = { ...(info || {}), ...(await chrome.runtime.sendMessage({ type: "privac-ai", cmd, ...extra })) }; }
      catch (e) { info = { ...(info || {}), status: { state: "error", error: "PrivaC's background isn't answering. Reload the extension." } }; }
      render();
    };
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-brain]");
      if (!b) return;
      const cmd = b.dataset.brain;
      ui.confirmRemove = cmd === "ask-remove";
      if (cmd === "ask-remove" || cmd === "keep") render();
      else if (cmd === "remove") send("remove");
      else if (cmd === "use-ollama") send("use", { use: "ollama" });
      else if (cmd === "use-browser") send("use", { use: "browser" });
      else if (cmd === "cancel") send("cancel-download");
      else if (cmd === "download") send("download");
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== "privac-brain-status" || !msg.status) return;
      const was = info && info.status && info.status.state;
      info = { ...(info || {}), status: msg.status };
      render();
      if (was !== "downloaded" && msg.status.state === "downloaded") send("status");   // fresh after the download
      if (warmAfter(was, msg.status.state)) warm(true);
    });
    await send("status");
    // Downloaded but not loaded yet: start loading now, so the first question is quick.
    if (info && info.use !== "ollama" && info.status && info.status.state === "downloaded") warm(false);
  }

  window.PrivaCBrainCard = { view, html, warmAfter, sameShape };
  if (typeof document !== "undefined") init();
})();
