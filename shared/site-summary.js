// What the toolbar popup shows first for the site you're on, most important first:
// C's verdict, alerts (state-run media, foreign-adversary links, a breach this year), the reasons that added
// points (biggest first, adding up to the score), the checks that added nothing, and who saw your visit.
// Pure: reads a scored site from shared/data.js, no Chrome calls. Tests: tests/site-summary.test.js.
(function () {
  const root = typeof window !== "undefined" ? window : self;
  const ADV = () => (root.PrivaCData && root.PrivaCData.FOREIGN_ADVERSARIES) || {};

  // Tracker purposes, in the order their colors are assigned (shared/ui.css --p-<key>).
  // Labels match the dashboard's (shared/highlights.js PURPOSE).
  const PURPOSES = [
    { key: "ads", label: "Advertising", cats: ["Advertising"] },
    { key: "measure", label: "Measuring your visits", cats: ["Analytics"] },
    { key: "record", label: "Recording your screen", cats: ["Session recording"] },
    { key: "broker", label: "Data brokers", cats: ["Data broker"] },
    { key: "social", label: "Social media", cats: ["Social"] },
    { key: "malware", label: "Labelled malware", cats: ["Malware"] },
    { key: "risk", label: "High-risk behavior", cats: ["High-risk"] },
    { key: "hidden", label: "Hidden owner", cats: ["Obscure ownership"] },
    { key: "other", label: "Unlabelled tracking", cats: ["Tracking"] }
  ];
  // When a company does several things, the most invasive one names it.
  const SEVERITY = ["malware", "risk", "record", "broker", "ads", "social", "measure", "hidden", "other"];

  // Accepts a tracker category ("Analytics") or a dashboard label ("Measuring your visits").
  function purposeOf(name) {
    const p = PURPOSES.find((x) => x.cats.includes(name) || x.label === name || x.key === name);
    return p ? { key: p.key, label: p.label } : { key: "other", label: "Unlabelled tracking" };
  }

  const SOURCE = { observed: "Seen on your visits in the last 7 days", breach: "Have I Been Pwned", disclosed: "Disclosed in privacy policy" };

  function toneOf(label) {
    if (/^Also contacted/.test(label)) return "warn";
    if (/^No |^0 |declined|nothing tracking|doesn't sell/.test(label)) return "good";
    return "info";
  }

  function millions(n) {
    if (!n) return "";
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")} million accounts`;
    if (n >= 1e3) return `${Math.round(n / 1e3)} thousand accounts`;
    return `${n} accounts`;
  }

  function alertsFor(site, now) {
    const adv = ADV();
    const out = [];
    const owner = site.ownerFlag;
    if (owner && owner.stateMedia) {
      out.push({ kind: "state-media", title: "State-run media", detail: `${owner.company} (${adv[owner.country]}), per State Media Monitor` });
    }
    const flagged = site.flagged || [];
    if (flagged.length) {
      const byCompany = new Map();
      for (const t of flagged) {
        const bits = [adv[t.country], t.listed ? "Pentagon 1260H list" : null].filter(Boolean).join("; ");
        if (!byCompany.has(t.company)) byCompany.set(t.company, `${t.company} (${bits})`);
      }
      out.push({ kind: "adversary", title: byCompany.size > 1 ? "Foreign-adversary trackers" : "Foreign-adversary tracker", detail: [...byCompany.values()].join(", ") });
    }
    if (owner && !owner.stateMedia) {
      out.push({ kind: "owner", title: "Owner in a listed country", detail: `${owner.company}, based in ${adv[owner.country]}` });
    }
    if (site.addressFlag && !flagged.length && !owner) {
      out.push({ kind: "address", title: "Listed-country web address", detail: `Web address ends in ${site.addressFlag.ending} (${adv[site.addressFlag.country]})` });
    }
    if (site.serverFlag && !flagged.length && !owner && !site.addressFlag) {
      out.push({ kind: "server", title: "Server in a listed country", detail: `Address registered in ${adv[site.serverFlag.country]} (internet registry)` });
    }
    const b = site.breach;
    if (b && (b.addedDate || b.breachDate)) {
      const added = Date.parse(b.addedDate || b.breachDate);
      if (now - added < 365.25 * 86400000) {
        const year = String(b.breachDate || b.addedDate).slice(0, 4);
        const count = millions(b.pwnCount);
        out.push({ kind: "breach", title: "Data breach in the last year", detail: `${b.name} (${year})${count ? ", " + count : ""}. Change that password if you reused it.` });
      }
    }
    return out;
  }

  // C's verdict: a headline about who saw the visit, then a note about the cookie choice ("" if none).
  function verdictFor(site, companyCount) {
    const who = `${companyCount} outside ${companyCount === 1 ? "company" : "companies"}`;
    const Who = who[0].toUpperCase() + who.slice(1);
    let first;
    if (site.grade === "A") first = companyCount ? `Looking good. Only ${who} showed up here.` : "Looking good. No outside companies showed up here.";
    else if (site.grade === "B") first = `Not bad. ${Who} saw your visits here this week.`;
    else if (site.grade === "C") first = `Heads up: ${who} saw your visits here this week.`;
    else first = `Yikes. ${Who} saw your visits here this week.`;
    const note = site.cookieChoice === "declined" ? "You declined the extra cookies, nice."
      : site.cookieChoice === "accepted" ? "You accepted all cookies here. Clearing this site's cookies would lower your score."
      : site.cookieChoice === "no-reject" ? "This site's cookie banner had no Reject button, only Accept."
      : "";
    return { headline: first, cookieNote: note, verdict: note ? `${first} ${note}` : first };
  }

  function summarize(site, opts) {
    const now = (opts && opts.now) || Date.now();
    const adv = ADV();
    const trackers = site.trackers || [];
    const parts = site.parts || [];

    const reasons = parts.map((p, i) => ({ label: p.label, points: p.points, source: SOURCE[p.kind] || SOURCE.observed, i }))
      .filter((p) => p.points > 0)
      .sort((a, b) => b.points - a.points || a.i - b.i)
      .map(({ label, points, source }) => ({ label, points, source }));
    const checks = parts.filter((p) => !p.points).map((p) => ({ label: p.label, tone: toneOf(p.label) }));

    const companies = new Map();
    const purposeCount = new Map();
    for (const t of trackers) {
      const p = purposeOf(t.category);
      purposeCount.set(p.key, (purposeCount.get(p.key) || 0) + 1);
      const c = companies.get(t.company) || { name: t.company, purposes: new Set(), flagged: false, country: null, domains: 0 };
      c.purposes.add(p.key);
      c.domains++;
      if (adv[t.country] || t.listed) { c.flagged = true; c.country = adv[t.country] || c.country; }
      companies.set(t.company, c);
    }
    const companyList = [...companies.values()].map((c) => {
      const key = SEVERITY.find((k) => c.purposes.has(k)) || "other";
      return { name: c.name, purpose: purposeOf(key), flagged: c.flagged, country: c.country, domains: c.domains };
    }).sort((a, b) => (b.flagged - a.flagged) || (b.domains - a.domains) || a.name.localeCompare(b.name));
    const order = PURPOSES.map((p) => p.key);
    const purposes = [...purposeCount.entries()].map(([key, n]) => ({ ...purposeOf(key), n }))
      .sort((a, b) => b.n - a.n || order.indexOf(a.key) - order.indexOf(b.key));

    return {
      domain: site.domain,
      grade: site.grade,
      score: site.score,
      words: root.PrivaCData && root.PrivaCData.GRADE_WORDS ? root.PrivaCData.GRADE_WORDS[site.grade] : "",
      ...verdictFor(site, companyList.length),
      alerts: alertsFor(site, now),
      reasons,
      checks,
      companies: companyList,
      purposes,
      trackerCount: trackers.length,
      companyCount: companyList.length
    };
  }

  root.PrivaCSiteSummary = { summarize, purposeOf, PURPOSES };
})();
