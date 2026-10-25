// The grade box (IDEA.md, Max): a few seconds after a site opens, a small box in the top right shows its PrivaC
// grade, so you don't have to click the toolbar button. Once per site per day; it closes by itself after
// 8 seconds (not while the mouse is on it), has an x, and clicking it opens PrivaC's full panel.
// After you decline or accept on a cookie banner, the same box explains what that choice means (IDEA.md).
// Settings > "Show the grade box" turns both off. Remembers only site names and days, never addresses.
(function () {
  if (window.top !== window || window.PrivaCGradeChip) return;

  const WORDS = { A: "Low exposure", B: "Some exposure", C: "Moderate exposure", D: "High exposure", F: "Very high exposure" };
  const COLORS = { A: "#15803d", B: "#4d7c0f", C: "#a16207", D: "#c2410c", F: "#b91c1c" };   // shared/theme.css solids
  const DELAY = 4000;    // ms after the page loads: trackers are counted as the page loads, so the grade settles first
  const SHOW = 8000;     // ms on screen
  const KEEP_DAYS = 7;   // days of "already shown" remembered

  const domainOf = (host) => String(host || "").replace(/^www\./, "");

  // What to show for this site, or null (no grade yet, turned off, or already shown today).
  // site = { grade, score } from the background: the same numbers the popup shows.
  function pick(store, domain, today, site) {
    if (((store && store.privacSettings) || {}).gradeChip === false) return null;
    if (((store && store.privacChipSeen) || {})[domain] === today) return null;
    if (!site || !WORDS[site.grade]) return null;
    const chip = { domain, grade: site.grade, score: site.score, word: WORDS[site.grade] };
    if (site.range && site.range.max > site.score) chip.max = site.range.max;   // part of the grade is still unknown
    return chip;
  }

  // The "shown today" list with this site added and days older than a week dropped.
  function remember(seen, domain, today) {
    const cutoff = new Date(Date.parse(today) - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    const out = {};
    for (const [d, day] of Object.entries(seen || {})) if (day >= cutoff && d !== domain) out[d] = day;
    out[domain] = today;
    return out;
  }

  // What a cookie choice means for this visit (content/c-events.js calls explain() when it records one).
  const MEANING = {
    declined: { title: "You declined extra cookies", icon: "✓", color: "#15803d",
      text: "This site agreed not to store ad or tracking cookies for this visit. Trackers can still load, and PrivaC " +
        "still counts them. The 10 cookie points come off this site's grade." },
    accepted: { title: "You accepted all cookies", icon: "!", color: "#c2410c",
      text: "Ad and measurement companies here may now store cookies that follow you to other sites. This adds 10 points " +
        "to the site's grade. To undo it, open PrivaC and use \"Clear this site's data\"." }
  };
  function meaning(store, choice) {
    if (((store && store.privacSettings) || {}).gradeChip === false) return null;
    return MEANING[choice] || null;
  }

  const CSS = `
    .chip { position: fixed; top: 12px; right: 12px; display: flex; align-items: center; gap: 10px; box-sizing: border-box;
      max-width: calc(100vw - 24px); padding: 8px 8px 8px 9px; border-radius: 18px; cursor: pointer;
      font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
      color: #16233f; background: rgba(245, 246, 248, .78);
      -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
      box-shadow: 0 0 0 .5px rgba(0, 0, 0, .14), 0 10px 30px -10px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .7);
      opacity: 0; transform: translateY(-6px) scale(.97); transform-origin: 100% 0;
      transition: opacity 180ms ease-out, transform 260ms cubic-bezier(.2, .9, .3, 1.04); }
    .chip.shown { opacity: 1; transform: none; }
    .badge { flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
      color: #fff; font-size: 18px; font-weight: 700; background: var(--g); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .25); }
    .text { display: grid; min-width: 0; }
    .word { font-weight: 650; white-space: nowrap; }
    .site { color: #4e586d; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chip.note { align-items: flex-start; width: 340px; }
    .chip.note .site { white-space: normal; font-size: 12px; line-height: 1.4; margin-top: 2px; }
    .x { flex: none; width: 24px; height: 24px; border: 0; border-radius: 50%; padding: 0; cursor: pointer;
      background: rgba(22, 35, 63, .07); color: #4e586d; font: 600 14px/24px system-ui, sans-serif; }
    .x:hover { background: rgba(22, 35, 63, .13); }
    @media (prefers-color-scheme: dark) {
      .chip { color: #eef1f6; background: rgba(24, 27, 36, .78); box-shadow: 0 0 0 .5px rgba(0, 0, 0, .5), 0 10px 30px -10px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .1); }
      .site { color: #aab3c3; } .x { background: rgba(255, 255, 255, .1); color: #aab3c3; }
    }
    @media (prefers-reduced-motion: reduce) { .chip { transform: none; transition: opacity 120ms linear; } }`;

  // Draws the box: a colored badge, a bold line, a small line, and an x. Clicking it opens PrivaC's panel.
  function show({ badge: letter, color, title, line, label, note = false, time = SHOW }) {
    const host = document.createElement("privac-grade");
    host.style.cssText = "all: initial !important; position: fixed !important; top: 0 !important; right: 0 !important; z-index: 2147483646 !important;";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    const box = document.createElement("div");
    box.className = note ? "chip note" : "chip";
    box.setAttribute("role", "button");
    box.setAttribute("tabindex", "0");
    box.setAttribute("aria-label", label);
    box.style.setProperty("--g", color);
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = letter;
    const text = document.createElement("span");
    text.className = "text";
    const word = document.createElement("span");
    word.className = "word";
    word.textContent = title;
    const site = document.createElement("span");
    site.className = "site";
    site.textContent = line;
    text.append(word, site);
    const x = document.createElement("button");
    x.className = "x";
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    box.append(badge, text, x);
    root.append(style, box);
    for (const old of document.querySelectorAll("privac-grade")) old.remove();   // one box at a time
    document.documentElement.appendChild(host);

    let timer = 0;
    const close = () => { clearTimeout(timer); box.classList.remove("shown"); setTimeout(() => host.remove(), 300); };
    const later = () => { clearTimeout(timer); timer = setTimeout(close, time); };
    x.addEventListener("click", (e) => { e.stopPropagation(); close(); });
    box.addEventListener("click", () => {
      close();
      try { chrome.runtime.sendMessage({ type: "privac-open-panel" }).catch(() => {}); } catch (e) { /* PrivaC was reloaded */ }
    });
    box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); box.click(); } if (e.key === "Escape") close(); });
    box.addEventListener("mouseenter", () => clearTimeout(timer));
    box.addEventListener("mouseleave", later);
    requestAnimationFrame(() => box.classList.add("shown"));
    later();
  }

  const lineFor = (chip) => `PrivaC · ${chip.domain} · ${chip.score} of 100${chip.max ? `, could be up to ${chip.max}` : ""}`;
  const showGrade = (chip) => show({ badge: chip.grade, color: COLORS[chip.grade], title: chip.word,
    line: lineFor(chip), label: `PrivaC grade ${chip.grade} for ${chip.domain}: ${chip.word}. Open PrivaC.` });

  // Not on top of C: calls then(true) once his pop-up is gone (checked every 0.4 s), or then(false) after maxMs.
  function afterC(then, maxMs) {
    let waited = 0;
    const check = () => {
      if (!document.querySelector("privac-prompt")) return then(true);
      if (waited >= maxMs) return then(false);
      waited += 400;
      setTimeout(check, 400);
    };
    check();
  }

  // After a cookie choice: waits for C's own answer ("Nice!") to finish first, then explains. Once per page.
  const explained = new Set();
  let noteComing = false;   // a note is on its way, so the grade box stands aside instead of flashing first
  async function explain(choice) {
    if (explained.has(choice) || !/^https?:$/.test(location.protocol)) return;
    explained.add(choice);
    try {
      const n = meaning(await chrome.storage.local.get("privacSettings"), choice);
      if (!n) return;
      noteComing = true;
      const draw = () => show({ badge: n.icon, color: n.color, title: n.title, line: n.text, note: true, time: 12000,
        label: `${n.title}. ${n.text} Open PrivaC.` });
      // Not on top of C: wait (up to 8 s) for his pop-up to go away.
      setTimeout(() => afterC(draw, 8000), choice === "declined" ? 3200 : 800);
    } catch (e) { /* PrivaC was reloaded */ }
  }

  async function run() {
    if (!/^https?:$/.test(location.protocol)) return;
    const domain = domainOf(location.hostname);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const store = await chrome.storage.local.get(["privacSettings", "privacChipSeen"]);
      if (!pick(store, domain, today, { grade: "A" })) return;   // turned off or shown today: don't ask the background
      const chip = pick(store, domain, today, await chrome.runtime.sendMessage({ type: "privac-site-grade", domain }));
      if (!chip) return;
      // C's cookie pop-up can sit in the top right too (zara.com/us): wait up to a minute for it to go away, and
      // skip the box if it doesn't (it then shows on the next visit, as it wasn't marked seen).
      afterC(async (gone) => {
        if (!gone || noteComing) return;
        try { await chrome.storage.local.set({ privacChipSeen: remember(store.privacChipSeen, domain, today) }); } catch (e) { return; }
        showGrade(chip);
      }, 60000);
    } catch (e) { /* PrivaC was reloaded or storage isn't there: no box */ }
  }

  window.PrivaCGradeChip = { pick, remember, meaning, explain, lineFor, afterC, noteComing: () => noteComing };
  const start = () => setTimeout(run, DELAY);
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
})();
