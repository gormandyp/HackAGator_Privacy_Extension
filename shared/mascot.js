/*
  C — the PrivaC mascot.
  PrivaCMascot.svg(mood, options) returns an SVG string.
  mood: "happy" | "uneasy" | "alarmed" | "wave"
  options: { size: number (px height), body: boolean (show arms/legs) }

  PrivaCMascot.moodForGrade("A".."F") picks the right face for a grade.
*/
(function () {
  const INK = "#16233f";
  const ORANGE = "#fa4616";

  // The C itself: a thick arc open to the right.
  const C_PATH = "M86.9 31.1 A38 38 0 1 0 86.9 84.9";

  const mouths = {
    happy: `<path d="M51 66 Q60 75 69 66" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    wave: `<path d="M51 66 Q60 75 69 66" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    uneasy: `<path d="M51 69 Q55.5 65 60 69 T69 69" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    alarmed: `<ellipse cx="60" cy="69" rx="5" ry="6.5" fill="${INK}"/>`
  };

  const brows = {
    happy: "",
    wave: "",
    uneasy: `<path d="M48 43 L57 39.5 M72 43 L63 39.5" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
    alarmed: `<path d="M47 37 Q52 33 57 35 M73 37 Q68 33 63 35" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`
  };

  function eyes(mood) {
    const r = mood === "alarmed" ? 7.5 : 6.5;
    const pupil = mood === "alarmed" ? 2.6 : 3.2;
    const dy = mood === "uneasy" ? 1.5 : 0;
    return `
      <circle cx="53" cy="52" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="67" cy="52" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="54.5" cy="${53 + dy}" r="${pupil}" fill="${INK}"/>
      <circle cx="68.5" cy="${53 + dy}" r="${pupil}" fill="${INK}"/>`;
  }

  function limbs(mood) {
    const rightArm =
      mood === "wave"
        ? `<path d="M93 80 L104 66 L101 52" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
        : mood === "alarmed"
        ? `<path d="M93 80 L108 72" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M108 72 L112 64 M108 72 L115 70" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
        : `<path d="M93 80 L105 92" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    const leftArm =
      mood === "alarmed"
        ? `<path d="M23 64 L8 54" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M8 54 L3 47 M8 54 L1 54" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
        : `<path d="M23 66 L10 82" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    return `
      ${leftArm}
      ${rightArm}
      <path d="M50 96 L45 124 L38 125" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M70 96 L75 124 L82 125" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  function svg(mood = "happy", opts = {}) {
    const body = opts.body !== false;
    const size = opts.size || 120;
    const vb = body ? "0 0 120 130" : "10 10 100 98";
    const w = body ? (size * 120) / 130 : size * (100 / 98);
    const label = opts.label || `C, the PrivaC mascot, looking ${mood === "wave" ? "friendly" : mood}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.round(w)}" height="${size}" role="img" aria-label="${label}">
      ${body ? limbs(mood) : ""}
      <path d="${C_PATH}" fill="none" stroke="${ORANGE}" stroke-width="19" stroke-linecap="round"/>
      ${brows[mood] || ""}
      ${eyes(mood)}
      ${mouths[mood] || mouths.happy}
    </svg>`;
  }

  function moodForGrade(grade) {
    if (grade === "A" || grade === "B") return "happy";
    if (grade === "C") return "uneasy";
    return "alarmed";
  }

  // Wordmark: "Priva" in navy followed by C's face as the final letter.
  function wordmark(height = 28) {
    const faceH = Math.round(height * 0.98);
    return `<span class="privac-wordmark" style="display:inline-flex;align-items:flex-end;gap:2px;font-family:var(--font-display);font-weight:800;font-size:${height}px;letter-spacing:-0.02em;color:${INK};line-height:1">Priva${svg("happy", { body: false, size: faceH, label: "C" })}</span>`;
  }

  window.PrivaCMascot = { svg, moodForGrade, wordmark };
})();
