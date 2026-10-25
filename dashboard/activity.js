// "C's impact" and "Safety" tabs, drawn from the daily totals in privacStats (shared/stats.js).
// Numbers only, never site names. Opened outside Chrome (or before any browsing) they use clearly
// labelled sample totals, like the rest of the dashboard.
(function () {
  const $ = (id) => document.getElementById(id);
  const tile = (g, c, size) => (window.PrivaCIcons ? PrivaCIcons.tile(g, c, size) : "");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RANGE_WORDS = { day: "today", week: "in the last 7 days", month: "in the last 30 days" };
  const range = { impact: "week", safety: "week" };
  let stats = null;

  // Sample totals for previews: 30 days, steady but uneven, so both charts have something to show.
  function sampleStats(now = Date.now()) {
    let seed = 7;
    const rnd = (n) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * n); };
    const days = {};
    for (let i = 0; i < 30; i++) {
      const key = PrivaCStats.dayKey(now - i * 86400000);
      const sites = 3 + rnd(9);
      const risky = Math.min(sites, rnd(3));
      const f = Math.min(risky, rnd(2));
      days[key] = {
        events: { "popup-cookie": 1 + rnd(5), "popup-accept-only": rnd(3), "popup-adversary": rnd(10) > 7 ? 1 : 0,
                  "decline-click": rnd(4), "decline-confirmed": rnd(3), "choose-click": rnd(2), "rejected-on-site": rnd(2), "accepted-on-site": rnd(2) },
        snapshot: { sites, grades: { A: sites - risky - 2 > 0 ? sites - risky - 2 : 0, B: 1, C: 1, D: risky - f, F: f }, unsafeSites: f,
                    flaggedSites: rnd(10) > 7 ? 1 : 0, breachedSites: rnd(3) ? 0 : 1, trackers: sites * (2 + rnd(5)), adTrackers: sites + rnd(6),
                    cookies: sites * (3 + rnd(6)), trackingCookies: sites * (1 + rnd(3)), declined: rnd(4), accepted: rnd(3), noReject: rnd(2), neverAsked: rnd(5) }
      };
    }
    return { days };
  }

  async function loadStats(sample) {
    if (!sample && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try { return (await chrome.storage.local.get("privacStats")).privacStats || { days: {} }; } catch (e) { /* fall through */ }
    }
    return sampleStats();
  }

  const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  const weekday = (key) => new Date(key + "T12:00:00").toLocaleDateString([], { weekday: "short" });
  const shortDate = (key) => new Date(key + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
  // Axis top: twice a "nice" whole step, so the middle tick is a whole number too (2, 4, 6, 8, 10, 20, 40, 60...).
  const niceMax = (v) => {
    const half = Math.max(1, v / 2);
    const p = Math.pow(10, Math.floor(Math.log10(half)));
    const step = [1, 2, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= half);
    return step * 2;
  };
  const ask = (q, about) => (window.PrivaCExplain ? PrivaCExplain.button(q, about) : "");

  // Column chart. series: [{ key, label, cls }], drawn bottom-up as a stack. Each column has a hover/focus tooltip.
  // A column is one day ({ day, values }), or names itself with { x, title, aria, cls } (Today's grade columns).
  function columns(days, series, opts = {}) {
    const totals = days.map((d) => series.reduce((s, x) => s + (d.values[x.key] || 0), 0));
    const max = niceMax(Math.max(1, ...totals));
    const ticks = [max, max / 2, 0];
    const labelEvery = days.length > 10 ? 5 : 1;
    return `
      <div class="chart" role="img" aria-label="${esc(opts.label || "")}">
        <div class="chart-y">${ticks.map((t) => `<span>${t}</span>`).join("")}</div>
        <div class="chart-plot">
          ${ticks.map((t, i) => `<i class="grid" style="bottom:${i === 0 ? 100 : i === 1 ? 50 : 0}%"></i>`).join("")}
          <div class="cols" style="--n:${days.length}">
            ${days.map((d, i) => {
              const tip = `<b>${esc(d.title || (i === days.length - 1 ? "Today" : shortDate(d.day)))}</b>` +
                series.map((x) => `<span><i class="sw ${x.cls}"></i>${esc(x.label)}<em>${d.values[x.key] || 0}</em></span>`).join("");
              const aria = d.aria || `${shortDate(d.day)}: ${series.map((x) => `${d.values[x.key] || 0} ${x.label}`).join(", ")}`;
              return `<button type="button" class="col${d.cls ? " " + d.cls : ""}" data-tip="${esc(tip)}" aria-label="${esc(aria)}">
                <span class="stack" style="height:${(totals[i] / max) * 100}%">
                  ${series.map((x) => d.values[x.key] ? `<span class="seg ${x.cls}" style="flex-grow:${d.values[x.key]}"></span>` : "").reverse().join("")}
                </span>
                <span class="x">${esc(d.x || (i % labelEvery === (days.length - 1) % labelEvery ? (days.length <= 7 ? weekday(d.day) : shortDate(d.day)) : ""))}</span>
              </button>`;
            }).join("")}
          </div>
        </div>
      </div>
      ${series.length > 1 ? `<div class="legend">${series.map((x) => `<span><i class="sw ${x.cls}"></i>${esc(x.label)}</span>`).join("")}</div>` : ""}`;
  }

  function numbersTable(days, cols) {
    return `<details class="numbers"><summary>Show the numbers</summary>
      <table><thead><tr><th>Day</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>${days.slice().reverse().map((d) => `<tr><td>${esc(shortDate(d.day))}</td>${cols.map((c) => `<td>${c.get(d)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    </details>`;
  }

  // ---------- C's impact ----------
  function renderImpact() {
    const sum = PrivaCStats.summary(stats, range.impact);
    const ev = sum.totals.events;
    const n = (k) => ev[k] || 0;
    const when = RANGE_WORDS[range.impact];
    const kinds = [
      { key: "popup-cookie", icon: ["cookie", "orange"], label: "Offers to decline cookies", q: "What does C's offer to decline cookies do, and what happens when I say yes?" },
      { key: "popup-accept-only", icon: ["alert", "yellow"], label: "Warnings about banners with no Reject", q: "Why does C warn me about cookie banners that only have an Accept button?" },
      { key: "popup-adversary", icon: ["globe", "red"], label: "Foreign-adversary alerts", q: "What is a foreign-adversary alert, and what should I do when C shows one?" },
      { key: "popup-unsafe", icon: ["shield", "red"], label: "Unsafe-site warnings", q: "Why does C warn me before I stay on some sites graded F?" }
    ];
    const most = Math.max(1, ...kinds.map((k) => n(k.key)));
    const responses = [
      ["Protected by C (\"Protect me\" or automatic)", n("decline-click"), "What changes when C declines the extra cookies for me?"],
      ["C confirmed the site accepted it", n("decline-confirmed"), "How does C check that a site really accepted my 'decline'?", "sub"],
      ["Opened the site's own cookie choices", n("choose-click"), "What should I switch off when I open a site's own cookie choices?"],
      ["Said no on the site yourself", n("rejected-on-site"), "Is clicking Reject on a cookie banner as good as letting C decline?"],
      ["Accepted all cookies yourself", n("accepted-on-site"), "What happens to my data when I accept all cookies?"]
    ];
    const days = sum.days.map((d) => ({ day: d.day, values: { popups: d.popups } }));
    $("impact").innerHTML = `
      <div class="bento">
        <div class="card glass">
          <div class="lead-row">${tile("c", "c", "lg")}<h2 class="lead">C stepped in ${plural(sum.totals.popups, "time", "times")} ${when}.</h2></div>
          <ul class="meter-list">
            ${kinds.map((k) => `<li><span class="lbl">${tile(k.icon[0], k.icon[1], "sm")}${esc(k.label)}</span><span class="bar"><i class="c" style="--w:${(n(k.key) / most) * 100}%"></i></span><b>${n(k.key)}</b>${ask(k.q, k.label)}</li>`).join("")}
          </ul>
          ${range.impact === "day" ? `<p class="hint">Pick 7 or 30 days to see how this changes day by day.</p>`
            : `<h3 class="chart-title">C's pop-ups per day</h3>${columns(days, [{ key: "popups", label: "pop-ups", cls: "s-c" }], { label: `C's pop-ups per day ${when}` })}
               ${numbersTable(sum.days, [{ label: "Pop-ups", get: (d) => d.popups }, { label: "Declines with C", get: (d) => d.events["decline-click"] || 0 }])}`}
        </div>
        <div class="card glass">
          <div class="head-title">${tile("check", "green")}<h2>What you did next</h2></div>
          <ul class="kv">
            ${responses.map(([label, v, q, cls]) => `<li class="${cls || ""}"><span>${esc(label)}</span><span class="end"><b>${v}</b>${ask(q, label)}</span></li>`).join("")}
          </ul>
          <p class="hint">Counted every time, not once per site.</p>
        </div>
      </div>`;
  }

  // ---------- Safety over time ----------
  function renderSafety() {
    const sum = PrivaCStats.summary(stats, range.safety);
    const t = sum.totals;
    const when = RANGE_WORDS[range.safety];
    const risky = (t.grades.D || 0) + (t.grades.F || 0);
    const visits = t.sites || 0;
    const days = sum.days.map((d) => {
      const s = d.snapshot || { sites: 0, grades: {} };
      const r = (s.grades.D || 0) + (s.grades.F || 0);
      return { day: d.day, values: { risky: r, other: Math.max(0, (s.sites || 0) - r) } };
    });
    const tiles = [
      ["Foreign-adversary links", t.flaggedSites || 0, "site visits", "What does a foreign-adversary link on a site mean for me?", ["globe", "red"]],
      ["Sites with a data breach", t.breachedSites || 0, "site visits", "What should I do after visiting a site that had a data breach?", ["breach", "pink"]],
      ["Trackers seen", t.trackers || 0, `${(t.adTrackers || 0).toLocaleString()} for advertising`, "What do the trackers on the sites I visit collect?", ["radar", "blue"]],
      ["Tracking cookies", t.trackingCookies || 0, `of ${(t.cookies || 0).toLocaleString()} cookies`, "What's the difference between a tracking cookie and one a site needs?", ["cookie", "orange"]]
    ];
    // Status colors, always beside the label: good (declined) to critical (tracked without asking).
    const choices = [
      ["Declined the extras", t.declined || 0, "What does declining the extra cookies change?", "st-good"],
      ["Accepted all", t.accepted || 0, "What happens to my data when I accept all cookies?", "st-warn"],
      ["Banner had no Reject", t.noReject || 0, "Why do some cookie banners have no Reject button, and is that allowed?", "st-serious"],
      ["Tracked you without asking", t.neverAsked || 0, "How can a site track me without showing a cookie banner?", "st-critical"]
    ];
    const choiceMax = Math.max(1, ...choices.map((c) => c[1]));
    // Today has one day, so it gets one column per grade instead of one column per day.
    const byGrade = ["A", "B", "C", "D", "F"].map((g) => {
      const n = t.grades[g] || 0;
      return { x: g, title: `Graded ${g}`, aria: `Graded ${g}: ${plural(n, "site visit", "site visits")}`, cls: `grade-${g}`, values: { visits: n } };
    });
    $("safety").innerHTML = `
      <div class="bento">
        <div class="card glass">
          ${visits ? `<div class="lead-row">${tile("shield", "blue", "lg")}<h2 class="lead">${risky.toLocaleString()} of ${plural(visits, "site visit", "site visits")} ${risky === 1 ? "was" : "were"} risky ${when}.</h2></div>
            <p class="sub">Risky means graded D or F. A site visit is one site on one day.</p>`
            : `<h2 class="lead">No browsing recorded ${when} yet.</h2>`}
          <div class="grade-mix" aria-label="Site visits by grade">
            ${["A", "B", "C", "D", "F"].map((g) => `<span class="g grade-${g} ${t.grades[g] ? "" : "none"}"><b>${g}</b><span>${t.grades[g] || 0}</span></span>`).join("")}
          </div>
          ${range.safety === "day" ? `<h3 class="chart-title">Today's site visits by grade</h3>${columns(byGrade, [{ key: "visits", label: "site visits", cls: "s-grade" }], { label: "Today's site visits by grade" })}
               <p class="hint">Pick 7 or 30 days to see how this changes day by day.</p>`
            : `<h3 class="chart-title">Site visits per day</h3>${columns(days, [{ key: "risky", label: "Risky (D or F)", cls: "s-risk" }, { key: "other", label: "A to C", cls: "s-safe" }], { label: `Site visits per day ${when}, risky versus the rest` })}
               ${numbersTable(sum.days, [{ label: "Site visits", get: (d) => (d.snapshot && d.snapshot.sites) || 0 }, { label: "Risky (D or F)", get: (d) => d.snapshot ? (d.snapshot.grades.D || 0) + (d.snapshot.grades.F || 0) : 0 }])}`}
        </div>
        <div class="col-stack">
          <div class="card glass">
            <div class="head-title">${tile("list", "purple")}<h2>What showed up</h2></div>
            <div class="tiles">${tiles.map(([label, v, note, q, ic]) => `<div><span class="tile-top"><span class="lbl">${tile(ic[0], ic[1], "sm")}${esc(label)}</span>${ask(q, label)}</span><b>${v.toLocaleString()}</b><small>${esc(note)}</small></div>`).join("")}</div>
          </div>
          <div class="card glass">
            <div class="head-title">${tile("cookie", "orange")}<h2>Cookie choices</h2></div>
            <ul class="meter-list">${choices.map(([label, v, q, st]) => `<li class="${st}"><span class="lbl"><i class="p-dot"></i>${esc(label)}</span><span class="bar"><i style="--w:${(v / choiceMax) * 100}%"></i></span><b>${v}</b>${ask(q, label)}</li>`).join("")}</ul>
          </div>
        </div>
      </div>`;
  }

  // ---------- Chart tooltip (hover and keyboard focus) ----------
  const tip = $("chart-tip");
  function showTip(col) {
    tip.innerHTML = col.dataset.tip;
    tip.hidden = false;
    const r = col.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)) + "px";
    tip.style.top = (r.top + window.scrollY - tip.offsetHeight - 8) + "px";
  }
  document.addEventListener("pointerover", (e) => { const c = e.target.closest && e.target.closest(".col"); if (c) showTip(c); });
  document.addEventListener("pointerout", (e) => { if (e.target.closest && e.target.closest(".col")) tip.hidden = true; });
  document.addEventListener("focusin", (e) => { const c = e.target.closest && e.target.closest(".col"); if (c) showTip(c); else tip.hidden = true; });

  function setRange(which, r) {
    range[which] = r;
    if (stats) (which === "impact" ? renderImpact : renderSafety)();
  }

  // Overview reads the same totals (its "This week" card), so share them once they're loaded.
  const ready = (async () => {
    const data = await PrivaCData.load();
    stats = await loadStats(data.sample);
    renderImpact();
    renderSafety();
    return stats;
  })();

  window.PrivaCActivity = { setRange, sampleStats, ready };
})();
