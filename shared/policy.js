/*
  Privacy-policy reader, pure logic (PLAN R3). Used by background/policy-reader.js; tested in tests/policy.test.js.

  Steps for one site:
    1. pickPolicyLink: choose the site's own "Privacy Policy" link from the links on the page.
    2. htmlToText:     turn the fetched policy page into plain paragraphs.
    3. passagesFor:    for each question in shared/knowledge-map.json, keep only the paragraphs that
                       contain its find-words (plus one paragraph either side). No match = unknown, Gemma isn't asked.
    4. Ask Gemma two questions at a time, as JSON: yes / no / unknown + the exact sentence.
    5. verifyQuote:    the sentence must really be in the policy, or the answer becomes unknown.
       quoteFits:      and it must really say it (a "sells" sentence about personal information, not ad space).
  Result: { sells, shares, optOut, gpc, retention, preciseLocation, sensitive, otherSources,
            quotes: { field: sentence }, source: policy URL without query, checkedAt }
  true = yes, false = no, null = unknown (never shown as safe).
*/
(function () {
  const MIN_POLICY_CHARS = 400;      // shorter than this is an error page or a stub, not a policy
  const PASSAGE_CHARS = 2500;        // per question; keeps prompts short for Gemma 4 E4B
  const PER_CALL = 2;                // questions per Gemma call
  const MIN_QUOTE_CHARS = 15;        // a shorter "quote" proves nothing

  function cleanUrl(u) {
    try {
      const x = new URL(u);
      if (x.protocol !== "http:" && x.protocol !== "https:") return null;
      return x.origin + x.pathname;
    } catch (e) { return null; }
  }

  // The site's own privacy policy link. Same site or a sister subdomain only; "privacy choices"/settings links are skipped.
  function pickPolicyLink(links, pageDomain) {
    const root = String(pageDomain || "").replace(/^www\./, "").split(".").slice(-2).join(".");
    if (!root) return null;
    let best = null, bestScore = 0;
    for (const l of links || []) {
      const url = cleanUrl(l && l.href);
      if (!url) continue;
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host !== root && !host.endsWith("." + root)) continue;
      const text = String(l.text || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (/choice|setting|preference|opt.?out|do not sell|manage|cookie/.test(text)) continue;
      let score = 0;
      if (/privacy (policy|notice|statement)/.test(text)) score += 4;
      else if (/privacy/.test(text)) score += 2;
      if (/privacy/.test(new URL(url).pathname.toLowerCase())) score += 1;
      if (score > bestScore) { best = url; bestScore = score; }
    }
    return best;
  }

  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: "-", ndash: "-", hellip: "..." };
  function htmlToText(html) {
    return String(html || "")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(p|div|li|ul|ol|h[1-6]|br|tr|td|th|section|article|header|footer|nav|table|blockquote|dd|dt)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
      .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m))
      .split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  }

  // Paragraphs with any of the question's find-words, plus one either side, in policy order, up to max characters.
  function passagesFor(text, check, max = PASSAGE_CHARS) {
    const paras = String(text || "").split("\n");
    const words = (check.findWords || []).map((w) => w.toLowerCase());
    const hits = [];
    paras.forEach((p, i) => { const low = p.toLowerCase(); if (words.some((w) => low.includes(w))) hits.push(i); });
    if (!hits.length) return "";
    const keep = new Set();
    for (const i of hits) { keep.add(i); keep.add(i - 1); keep.add(i + 1); }
    // Direct matches first, neighbors only if there's room; then put them back in policy order.
    const order = [...hits, ...[...keep].filter((i) => !hits.includes(i))].filter((i) => i >= 0 && i < paras.length);
    const chosen = [];
    let used = 0;
    for (const i of order) {
      const len = paras[i].length + 1;
      if (used + len > max) continue;
      chosen.push(i); used += len;
    }
    return chosen.sort((a, b) => a - b).map((i) => paras[i]).join("\n");
  }

  function norm(s) {
    return String(s || "").toLowerCase().replace(/[“”„«»]/g, '"').replace(/[‘’′]/g, "'")
      .replace(/\s+/g, " ").trim().replace(/^[\s"'.,;:]+|[\s"'.,;:]+$/g, "");
  }
  function verifyQuote(quote, text) {
    const q = norm(quote);
    return q.length >= MIN_QUOTE_CHARS && norm(text).includes(q);
  }

  // A yes or no also needs a sentence that really says it (G14 test with real Gemma, Oct 25 2026): "We sell premium
  // advertising space" (bbc) and "We sell premium Services" (linkedin) were saved as selling personal information, and
  // so was "business transactions such as sales or a merger" (github); the "Do not sell or share my personal
  // information" link (dailymail) was saved as a promise not to, and the menu words "Sports Health Science" as
  // collecting sensitive information. A sentence that fails these checks leaves the answer unknown (never safe).
  const MIN_QUOTE_WORDS = 5;
  const LINK_NAME = /^(?:do not|don't) (?:sell|share)(?: or (?:sell|share))?(?: my)? personal (?:information|data)$/;
  const PERSONAL = /\bpersonal (?:information|data|info)\b|\byour (?:information|data|info)\b|\b(?:information|data) about you\b|\bconsumer (?:information|data)\b/;
  const SELL_WORD = /\b(?:sell|sells|selling|sold|sale|sales)\b|valuable consideration|in exchange for/;
  const SHARE_WORD = /\b(?:share|shares|sharing|shared|disclose|discloses|disclosed|disclosure|provide|provides|make available)\b/;
  const AD_WORD = /advertis|marketing|targeted|interest-based|cross-context|behaviou?ral|data brokers?/;
  const BUSINESS_SALE = /merger|acquisition|bankruptcy|reorgani[sz]|business transactions?|sale of (?:all|part|substantially|the|our|a)\b|such as (?:a )?sales?\b/;
  const RIGHTS = /\bright to\b[^.]{0,80}\b(?:opt[- ]?out|instruct|direct|request|limit|stop|tell)\b|\bopt[- ]?out of (?:the )?(?:sale|selling|sharing)\b/;
  const DEFINES = /\bwe mean\b|\bis defined as\b/;
  const DENY = {
    sells: /\b(?:do|does|will|shall|did)\s+not\s+(?:and will not\s+)?sell\b|\b(?:don't|doesn't|won't|never)\s+sell\b|\bhave not sold\b|\bno sale\b/,
    shares: /\b(?:do|does|will|shall|did)\s+not\s+(?:and will not\s+)?(?:sell (?:or|and)\s+)?share\b|\b(?:don't|doesn't|won't|never)\s+(?:sell (?:or|and)\s+)?share\b/
  };
  function quoteFits(field, answer, quote) {
    const q = norm(quote);
    if (q.split(" ").length < MIN_QUOTE_WORDS) return false;
    if (field !== "sells" && field !== "shares") return true;
    if (LINK_NAME.test(q) || DEFINES.test(q)) return false;
    if (answer === "no") return DENY[field].test(q);
    if (DENY[field].test(q) || RIGHTS.test(q)) return false;
    return field === "sells" ? SELL_WORD.test(q) && PERSONAL.test(q) && !BUSINESS_SALE.test(q) : SHARE_WORD.test(q) && AD_WORD.test(q);
  }

  // Answers saved before quoteFits existed are checked once more (background/policy-reader.js, when PrivaC starts).
  // Returns the same object when nothing changes.
  function recheck(policy) {
    if (!policy || !policy.quotes) return policy;
    let out = policy;
    for (const [field, quote] of Object.entries(policy.quotes)) {
      if (typeof policy[field] !== "boolean" || quoteFits(field, policy[field] ? "yes" : "no", quote)) continue;
      if (out === policy) out = { ...policy, quotes: { ...policy.quotes } };
      out[field] = null;
      delete out.quotes[field];
    }
    return out;
  }

  function systemPrompt(map) {
    const f = map.answerFormat || {};
    return [
      "You read website privacy policies for PrivaC, a privacy tool. You answer questions about one policy.",
      ...(f.forGemma || []).map((x) => "- " + x),
      '- Reply with JSON only, in this shape: {"answers": [{"id": <question id>, "answer": "yes" or "no" or "unknown", "quote": <exact sentence from the policy, or "">}]}'
    ].join("\n");
  }

  function questionText(batch) {
    return "Answer each question about the privacy policy excerpts above.\n" + batch.map((c) =>
      `{"id": "${c.id}", "question": ${JSON.stringify(c.question)}, "answer yes if": ${JSON.stringify(c.yesIf)}, ` +
      `"answer no if": ${JSON.stringify(c.noIf)}, "answer unknown if": ${JSON.stringify(c.unknownIf)}}`).join("\n");
  }

  function answersFrom(reply) {
    if (!reply) return [];
    if (Array.isArray(reply)) return reply;
    if (Array.isArray(reply.answers)) return reply.answers;
    return Object.entries(reply).map(([id, v]) => (v && typeof v === "object" ? { id, ...v } : { id, answer: v }));
  }

  async function readPolicy({ html, url }, map, ask, opts = {}) {
    const text = htmlToText(html);
    if (text.length < MIN_POLICY_CHARS) throw new Error("That page is too short to be a privacy policy");
    const checks = (map.checks || []).filter((c) => c.answeredBy === "gemma");
    const policy = { source: cleanUrl(url), checkedAt: new Date(opts.now || Date.now()).toISOString(), quotes: {} };
    for (const c of checks) policy[c.policyField] = null;

    const toAsk = checks.map((c) => ({ c, passage: passagesFor(text, c) })).filter((x) => x.passage);
    const system = systemPrompt(map);
    for (let i = 0; i < toAsk.length; i += PER_CALL) {
      const batch = toAsk.slice(i, i + PER_CALL);
      const context = batch.map((x) => `Excerpts for "${x.c.id}":\n${x.passage}`).join("\n\n");
      const reply = await ask(questionText(batch.map((x) => x.c)), { system, context, json: true, options: { temperature: 0 } });
      for (const a of answersFrom(reply)) {
        const hit = batch.find((x) => x.c.id === a.id);
        if (!hit) continue;
        const answer = String(a.answer || "").toLowerCase();
        if ((answer === "yes" || answer === "no") && verifyQuote(a.quote, text) && quoteFits(hit.c.policyField, answer, a.quote)) {
          policy[hit.c.policyField] = answer === "yes";
          policy.quotes[hit.c.policyField] = String(a.quote).replace(/\s+/g, " ").trim();
        }
      }
    }
    return policy;
  }

  (typeof window !== "undefined" ? window : self).PrivaCPolicy = { pickPolicyLink, htmlToText, passagesFor, verifyQuote, quoteFits, recheck, readPolicy, cleanUrl };
})();
