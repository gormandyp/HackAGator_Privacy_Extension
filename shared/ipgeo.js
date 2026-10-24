/*
  PrivaC server location (PLAN F3). Which country an IP address block is registered to, for the
  7 foreign-adversary countries only, from the regional internet registries' public lists
  (RIPE NCC, APNIC, LACNIC "delegated-extended" files), built into shared/ip-countries.json by
  scripts/build-ip-countries.js. Whole lists only: no address is ever sent anywhere.
  A registry country is where the network's holder is registered, not proof of where a machine sits.
*/
(function () {
  let V4 = [], V6 = [];           // V4: [start, end, cc] (numbers); V6: [start, end, cc] (BigInt)
  let meta = null;

  function v4ToNum(ip) {
    const p = String(ip).split(".");
    if (p.length !== 4 || p.some(x => !/^\d{1,3}$/.test(x) || +x > 255)) return null;
    return ((+p[0] * 256 + +p[1]) * 256 + +p[2]) * 256 + +p[3];
  }

  // "2001:db8::1" -> BigInt; also handles "[...]" and "::ffff:1.2.3.4".
  function v6ToBig(ip) {
    let s = String(ip).replace(/^\[|\]$/g, "").toLowerCase();
    const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (tail) { const n = v4ToNum(tail[1]); if (n === null) return null; s = s.slice(0, -tail[1].length) + (n >>> 16).toString(16) + ":" + (n & 0xffff).toString(16); }
    const halves = s.split("::");
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(":") : [];
    const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
    const groups = [...head, ...Array(fill).fill("0"), ...rest];
    if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
    return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g, 16)), 0n);
  }

  function setData(d) {
    meta = d ? { builtAt: d.builtAt, source: d.source } : null;
    V4 = ((d && d.v4) || []).map(([s, n, cc]) => [s, s + n - 1, cc]);
    V6 = ((d && d.v6) || []).map(([hex, len, cc]) => { const s = BigInt("0x" + hex); return [s, s + (1n << BigInt(128 - len)) - 1n, cc]; });
  }

  // Last range starting at or before x (ranges are sorted and don't overlap).
  function find(list, x) {
    let lo = 0, hi = list.length - 1, hit = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid][0] <= x) { hit = list[mid]; lo = mid + 1; } else hi = mid - 1; }
    return hit && x <= hit[1] ? hit[2] : null;
  }

  // "95.173.136.70" -> "RU"; anything outside the 7 countries (or unparseable) -> null.
  function countryOfIp(ip) {
    if (!ip) return null;
    if (String(ip).includes(":")) { const b = v6ToBig(ip); return b === null ? null : find(V6, b); }
    const n = v4ToNum(ip);
    return n === null ? null : find(V4, n);
  }

  const ready = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
    ? fetch(chrome.runtime.getURL("shared/ip-countries.json")).then(r => r.json()).then(setData)
        .catch(e => console.warn("PrivaC: ip-countries.json didn't load", e))
    : Promise.resolve();

  const root = typeof window !== "undefined" ? window : self;
  root.PrivaCIP = { setData, countryOfIp, ready, meta: () => meta };
})();
