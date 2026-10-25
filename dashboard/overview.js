// Overview: everything summarized. Headline, average exposure, the standout facts (shared/highlights.js),
// this week from C's impact and Safety, what trackers were for, foreign-adversary links, and who
// followed you across sites. Each piece links to the tab with the details; every row has Ask C.
(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ask = (q, about) => (window.PrivaCExplain ? PrivaCExplain.button(q, about) : "");
  const ADV = PrivaCData.FOREIGN_ADVERSARIES;
  const H = PrivaCHighlights;
  const I = window.PrivaCIcons || { tile: () => "", icon: () => "" };
  const PS = window.PrivaCSiteSummary;
  const purposeKey = (label) => (PS ? PS.purposeOf(label).key : "other");
  // A company that does several things is colored by the most invasive one (same order as the popup).
  const SEV = ["malware", "risk", "record", "broker", "ads", "social", "measure", "hidden", "other"];
  const mainPurpose = (cats) => { const keys = [...cats].map(purposeKey); return SEV.find((k) => keys.includes(k)) || "other"; };
  const head = (tile, title, sub, extra) =>
    `<div class="card-head"><div class="head-title">${tile}<div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>${extra || ""}</div>`;

  const data = await PrivaCData.load();
  const sites = [...data.sites].sort((a, b) => b.score - a.score);
  const agg = H.aggregate(sites);
  const stats = window.PrivaCActivity ? await window.PrivaCActivity.ready : null;
  const week = stats ? PrivaCStats.summary(stats, "week") : null;
  const declines = week ? (week.totals.events["decline-confirmed"] || week.totals.events["decline-click"] || 0) : 0;

  // ---- Headline ----
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  sites.forEach((s) => counts[s.grade]++);
  const flaggedSites = sites.filter((s) => s.flagged.length || s.ownerFlag || s.addressFlag || s.serverFlag);
  const mood = agg.avgGrade === "D" || agg.avgGrade === "F" || flaggedSites.length ? "uneasy" : "wave";
  $("intro").innerHTML = `
    <div class="hero-c">${PrivaCMascot.svg(mood, { size: 92 })}</div>
    <div class="hero-text">
      <h1>${agg.companyCount} ${agg.companyCount === 1 ? "company" : "companies"} saw your browsing across ${sites.length} ${sites.length === 1 ? "site" : "sites"} this week.</h1>
      <p>${flaggedSites.length
        ? `${flaggedSites.length === 1 ? "One site" : flaggedSites.length + " sites"} also connected to a company or server in a listed foreign-adversary country.`
        : "None of them connected to a company in a listed foreign-adversary country."}</p>
      <div class="grade-strip" aria-label="Sites by grade">
        ${Object.entries(counts).map(([g, n]) => `<button type="button" class="g grade-${g} ${n ? "" : "none"}" data-grade="${g}" aria-label="${n} ${n === 1 ? "site" : "sites"} graded ${g}"><b>${g}</b><span>${n} ${n === 1 ? "site" : "sites"}</span></button>`).join("")}
      </div>
    </div>`;

  // ---- Average exposure ring ----
  const R = 46, CIRC = 2 * Math.PI * R;
  const worst = sites[0];
  $("exposure").innerHTML = sites.length ? `
    <div class="gauge grade-${agg.avgGrade}">
      <svg viewBox="0 0 112 112" width="112" height="112" aria-hidden="true">
        <defs><linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="ring-a"/><stop offset="1" class="ring-b"/></linearGradient></defs>
        <circle cx="56" cy="56" r="${R}" class="track"/>
        <circle cx="56" cy="56" r="${R}" class="arc" style="--len:${(agg.avgScore / 100) * CIRC}px; --circ:${CIRC}px"/>
      </svg>
      <div class="gauge-center"><b>${agg.avgGrade}</b><span>${agg.avgScore}</span></div>
    </div>
    <div class="gauge-text">
      <h2>Average exposure</h2>
      <p>Across your ${sites.length} ${sites.length === 1 ? "site" : "sites"} this week, out of 100.</p>
      ${worst ? `<button type="button" class="link-row" data-site="${esc(worst.domain)}"><span class="badge small grade-${worst.grade}">${worst.grade}</span><span>Riskiest: <strong>${esc(worst.domain)}</strong></span></button>` : ""}
    </div>` : `<p class="hint">Browse a few sites with PrivaC on and your average shows up here.</p>`;

  // ---- Worth knowing ----
  const ICON = {
    alert: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M10 5.3v5.6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="14.3" r="1.3" fill="#fff"/></svg>`,
    warn: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M8.3 2.9a2 2 0 0 1 3.4 0l6.6 11.6a2 2 0 0 1-1.7 3H3.4a2 2 0 0 1-1.7-3L8.3 2.9Z" fill="currentColor"/><path d="M10 7.2v4.4" stroke="#4a3500" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.4" r="1.15" fill="#4a3500"/></svg>`,
    info: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><circle cx="10" cy="6.2" r="1.25" fill="#fff"/><path d="M10 9.2v5.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    good: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="m6.2 10.3 2.5 2.5 5-5.3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  const list = H.facts(sites, { declines });
  $("facts").innerHTML = `
    ${head(I.tile("bulb", "yellow"), "Worth knowing", "")}
    ${list.length ? `<ul class="facts">${list.map((f) => `
      <li class="fact tone-${f.tone}">
        <span class="fact-icon">${ICON[f.tone]}</span>
        <div class="fact-text">${f.site ? `<button type="button" class="fact-title" data-site="${esc(f.site)}"${f.company ? ` data-company="${esc((f.companies || [f.company]).join("|"))}"` : ""}>${esc(f.title)}</button>` : `<b class="fact-title">${esc(f.title)}</b>`}<span>${esc(f.detail)}</span></div>
        ${ask(f.ask, f.title)}
      </li>`).join("")}</ul>` : `<p class="hint">Nothing stands out yet. Browse with PrivaC on and the strongest findings show up here.</p>`}`;

  // ---- This week (from C's impact and Safety) ----
  const spark = (vals, cls) => {
    const max = Math.max(1, ...vals.map((v) => (Array.isArray(v) ? v[0] + v[1] : v)));
    return `<span class="spark" aria-hidden="true">${vals.map((v) => {
      const [a, b] = Array.isArray(v) ? v : [v, 0];
      return `<i style="height:${((a + b) / max) * 100}%">${b ? `<em class="s-base" style="flex-grow:${b}"></em>` : ""}${a ? `<em class="${cls}" style="flex-grow:${a}"></em>` : ""}</i>`;
    }).join("")}</span>`;
  };
  if (week) {
    const t = week.totals;
    const risky = (t.grades.D || 0) + (t.grades.F || 0);
    $("week").innerHTML = `
      ${head(I.tile("calendar", "indigo"), "This week")}
      <button type="button" class="mini" data-tab="impact">
        <span class="mini-top"><span class="mini-label">${I.tile("c", "c", "sm")}C stepped in</span><span class="chev" aria-hidden="true"></span></span>
        <b>${t.popups.toLocaleString()}<small> ${t.popups === 1 ? "time" : "times"}</small></b>
        ${spark(week.days.map((d) => d.popups), "s-c")}
      </button>
      <button type="button" class="mini" data-tab="safety">
        <span class="mini-top"><span class="mini-label">${I.tile("alert", "red", "sm")}Risky site visits</span><span class="chev" aria-hidden="true"></span></span>
        <b>${risky.toLocaleString()}<small> of ${(t.sites || 0).toLocaleString()}</small></b>
        ${spark(week.days.map((d) => { const s = d.snapshot || { sites: 0, grades: {} }; const r = (s.grades.D || 0) + (s.grades.F || 0); return [r, Math.max(0, (s.sites || 0) - r)]; }), "s-risk")}
      </button>
      <button type="button" class="mini" data-tab="safety">
        <span class="mini-top"><span class="mini-label">${I.tile("radar", "blue", "sm")}Trackers seen</span><span class="chev" aria-hidden="true"></span></span>
        <b>${(t.trackers || 0).toLocaleString()}<small> ${(t.adTrackers || 0).toLocaleString()} for ads</small></b>
        ${spark(week.days.map((d) => (d.snapshot && d.snapshot.trackers) || 0), "s-trackers")}
      </button>
      <button type="button" class="mini" data-tab="safety">
        <span class="mini-top"><span class="mini-label">${I.tile("cookie", "orange", "sm")}Tracking cookies</span><span class="chev" aria-hidden="true"></span></span>
        <b>${(t.trackingCookies || 0).toLocaleString()}<small> of ${(t.cookies || 0).toLocaleString()}</small></b>
        ${spark(week.days.map((d) => (d.snapshot && d.snapshot.trackingCookies) || 0), "s-cookies")}
      </button>`;
  } else $("week").hidden = true;

  // ---- What the trackers were for ----
  const pmax = Math.max(1, ...agg.purposes.map((p) => p.n));
  $("purposes").innerHTML = `
    ${head(I.tile("eye", "purple"), "What the trackers were for", `${agg.trackerCount} tracker ${agg.trackerCount === 1 ? "address" : "addresses"} from ${agg.companyCount} ${agg.companyCount === 1 ? "company" : "companies"}.`)}
    ${agg.purposes.length ? `<ul class="meter-list">${agg.purposes.slice(0, 6).map((p) => `<li class="p-${purposeKey(p.label)}"><span class="lbl"><i class="p-dot"></i>${esc(p.label)}</span><span class="bar"><i style="--w:${(p.n / pmax) * 100}%"></i></span><b>${p.n}</b>${ask(`What do trackers used for "${p.label.toLowerCase()}" do with what they see?`, p.label)}</li>`).join("")}</ul>`
      : `<p class="hint">No outside trackers seen this week.</p>`}`;

  // ---- Cookies (shown on the Safety tab since the home page was lightened) ----
  let ck = { total: agg.cookies, tracking: agg.trackingCookies, from: "sites" };
  if (!ck.total && week && week.totals.cookies) ck = { total: week.totals.cookies, tracking: week.totals.trackingCookies || 0, from: "week" };
  $("cookies-card").innerHTML = `
    ${head(I.tile("cookie", "orange"), "Cookies your sites kept", "Names only. PrivaC never reads what's inside a cookie.", ask("Which of my cookies track me, and how do I clear them?", "your cookies"))}
    ${ck.total ? `<p class="big-stat"><b>${ck.tracking.toLocaleString()}</b> of ${ck.total.toLocaleString()} track you</p>
      <div class="prop" role="img" aria-label="${ck.tracking} tracking cookies out of ${ck.total}"><i class="s-cookies" style="flex-grow:${ck.tracking}"></i><i class="s-base" style="flex-grow:${Math.max(0, ck.total - ck.tracking)}"></i></div>
      <div class="legend"><span><i class="sw s-cookies"></i>Advertising or measuring you</span><span><i class="sw s-base"></i>Needed or settings</span></div>
      ${agg.topCookies.length ? `<h3 class="sub-title">Seen on the most sites</h3><ul class="kv tight">${agg.topCookies.map((c) => `<li><span class="cookie-name">${esc(c.name)}</span><span class="end"><span class="muted">${c.sites} ${c.sites === 1 ? "site" : "sites"}</span>${ask(`What is the ${c.name} cookie, who sets it, and what does it track?`, c.name)}</span></li>`).join("")}</ul>` : ""}`
      : `<p class="hint">PrivaC lists cookies a few seconds after each page loads. None recorded yet.</p>`}`;

  // ---- Foreign-adversary links ----
  $("countries").innerHTML = `
    ${head(I.tile("globe", "red"), "Foreign-adversary links", "Countries on the U.S. Commerce Department's list (15 CFR 7.4).")}
    ${agg.countries.length ? `<p class="big-stat"><b>${flaggedSites.length}</b> of ${sites.length} ${sites.length === 1 ? "site" : "sites"} had a link</p>
      <div class="prop" role="img" aria-label="${flaggedSites.length} of ${sites.length} sites had a foreign-adversary link"><i class="s-risk" style="flex-grow:${flaggedSites.length}"></i><i class="s-base" style="flex-grow:${Math.max(0, sites.length - flaggedSites.length)}"></i></div>
      <ul class="kv">${agg.countries.map((c) => `<li><span><b class="cname">${esc(c.name)}</b><small>${esc(c.companies.length ? c.companies.join(", ") : "Web address or server")}</small></span><span class="end"><span class="muted">${c.sites.length} ${c.sites.length === 1 ? "site" : "sites"}</span>${ask(`What did companies from ${c.name} see on my sites, and should I worry?`, c.name)}</span></li>`).join("")}</ul>`
      : `<p class="calm">${ICON.good}<span>None this week.</span></p>`}`;

  // ---- Who followed you across sites ----
  // Company names stay in their own column; only the site columns scroll, so nothing ever slides over a name.
  const LIMIT_SITES = 6, LIMIT_COS = 5;
  let allSites = false, allCos = false;
  function renderFollow() {
    const cols = allSites ? sites : sites.slice(0, LIMIT_SITES);
    const rows = allCos ? agg.companies : agg.companies.slice(0, LIMIT_COS);
    const more = [];
    if (sites.length > LIMIT_SITES) more.push(`<button type="button" class="pill-btn" data-more="sites">${allSites ? "Fewer sites" : `All ${sites.length} sites`}</button>`);
    if (agg.companies.length > LIMIT_COS) more.push(`<button type="button" class="pill-btn" data-more="cos">${allCos ? "Fewer companies" : `All ${agg.companies.length} companies`}</button>`);
    const shown = [...new Set(rows.filter((c) => !(ADV[c.country] || c.listed)).map((c) => mainPurpose(c.categories)))];
    const keysInOrder = (PS ? PS.PURPOSES.map((p) => p.key) : SEV).filter((k) => shown.includes(k));
    const legend = rows.length ? `<div class="legend follow-legend">${keysInOrder.map((k) => `<span class="p-${k}"><i class="p-dot"></i>${esc(PS ? PS.purposeOf(k).label : k)}</span>`).join("")}${rows.some((c) => ADV[c.country] || c.listed) ? `<span class="p-flag"><i class="p-dot"></i>Foreign adversary</span>` : ""}</div>` : "";
    $("follow").innerHTML = `
      ${head(I.tile("people", "teal"), "Who followed you across sites", "The more of your sites a company is on, the more of your browsing it can connect.", more.length ? `<div class="head-actions">${more.join("")}</div>` : "")}
      ${legend}
      ${rows.length ? `<div class="follow">
        ${rows[0] && rows[0].sites.size > 1 ? `<div class="band band-top" style="--r:0" aria-hidden="true"></div>` : ""}
        <div class="band band-hover" aria-hidden="true"></div>
        <div class="rules" style="--rows:${rows.length}" aria-hidden="true"></div>
        <div class="follow-names">
          <div class="fh"></div>
          ${rows.map((c, i) => `<div class="fr ${i === 0 && c.sites.size > 1 ? "top" : ""} ${ADV[c.country] || c.listed ? "flagged" : ""}" data-row="${i}"><b>${esc(c.name)}</b><small>${esc([...c.categories].join(", "))}</small>${ADV[c.country] || c.listed ? `<span class="flag-chip">Foreign adversary</span>` : ""}</div>`).join("")}
        </div>
        <div class="follow-scroll">
          <div class="follow-grid" style="--cols:${cols.length}">
            ${cols.map((s) => `<div class="fh col-head grade-${s.grade}" title="${esc(s.domain)} (grade ${s.grade})"><span class="mini-grade">${s.grade}</span><span class="col-name">${esc(s.domain.replace(/^www\./, ""))}</span></div>`).join("")}
            ${rows.map((c, i) => cols.map((s) => `<div class="fr cell ${i === 0 && c.sites.size > 1 ? "top" : ""} ${ADV[c.country] || c.listed ? "flagged" : ""}" data-row="${i}">${c.sites.has(s.domain) ? `<span class="dot p-${mainPurpose(c.categories)}" title="${esc(c.name)} on ${esc(s.domain)}"></span>` : `<span class="no-dot" aria-hidden="true"></span>`}</div>`).join("")).join("")}
          </div>
        </div>
        <div class="follow-end">
          <div class="fh"><span>Sites</span></div>
          ${rows.map((c, i) => `<div class="fr ${i === 0 && c.sites.size > 1 ? "top" : ""}" data-row="${i}"><span class="reach">${c.sites.size} of ${sites.length}</span>${ask(`Who is ${c.name}, and what does it do with what it sees on ${[...c.sites].slice(0, 3).join(", ")}?`, c.name)}</div>`).join("")}
        </div>
      </div>` : `<p class="hint">No outside companies yet. Browse with PrivaC on and they'll show up here.</p>`}`;
    const scroller = $("follow").querySelector(".follow-scroll");
    if (scroller) {
      const edges = () => {
        const max = scroller.scrollWidth - scroller.clientWidth;
        scroller.classList.toggle("fade-l", scroller.scrollLeft > 2);
        scroller.classList.toggle("fade-r", scroller.scrollLeft < max - 2);
      };
      scroller.addEventListener("scroll", edges, { passive: true });
      new ResizeObserver(edges).observe(scroller);
      edges();
    }
  }
  renderFollow();
  $("follow").addEventListener("click", (e) => {
    const b = e.target.closest("[data-more]");
    if (!b) return;
    if (b.dataset.more === "sites") allSites = !allSites; else allCos = !allCos;
    renderFollow();
  });
  // Row highlights and row lines sit behind all three parts (names, dots, counts), so they stay whole while
  // the dots scroll and fade at the edges. Hovering a row moves the hover band there.
  $("follow").addEventListener("pointerover", (e) => {
    const r = e.target.closest("[data-row]");
    const band = $("follow").querySelector(".band-hover");
    if (!band) return;
    if (r) { band.style.setProperty("--r", r.dataset.row); band.classList.add("on"); } else band.classList.remove("on");
    $("follow").querySelectorAll(".follow-end .fr").forEach((x) => x.classList.toggle("hot", !!r && x.dataset.row === r.dataset.row));
  });
  $("follow").addEventListener("pointerleave", () => {
    const b = $("follow").querySelector(".band-hover"); if (b) b.classList.remove("on");
    $("follow").querySelectorAll(".follow-end .fr.hot").forEach((x) => x.classList.remove("hot"));
  });

  // ---- Links into the other tabs ----
  $("panel-overview").addEventListener("click", (e) => {
    const g = e.target.closest("[data-grade]");
    const s = e.target.closest("[data-site]");
    const t = e.target.closest("[data-tab]");
    if (!window.PrivaCTabs) return;
    if (g) { const first = sites.find((x) => x.grade === g.dataset.grade); PrivaCTabs.show("sites"); if (first && window.PrivaCSites) PrivaCSites.select(first.domain); }
    else if (s) { PrivaCTabs.show("sites"); if (window.PrivaCSites) PrivaCSites.select(s.dataset.site, s.dataset.company); }
    else if (t) PrivaCTabs.show(t.dataset.tab);
  });
})();
