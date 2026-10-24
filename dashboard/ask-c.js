/*
  Ask C — the chat panel on the dashboard.

  HOW IT TALKS TO THE AI (contract with the background script):

    chrome.runtime.sendMessage({ type: "askC", question: "Who is LiveRamp?" })
      → resolves to {
          answer: "LiveRamp is a registered data broker. [CA Broker Registry] ...",
          trace:  [ { tool: "lookup_company", label: "Tracker Radar" }, ... ],   // label optional
          error:  "optional message if something went wrong"
        }

  Source tags in the answer, written exactly like this, turn into colored labels:
    [Seen on your visit]  [Tracker Radar]  [CA Broker Registry]  [HIBP]  [RegTrack]  [Privacy policy]

  If there is no background script, or Gemma can't be reached, the suggested
  questions fall back to the SAMPLE answers below (labeled as samples), so the
  demo never dead-ends.

  The popup can open the dashboard with a question already asked:
    dashboard/dashboard.html?ask=Why%20did%20news.example%20get%20a%20D%3F
*/
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SOURCES = {
    "Seen on your visit": "seen",
    "Tracker Radar": "radar",
    "CA Broker Registry": "broker",
    "HIBP": "hibp",
    "RegTrack": "regtrack",
    "Privacy policy": "policy",
    "Government list": "gov",
    "Cookie Database": "cookie"
  };

  // What each tool is called in the "C checked" line.
  const TOOL_LABELS = {
    get_site_report: "Your browsing",
    where_seen: "Your browsing",
    lookup_company: "Company records",
    find_companies: "Company records",
    regtrack_compare: "RegTrack"
  };

  const SUGGESTED = [
    "Who is LiveRamp and should I worry?",
    "Which data brokers have seen me?",
    "Why did flightdeals get an F?",
    "What is this site collecting about me?"
  ];

  // Suggested questions built from the person's own browsing (falls back to SUGGESTED on sample data).
  function suggestionsFor(data) {
    const sites = (data && !data.sample && data.sites) || [];
    if (!sites.length) return SUGGESTED.slice();
    const out = [];
    const add = (q) => { if (q && !out.includes(q) && out.length < 4) out.push(q); };
    const article = (g) => (g === "A" || g === "F" ? "an" : "a");

    // 1. The riskiest site (only if it isn't already an A).
    const risky = [...sites].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    if (risky && risky.grade && risky.grade !== "A") add(`Why did ${risky.domain} get ${article(risky.grade)} ${risky.grade}?`);

    // 2. The tracker company seen on the most sites.
    const count = {};
    for (const s of sites) for (const c of new Set((s.trackers || []).map((t) => t.company).filter(Boolean))) count[c] = (count[c] || 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    if (top) add(`Who is ${top[0]} and should I worry?`);

    // 3. A site with a known data breach.
    const breached = sites.find((s) => s.breach);
    if (breached) add(`Was ${breached.domain} hacked?`);

    // 4. Data brokers, else what the riskiest site collects.
    if (sites.some((s) => (s.trackers || []).some((t) => t.broker))) add("Which data brokers have seen me?");
    const withCookies = [...sites].sort((a, b) => (b.score || 0) - (a.score || 0)).find((s) => s.cookies && s.cookies.length);
    if (withCookies) add(`What is ${withCookies.domain} collecting about me?`);
    add("Which sites I visited are the riskiest?");
    add("Should I accept cookies?");
    return out;
  }

  // ---------- Sample answers (used only when the real AI isn't connected) ----------
  const SAMPLE = {
    "who is liveramp and should i worry?": {
      trace: [{ label: "Your browsing" }, { label: "Tracker Radar" }, { label: "CA Broker Registry" }, { label: "HIBP" }],
      answer: "LiveRamp's tracker loaded on 3 of your 6 sites: dailynews, weathernow and flightdeals. [Seen on your visit] It's an advertising company whose business is matching people across websites and apps. [Tracker Radar] It is registered as a data broker in California. [CA Broker Registry] No breaches are on record. [HIBP] Seeing its tracker doesn't prove your data was sold, but it's in the business of connecting visits like these. What you can do: decline extra cookies on those 3 sites, and if you live in California, use DROP to ask every registered broker to delete your data."
    },
    "which data brokers have seen me?": {
      trace: [{ label: "Your browsing" }, { label: "CA Broker Registry" }],
      answer: "One registered data broker showed up in your browsing: LiveRamp, on 3 of your 6 sites. [Seen on your visit] [CA Broker Registry] The other companies are mostly advertisers and analytics firms. They also collect data, but they aren't registered as brokers. [Tracker Radar] What you can do: open each of those 3 sites and decline extra cookies."
    },
    "why did flightdeals get an f?": {
      trace: [{ label: "Your browsing" }, { label: "Company records" }],
      answer: "flightdeals hit the maximum exposure score, 100 out of 100. It contacted 8 tracker companies, more than any other site you visited. [Seen on your visit] Two of them, Yandex and Baidu, are based in Russia and China, which are on the U.S. foreign-adversary list. [Tracker Radar] You accepted all cookies there, and its policy says it sells personal information. [Seen on your visit] [Privacy policy] What you can do: clear that site's cookies and decline extras next time."
    }
  };
  const SAMPLE_FALLBACK = {
    trace: [{ label: "Your browsing" }],
    answer: "I can only answer that once my AI is connected. Right now I'm showing sample answers. Try one of the suggested questions below."
  };

  // Same question, ignoring case, extra spaces and the ".example" on demo domains.
  function normalize(q) {
    return String(q || "").toLowerCase().replace(/\.example\b/g, "").replace(/\s+/g, " ").trim();
  }
  function sampleFor(question) {
    const key = normalize(question);
    return (key && SAMPLE[key]) || null;
  }

  function questionFromUrl(search) {
    return (new URLSearchParams(search || "").get("ask") || "").trim();
  }

  // ---------- Talking to the background script ----------
  function hasRuntime() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage;
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }

  async function askBackground(question) {
    if (hasRuntime()) {
      try {
        const res = await withTimeout(chrome.runtime.sendMessage({ type: "askC", question }), 90000);
        if (res && (res.answer || res.error)) return { ...res, sample: false };
      } catch (e) {
        if (e && e.message === "timeout") return { error: "I took too long to answer. Try a shorter question.", sample: false };
        // "Receiving end does not exist" = no background script yet → fall through to samples.
      }
    }
    await new Promise((r) => setTimeout(r, 1400)); // feel like real checking
    return { ...(sampleFor(question) || SAMPLE_FALLBACK), sample: true };
  }

  // ---------- Rendering ----------
  function renderAnswer(text) {
    let html = esc(text);
    html = html.replace(/\[([^\]]+)\]/g, (m, name) => {
      const key = SOURCES[name.trim()];
      return key ? `<span class="src src-${key}">${esc(name.trim())}</span>` : m;
    });
    return html;
  }

  function traceLabels(trace) {
    const seen = new Set();
    return (trace || [])
      .map((t) => t.label || TOOL_LABELS[t.tool] || t.tool || "Records")
      .filter((l) => (seen.has(l) ? false : seen.add(l)));
  }

  function addMessage(html, who) {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.innerHTML = html;
    $("ask-thread").appendChild(el);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return el;
  }

  function setMood(mood) {
    $("ask-c-face").innerHTML = PrivaCMascot.svg(mood, { size: 110 });
  }

  let busy = false;

  async function ask(question) {
    question = (question || "").trim();
    if (!question || busy) return;
    busy = true;
    $("ask-send").disabled = true;
    $("ask-input").value = "";
    $("ask-empty").hidden = true;

    addMessage(esc(question), "you");
    const pending = addMessage(`<p class="checking">C is checking<span class="dots"><i></i><i></i><i></i></span></p>`, "c");
    setMood("uneasy");

    let res = await askBackground(question);
    // Gemma unreachable (e.g. Ollama not running): a suggested question still gets its sample answer.
    if (res.error && !res.answer && sampleFor(question)) {
      res = { ...sampleFor(question), sample: true, offline: res.error };
    }

    if (res.error && !res.answer) {
      pending.innerHTML = `<p>${esc(res.error)}</p>`;
      pending.classList.add("err");
      setMood("alarmed");
    } else {
      const labels = traceLabels(res.trace);
      pending.innerHTML = `
        ${labels.length ? `<p class="trace">C checked: ${labels.map((l) => `<span>${esc(l)} <b aria-hidden="true">✓</b></span>`).join("")}</p>` : ""}
        <p class="answer">${renderAnswer(res.answer)}</p>
        ${res.sample ? `<p class="sample-tag">${res.offline ? `Sample answer. ${esc(res.offline)}` : "Sample answer. The AI isn't connected yet."}</p>` : ""}`;
      // reveal the checks one by one
      pending.querySelectorAll(".trace > span").forEach((s, i) => { s.style.animationDelay = `${i * 180}ms`; });
      setMood("happy");
    }
    busy = false;
    $("ask-send").disabled = false;
    $("ask-input").focus();
  }

  function init() {
    if (!$("ask-c")) return;
    setMood("wave");
    const showSuggestions = (qs) => { $("ask-suggest").innerHTML = qs.map((q) => `<button type="button" class="suggest">${esc(q)}</button>`).join(""); };
    showSuggestions(SUGGESTED);
    if (window.PrivaCData) window.PrivaCData.load().then((d) => showSuggestions(suggestionsFor(d))).catch(() => {});
    $("ask-suggest").addEventListener("click", (e) => {
      const b = e.target.closest(".suggest");
      if (b) ask(b.textContent);
    });
    $("ask-form").addEventListener("submit", (e) => { e.preventDefault(); ask($("ask-input").value); });

    // Opened from the popup's "Ask C about this site" button.
    const fromPopup = questionFromUrl(location.search);
    if (fromPopup) {
      $("ask-c").scrollIntoView({ block: "start" });
      ask(fromPopup);
    }
  }

  // Other parts of the dashboard (e.g. "Ask C" next to a company) can call this.
  window.PrivaCAsk = {
    ask(question) {
      $("ask-c").scrollIntoView({ behavior: "smooth", block: "start" });
      ask(question);
    },
    // Pure helpers, exported for tests (tests/askc-panel.test.js).
    sampleFor, renderAnswer, questionFromUrl, suggestionsFor
  };

  if (typeof document !== "undefined") init();
})();
