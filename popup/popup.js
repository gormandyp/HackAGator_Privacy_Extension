// Toolbar popup: the site you're on, most important first, with the buttons always in reach.
// Order: grade and C's verdict, alerts, why it got its grade, who saw your visit. The header and the
// button bar stay put while the middle scrolls (rarely needed). What to show comes from shared/site-summary.js.
(async function () {
  const $ = (id) => document.getElementById(id);
  const I = window.PrivaCIcons;
  const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const an = (g) => (g === "A" || g === "F" ? "an" : "a");

  $("wordmark").innerHTML = PrivaCMascot.wordmark(20);
  $("open-dashboard-top").innerHTML = I.icon("grid", 18);
  $("open-settings").innerHTML = I.icon("gear", 18);

  function openDashboard(query) {
    const url = "dashboard/dashboard.html" + (typeof query === "string" ? query : "");
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    } else {
      window.open("../" + url, "_blank");
    }
  }
  $("open-dashboard-top").addEventListener("click", () => openDashboard());
  $("open-dashboard").addEventListener("click", () => openDashboard());
  $("open-settings").addEventListener("click", () => openDashboard("?settings"));

  const data = await PrivaCData.load();
  // ?site=domain previews any site's popup outside Chrome (handy for demos).
  const preview = new URLSearchParams(location.search).get("site");
  const inExtension = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  // Inside the real extension, never show a sample site as if it were the page you're on.
  const useSample = data.sample && (!inExtension || preview);
  if (useSample) $("sample-note").hidden = false;
  const sites = data.sample && !useSample ? [] : data.sites;

  const domain = preview || (await PrivaCData.currentDomain());
  // In Chrome, no domain means the tab isn't showing a website (the new-tab page, Chrome's settings): never show
  // another site as if it were this one. Outside Chrome (a design preview), the first site stands in.
  const noWebsite = inExtension && !domain;
  const site = domain ? sites.find((s) => s.domain === domain) : noWebsite ? null : sites[0];

  if (!site) {
    $("app").innerHTML = noWebsite ? `
      <section class="card glass empty">
        <div class="c-art">${PrivaCMascot.svg("wave", { size: 104 })}</div>
        <h1>There's no website in this tab for me to grade.</h1>
        <p>Open a website and I'll check it.</p>
      </section>` : `
      <section class="card glass empty">
        <div class="c-art">${PrivaCMascot.svg("wave", { size: 104 })}</div>
        <h1>I haven't checked ${esc(domain || "this page")} yet.</h1>
        <p>Reload the page and I'll take a look. Grades show up a moment after a page loads.</p>
      </section>`;
    return;
  }

  const s = PrivaCSiteSummary.summarize(site);
  const tone = { good: "check", info: "list", warn: "alert" };
  const SOURCE_CHIP = { "Have I Been Pwned": "Have I Been Pwned", "Disclosed in privacy policy": "Privacy policy" };
  const SHOW_COMPANIES = 8;

  $("app").innerHTML = `
    <section class="card glass site grade-${s.grade}">
      <div class="site-top">
        <span class="badge big" aria-label="Grade ${s.grade}">${s.grade}</span>
        <div class="site-id">
          <h1>${esc(s.domain)}</h1>
          <p>${esc(s.words)}</p>
        </div>
        <div class="c-art" aria-hidden="true">${PrivaCMascot.svg(PrivaCMascot.moodForGrade(s.grade), { size: 66 })}</div>
      </div>
      <div class="score-row">
        <div class="meter" aria-hidden="true"><span style="width:${s.score}%"></span></div>
        <span class="score"><b>${s.score}</b> of 100</span>
      </div>
      <p class="verdict">${esc(s.headline)}</p>
      ${s.trackerCount ? `
        <div class="who-line"><span>${s.companyCount} ${s.companyCount === 1 ? "company" : "companies"} · ${s.trackerCount} ${s.trackerCount === 1 ? "tracker" : "trackers"}</span></div>
        <div class="purpose-bar" role="img" aria-label="${esc(s.purposes.map((p) => `${p.label} ${p.n}`).join(", "))}">
          ${s.purposes.map((p) => `<i class="p-${p.key}" style="flex-grow:${p.n}"></i>`).join("")}
        </div>
        <div class="legend">${s.purposes.map((p) => `<span class="p-${p.key}"><i class="p-dot"></i>${esc(p.label)} <b>${p.n}</b></span>`).join("")}</div>` : ""}
    </section>

    ${s.alerts.length ? `
    <section class="card alerts" role="alert">
      <ul>${s.alerts.map((a) => `
        <li class="alert-${a.kind}">
          ${I.tile(a.kind === "breach" ? "breach" : a.kind === "state-media" ? "news" : a.kind === "server" ? "server" : "globe", a.kind === "breach" ? "pink" : "red", "sm")}
          <div><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></div>
        </li>`).join("")}</ul>
    </section>` : ""}

    <section class="card glass why grade-${s.grade}">
      <div class="card-top">
        <div class="head-title">${I.tile("list", "grade", "sm")}<h2>Why it got ${an(s.grade)} ${s.grade}</h2></div>
        <span class="muted">From your visits in the last 7 days</span>
      </div>
      ${s.reasons.length ? `<ul class="reasons">${s.reasons.map((r) => `
        <li><span class="r-label">${esc(r.label)}${SOURCE_CHIP[r.source] ? ` <em class="src-chip">${SOURCE_CHIP[r.source]}</em>` : ""}</span><span class="pts">+${r.points}</span></li>`).join("")}</ul>`
        : `<p class="calm">Nothing here added points.</p>`}
      ${s.checks.length ? `<ul class="checks">${s.checks.map((c) => `<li class="chk-${c.tone}">${I.icon(tone[c.tone], 13)}<span>${esc(c.label)}</span></li>`).join("")}</ul>` : ""}
    </section>

    <section class="card glass who">
      <div class="card-top">
        <div class="head-title">${I.tile("radar", "blue", "sm")}<h2>Who saw your visit</h2></div>
        <span class="muted">Colored by what they do</span>
      </div>
      ${s.trackerCount ? `
        <div class="companies">
          ${s.companies.slice(0, SHOW_COMPANIES).map((c) => `<span class="co p-${c.purpose.key}${c.flagged ? " flagged" : ""}" title="${esc(c.name)}: ${esc(c.purpose.label)}${c.flagged ? `, based in ${esc(c.country || "a listed country")}` : ""}"><i class="p-dot"></i>${esc(c.name)}${c.flagged ? `<small>${esc(c.country || "Listed")}</small>` : ""}</span>`).join("")}
          ${s.companies.length > SHOW_COMPANIES ? `<span class="co more">+${s.companies.length - SHOW_COMPANIES} more</span>` : ""}
        </div>`
        : `<p class="calm">${I.icon("check", 14)} No outside companies showed up on your visits here this week.</p>`}
      <p class="honesty">Connections your browser made: who could see your visit, not proof your data was sold.</p>
    </section>`;

  const ask = $("ask-site");
  ask.innerHTML = `${I.icon("c", 16)}<span>Ask C why it got ${an(s.grade)} ${s.grade}</span>`;
  ask.hidden = false;
  ask.addEventListener("click", () => openDashboard("?ask=" + encodeURIComponent(`Why did ${s.domain} get ${an(s.grade)} ${s.grade}?`)));
})().finally(() => {
  // The rounded panel on a website (popup/panel-mode.js) waits for this before it appears.
  document.dispatchEvent(new Event("privac-popup-ready"));
});
