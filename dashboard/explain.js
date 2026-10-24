// "Ask C" on any row: a small C button opens a "C explains" popover right next to the row, with C's answer
// and where each fact came from. Same path to Gemma as the Ask C tab (dashboard/ask-c.js: message "askC").
// "Continue in Ask C" moves the question and answer into the chat. Answers are kept for this visit.
(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const GLYPH = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M16.6 7.3a6.6 6.6 0 1 0 0 9.4" fill="none" stroke="#fa4616" stroke-width="3.4" stroke-linecap="round"/></svg>`;
  const answers = new Map();   // question -> { html } | Promise
  let pop = null, anchor = null;

  // The button every list row uses. `about` is what the screen reader hears ("Ask C about Google").
  function button(question, about) {
    return `<button type="button" class="ask-btn" data-ask="${esc(question)}" aria-label="Ask C about ${esc(about || "this")}" title="Ask C">${GLYPH}</button>`;
  }

  function hasRuntime() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage;
  }

  async function fetchAnswer(question) {
    let res = null;
    if (hasRuntime()) {
      try {
        res = await Promise.race([
          chrome.runtime.sendMessage({ type: "askC", question }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 90000))
        ]);
      } catch (e) {
        res = { error: e && e.message === "timeout" ? "I took too long to answer. Try again in a moment." : null };
      }
    }
    const ask = window.PrivaCAsk;
    if (!res || (!res.answer && !res.error) || (res.error && !res.answer && ask && ask.sampleFor(question))) {
      const sample = ask && ask.sampleFor(question);
      if (sample) return { ...sample, sample: true };
      if (!res || !res.error) return { error: "C needs Gemma running on this Mac (Ollama) to explain this. Everything else on this page works without it." };
    }
    return res;
  }

  function render(res) {
    if (res.error && !res.answer) return `<p class="explain-err">${esc(res.error)}</p>`;
    const seen = new Set();
    const labels = (res.trace || []).map((t) => t.label || t.tool).filter((l) => l && !seen.has(l) && seen.add(l));
    const body = window.PrivaCAsk ? window.PrivaCAsk.renderAnswer(res.answer) : esc(res.answer);
    return `${labels.length ? `<p class="trace">C checked: ${labels.map((l) => `<span>${esc(l)} <b aria-hidden="true">✓</b></span>`).join("")}</p>` : ""}
      <p class="answer">${body}</p>${res.sample ? `<p class="sample-tag">Sample answer. The AI isn't connected yet.</p>` : ""}`;
  }

  function place() {
    if (!pop || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const below = r.bottom + 8 + h < window.innerHeight || r.top < h + 16;
    const left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w + 14));
    pop.style.left = left + window.scrollX + "px";
    pop.style.top = (below ? r.bottom + 8 : r.top - h - 8) + window.scrollY + "px";
    pop.style.transformOrigin = `${Math.min(w - 16, Math.max(16, r.left + r.width / 2 - left))}px ${below ? "top" : "bottom"}`;
  }

  function close() {
    if (!pop) return;
    const p = pop; pop = null;
    p.classList.remove("open");
    setTimeout(() => p.remove(), 180);
    if (anchor) { anchor.setAttribute("aria-expanded", "false"); anchor.focus({ preventScroll: true }); }
    anchor = null;
  }

  async function open(btn) {
    const question = btn.dataset.ask;
    if (pop && anchor === btn) return close();
    close();
    anchor = btn;
    btn.setAttribute("aria-expanded", "true");
    pop = document.createElement("div");
    pop.className = "explain glass";
    pop.dataset.liquid = "sheet";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "C explains");
    pop.innerHTML = `
      <header>
        <span class="explain-c">${window.PrivaCMascot ? PrivaCMascot.svg("happy", { body: false, size: 26 }) : ""}</span>
        <div><b>C explains</b><span class="q">${esc(question)}</span></div>
        <button type="button" class="icon-btn explain-close" aria-label="Close"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      </header>
      <div class="explain-body" aria-live="polite"><p class="checking">C is checking<span class="dots"><i></i><i></i><i></i></span></p></div>
      <footer><button type="button" class="pill-btn explain-more">Continue in Ask C</button></footer>`;
    document.body.appendChild(pop);
    place();
    requestAnimationFrame(() => pop && pop.classList.add("open"));
    const mine = pop;
    mine.querySelector(".explain-close").addEventListener("click", close);
    mine.querySelector(".explain-more").addEventListener("click", () => continueInChat(question, mine.querySelector(".explain-body").innerHTML));
    mine.querySelector(".explain-close").focus({ preventScroll: true });

    if (!answers.has(question)) answers.set(question, fetchAnswer(question).then(render));
    const html = await answers.get(question);
    if (pop !== mine) return;
    mine.querySelector(".explain-body").innerHTML = html;
    mine.querySelectorAll(".trace > span").forEach((s, i) => { s.style.animationDelay = `${i * 160}ms`; });
    place();
  }

  // Put this question and C's answer into the Ask C chat, then open that tab.
  function continueInChat(question, answerHtml) {
    close();
    const thread = document.getElementById("ask-thread");
    const empty = document.getElementById("ask-empty");
    if (thread) {
      if (empty) empty.hidden = true;
      const you = document.createElement("div"); you.className = "msg you"; you.textContent = question;
      const c = document.createElement("div"); c.className = "msg c"; c.innerHTML = answerHtml;
      thread.append(you, c);
    }
    if (window.PrivaCTabs) window.PrivaCTabs.show("ask");
    const input = document.getElementById("ask-input");
    if (input) setTimeout(() => input.focus(), 300);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".ask-btn, [data-ask-pill]");
    if (btn) { e.preventDefault(); open(btn); return; }
    if (pop && !pop.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) close(); });
  window.addEventListener("resize", place);
  document.addEventListener("privac-tab", close);

  window.PrivaCExplain = { button, open, close };
})();
