/*
  PrivaC home-page summary: totals across your sites and the standout facts worth knowing.
  Pure functions over the scored sites from PrivaCData.load() (no storage, no network), so they're testable.
    aggregate(sites)          -> counts, average exposure, what trackers were for, cookies, listed countries
    facts(sites, { declines }) -> up to 6 facts, strongest first: [{ kind, tone, weight, title, detail, ask, site }]
  Wording follows the Honesty rules: what was seen, or what a public list says; never that data was sold.
*/
(function () {
  const root = typeof window !== "undefined" ? window : self;
  const ADV = () => (root.PrivaCData && root.PrivaCData.FOREIGN_ADVERSARIES) || {};

  // Plain names for Tracker Radar's categories (what the tracker is for).
  const PURPOSE = {
    "Advertising": "Advertising", "Analytics": "Measuring your visits", "Session recording": "Recording your screen",
    "Social": "Social media", "Data broker": "Data brokers", "Tracking": "Unlabelled tracking",
    "Malware": "Labelled malware", "High-risk": "High-risk behavior", "Obscure ownership": "Hidden owner"
  };
  const an = (g) => (g === "A" || g === "F" ? "an" : "a");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const gradeFor = (score) => (score <= 20 ? "A" : score <= 40 ? "B" : score <= 60 ? "C" : score <= 80 ? "D" : "F");

  function aggregate(sites) {
    sites = sites || [];
    const adv = ADV();
    const flaggedCo = (c) => (adv[c.country] || c.listed ? 1 : 0);
    const companies = new Map();       // name -> { sites:Set, categories:Set, country, listed, broker, fingerprinting }
    const domains = new Map();         // tracker domain -> purpose
    const countries = new Map();       // CC -> { companies:Set, sites:Set }
    const addCountry = (cc, company, site) => {
      if (!adv[cc]) return;
      if (!countries.has(cc)) countries.set(cc, { companies: new Set(), sites: new Set() });
      const c = countries.get(cc);
      if (company) c.companies.add(company);
      c.sites.add(site);
    };
    let cookies = 0, trackingCookies = 0, scoreSum = 0;
    const cookieNames = new Map();     // tracking cookie name -> { sites:Set, company }
    for (const s of sites) {
      scoreSum += s.score || 0;
      for (const c of s.cookies || []) {
        cookies++;
        if (c.category !== "Marketing" && c.category !== "Analytics") continue;
        trackingCookies++;
        if (!cookieNames.has(c.name)) cookieNames.set(c.name, { sites: new Set(), company: c.company || null });
        cookieNames.get(c.name).sites.add(s.domain);
      }
      for (const t of s.trackers || []) {
        if (!companies.has(t.company)) companies.set(t.company, { sites: new Set(), categories: new Set(), country: t.country, listed: !!t.listed, broker: t.broker || null, fingerprinting: 0 });
        const co = companies.get(t.company);
        co.sites.add(s.domain); co.categories.add(t.category);
        co.fingerprinting = Math.max(co.fingerprinting, t.fingerprinting || 0);
        if (t.broker) co.broker = t.broker;
        if (t.listed) co.listed = true;
        if (!domains.has(t.domain)) domains.set(t.domain, t.broker ? "Data broker" : t.category);
        addCountry(t.country, t.company, s.domain);
      }
      if (s.ownerFlag) addCountry(s.ownerFlag.country, s.ownerFlag.company, s.domain);
      else if (s.addressFlag) addCountry(s.addressFlag.country, null, s.domain);
      else if (s.serverFlag) addCountry(s.serverFlag.country, null, s.domain);
    }
    const purposeCounts = {};
    for (const cat of domains.values()) { const label = PURPOSE[cat] || cat || "Other"; purposeCounts[label] = (purposeCounts[label] || 0) + 1; }
    const avgScore = sites.length ? Math.round(scoreSum / sites.length) : 0;
    return {
      siteCount: sites.length,
      companyCount: companies.size,
      trackerCount: domains.size,
      // Most sites first; at equal reach, companies from listed countries come first so they're never trimmed away.
      companies: [...companies.entries()].map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.sites.size - a.sites.size || (flaggedCo(b) - flaggedCo(a)) || a.name.localeCompare(b.name)),
      purposes: Object.entries(purposeCounts).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
      cookies, trackingCookies,
      topCookies: [...cookieNames.entries()].map(([name, v]) => ({ name, company: v.company, sites: v.sites.size }))
        .sort((a, b) => b.sites - a.sites || a.name.localeCompare(b.name)).slice(0, 3),
      avgScore, avgGrade: gradeFor(avgScore),
      countries: [...countries.entries()].map(([cc, v]) => ({ cc, name: adv[cc], companies: [...v.companies], sites: [...v.sites] }))
        .sort((a, b) => b.sites.length - a.sites.length || a.name.localeCompare(b.name))
    };
  }

  const list = (xs) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const FOREIGN = new Set(["state-media", "owner", "address", "adversary"]);

  function facts(sites, opts = {}) {
    sites = sites || [];
    const adv = ADV();
    const agg = aggregate(sites);
    const out = [];
    const add = (f) => out.push(f);

    // ---- Who runs the sites (merged across sites) ----
    const stateMedia = sites.filter((s) => s.ownerFlag && s.ownerFlag.stateMedia);
    if (stateMedia.length === 1) {
      const s = stateMedia[0];
      add({ kind: "state-media", tone: "alert", weight: 100, site: s.domain,
        title: `${s.domain} is state-run media: ${s.ownerFlag.company} (${adv[s.ownerFlag.country]})`,
        detail: "State Media Monitor says the government controls this outlet. That's about who runs it, not what it does with your data.",
        ask: `What does it mean that ${s.domain} is state-run media, and what could it learn about me?` });
    } else if (stateMedia.length > 1) {
      add({ kind: "state-media", tone: "alert", weight: 100, site: stateMedia[0].domain,
        title: `You visited ${stateMedia.length} state-run media sites`,
        detail: `${list(stateMedia.map((s) => `${s.domain} (${adv[s.ownerFlag.country]})`))}, per State Media Monitor. That's about who runs them, not what they do with your data.`,
        ask: `What does it mean that ${list(stateMedia.map((s) => s.domain))} are state-run media, and what could they learn about me?` });
    }
    const owned = sites.filter((s) => s.ownerFlag && !s.ownerFlag.stateMedia);
    if (owned.length) add({ kind: "owner", tone: "alert", weight: 92, site: owned[0].domain,
      title: owned.length === 1 ? `${owned[0].domain} belongs to ${owned[0].ownerFlag.company}, based in ${adv[owned[0].ownerFlag.country]}`
        : `${owned.length} sites belong to companies in listed countries`,
      detail: owned.length === 1 ? "A country on the U.S. Commerce Department's foreign-adversary list."
        : `${list(owned.map((s) => `${s.domain} (${s.ownerFlag.company}, ${adv[s.ownerFlag.country]})`))}. Countries on the U.S. Commerce Department's foreign-adversary list.`,
      ask: `What does it mean that ${list(owned.map((s) => s.domain))} ${owned.length === 1 ? "is" : "are"} owned by companies in ${list([...new Set(owned.map((s) => adv[s.ownerFlag.country]))])}?` });
    const placed = sites.filter((s) => !s.ownerFlag && (s.addressFlag || s.serverFlag));
    if (placed.length) {
      const where = (s) => s.addressFlag ? `${s.domain} uses ${adv[s.addressFlag.country]}'s web address ending (${s.addressFlag.ending})` : `${s.domain}'s server is registered in ${adv[s.serverFlag.country]}`;
      add({ kind: "address", tone: "alert", weight: 84, site: placed[0].domain,
        title: placed.length === 1 ? where(placed[0]) : `${placed.length} sites have an address or server in a listed country`,
        detail: placed.length === 1 ? "From the web address, or the internet registries for the server." : `${list(placed.map((s) => s.domain))}. From their web addresses or the internet registries.`,
        ask: `What does it tell me that ${list(placed.map((s) => s.domain))} ${placed.length === 1 ? "has" : "have"} an address or server in a listed foreign-adversary country?` });
    }

    // ---- Tracker companies from listed countries (merged), not counting a site's own owner ----
    const ownersOf = new Map(sites.filter((s) => s.ownerFlag).map((s) => [s.domain, s.ownerFlag.company]));
    const foreign = agg.companies.filter((c) => (adv[c.country] || c.listed) && [...c.sites].some((d) => ownersOf.get(d) !== c.name));
    if (foreign.length) {
      const names = foreign.map((c) => `${c.name}${adv[c.country] ? ` (${adv[c.country]})` : ""}`);
      const siteSet = [...new Set(foreign.flatMap((c) => [...c.sites]))];
      add({ kind: "adversary", tone: "alert", weight: 94, site: siteSet[0],
        title: `${list(names)} tracked you on ${siteSet.length === 1 ? siteSet[0] : `${siteSet.length} sites`}`,
        detail: foreign.some((c) => c.listed) ? `Includes a company on the Pentagon's Section 1260H list (June 2026).` : "Companies based in countries on the U.S. Commerce Department's foreign-adversary list.",
        ask: `Who ${foreign.length === 1 ? "is" : "are"} ${list(foreign.map((c) => c.name))}, and what can ${foreign.length === 1 ? "it" : "they"} see when ${foreign.length === 1 ? "it loads" : "they load"} on my sites?` });
    }

    // ---- Per-site facts ----
    const recentBreaches = sites.filter((s) => s.breach && (s.parts || []).some((p) => p.kind === "breach" && p.points === 15));
    for (const s of sites) {
      const b = s.breach;
      if (!b) continue;
      const recent = recentBreaches.includes(s);
      const year = String(b.breachDate || b.addedDate || "").slice(0, 4);
      add({ kind: "breach", tone: recent ? "alert" : "info", weight: recent ? 86 : 40, site: s.domain,
        title: recent ? `${s.domain} had a data breach reported in the last year (${b.name}, ${year})` : `${s.domain} had a past data breach (${b.name}, ${year})`,
        detail: `${b.pwnCount ? `${Number(b.pwnCount).toLocaleString()} accounts. ` : ""}From Have I Been Pwned. Change that password if you reused it.`,
        ask: `What happened in the ${b.name} data breach, and what should I do?` });
    }
    const sellers = sites.filter((s) => s.policy && s.policy.sells === true);
    if (sellers.length) add({ kind: "sells", tone: "warn", weight: 72, site: sellers[0].domain,
      title: sellers.length === 1 ? `${sellers[0].domain}'s privacy policy says it sells personal information` : `${sellers.length} sites' privacy policies say they sell personal information`,
      detail: sellers.length === 1 ? "Read from its own policy on this computer, with the sentence checked." : `${list(sellers.map((s) => s.domain))}. Read from their own policies, sentences checked.`,
      ask: `What does ${sellers[0].domain}'s privacy policy say about selling my information, and can I opt out?` });

    // ---- Tracker behavior ----
    for (const c of agg.companies) {
      const where = [...c.sites];
      const on = where.length === 1 ? `on ${where[0]}` : `on ${where.length} of your sites`;
      if (c.categories.has("Malware")) add({ kind: "malware", tone: "alert", weight: 88, site: where[0],
        title: `DuckDuckGo's Tracker Radar labels ${c.name} as malware`,
        detail: `It loaded ${on}.`,
        ask: `Why does Tracker Radar label ${c.name} as malware, and is it a risk to me?` });
      if (c.categories.has("Session recording")) add({ kind: "recording", tone: "warn", weight: 78, site: where[0],
        title: `${c.name} can record what you do ${on}`,
        detail: "Session-recording scripts can capture clicks, scrolling and typing on the page.",
        ask: `What can ${c.name}'s session recording capture ${on}?` });
      if (c.broker || c.categories.has("Data broker")) add({ kind: "broker", tone: "warn", weight: 74 + Math.min(4, where.length), site: where[0],
        title: `${c.name}, a data broker, saw you ${on}`,
        detail: c.broker ? `Registered as ${c.broker} in California's 2026 Data Broker Registry.` : "Tracker Radar lists it as a data broker.",
        ask: `What does the data broker ${c.name} do with what it sees about me?` });
    }
    const fp = agg.companies.filter((c) => c.fingerprinting >= 2);
    if (fp.length) add({ kind: "fingerprint", tone: "warn", weight: 70, site: [...fp[0].sites][0],
      title: `${plural(fp.length, "company", "companies")} can recognize your device without cookies`,
      detail: `Device fingerprinting: ${list(fp.slice(0, 3).map((c) => c.name))}${fp.length > 3 ? " and more" : ""}. Clearing cookies doesn't stop it.`,
      ask: "What is device fingerprinting, and how can I protect myself from it?" });

    const top = agg.companies[0];
    if (top && top.sites.size > 1) add({ kind: "reach", tone: "info", weight: top.sites.size >= 3 ? 56 : 36, site: [...top.sites][0],
      title: `${top.name} followed you across ${top.sites.size} of your ${sites.length} sites`,
      detail: "One company on many sites can connect those visits into one picture of you.",
      ask: `Who is ${top.name}, and what can it learn from seeing me on ${top.sites.size} different sites?` });
    const neverAsked = sites.filter((s) => s.cookieChoice === "none" && (s.trackers || []).length).length;
    if (neverAsked) add({ kind: "never-asked", tone: "info", weight: 44, title: `${plural(neverAsked, "site", "sites")} tracked you with no cookie banner`,
      detail: "Trackers loaded and you were never asked.", ask: "How can a site track me without showing a cookie banner?" });
    const accepted = sites.filter((s) => s.cookieChoice === "accepted").length;
    if (accepted) add({ kind: "accepted", tone: "info", weight: 38, title: `You accepted all cookies on ${plural(accepted, "site", "sites")}`,
      detail: "Declining the extras usually means fewer trackers on your next visit.", ask: "What changes if I decline the extra cookies instead of accepting all?" });
    if (opts.declines) add({ kind: "declines", tone: "good", weight: 30, title: `C declined cookies for you ${plural(opts.declines, "time", "times")} this week`,
      detail: "Each one is a site asked to skip the extra tracking.", ask: "What does C do when it declines cookies for me?" });
    const clean = sites.filter((s) => !(s.trackers || []).length).length;
    if (clean) add({ kind: "clean", tone: "good", weight: 20, title: `${plural(clean, "site", "sites")} had no outside trackers at all`,
      detail: "Nothing loaded from other companies while you were there.", ask: "How can a site have no outside trackers, and why is that good?" });

    // Strongest first, with variety: at most 2 foreign-adversary facts, 2 of any other kind; keep one good-news fact.
    out.sort((a, b) => b.weight - a.weight);
    const perKind = {}, picked = [];
    let foreignCount = 0;
    for (const f of out) {
      if (FOREIGN.has(f.kind) && ++foreignCount > 2) continue;
      if ((perKind[f.kind] = (perKind[f.kind] || 0) + 1) > 2) continue;
      picked.push(f);
    }
    const max = opts.max || 6;
    const result = picked.slice(0, max);
    const good = picked.find((f) => f.tone === "good");
    if (good && !result.includes(good) && result.length) result[result.length - 1] = good;
    return result;
  }

  root.PrivaCHighlights = { aggregate, facts, PURPOSE, an };
})();
