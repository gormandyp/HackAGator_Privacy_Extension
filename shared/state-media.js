// State-run news sites (PLAN F2). The list is shared/state-media.json (State Media Monitor, each domain sourced).
// lookup("english.news.cn", list) -> { company: "Xinhua", country: "CN", stateMedia: { name, classification, updated, profile } }
(function () {
  function lookup(domain, list) {
    if (!domain || !list || !Array.isArray(list.outlets)) return null;
    const d = String(domain).toLowerCase().replace(/^www\./, "");
    for (const o of list.outlets) {
      if (!o.domains.some((x) => d === x || d.endsWith("." + x))) continue;
      return {
        company: o.short || o.name,
        country: o.country,
        stateMedia: { name: o.name, classification: o.classification, updated: o.smmUpdated, profile: o.profile }
      };
    }
    return null;
  }
  const CLASS_LABEL = { SC: "State-Controlled", CaPu: "Captured Public (state-managed)" };
  (typeof window !== "undefined" ? window : self).PrivaCStateMedia = { lookup, CLASS_LABEL };
})();
