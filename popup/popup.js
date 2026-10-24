(async function () {
  const $ = (id) => document.getElementById(id);
  $("wordmark").innerHTML = PrivaCMascot.wordmark(22);

  function openDashboard(query) {
    const url = "dashboard/dashboard.html" + (typeof query === "string" ? query : "");
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    } else {
      window.open("../" + url, "_blank");
    }
  }
  $("open-dashboard-top").addEventListener("click", () => openDashboard());

  const data = await PrivaCData.load();
  if (data.sample) $("sample-note").hidden = false;

  // ?site=domain lets you preview any site's popup outside Chrome (handy for demos).
  const domain = new URLSearchParams(location.search).get("site") || (await PrivaCData.currentDomain());
  let site = domain ? data.sites.find((s) => s.domain === domain) : data.sites[0];

  if (!site) {
    $("app").innerHTML = `
      <div class="empty">
        ${PrivaCMascot.svg("wave", { size: 130 })}
        <p>I haven't checked <strong>${escapeHtml(domain || "this page")}</strong> yet.<br>Reload the page and I'll take a look.</p>
      </div>`;
    return;
  }

  const n = site.trackers.length;
  const companies = [...new Set(site.trackers.map((t) => t.company))];
  const flaggedNames = [...new Set(site.flagged.map((t) => `${t.company} (${PrivaCData.FOREIGN_ADVERSARIES[t.country]})`))];

  $("app").innerHTML = `
    <p class="site-line">You're on <strong>${escapeHtml(site.domain)}</strong></p>

    <div class="hero grade-${site.grade}">
      <div class="mascot">${PrivaCMascot.svg(PrivaCMascot.moodForGrade(site.grade), { size: 118 })}</div>
      <div>
        <div class="grade-letter" aria-label="Grade ${site.grade}">${site.grade}</div>
        <div class="grade-words">${PrivaCData.GRADE_WORDS[site.grade]}</div>
        <div class="score-line">Exposure score ${site.score} of 100</div>
        <div class="meter" aria-hidden="true"><span style="width:${site.score}%"></span></div>
      </div>
    </div>

    <div class="bubble">${bubbleText(site, companies.length)}</div>

    ${flaggedNames.length ? `
      <div class="flag" role="alert">
        <strong>Foreign-adversary link.</strong> This page contacted ${flaggedNames.join(" and ")},
        based in ${flaggedNames.length > 1 ? "countries" : "a country"} the U.S. Commerce Department lists as a foreign adversary.
      </div>` : ""}

    <section>
      <h2>Why this grade</h2>
      <ul class="reasons">
        ${site.parts.map((p) => `
          <li>
            <span>${escapeHtml(p.label)}<span class="src">${p.kind === "observed" ? "Observed on this visit" : p.kind === "breach" ? "Have I Been Pwned" : "Disclosed in privacy policy"}</span></span>
            <span class="pts ${p.points ? "" : "zero"}">+${p.points}</span>
          </li>`).join("")}
      </ul>
    </section>

    <section>
      <h2>Tracker connections (${n})</h2>
      ${n ? `<ul class="companies">
        ${site.trackers.map((t) => `
          <li class="${PrivaCData.FOREIGN_ADVERSARIES[t.country] ? "flagged" : ""}">
            <span class="name">${escapeHtml(t.company)}</span>
            <span class="dom">${escapeHtml(t.domain)}</span>
            <span class="chip">${escapeHtml(t.category)}</span>
          </li>`).join("")}
      </ul>` : `<p class="honesty">No outside companies were contacted on this page.</p>`}
    </section>

    <p class="honesty">These are connections your browser made. They show who could see your visit, not proof that your data was sold.</p>

    <div class="actions">
      <button class="btn" id="ask-site">Ask C why</button>
      <button class="btn secondary" id="open-dashboard">Open dashboard</button>
    </div>
  `;

  $("open-dashboard").addEventListener("click", () => openDashboard());
  $("ask-site").addEventListener("click", () => {
    const article = site.grade === "A" || site.grade === "F" ? "an" : "a";
    openDashboard("?ask=" + encodeURIComponent(`Why did ${site.domain} get ${article} ${site.grade}?`));
  });

  function bubbleText(s, companyCount) {
    const who = `${companyCount} outside ${companyCount === 1 ? "company" : "companies"}`;
    let first;
    if (s.grade === "A") first = companyCount ? `Looking good. Only ${who} showed up here.` : "Looking good. No outside companies showed up here.";
    else if (s.grade === "B") first = `Not bad. ${who[0].toUpperCase() + who.slice(1)} saw this visit.`;
    else if (s.grade === "C") first = `Heads up: ${who} saw this visit.`;
    else first = `Yikes. ${who[0].toUpperCase() + who.slice(1)} saw this visit.`;

    const second = s.cookieChoice === "declined" ? " You declined the extra cookies, nice."
      : s.cookieChoice === "accepted" ? " You accepted all cookies here. Clearing this site's cookies would lower your score."
      : s.cookieChoice === "no-reject" ? " This site's cookie banner had no Reject button, only Accept."
      : "";
    return first + second;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
