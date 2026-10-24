/*
  C — the PrivaC mascot.
  PrivaCMascot.svg(mood, options) returns an SVG string.
  mood: "happy" | "uneasy" | "alarmed" | "wave"
        or a behind-the-popup pose: "push-up" | "cliff-hang" (see POSES below)
  options: { size: number (px height), body: boolean (show arms/legs),
             animate: boolean (poses only, default true) }

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


  /*
    Behind-the-popup poses. C is BEHIND a popup card: the bottom edge of each
    SVG is the popup's top edge, and everything below it is cut off. Place the
    SVG so its bottom sits exactly on the popup's top edge.
      push-up     hands flat on the edge, pushing himself up and sinking back down
      cliff-hang  fingertips gripping the edge, peeking over like hanging off a cliff
    Both animate (SMIL, so they also move as a plain .svg file or <img>).
    Pass { animate: false } for a still version; reduced-motion users get the still one.
  */
  const POSES = ["push-up", "cliff-hang"];

  const LIMB = `fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  const EASE = `calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"`;

  // C's face for poses: eyes with pupils shifted by (lx, ly), optional brows and mouth.
  function poseFace(lx, ly, browsSvg, mouthSvg) {
    return `
      <path d="${C_PATH}" fill="none" stroke="${ORANGE}" stroke-width="19" stroke-linecap="round"/>
      ${browsSvg}
      <circle cx="53" cy="52" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="67" cy="52" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="${54.5 + lx}" cy="${53 + ly}" r="3.2" fill="${INK}"/>
      <circle cx="${68.5 + lx}" cy="${53 + ly}" r="3.2" fill="${INK}"/>
      ${mouthSvg}`;
  }

  // Each pose: frame size, body heights (how far C is pushed down; bigger = lower),
  // arms that follow the body, hands that stay on the edge, and its face.
  const POSE_DEF = {
    "push-up": {
      w: 120, edge: 104, dur: "2.4s",
      // low -> high -> hold -> low
      body: [26, 10, 10, 26], keyTimes: "0;0.45;0.7;1", still: 10,
      // arms: shoulder, elbow, hand. Elbows bend out when low, straighten when high.
      arms: (d) => {
        const low = d > 18;
        return [
          `M21 ${50 + d} L${low ? 3 : 15} ${low ? 82 : 81} L12 102`,
          `M97 ${60 + d} L${low ? 117 : 104} ${low ? 84 : 86} L108 102`
        ];
      },
      hands: `<path d="M4 102 L20 102" ${LIMB}/><path d="M100 102 L116 102" ${LIMB}/>`,
      face: poseFace(0, -0.5,
        `<path d="M48 40 Q52.5 37 57 39 M72 40 Q67.5 37 63 39" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
        `<path d="M51 65 Q60 75 69 65 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`),
      label: "C, the PrivaC mascot, pushing himself up from behind the popup"
    },
    "cliff-hang": {
      w: 120, edge: 80, dur: "3s",
      // peeking -> pulls up -> holds -> slips -> peeking
      body: [19, 15, 16, 24, 19], keyTimes: "0;0.3;0.5;0.75;1", still: 16,
      arms: () => [],
      // fingertips curled over the edge, in front of the popup
      hands: `
        <path d="M15 80 L15 73 M21 80 L21 72 M27 80 L27 73" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <path d="M93 80 L93 73 M99 80 L99 72 M105 80 L105 73" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
      face: poseFace(0, -2,
        `<path d="M48 43 L57 39.5 M72 43 L63 39.5" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
        `<path d="M51 69 Q55.5 65 60 69 T69 69" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`),
      label: "C, the PrivaC mascot, hanging onto the top of the popup"
    }
  };

  let poseCount = 0;
  function poseSvg(pose, opts) {
    const def = POSE_DEF[pose];
    const size = opts.size || 120;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = opts.animate !== false && !reduce;
    const clip = `privac-edge-${pose}-${++poseCount}`;
    const keys = def.keyTimes;
    const splines = EASE.replace(/(0\.45 0 0\.55 1;?)+/, Array(def.body.length - 1).fill("0.45 0 0.55 1").join(";"));
    const start = animate ? def.body[0] : def.still;

    const bodyAnim = animate
      ? `<animateTransform attributeName="transform" type="translate" values="${def.body.map((d) => `0 ${d}`).join(";")}" keyTimes="${keys}" dur="${def.dur}" repeatCount="indefinite" ${splines}/>`
      : "";
    const arms = def.arms(start).map((d, i) => {
      const anim = animate
        ? `<animate attributeName="d" values="${def.body.map((b) => def.arms(b)[i]).join(";")}" keyTimes="${keys}" dur="${def.dur}" repeatCount="indefinite" ${splines}/>`
        : "";
      return `<path d="${d}" ${LIMB}>${anim}</path>`;
    }).join("");

    const w = (size * def.w) / def.edge;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${def.w} ${def.edge}" width="${Math.round(w)}" height="${size}" role="img" aria-label="${opts.label || def.label}">
      <defs><clipPath id="${clip}"><rect x="-10" y="-10" width="${def.w + 20}" height="${def.edge + 10}"/></clipPath></defs>
      <g clip-path="url(#${clip})">
        ${arms}
        <g transform="translate(0 ${start})">${bodyAnim}${def.face}</g>
        ${def.hands}
      </g>
    </svg>`;
  }

  function svg(mood = "happy", opts = {}) {
    if (POSES.includes(mood)) return poseSvg(mood, opts);
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

  window.PrivaCMascot = { svg, moodForGrade, wordmark, POSES };
})();
