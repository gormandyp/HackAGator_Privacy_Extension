// Still copies of C's animated poses (repo owner, 2026-10-24). Matthew's pose files in c-poses/ loop a
// motion (C pushing up over the edge, or swaying while he hangs). When C reacts to your choice he should
// hold still, so this writes "-still" copies with every animation removed and each moving part set to
// where it is at one moment of the loop. The drawings themselves stay Matthew's.
//   node scripts/freeze-pose.js        (rewrites the still files from the originals)
// Tests: tests/freeze-pose.test.js
const fs = require("fs");
const path = require("path");

const STILL = {
  "mascot-push-up-uneasy.svg": "mascot-push-up-uneasy-still.svg",
  "mascot-cliff-hang-uneasy.svg": "mascot-cliff-hang-uneasy-still.svg"
};

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };
function setAttr(tag, name, value) {
  const re = new RegExp(`\\b${name}="[^"]*"`);
  return re.test(tag) ? tag.replace(re, `${name}="${value}"`) : `${tag} ${name}="${value}"`;
}

// The value an animation shows at time t (0..1 of its loop): the last keyframe at or before t.
function valueAt(anim, t) {
  const values = (attr(anim, "values") || "").split(";").map((v) => v.trim());
  const times = attr(anim, "keyTimes") ? attr(anim, "keyTimes").split(";").map(Number) : values.map((_, i) => (values.length > 1 ? i / (values.length - 1) : 0));
  let i = 0;
  for (let k = 0; k < times.length; k++) if (times[k] <= t + 1e-9) i = k;
  return values[Math.min(i, values.length - 1)];
}

// Each <animate>/<animateTransform> is the first child of the shape it moves.
function freeze(svg, t) {
  return svg.replace(/(<(?:path|g|circle|ellipse|line|polyline|polygon|rect)\b[^>]*?)>(\s*)<(animate|animateTransform)\b([^>]*?)\/>/g,
    (_, open, space, kind, anim) => {
      const value = valueAt(anim, t);
      const tag = kind === "animate"
        ? setAttr(open, attr(anim, "attributeName"), value)
        : setAttr(open, "transform", `${attr(anim, "type") || "translate"}(${value})`);
      return `${tag}>${space}`;
    });
}

if (require.main === module) {
  const dir = path.join(__dirname, "..", "c-poses");
  for (const [from, to] of Object.entries(STILL)) {
    fs.writeFileSync(path.join(dir, to), freeze(fs.readFileSync(path.join(dir, from), "utf8"), 0.5));
    console.log("wrote c-poses/" + to);
  }
}

module.exports = { freeze, valueAt, STILL };
