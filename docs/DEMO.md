# Demo and video plan (draft 2026-10-24; presenters Matthew, Max, Justin; recorded on the repo owner's Mac)
Video limit: **3 minutes**. Rehearse every step on the recording Mac first; anything that fails twice gets cut.
Judging round 1 is offline (Sunday night): judges see only the Devpost page, this video and the repo. Show every feature working on screen, and say the limits out loud.

## Before recording (checklist, repo owner)
- [ ] C's brain ready (main is the in-browser version): Dashboard → Ask C shows it's ready. If not, click **Download C's brain** (2.0 GB) well before recording, then ask one question so the first load is done. Ollama is only needed for the `ollama` branch (docs/OLLAMA.md).
- [ ] `chrome://extensions` → reload PrivaC. No errors on its card.
- [ ] Turn off other extensions that pop up on sites (an ID.me coupon pop-up appeared on economist.com).
- [ ] Dashboard → **Clear my PrivaC data**, so only the demo sites show.
- [ ] Visit the demo sites below once, 20 s each, so the dashboard has data; then ask C each demo question once (Gemma's first answer is the slowest).
- [ ] Mac: Do Not Disturb on, hide the bookmarks bar, close other tabs, zoom Chrome to 110% for readability.

## Why these sites (US visitors rarely see cookie banners)
From Florida, Stack Overflow, the Guardian, BBC, the Economist, OneTrust and Cookiebot showed **no** banner. So:
| Show | Site | What to point at |
|---|---|---|
| Breach + "never asked" | wired.com | Grade F, "Data breach reported in the last year (WIRED, 2025)" |
| No Reject button | cnn.com (Agree only) or ikea.com/us (Ok + "Your privacy choices") | "Cookie banner had no Reject button" |
| C declines for you | `preview/demo-site.html` (Matthew's demo page), or a U.K. site where C was checked (gov.uk says "Nice!") | C pops up → "Protect me" |
| Foreign-adversary alert | baidu.com | C's alert names Baidu, China and the Pentagon 1260H list (June 2026) |
| Ask C | dashboard | "What is cnn.com collecting about me?", "Was wired.com hacked?" |

## 3-minute script (draft)
- **0:00-0:25 Justin, problem.** Sites quietly hand your visit to dozens of companies; banners are confusing or missing; nobody reads policies.
- **0:25-1:40 Matthew, live demo.** wired.com → popup grade F and why. cnn.com → no Reject button. Demo page → C declines for you. baidu.com → C's foreign-adversary alert. Dashboard → "Who followed you across sites".
- **1:40-2:25 Max, Ask C.** Ask the two questions; point at the source labels (HIBP, Cookie Database, Government list). Say: Gemma 4 runs inside Chrome on this laptop; nothing leaves it.
- **2:25-3:00 Justin, what's new + limits.** Gemma 4 (Mar 31 2026) running in Chrome with LiteRT-LM (May 2026), RegTrack (2026 study of 743 sites), Pentagon 1260H list (Jun 8 2026), 2026 California broker registry. Limits: a tracker loading doesn't prove data was sold; country is known for only some companies; the rubric is ours, not a validated measure; the AI needs a one-time 2 GB download and a graphics chip Chrome can use (grades and C work without it).

## Open items
- Matthew: C pop-up for no-Reject banners (IKEA) pointing to "Your privacy choices"; optional RegTrack line in the cookie pop-up via `await PrivaCRegTrack.line()` (content/regtrack-line.js).
- Confirm baidu.com triggers the alert on the recording Mac (R4 check).
