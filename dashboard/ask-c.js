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

  If there is no background script yet (or it doesn't answer), the panel uses
  SAMPLE answers below and says so, so the demo UI works on its own.
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
    const hit = SAMPLE[question.trim().toLowerCase()] || SAMPLE_FALLBACK;
    return { ...hit, sample: true };
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

    const res = await askBackground(question);

    if (res.error && !res.answer) {
      pending.innerHTML = `<p>${esc(res.error)}</p>`;
      pending.classList.add("err");
      setMood("alarmed");
    } else {
      const labels = traceLabels(res.trace);
      pending.innerHTML = `
        ${labels.length ? `<p class="trace">C checked: ${labels.map((l) => `<span>${esc(l)} <b aria-hidden="true">✓</b></span>`).join("")}</p>` : ""}
        <p class="answer">${renderAnswer(res.answer)}</p>
        ${res.sample ? `<p class="sample-tag">Sample answer. The AI isn't connected yet.</p>` : ""}`;
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
    $("ask-suggest").innerHTML = SUGGESTED.map((q) => `<button type="button" class="suggest">${esc(q)}</button>`).join("");
    $("ask-suggest").addEventListener("click", (e) => {
      const b = e.target.closest(".suggest");
      if (b) ask(b.textContent);
    });
    $("ask-form").addEventListener("submit", (e) => { e.preventDefault(); ask($("ask-input").value); });
  }

  // Other parts of the dashboard (e.g. "Ask C" next to a company) can call this.
  window.PrivaCAsk = {
    ask(question) {
      $("ask-c").scrollIntoView({ behavior: "smooth", block: "start" });
      ask(question);
    }
  };

  init();
})();
