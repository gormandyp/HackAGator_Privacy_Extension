// Toolbar popup: the site you're on, most important first, with the buttons always in reach.
// Order: grade and C's verdict, alerts, why it got its grade, who saw your visit. The header and the
// button bar stay put while the middle scrolls (rarely needed). What to show comes from shared/site-summary.js.
(async function () {
  const $ = (id) => document.getElementById(id);
  const I = window.PrivaCIcons;
  const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Long site names may only wrap after a dot ("openencyclopedia." / "example"), never in the middle of a word.
  const breakable = (d) => esc(d).replace(/\./g, ".<wbr>");
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

  // The privacy policy is read in the background and can take a minute, so its answer often arrives after the
  // pop-up has drawn. Redraw when this site's selling/sharing answers are saved (the first ones come before the read
  // is done), when it's marked read, and when C starts or stops reading it ("Reading the privacy policy" and its dot).
  function redrawWhenPolicyRead(site, reading) {
    if (!(chrome.storage && chrome.storage.onChanged)) return;
    const said = (p) => [p.checkedAt || null, typeof p.sells === "boolean" ? p.sells : null, typeof p.shares === "boolean" ? p.shares : null].join();
    const before = said(site.policy || {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "session" && changes.privacPolicyReading) {
        const on = !!(changes.privacPolicyReading.newValue || {})[site.domain];
        if (on !== reading) location.reload();
        return;
      }
      const data = area === "local" && changes.privacData && changes.privacData.newValue;
      const now = data && Array.isArray(data.sites) && data.sites.find((x) => x.domain === site.domain);
      if (now && now.policy && said(now.policy) !== before) location.reload();
    });
  }
  const reading = inExtension && !preview ? await PrivaCData.readingPolicies() : {};
  if (inExtension && !preview) redrawWhenPolicyRead(site, !!reading[site.domain]);

  const s = PrivaCSiteSummary.summarize(site, { reading: !!reading[site.domain] });
  const tone = { good: "check", info: "list", warn: "alert" };
  const SOURCE_CHIP = { "Have I Been Pwned": "Have I Been Pwned", "Disclosed in privacy policy": "Privacy policy" };
  const SHOW_COMPANIES = 8;

  $("app").innerHTML = `
    <section class="card glass site grade-${s.grade}">
      <div class="site-top">
        <span class="badge big" aria-label="Grade ${s.grade}">${s.grade}</span>
        <div class="site-id">
          <h1 class="${s.domain.length > 20 ? "long" : ""}">${breakable(s.domain)}</h1>
          <p>${esc(s.words)}</p>
        </div>
        <div class="c-art" aria-hidden="true">${PrivaCMascot.svg(PrivaCMascot.moodForGrade(s.grade), { size: 66 })}</div>
      </div>
      <div class="score-row">
        <div class="meter" aria-hidden="true"><span style="width:${s.score}%"></span></div>
        <span class="score"><b>${s.score}</b> of 100</span>
      </div>
      <p class="checked ${s.checked.full ? "full" : "part"}">${I.icon(s.checked.full ? "check" : "alert", 13)}<span><b>${s.checked.label}</b> · ${s.checked.reading ? `<span class="reading-now"><i class="progress-dot" aria-hidden="true"></i>${s.checked.status}</span>` : `${s.checked.coverage}% of the grade checked`}. ${esc(s.checked.note)}</span></p>
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
    </section>

    ${inExtension ? `
    <section class="card glass clear">
      <div class="card-top"><div class="head-title">${I.tile("trash", "gray", "sm")}<h2>Clear this site's data</h2></div></div>
      <ul class="clear-list">
        <li class="chk-good">${I.icon(tone.good, 13)}<span>Chrome forgets ${esc(s.domain)}'s own cookies, saved data and cache, so the site can't link your next visit to earlier ones.</span></li>
        <li class="chk-warn">${I.icon(tone.warn, 13)}<span>Other companies' tracking cookies aren't removed: Chrome's "Block third-party cookies" setting stops those.</span></li>
        <li class="chk-info">${I.icon(tone.info, 13)}<span>It also signs you out of ${esc(s.domain)}. Your history and passwords stay.</span></li>
      </ul>
      <button type="button" class="btn-quiet clear-btn" id="clear-site">Clear ${esc(s.domain)}'s data</button>
      <p class="clear-done" id="clear-done" role="status" hidden></p>
    </section>` : ""}`;

  // What the pop-up says once Chrome is done. On real sites the card looked the same after clearing, so it seemed to
  // do nothing; and on reload the site sets new cookies, which looked like clearing had failed (Mac check, Oct 25).
  function clearedNote(domain, cookies) {
    const what = cookies > 0 ? `${cookies} cookie${cookies === 1 ? "" : "s"} and ${domain}'s saved data`
      : cookies === 0 ? `${domain}'s saved data (it had no cookies)` : `${domain}'s cookies and saved data`;
    return `Removed ${what}. Reload the page to start fresh; the site will set new cookies as it loads. ` +
      "Clearing doesn't change the grade: it's about what the site loads on your visits.";
  }

  // Clear this site's data: the first tap asks, the second clears (background/clear-site.js).
  const clear = $("clear-site");
  if (clear) {
    let armed = false;
    clear.addEventListener("click", async () => {
      if (!armed) { armed = true; clear.textContent = "Tap again to clear"; clear.classList.add("armed"); return; }
      clear.disabled = true;
      clear.textContent = "Clearing…";
      let r = null;
      try { r = await chrome.runtime.sendMessage({ type: "privac-clear-site", domain: s.domain }); } catch (e) { r = null; }
      clear.classList.remove("armed");
      if (r && r.ok) {
        clear.classList.add("done");
        clear.innerHTML = `${I.icon("check", 15)}<span>Cleared</span>`;
        const done = $("clear-done");
        done.textContent = clearedNote(s.domain, typeof r.cookies === "number" ? r.cookies : null);
        done.hidden = false;
        done.scrollIntoView({ block: "nearest" });
      } else {
        clear.textContent = "Couldn't clear it. Try again.";
        armed = false;
        clear.disabled = false;
      }
    });
  }

  const ask = $("ask-site");
  ask.innerHTML = `${I.icon("c", 16)}<span>Ask C why it got ${an(s.grade)} ${s.grade}</span>`;
  ask.hidden = false;
  ask.addEventListener("click", () => openDashboard("?ask=" + encodeURIComponent(`Why did ${s.domain} get ${an(s.grade)} ${s.grade}?`)));
})().finally(() => {
  // The rounded panel on a website (popup/panel-mode.js) waits for this before it appears.
  document.dispatchEvent(new Event("privac-popup-ready"));
});
