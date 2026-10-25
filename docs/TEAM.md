# Who built what (final, Sun Oct 25)

| Person | Area | What they built |
|---|---|---|
| Repo owner (gormandyp) | core + integrator | Background tracker recording and data plumbing, the score rules (`shared/data.js`: breach rule v4, country web address, server location, more company countries), C's impact counters, the unsafe-site warning, the dashboard and popup redesign (liquid glass), steadier grades, Gemma running inside Chrome (LiteRT-LM), the security fixes before the Chrome Web Store, every merge, and the real-browser tests on the Mac and the Windows laptop |
| Max Glassman | ask-c + data | The Ask C panel and its fixes (docs/ASKC-FIXES.md, PLAN R13 and R19), RegTrack facts, the Pentagon 1260H list, state-run media, the privacy-policy reader and Knowledge Map, the date checks in docs/DATA.md, Chrome Web Store readiness, dashboard tab icons, glass colors and C's white limbs on dark sites |
| Matthew Finkelstein | ui | C on web pages (`content/c-prompt.js` and his poses), the cookie-banner detector (`content/cookie-detector.js`) and the first tracker recorder |
| Justin Smilowitz | demo | The Devpost draft, demo sites and testing, the grading-scale review that gave every grade its range and "Fully/Partly checked" label (PLAN R17), bug reports from testing |
| Josh Davis | data | The data lane: lists and their sources (docs/DATA.md) |

Video presenters: Matthew, Max and Justin, recorded on the repo owner's Mac.

## How we worked
- Everyone used GitHub Desktop: **Fetch origin, then Pull**, work on your own branch, one docs/PLAN.md step at a time, push when the step's check passes. Never "Force push". Push code, not zip files.
- Shared files needed the repo owner's OK first: `shared/data.js` (score rules), `shared/askc.js`, `shared/gemma.js`, `shared/lists.js`, `background/tracking.js`, `manifest.json`.
- Don't edit another area's files without telling them; post in the group chat when you push.
- Feature freeze Sun 11 AM ET, submission by 4 PM.
- The status board and decision log we kept during the hackathon: [history/STATUS.md](history/STATUS.md).
