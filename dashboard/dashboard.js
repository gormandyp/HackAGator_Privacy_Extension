(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ADV = PrivaCData.FOREIGN_ADVERSARIES;

  $("wordmark").innerHTML = PrivaCMascot.wordmark(26);

  const data = await PrivaCData.load();
  if (data.sample) $("sample-note").hidden = false;
  const sites = [...data.sites].sort((a, b) => b.score - a.score);

  // ---- Companies across sites ----
  const companyMap = new Map(); // company -> { sites:Set, categories:Set, country }
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

  // ---- Intro ----
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  sites.forEach((s) => counts[s.grade]++);
  const worst = sites[0];
  const flaggedSites = sites.filter((s) => s.flagged.length);

  $("intro").innerHTML = `
    <div>${PrivaCMascot.svg(worst && (worst.grade === "D" || worst.grade === "F") ? "uneasy" : "wave", { size: 150 })}</div>
    <div>
      <h1>${companies.length} companies saw your browsing across ${sites.length} sites.</h1>
      <p>${flaggedSites.length
        ? `${flaggedSites.length === 1 ? "One site" : flaggedSites.length + " sites"} also connected to a company based in a listed foreign-adversary country.`
        : "None of them connected to a company in a listed foreign-adversary country."}
        Here's who showed up where, and why each site got its grade.</p>
      <div class="grade-strip">
        ${Object.entries(counts).map(([g, n]) => `<span class="g grade-${g} ${n ? "" : "none"}"><b>${g}</b>${n} ${n === 1 ? "site" : "sites"}</span>`).join("")}
      </div>
    </div>`;

  // ---- Matrix ----
  const siteCols = sites.map((s) => s.domain);
  $("matrix").innerHTML = `
    <thead><tr>
      <th></th>
      ${sites.map((s) => `<th scope="col"><span class="site-head grade-${s.grade}"><span class="mini-grade">${s.grade}</span>${esc(s.domain.replace(/\.example$/, ""))}</span></th>`).join("")}
      <th scope="col" style="text-align:right">Sites</th>
    </tr></thead>
    <tbody>
      ${companies.map((c, i) => `
        <tr class="${ADV[c.country] ? "flagged" : ""} ${i === 0 && c.sites.size > 1 ? "top-row" : ""}">
          <th scope="row">${esc(c.name)} <button type="button" class="ask-link" data-q="Who is ${esc(c.name)} and should I worry?" aria-label="Ask C about ${esc(c.name)}">Ask C</button><small>${esc([...c.categories].join(", "))}</small></th>
          ${siteCols.map((d) => `<td>${c.sites.has(d) ? `<span class="dot" title="${esc(c.name)} on ${esc(d)}"></span>` : `<span class="no-dot" aria-hidden="true"></span>`}</td>`).join("")}
          <td class="reach">${c.sites.size} of ${sites.length}</td>
        </tr>`).join("")}
    </tbody>`;

  $("matrix").addEventListener("click", (e) => {
    const b = e.target.closest(".ask-link");
    if (b && window.PrivaCAsk) window.PrivaCAsk.ask(b.dataset.q);
  });

  const top = companies[0];
  if (top && top.sites.size > 1) {
    $("callout").innerHTML = `${PrivaCMascot.svg("uneasy", { body: false, size: 40 })}
      <span><strong>${esc(top.name)}</strong> showed up on ${top.sites.size} of your ${sites.length} sites, more than any other company.</span>`;
  } else {
    $("callout").hidden = true;
  }

  // ---- Site list ----
  $("sites").innerHTML = sites.map((s) => {
    const uniq = new Set(s.trackers.map((t) => t.company)).size;
    const when = new Date(s.lastVisit).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
    const cookie = s.cookieChoice === "declined" ? "cookies declined" : s.cookieChoice === "accepted" ? "cookies accepted" : "no cookie choice";
    return `
    <details class="site grade-${s.grade}">
      <summary>
        <span class="badge" aria-label="Grade ${s.grade}">${s.grade}</span>
        <span>
          <span class="dom">${esc(s.domain)}</span>
          <span class="meta">${uniq} ${uniq === 1 ? "company" : "companies"}, ${cookie}, last visit ${esc(when)}${s.flagged.length ? `<span class="warn">, foreign-adversary link</span>` : ""}</span>
        </span>
        <span class="score-col">
          <div class="bar-label">${s.score} of 100</div>
          <div class="bar"><span style="width:${s.score}%"></span></div>
        </span>
        <span class="caret" aria-hidden="true"></span>
      </summary>
      <div class="detail">
        <div>
          <h3>Why it got ${s.grade === "A" || s.grade === "F" ? "an" : "a"} ${s.grade}</h3>
          <ul>${s.parts.map((p) => `<li><span>${esc(p.label)}</span><span class="pts ${p.points ? "" : "zero"}">+${p.points}</span></li>`).join("")}</ul>
        </div>
        <div>
          <h3>Tracker connections</h3>
          <ul>${s.trackers.length ? s.trackers.map((t) => `<li><span>${esc(t.company)} <span style="color:var(--ink-3)">${esc(t.domain)}</span></span><span>${esc(t.category)}${ADV[t.country] ? ` <strong style="color:var(--flag)">${esc(ADV[t.country])}</strong>` : ""}</span></li>`).join("") : "<li>None on this site</li>"}</ul>
        </div>
      </div>
    </details>`;
  }).join("");

  // ---- Grades key ----
  const ranges = { A: "0–20", B: "21–40", C: "41–60", D: "61–80", F: "81–100" };
  $("grades-key").innerHTML = Object.keys(ranges).map((g) =>
    `<div class="k grade-${g}"><b>${g}</b><span>${PrivaCData.GRADE_WORDS[g]}</span><span>${ranges[g]}</span></div>`).join("");

  // ---- Clear data ----
  $("clear").addEventListener("click", async () => {
    if (!confirm("Delete everything PrivaC has recorded in this browser? This can't be undone.")) return;
    await PrivaCData.clearAll();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = "PrivaC data cleared";
    document.body.appendChild(t);
    setTimeout(() => location.reload(), 1200);
  });
})();
