// Dashboard: Overview (headline, spotlight, who followed you), Sites (list + detail), Grades.
// C's impact and Safety live in activity.js; tabs and Settings in tabs.js; row "Ask C" buttons in explain.js.
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

  // ---- Companies across sites ----
  const companyMap = new Map();
  for (const s of sites) {
    for (const t of s.trackers) {
      if (!companyMap.has(t.company)) companyMap.set(t.company, { sites: new Set(), categories: new Set(), country: t.country });
      const c = companyMap.get(t.company);
      c.sites.add(s.domain);
      c.categories.add(t.category);
    }
  }
  const companies = [...companyMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sites.size - a.sites.size || a.name.localeCompare(b.name));

  // ---- Headline ----
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  sites.forEach((s) => counts[s.grade]++);
  const worst = sites[0];
  const flaggedSites = sites.filter((s) => s.flagged.length || s.ownerFlag || s.addressFlag || s.serverFlag);
  $("intro").innerHTML = `
    <div class="hero-c">${PrivaCMascot.svg(worst && (worst.grade === "D" || worst.grade === "F") ? "uneasy" : "wave", { size: 92 })}</div>
    <div class="hero-text">
      <h1>${companies.length} ${companies.length === 1 ? "company" : "companies"} saw your browsing across ${sites.length} ${sites.length === 1 ? "site" : "sites"} this week.</h1>
      <p>${flaggedSites.length
        ? `${flaggedSites.length === 1 ? "One site" : flaggedSites.length + " sites"} also connected to a company or server in a listed foreign-adversary country.`
        : "None of them connected to a company in a listed foreign-adversary country."}</p>
      <div class="grade-strip" aria-label="Sites by grade">
        ${Object.entries(counts).map(([g, n]) => `<button type="button" class="g grade-${g} ${n ? "" : "none"}" data-goto="${g}" aria-label="${n} ${n === 1 ? "site" : "sites"} graded ${g}"><b>${g}</b><span>${n} ${n === 1 ? "site" : "sites"}</span></button>`).join("")}
      </div>
    </div>`;

  // ---- Spotlight: the company that followed you furthest ----
  const top = companies[0];
  $("callout").innerHTML = top && top.sites.size > 1 ? `
    <div class="spot-row">${PrivaCMascot.svg("uneasy", { body: false, size: 40 })}
      <p><strong>${esc(top.name)}</strong> showed up on ${top.sites.size} of your ${sites.length} sites, more than any other company.</p></div>
    <button type="button" class="pill-btn" data-ask-pill data-ask="Who is ${esc(top.name)}, and what can it learn from seeing me on ${top.sites.size} different sites?">Ask C about ${esc(top.name)}</button>`
    : `<div class="spot-row">${PrivaCMascot.svg("happy", { body: false, size: 40 })}
      <p>No company followed you across more than one site this week.</p></div>`;

  // ---- Who followed you: company x site ----
  const siteCols = sites.map((s) => s.domain);
  $("matrix").innerHTML = `
    <thead><tr>
      <th></th>
      ${sites.map((s) => `<th scope="col"><span class="site-head grade-${s.grade}"><span class="mini-grade">${s.grade}</span>${esc(s.domain.replace(/\.example$/, ""))}</span></th>`).join("")}
      <th scope="col" style="text-align:right">Sites</th>
      <th><span class="visually-hidden">Ask C</span></th>
    </tr></thead>
    <tbody>
      ${companies.map((c, i) => `
        <tr class="${ADV[c.country] ? "flagged" : ""} ${i === 0 && c.sites.size > 1 ? "top-row" : ""}">
          <th scope="row">${esc(c.name)}<small>${esc([...c.categories].join(", "))}</small></th>
          ${siteCols.map((d) => `<td>${c.sites.has(d) ? `<span class="dot" title="${esc(c.name)} on ${esc(d)}"></span>` : `<span class="no-dot" aria-hidden="true"></span>`}</td>`).join("")}
          <td class="reach">${c.sites.size} of ${sites.length}</td>
          <td class="ask-cell">${ask(`Who is ${c.name}, and what does it do with what it sees on ${[...c.sites].slice(0, 3).join(", ")}?`, c.name)}</td>
        </tr>`).join("")}
    </tbody>`;

  $("intro").addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (!b || !window.PrivaCTabs) return;
    const i = sites.findIndex((s) => s.grade === b.dataset.goto);
    window.PrivaCTabs.show("sites");
    if (i >= 0) selectSite(i, true);
  });

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
      <div class="detail-actions"><button type="button" class="pill-btn" data-ask-pill data-ask="Why did ${esc(s.domain)} get ${an(s.grade)} ${s.grade}, and what can I do about it?">Ask C why it got ${an(s.grade)} ${s.grade}</button></div>
      <div class="detail-cols">
        <section>
          <h3>Why it got ${an(s.grade)} ${s.grade}</h3>
          <ul>${s.parts.map((p) => `<li><span>${esc(p.label)}</span><span class="end"><span class="pts ${p.points ? "" : "zero"}">+${p.points}</span>${ask(`On ${s.domain}: what does "${p.label}" mean, and why is it worth ${p.points} points?`, p.label)}</span></li>`).join("")}</ul>
        </section>
        <section>
          <h3>Tracker connections</h3>
          <ul>${s.trackers.length ? s.trackers.map((t) => `<li><span class="co">${esc(t.company)}<small>${esc(t.domain)}</small></span><span class="end"><span class="where">${esc(t.category)}${ADV[t.country] ? ` <strong>${esc(ADV[t.country])}</strong>` : ""}</span>${ask(`What does ${t.company} (${t.domain}) do on ${s.domain}, and should I worry?`, t.company)}</span></li>`).join("") : "<li><span>None on this site</span></li>"}</ul>
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
  if (sites.length) selectSite(0);
  else $("site-detail").innerHTML = `<p class="hint">Pick a site on the left once PrivaC has seen a few.</p>`;

  // ---- Grades: the key, and an Ask C button on each rule ----
  const ranges = { A: "0–20", B: "21–40", C: "41–60", D: "61–80", F: "81–100" };
  $("grades-key").innerHTML = Object.keys(ranges).map((g) =>
    `<div class="k grade-${g}"><b>${g}</b><span>${PrivaCData.GRADE_WORDS[g]}</span><span>${ranges[g]}</span></div>`).join("");
  for (const tr of document.querySelectorAll("#rubric tbody tr")) {
    const rule = tr.cells[0].textContent.trim();
    const td = document.createElement("td");
    td.className = "ask-cell";
    td.innerHTML = ask(`Explain this grading rule in plain words, with an example: "${rule}"`, "this rule");
    tr.appendChild(td);
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
