# Handoff: finishing PrivaC on the repo owner's Mac (written 2026-10-24 Sat ~2:45 AM)
From here on, all UI and code work happens **on the Mac with Claude Code in this folder** (not the cloud session).
Read this first, then CLAUDE.md, docs/PLAN.md, docs/STATUS.md, docs/SPEC.md (Honesty rules).
Deadline: feature freeze **Sun Oct 25 11 AM ET**, submit by **4 PM** (hard deadline 5 PM).

## Start a session (every time)
1. Terminal: `cd ~/Documents/GitHub/HackAGator_Privacy_Extension && git pull && node --test` (expect **131 passing**).
2. If the Mac restarted: `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"`, then reopen Ollama.
3. Start Claude Code here, `/clear`, then `/next-step` (or name the step below).
4. After each step: `node --test`, reload the extension in chrome://extensions, check it in Chrome, commit, `git push` (works directly on the Mac; GitHub Desktop is fine too). **Never force push.** One PLAN.md step per commit.
5. Teammates' zips on GitHub: unzip outside the repo, diff, copy only newer files, delete the zip (done for "Hack 2.zip").

## State of main (all pushed)
- Score rules: foreign-adversary line = one 15 points from any of: tracker company in a listed country or on the 1260H list, site owner in a listed country, **F1** country web address (.ir .ru .cn ...), **F2** state-run media (Max, State Media Monitor), **F3** site's own server registered in a listed country. Unknown outside servers with those endings/addresses = 0-point label. **F4** 33 more company countries.
- Breach rule v4: last 12 months 15, last 5 years 5, older 0 unless 100M+ accounts (5); all breaches listed.
- google.com false flag fixed (Google's result prefetch no longer counts as trackers).
- Matthew's latest `content/c-prompt.js` + `content/cookie-detector.js` merged **unchanged**; poses in `c-poses/`.
- `content/c-events.js` (ours) wraps PrivaCPrompt: counts every C pop-up and click, and reports cookie choices (declined / no-reject / accepted) to the background.
- **R12 counters**: `shared/stats.js` + `background/stats.js`, key `privacStats`, numbers only, 90 days. Use `PrivaCStats.summary(stats, "day" | "week" | "month")`: `totals.popups` (all of C's pop-ups), `totals.events["decline-click" | "decline-confirmed" | "choose-click" | "rejected-on-site" | "accepted-on-site" | "popup-cookie" | "popup-accept-only" | "popup-adversary"]`, plus `sites, grades{A..F}, unsafeSites, flaggedSites, breachedSites, trackers, adTrackers, cookies, trackingCookies, declined, accepted, noReject, neverAsked`, and `days[]` for charts.
- Speed: a page's burst of trackers = one storage write.
- Google pre-loads (prefetch, reported as "main_frame" or "other") never count as trackers: google.com should grade A (about 8, from its policy).
- Pages already open when PrivaC starts (after a reload) are recorded; the popup never shows sample data inside the real extension ("I haven't checked X yet").
- Labels (repo owner, option 1): a site's record combines its visits for 7 days, so "Why this grade" says "Seen on your visits in the last 7 days".
- Smoke-tested in a real Chromium (cloud): C's cookie prompt, accept-only warning with pose images, counters and today's snapshot all work.

## Known issues to fix
- **F3 is missing China / Hong Kong / North Korea**: `privac-rir-apnic.txt` never reached Downloads (Chrome blocks a 2nd download from the same site until you click Allow). Get it, put it next to the other two in `~/Documents/GitHub/`, then: `node scripts/build-ip-countries.js ../privac-rir-ripencc.txt ../privac-rir-apnic.txt ../privac-rir-lacnic.txt && node --test`, commit, push. (Source: https://ftp.ripe.net/pub/stats/apnic/delegated-apnic-extended-latest, ~9 MB; the build keeps only the 7 countries.)
- Matthew's `cookie-detector.js` also writes `privacData` directly after a confirmed decline (races with the background). c-events.js already reports it properly; **ask Matthew** to delete that block (lines ~327-344) instead of us editing his file.
- Matthew's `findPrivacyOptOutButton` clicks "Do not sell or share my personal information" automatically. Confirm with him that this is intended and say so in the demo.
- C's on-page alert has no wording for sites flagged only by web address (F1) or server location (F3). **Matthew**: add a line for "this site's address/server is in <country>".
- Temu still unflagged: Pinduoduo/PDD wording + source from **Max**.

## Game plan (in this order, so nothing undoes anything)
**Newest first (2026-10-24 ~9:25 PM): do the "⏩ Do next, before the Sun 11 AM freeze" list at the top of docs/PLAN.md before anything below.**
0. **Next up (done 2026-10-24, verify in the live check):** google.com = A after Clear my PrivaC data; popup shows your real site (never dailynews.example); grade lines say "Seen on your visits in the last 7 days". Dashboard wording should match when R10 is built.
1. **Live check** (repo owner, 15 min): reload, Clear my PrivaC data, visit google.com (expect A), search "aliexpress" (still A), baidu.com and ya.ru (C alert), tass.com/rt.com (state-run media line, no tass.ru label), granma.cu, en.irna.ir, cnn.com, wired.com (policy answers after ~1 min). Screenshot the popup for each; note results in STATUS.md.
2. **F3 APNIC** (above).
3. **R10 dashboard mockups**: after Matthew's code is in (done), the repo owner sends the design prompt; Claude builds 2-3 clickable variations (published as artifacts) of:
   - **What C did for you** (impact): C's pop-ups (total + by kind), Decline clicks, confirmed declines, rejected yourself, accepted; honest comparison "tracking cookies on sites you declined vs accepted". Never claim "trackers blocked" (PrivaC doesn't block).
   - **Your safety over time**: Day / Week / Month toggle from `PrivaCStats.summary`: grades, unsafe (F) and flagged sites, trackers, tracking cookies, cookie choices. Make it C-narrated (weekly report card, calendar of good/bad days), not generic charts (TraceGuard has 7d/30d charts).
4. **Build the chosen mockup** in dashboard.html/js (plain JS + inline SVG, no libraries; keep theme.css and C's moods). Matthew polishes.
5. **Typing guard** (with Matthew): when you start typing into an email/password field on an F-grade or flagged site, C warns once. Field type only, never the value. Count it as a pop-up event.
6. **Offline mode**: if Ollama isn't running, the popup/dashboard say "C's brain is offline: grades still work, Ask C and policy reading need Ollama" instead of erroring.
7. **Freeze 11 AM**: step 13 polish + `/check-diff HEAD~10`, then README for judges, DIFFICULTIES.md, Devpost (step 14-16), video on this Mac (Justin, Matthew, Max; script docs/DEMO.md).
- Hold: `max/themes` (R8) until the mockup picks a look; `max/mascot-poses` is superseded by Matthew's merged code (don't merge it).
- After the hackathon: Gemma in the browser (R11: WebGPU, cached once, Ollama fallback), Chrome Web Store package, export my data.

## Speed rules for anything new (it must stay fast when it ships in the browser)
- Background writes: batch them (see saveSite / background/stats.js), never one write per request.
- Big JSON (atlas 420 KB, cookie-db 320 KB, ip-countries 360 KB): load once per service-worker wake, look up with Maps/binary search, never scan per request.
- Dashboard: read `privacStats` totals (tiny) instead of re-scoring history; inline SVG charts; no frameworks.
- Content scripts run on every page: keep them small; do nothing until a banner or a field appears.
- Gemma: one call at a time, cache answers per site (the policy reader already does weekly).

## TraceGuard (github.com/luca-liceti/TraceGuard-Privacy-Extension): stay different
AGPL-3.0: take ideas only, never code. They: React dashboard, safety score (higher = safer), watch-only, ToS;DR ratings, Gemini Nano query box, PII field warnings, signed phishing feed, 7d/30d charts. Us: letter grade + C who acts (declines banners), foreign-adversary / 1260H / state media / server location, Gemma reading policies with checked quotes, local Ask C with sources, C-narrated impact and timeline.
