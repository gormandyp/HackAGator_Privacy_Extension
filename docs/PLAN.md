# PrivaC: Plan (v3.1, updated 2026-10-24 Sat; deadline Sun Oct 25 5 PM ET, submit by 4 PM, feature freeze Sun 11 AM)
Owner areas: **core** (repo owner + Claude: background, data plumbing, merges), **data** (Josh), **ask-c** (Max), **ui** (Matthew), **demo** (Justin). One branch per person; merge to `main` when the step's check passes. Pull before every step. Spec: docs/SPEC.md.

## Done (Fri night) — what changed from plan v2
- [x] 1. Repo on GitHub, `node --test` (39 tests passing).
- [x] 2. Gemma check. **Changed:** Gemma 4 E4B through **Ollama** (docs/OLLAMA.md), not Transformers.js.
- [x] 3. Background tracker capture (Matthew's recorder + Claude's fixes). **Changed:** uses `shared/atlas.json` (3,721 Tracker Radar domains, built by scripts/build-atlas.js) instead of a hand list; skips same-company requests and non-web pages; 7-day auto-delete.
- [~] 4. Data files. atlas.json done. `flagged-companies.json` **not done** → R2.
- [x] 5. Score display. **Changed:** keep the **exposure score** (higher = more exposed, matches IDEA.md); no "100 - exposure" conversion. Knowledge-map panel moved to R3.
- [x] 6. Cookie-banner detection by button wording (Matthew), records declined / accepted / no-reject. Selector list per consent tool not needed.
- [x] 7. Gemma reachable from the extension (shared/gemma.js via background.js).
- [ ] 8. **Dropped (2026-10-23):** Gemma reading unfamiliar banners. JavaScript handles banners.
- [x] 11. Ask C panel (Max) connected to Gemma with source labels, breaches, brokers, cookies.
- [x] New: daily HIBP + CA broker lists (shared/lists.js), cookie inventory (shared/cookies.js), scoring v3, privacy footer and source credits.

## Remaining (in this order, so no step undoes another)
- [x] **R0. Live check of main** (Sat; log in STATUS.md). Found 2 tracking bugs and that US visitors rarely see cookie banners (see docs/DEMO.md).
- [x] **R0b. Fixes:** wait for the Atlas before judging requests; ignore Google's prerendered results; record the site's owner; keep tab state when Chrome pauses the background script.
- [x] **R1. RegTrack facts** (Max: `shared/regtrack-facts.json`, used by Ask C). For C's cookie pop-up, `await PrivaCRegTrack.line()` is ready (content/regtrack-line.js); Matthew decides where it shows.
- [x] **R2. 1260H list** (Max: `shared/flagged-companies.json`, sourced to the Federal Register). Used in the score label (no double points), Ask C and the popup.
- [~] **R3. Privacy-policy reader + Knowledge Map.** Built (Max, branch max-policy-questions): `shared/knowledge-map.json` (8 policy questions with CCPA definitions + 5 code checks), `shared/policy.js` (link pick, passages, 2 questions per Gemma call, quote check), `background/policy-reader.js` (once a week per site, fetched without cookies), `content/policy-link.js`; Ask C quotes the answers. **Left:** live check on 2 sites vs a human reading; "What C checked" on the dashboard (R10).
  Verify: matches a human check on 2 sites; a made-up quote becomes "unknown".
- [x] **R4. Foreign-adversary alert on the page** (background/alerts.js + content/alerts.js call Matthew's `PrivaCPrompt.adversary`, naming the country and the 1260H list with its date). Also fires when the site itself belongs to a flagged company. **Live check on baidu.com still needed.**
- [ ] **R5. [ui: Matthew] Unsafe-site warning** (grade F + flagged company or recent breach → Go back / Continue anyway) and a C pop-up for banners with no Reject button (IKEA) pointing to the site's settings link.
- [~] **R6. Ask C from your browsing.** Done (Max): adaptive suggestions, popup "Ask C why". Left: overall exposure score across sites on the dashboard (goes into R10).
- [ ] **R7. [ask-c, stretch] Terms of service** through the R3 reader, or ToS;DR only if a whole-list download exists.
- [~] **R8. Themes** (Max, branch `max/themes`, not merged): dark mode, accent colors, larger text. Hold until the dashboard mockups (R10) pick a direction.
- [~] **R9. Reliability.** Done: tab state survives pauses. Left: more company countries in build-atlas.js; owner-name fixes from Tracker Radar quirks (e.g. cnevids.com shows a law firm).
- [ ] **F1. Country web address rule** (do first): site ending in a listed country's code (.ir .ru .su .cn .hk .cu .kp .ve .рф) → foreign-adversary line, 15 points, never doubled. Unknown outside servers with those endings → label only. See docs/HANDOFF.md.
- [ ] **F4. More company countries** in scripts/build-atlas.js (PDD/Temu wording with Max, Russian counters, Tencent ad networks).
- [ ] **F3. Server location**: country of each server's IP address from the regional internet registries' public lists (download through the repo owner's Chrome; keep only the 7 listed countries).
- [ ] **F2. [Max] State-media list** `shared/state-media.json`, each entry sourced (Xinhua, CGTN, RT, Sputnik, TASS, IRNA, PressTV, Granma, teleSUR, KCNA...).
- [ ] **F5. [stretch] "Who runs this site"**: Gemma reads the About/footer text, quote verified; label "The site says it is run by...".
- [ ] **R10. [ui] Dashboard mockups**: several clickable variations to compare; then build the chosen one with Matthew.
- [ ] **R11. [later, decided 2026-10-24] Gemma fully in the browser** (Transformers.js + WebGPU, Ollama as fallback). Only after the kinks and the UI are done.

## Sun (freeze 11 AM)
- [ ] 13. [ui] Polish: loading/empty/error states, animations. Run `/check-diff`.
- [ ] 14. [demo] README for judges, "why it's recent" slide with dates (Gemma 4 Mar 31 2026, RegTrack Mar 2026, 1260H Jun 8 2026, CA registry 2026), docs/DIFFICULTIES.md.
- [ ] 15. [demo: Matthew, Max, Justin] 3-minute video, script in docs/DEMO.md, recorded on the repo owner's Mac.
- [ ] 16. [demo] Devpost: title, description, public repo, video, roster, challenges (Fresh off the frontier, Best Beginner Hack, Best AI Hack, Best Social Impact). **Submit by 4 PM.**
