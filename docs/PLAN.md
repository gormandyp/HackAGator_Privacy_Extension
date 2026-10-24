# PrivaC: Plan (v3, 2026-10-24 Sat; deadline Sun Oct 25 5 PM ET, submit by 4 PM, feature freeze Sun 11 AM)
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
- [ ] **R0. [core] Live check of main.** Reload the extension, browse google.com, wired.com, zara.com, cnn.com (20 s each), open the dashboard, ask C 3 questions. Log in STATUS.md: grades, which sites showed C's cookie pop-up, Gemma answer time.
  Verify: real sites (not sample data); wired.com shows its breach; cnn.com shows "no Reject button".
- [ ] **R1. [core] RegTrack facts.** `shared/regtrack-facts.json` (4 figures with paper section numbers, from IDEA.md). C's cookie pop-up quotes one ("Accepting all cookies brought in 16% more trackers on average (RegTrack, 2026)"); Ask C gets them as [RegTrack] facts.
  Verify: test that every fact has a section reference; the pop-up shows the line.
- [ ] **R2. [data → core while Josh is away] 1260H list.** `shared/flagged-companies.json`: 10-20 hand-checked entries (company, list "DoD 1260H", date 2026-06-08, source URL, tracker domains they own from atlas.json). Adds to the foreign-adversary flag and Ask C ([Government list]). Find 1-2 real demo sites that load Baidu or Alibaba scripts.
  Verify: every entry has a source URL; a test site with a Baidu domain gets flagged with the list name and date.
- [ ] **R3. [ask-c: Max, core helps] Privacy-policy reader + Knowledge Map.** Find the policy link on the page, fetch the text from the background, Gemma answers sells / shares / opt-out with an exact quote, code checks the quote is in the text. Fills `policy`. `shared/knowledge-map.json` + "What C checked" list on the dashboard.
  Verify: matches a human check on 2 sites; a made-up quote becomes "unknown".
- [ ] **R4. [core + ui] Foreign-adversary alert on the page.** Background tells the tab when a flagged company loads; content script calls Matthew's `PrivaCPrompt.adversary(...)` with company, list and date.
  Verify: shows on the R2 demo site; wording follows the Honesty rules.
- [ ] **R5. [ui: Matthew] Unsafe-site warning.** Grade F + flagged company or recent breach → C's full warning, Go back / Continue anyway.
- [ ] **R6. [ask-c] Ask C from your browsing.** Suggested questions built from your riskiest site, top tracker company and any breached site; popup "Ask C why" button opens the dashboard with the question. Overall exposure score across sites on the dashboard (IDEA.md).
- [ ] **R7. [ask-c, stretch] Terms of service.** Same reader as R3 on the ToS page, or ToS;DR ratings only if a whole-list download exists.
- [ ] **R8. [ui, stretch] Themes** (light / dark / accent color) from shared/theme.css variables (Max's idea).
- [ ] **R9. [core] Reliability.** Keep the per-tab visit state in `chrome.storage.session` so trackers aren't missed after Chrome pauses the background script; more company countries in build-atlas.js (Chinese and Russian ad networks first).

## Sun (freeze 11 AM)
- [ ] 13. [ui] Polish: loading/empty/error states, animations. Run `/check-diff`.
- [ ] 14. [demo] README for judges, "why it's recent" slide with dates (Gemma 4 Mar 31 2026, RegTrack Mar 2026, 1260H Jun 8 2026, CA registry 2026), docs/DIFFICULTIES.md.
- [ ] 15. [demo] 3-minute video: problem → live demo on 3 sites (one breach, one no-Reject banner, one flagged company) → Ask C on-device → limitations.
- [ ] 16. [demo] Devpost: title, description, public repo, video, roster, challenges (Fresh off the frontier, Best Beginner Hack, Best AI Hack, Best Social Impact). **Submit by 4 PM.**
