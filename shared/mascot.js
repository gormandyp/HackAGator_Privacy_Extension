/*
  C — the PrivaC mascot.
  PrivaCMascot.svg(mood, options) returns an SVG string.
  mood: "happy" | "uneasy" | "alarmed" | "wave"
        or a popup pose: "climb" | "point-down" | "hook" (see POSE_LIMBS below)
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

  // Popup poses: C interacting with the edge of a popup card.
  //   climb       hands curled over an edge above C, pulling itself up
  //   point-down  C popping up over a popup's top edge, bracing with one hand and pointing down at a button
  //   hook        C hanging from a popup corner by one hooked arm, pointing down and around at a button
  const POSES = ["climb", "point-down", "hook"];
  const POSE_VIEWBOX = { climb: "0 -8 120 138", "point-down": "0 0 124 130", hook: "-4 -12 128 142" };
  const POSE_LOOK = { climb: [0, -2], "point-down": [1.2, 1.8], hook: [-1.6, 1.8] }; // where the pupils look

  // A stick-figure pointing hand at (x, y) aimed at angle degrees (0 = right, 90 = down).
  function pointer(x, y, angle) {
    const a = (angle * Math.PI) / 180, t = ((angle - 65) * Math.PI) / 180;
    const fx = (x + 11 * Math.cos(a)).toFixed(1), fy = (y + 11 * Math.sin(a)).toFixed(1);
    const tx = (x + 5 * Math.cos(t)).toFixed(1), ty = (y + 5 * Math.sin(t)).toFixed(1);
    return `<path d="M${x} ${y} L${fx} ${fy} M${x} ${y} L${tx} ${ty}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  }

  const LIMB = `fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  const POSE_LIMBS = {
    climb: `
      <path d="M25 44 L28 4 Q29 -3 36 -3" ${LIMB}/>
      <path d="M81 22 L84 4 Q83 -3 76 -3" ${LIMB}/>
      <path d="M50 96 L43 111 L47 124" ${LIMB}/>
      <path d="M70 96 L75 123 L81 124" ${LIMB}/>`,
    "point-down": `
      <path d="M23 66 L12 86" ${LIMB}/>
      <path d="M5 87 L18 87" ${LIMB}/>
      <path d="M93 80 L107 103" ${LIMB}/>
      ${pointer(107, 103, 72)}
      <path d="M50 96 L45 124 L38 125" ${LIMB}/>
      <path d="M70 96 L75 124 L82 125" ${LIMB}/>`,
    hook: `
      <path d="M83 22 L91 0 Q93 -8 86 -9 Q80 -9 80 -3" ${LIMB}/>
      <path d="M24 67 L7 89" ${LIMB}/>
      ${pointer(7, 89, 128)}
      <path d="M50 96 L47 123 L42 126" ${LIMB}/>
      <path d="M70 96 L73 123 L78 126" ${LIMB}/>`
  };
  mouths.climb = `<path d="M51 65 Q60 75 69 65 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  mouths["point-down"] = mouths.happy;
  mouths.hook = mouths.happy;

  const brows = {
    happy: "",
    wave: "",
    uneasy: `<path d="M48 43 L57 39.5 M72 43 L63 39.5" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
    alarmed: `<path d="M47 37 Q52 33 57 35 M73 37 Q68 33 63 35" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
    climb: `<path d="M48 40 Q52.5 37 57 39 M72 40 Q67.5 37 63 39" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`
  };

  function eyes(mood) {
    const r = mood === "alarmed" ? 7.5 : 6.5;
    const pupil = mood === "alarmed" ? 2.6 : 3.2;
    const [lx, ly] = POSE_LOOK[mood] || [0, 0];
    const dy = (mood === "uneasy" ? 1.5 : 0) + ly;
    return `
      <circle cx="53" cy="52" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="67" cy="52" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="${54.5 + lx}" cy="${53 + dy}" r="${pupil}" fill="${INK}"/>
      <circle cx="${68.5 + lx}" cy="${53 + dy}" r="${pupil}" fill="${INK}"/>`;
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
    const isPose = POSES.includes(mood);
    const vb = !body ? "10 10 100 98" : isPose ? POSE_VIEWBOX[mood] : "0 0 120 130";
    const [, , vbW, vbH] = vb.split(" ").map(Number);
    const w = (size * vbW) / vbH;
    const label = opts.label || POSE_LABELS[mood] || `C, the PrivaC mascot, looking ${mood === "wave" ? "friendly" : mood}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.round(w)}" height="${size}" role="img" aria-label="${label}">
      ${body ? (isPose ? POSE_LIMBS[mood] : limbs(mood)) : ""}
      <path d="${C_PATH}" fill="none" stroke="${ORANGE}" stroke-width="19" stroke-linecap="round"/>
      ${brows[mood] || ""}
      ${eyes(mood)}
      ${mouths[mood] || mouths.happy}
    </svg>`;
  }

  const POSE_LABELS = {
    climb: "C, the PrivaC mascot, climbing up an edge",
    "point-down": "C, the PrivaC mascot, pointing down",
    hook: "C, the PrivaC mascot, hanging by one arm and pointing"
  };

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

  window.PrivaCMascot = { svg, moodForGrade, wordmark, POSES };
})();
