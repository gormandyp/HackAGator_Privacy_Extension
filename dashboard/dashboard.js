// Dashboard: Sites (list + detail) and Grades. Overview is overview.js; C's impact and Safety are
// activity.js; tabs and Settings are tabs.js; the row "Ask C" buttons are explain.js.
(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ADV = PrivaCData.FOREIGN_ADVERSARIES;
  const ask = (q, about) => (window.PrivaCExplain ? PrivaCExplain.button(q, about) : "");
  const an = (g) => (g === "A" || g === "F" ? "an" : "a");

  $("wordmark").innerHTML = PrivaCMascot.wordmark(22);
  $("ask-empty").insertAdjacentHTML("afterbegin", PrivaCMascot.svg("wave", { size: 104 }));

  const data = await PrivaCData.load();
  if (data.sample) $("sample-note").hidden = false;
  const sites = [...data.sites].sort((a, b) => b.score - a.score);

  // ---- Sites: list on the left, the chosen site on the right ----
  const cookieWords = (c) => c === "declined" ? "cookies declined" : c === "accepted" ? "cookies accepted" : c === "no-reject" ? "no way to reject cookies" : "no cookie banner";
  const isFlagged = (s) => s.flagged.length || s.ownerFlag || s.addressFlag || s.serverFlag;
  $("sites").innerHTML = sites.map((s, i) => {
    const uniq = new Set(s.trackers.map((t) => t.company)).size;
    return `<button type="button" class="site-item grade-${s.grade}" role="option" aria-selected="false" data-i="${i}">
      <span class="badge" aria-label="Grade ${s.grade}">${s.grade}</span>
      <span><span class="dom">${esc(s.domain)}</span><span class="meta">${uniq} ${uniq === 1 ? "company" : "companies"}${isFlagged(s) ? `, <span class="warn">foreign-adversary link</span>` : ""}</span></span>
      <span class="num">${s.score}</span>
    </button>`;
  }).join("") || `<p class="hint" style="padding:12px">No sites yet. Browse with PrivaC on and they'll appear here.</p>`;

  const I = window.PrivaCIcons || { tile: () => "" };
  const PS = window.PrivaCSiteSummary;
  const pkey = (cat) => (PS ? PS.purposeOf(cat).key : "other");
  function detailHtml(s) {
    const uniq = new Set(s.trackers.map((t) => t.company)).size;
    const when = new Date(s.lastVisit).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
    return `
      <header class="detail-head">
        <span class="badge big grade-${s.grade}" aria-label="Grade ${s.grade}">${s.grade}</span>
        <div><h2>${esc(s.domain)}</h2><p>${uniq} ${uniq === 1 ? "company" : "companies"}, ${cookieWords(s.cookieChoice)}, last visit ${esc(when)}${isFlagged(s) ? `, <span class="warn">foreign-adversary link</span>` : ""}</p></div>
        <div class="score"><b>${s.score}</b><span>of 100</span></div>
      </header>
      <div class="meter grade-${s.grade}"><span style="width:${s.score}%"></span></div>
      ${PS ? (() => { const c = PS.checkedFor(s); return `
      <p class="checked ${c.full ? "full" : "part"}"><b>${c.label}</b> · ${c.coverage}% of the grade checked${c.full ? "" : ` · range ${c.range.min}–${c.range.max}`}. ${esc(c.note)}</p>
      <details class="calc"><summary>How this grade was calculated</summary><ol>${PS.steps(s).map((t) => `<li>${esc(t)}</li>`).join("")}</ol></details>`; })() : ""}
      <div class="detail-actions"><button type="button" class="pill-btn" data-ask-pill data-ask="Why did ${esc(s.domain)} get ${an(s.grade)} ${s.grade}, and what can I do about it?">Ask C why it got ${an(s.grade)} ${s.grade}</button></div>
      <div class="detail-cols">
        <section>
          <h3 class="col-head">${I.tile("list", "grade", "sm")}Why it got ${an(s.grade)} ${s.grade}</h3>
          <ul>${s.parts.map((p) => `<li><span>${esc(p.label)}</span><span class="end"><span class="pts ${p.points ? "" : "zero"}">+${p.points}</span>${ask(`On ${s.domain}: what does "${p.label}" mean, and why is it worth ${p.points} points?`, p.label)}</span></li>`).join("")}</ul>
        </section>
        <section>
          <h3 class="col-head">${I.tile("radar", "blue", "sm")}Tracker connections</h3>
          <ul>${s.trackers.length ? s.trackers.map((t) => `<li><span class="co">${esc(t.company)}<small>${esc(t.domain)}</small></span><span class="end"><span class="where p-${pkey(t.category)}"><i class="p-dot"></i>${esc(t.category)}${ADV[t.country] ? ` <strong>${esc(ADV[t.country])}</strong>` : ""}</span>${ask(`What does ${t.company} (${t.domain}) do on ${s.domain}, and should I worry?`, t.company)}</span></li>`).join("") : "<li><span>None on this site</span></li>"}</ul>
        </section>
      </div>`;
  }

  let current = -1;
  function selectSite(i, focus) {
    const s = sites[i];
    if (!s) return;
    current = i;
    for (const b of $("sites").querySelectorAll(".site-item")) b.setAttribute("aria-selected", String(Number(b.dataset.i) === i));
    const pane = $("site-detail");
    pane.className = `site-detail glass grade-${s.grade}`;
    pane.innerHTML = detailHtml(s);
    pane.classList.remove("swap"); void pane.offsetWidth; pane.classList.add("swap");
    if (focus) $("sites").querySelector(`[data-i="${i}"]`).focus({ preventScroll: true });
  }
  $("sites").addEventListener("click", (e) => {
    const b = e.target.closest(".site-item");
    if (b) selectSite(Number(b.dataset.i));
  });
  $("sites").addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key) || current < 0) return;
    e.preventDefault();
    selectSite(Math.max(0, Math.min(sites.length - 1, current + (e.key === "ArrowDown" ? 1 : -1))), true);
  });
  // From the Overview's "Worth knowing" (Max, 2026-10-25: it opened the top of the Sites tab): selects the site, brings
  // it into view, and when companies are named ("Baidu|Yandex"), scrolls to the first one's row and highlights every
  // row of theirs for a moment.
  function reveal(company) {
    const pane = $("site-detail");
    const names = String(company || "").split("|").filter(Boolean);
    const rows = [...pane.querySelectorAll(".co")].filter((c) => c.firstChild && names.includes(c.firstChild.textContent.trim())).map((c) => c.closest("li"));
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      (rows[0] || pane).scrollIntoView({ block: rows.length ? "center" : "start", behavior: reduce ? "auto" : "smooth" });
      for (const li of rows) { li.classList.remove("spot"); void li.offsetWidth; li.classList.add("spot"); }
    });
  }
  window.PrivaCSites = { select: (domain, company) => {
    const i = sites.findIndex((s) => s.domain === domain);
    if (i < 0) return;
    selectSite(i);
    const item = $("sites").querySelector(`[data-i="${i}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
    reveal(company);
  } };
  if (sites.length) selectSite(0);
  else $("site-detail").innerHTML = `<p class="hint">Pick a site on the left once PrivaC has seen a few.</p>`;

  // ---- Grades: the key, and an Ask C button on each rule ----
  const ranges = { A: "0–20", B: "21–40", C: "41–60", D: "61–80", F: "81–100" };
  $("grades-key").innerHTML = Object.keys(ranges).map((g) =>
    `<div class="k grade-${g}"><b>${g}</b><span>${PrivaCData.GRADE_WORDS[g]}</span><span>${ranges[g]}</span></div>`).join("");
  const RULE_TILES = [["radar", "blue"], ["eye", "purple"], ["cookie", "orange"], ["globe", "red"], ["news", "indigo"], ["breach", "pink"]];
  [...document.querySelectorAll("#rubric tbody tr")].forEach((tr, i) => {
    const [g, c] = RULE_TILES[i] || ["list", "gray"];
    tr.classList.add(`tile-${c}`);   // the colored bar on the left matches the icon
    tr.cells[0].innerHTML = `<div class="rule">${I.tile(g, c, "lg")}<div class="rule-body">${tr.cells[0].innerHTML}</div></div>`;
  });
  const EVIDENCE_TILES = [["eye", "blue"], ["news", "indigo"], ["server", "gray"]];
  document.querySelectorAll(".evidence > div h3").forEach((h, i) => h.insertAdjacentHTML("afterbegin", I.tile(...(EVIDENCE_TILES[i] || ["list", "gray"]), "sm")));
  for (const tr of document.querySelectorAll("#rubric tbody tr")) {
    const rule = tr.cells[0].textContent.trim();
    tr.cells[1].insertAdjacentHTML("beforeend", `<span class="ask-cell">${ask(`Explain this grading rule in plain words, with an example: "${rule}"`, "this rule")}</span>`);
  }

  // ---- Clear data (Settings) ----
  $("clear").addEventListener("click", async () => {
    if (!confirm("Delete everything PrivaC has recorded in this browser? Your settings stay. This can't be undone.")) return;
    await PrivaCData.clearAll();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = "PrivaC data cleared";
    document.body.appendChild(t);
    setTimeout(() => location.reload(), 1200);
  });
})();
