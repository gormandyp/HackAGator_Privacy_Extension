// "C's impact" and "Safety" tabs, drawn from the daily totals in privacStats (shared/stats.js).
// Numbers only, never site names. Opened outside Chrome (or before any browsing) they use clearly
// labelled sample totals, like the rest of the dashboard.
(function () {
  const $ = (id) => document.getElementById(id);
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
  const niceMax = (v) => { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; };

  // Column chart. series: [{ key, label, cls }], drawn bottom-up as a stack. Each column has a hover/focus tooltip.
  function columns(days, series, opts = {}) {
    const totals = days.map((d) => series.reduce((s, x) => s + (d.values[x.key] || 0), 0));
    const max = niceMax(Math.max(1, ...totals));
    const ticks = [max, max / 2, 0];
    const labelEvery = days.length > 10 ? 5 : 1;
    return `
      <div class="chart" role="img" aria-label="${esc(opts.label || "")}">
        <div class="chart-y">${ticks.map((t) => `<span>${t}</span>`).join("")}</div>
        <div class="chart-plot">
          ${ticks.map((t, i) => `<i class="grid" style="bottom:${(i === 0 ? 100 : i === 1 ? 50 : 0)}%"></i>`).join("")}
          <div class="cols" style="--n:${days.length}">
            ${days.map((d, i) => {
              const tip = `<b>${esc(i === days.length - 1 ? "Today" : shortDate(d.day))}</b>` +
                series.map((x) => `<span><i class="sw ${x.cls}"></i>${esc(x.label)}<em>${d.values[x.key] || 0}</em></span>`).join("");
              return `<button type="button" class="col" data-tip="${esc(tip)}" aria-label="${esc(shortDate(d.day))}: ${series.map((x) => `${d.values[x.key] || 0} ${x.label}`).join(", ")}">
                <span class="stack" style="height:${(totals[i] / max) * 100}%">
                  ${series.map((x) => d.values[x.key] ? `<span class="seg ${x.cls}" style="flex-grow:${d.values[x.key]}"></span>` : "").reverse().join("")}
                </span>
                <span class="x">${i % labelEvery === (days.length - 1) % labelEvery ? esc(days.length <= 7 ? weekday(d.day) : shortDate(d.day)) : ""}</span>
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
    const kinds = [
      { key: "popup-cookie", label: "Offers to decline cookies", cls: "s-c" },
      { key: "popup-accept-only", label: "\"Beware\" warnings about banners with no way to say no", cls: "s-c" },
      { key: "popup-adversary", label: "Foreign-adversary alerts", cls: "s-c" }
    ];
    const most = Math.max(1, ...kinds.map((k) => n(k.key)));
    const responses = [
      ["Declined the extras with C", n("decline-click")],
      ["…and C confirmed the site accepted it", n("decline-confirmed")],
      ["Opened the site's own cookie choices", n("choose-click")],
      ["Said no on the site yourself", n("rejected-on-site")],
      ["Accepted all cookies yourself", n("accepted-on-site")]
    ];
    const days = sum.days.map((d) => ({ day: d.day, values: { popups: d.popups } }));
    $("impact").innerHTML = `
      <div class="activity-grid">
        <div class="card glass">
          <h2 class="lead">C stepped in ${plural(sum.totals.popups, "time", "times")} ${RANGE_WORDS[range.impact]}.</h2>
          <ul class="share-list">
            ${kinds.map((k) => `<li><span>${esc(k.label)}</span><b>${n(k.key)}</b><i class="share" style="--w:${(n(k.key) / most) * 100}%"></i></li>`).join("")}
          </ul>
          ${range.impact === "day" ? `<p class="hint">Pick 7 or 30 days to see how this changes day by day.</p>`
            : `<h3 class="chart-title">C's pop-ups per day</h3>${columns(days, [{ key: "popups", label: "pop-ups", cls: "s-c" }], { label: `C's pop-ups per day ${RANGE_WORDS[range.impact]}` })}
               ${numbersTable(sum.days, [{ label: "Pop-ups", get: (d) => d.popups }, { label: "Declines with C", get: (d) => d.events["decline-click"] || 0 }])}`}
        </div>
        <div class="card glass">
          <h2>What you did next</h2>
          <ul class="kv">
            ${responses.map(([label, v], i) => `<li class="${i === 1 ? "sub" : ""}"><span>${esc(label)}</span><b>${v}</b></li>`).join("")}
          </ul>
          <p class="hint">Counts every time, not every site: saying no to the same site twice counts twice.</p>
        </div>
      </div>`;
  }

  // ---------- Safety over time ----------
  function renderSafety() {
    const sum = PrivaCStats.summary(stats, range.safety);
    const t = sum.totals;
    const risky = (t.grades.D || 0) + (t.grades.F || 0);
    const visits = t.sites || 0;
    const days = sum.days.map((d) => {
      const s = d.snapshot || { sites: 0, grades: {} };
      const r = (s.grades.D || 0) + (s.grades.F || 0);
      return { day: d.day, values: { risky: r, other: Math.max(0, (s.sites || 0) - r) } };
    });
    const tiles = [
      ["Foreign-adversary links", t.flaggedSites || 0, "site visits"],
      ["Sites with a data breach", t.breachedSites || 0, "site visits"],
      ["Trackers seen", t.trackers || 0, `${t.adTrackers || 0} for advertising`],
      ["Tracking cookies", t.trackingCookies || 0, `of ${(t.cookies || 0).toLocaleString()} cookies`]
    ];
    const choices = [
      ["Declined the extras", t.declined || 0], ["Accepted all", t.accepted || 0],
      ["Banner had no way to say no", t.noReject || 0], ["Tracked you without asking", t.neverAsked || 0]
    ];
    const choiceMax = Math.max(1, ...choices.map((c) => c[1]));
    $("safety").innerHTML = `
      <div class="card glass">
        <h2 class="lead">${visits ? `${plural(risky, "of your site visits was", "of your site visits were")} risky (graded D or F) ${RANGE_WORDS[range.safety]}, out of ${plural(visits, "visit", "visits")}.`
          : `No browsing recorded ${RANGE_WORDS[range.safety]} yet.`}</h2>
        <div class="grade-mix" aria-label="Site visits by grade">
          ${["A", "B", "C", "D", "F"].map((g) => `<span class="g grade-${g} ${t.grades[g] ? "" : "none"}"><b>${g}</b><span>${t.grades[g] || 0}</span></span>`).join("")}
        </div>
        ${range.safety === "day" ? `<p class="hint">Pick 7 or 30 days to see how this changes day by day.</p>`
          : `<h3 class="chart-title">Site visits per day</h3>${columns(days, [{ key: "risky", label: "Risky (D or F)", cls: "s-risk" }, { key: "other", label: "A to C", cls: "s-base" }], { label: `Site visits per day ${RANGE_WORDS[range.safety]}, risky versus the rest` })}
             ${numbersTable(sum.days, [{ label: "Site visits", get: (d) => (d.snapshot && d.snapshot.sites) || 0 }, { label: "Risky (D or F)", get: (d) => d.snapshot ? (d.snapshot.grades.D || 0) + (d.snapshot.grades.F || 0) : 0 }])}`}
      </div>
      <div class="activity-grid">
        <div class="card glass">
          <h2>What showed up</h2>
          <div class="tiles">${tiles.map(([label, v, note]) => `<div><span>${esc(label)}</span><b>${v.toLocaleString()}</b><small>${esc(note)}</small></div>`).join("")}</div>
        </div>
        <div class="card glass">
          <h2>Cookie choices</h2>
          <ul class="share-list">${choices.map(([label, v]) => `<li><span>${esc(label)}</span><b>${v}</b><i class="share" style="--w:${(v / choiceMax) * 100}%"></i></li>`).join("")}</ul>
        </div>
      </div>
      <p class="hint">A site visit is one site on one day. Visiting the same site on three days counts three times.</p>`;
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

  (async () => {
    const data = await PrivaCData.load();
    stats = await loadStats(data.sample);
    renderImpact();
    renderSafety();
  })();

  window.PrivaCActivity = { setRange, sampleStats };
})();
