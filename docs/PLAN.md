# PrivaC: Plan (v2; deadline Sun Oct 25 5 PM ET, submit by 4 PM, feature freeze Sun 11 AM)
Owner areas: **core** (background/data plumbing), **gemma**, **data**, **ui**, **demo**. One branch per person; merge to `main` when the step's check passes. Pull before every step.

## Fri night
- [ ] 1. [core] Put this folder on GitHub (repo: gormandyp/HackAGator_Privacy_Extension) and add `tests/` using Node's built-in test runner (no installs). First test: `computeScore` from shared/data.js.
  Verify: `node --test` passes; the files show on GitHub; the extension loads at chrome://extensions.
- [ ] 2. [gemma] Hour-1 Gemma check:
  - Install Hugging Face's "Transformers.js Gemma 4 Browser Assistant" from the Chrome Web Store on the demo Mac.
  - Record the model download size, the load time and the time per answer in docs/RISK-CHECKS.md.
  - Confirm the Gemma 4 release date (ai.google.dev/gemma/docs/releases).
  Verify: numbers recorded and a go/no-go decision made.
- [ ] 3. [core] background.js service worker: capture third-party requests per tab (webRequest), map them with `shared/trackers.json`, and write `privacData`. Add the `webRequest` and `host_permissions` entries plus `background` to manifest.json.
  Verify: tests for the third-party check and domain cleanup; real trackers appear in the popup on a news site.
- [ ] 4. [data] `shared/trackers.json` (about 300-500 common tracker domains from DuckDuckGo Tracker Radar, mapped to company/category/country) and `shared/flagged-companies.json` (10-20 hand-checked entries from the 1260H list and the screening list, each with list name, date and source URL). Find 2 real demo sites that load Baidu, Alibaba, Tencent or Yandex scripts.
  Verify: known domains map correctly; every flagged entry has a source.

## Sat morning (checkpoint 1 PM: real data in the popup + Gemma loading)
- [ ] 5. [ui] Show the **Privacy Score (100 - exposure)** and the new grade bands everywhere (popup, dashboard, "How the grade works" table). Add a "What C checked" panel that reads knowledge-map.json.
  Verify: the grade boundary tests pass; screenshots on 3 sites.
- [ ] 6. [core] Cookie-banner detection by selectors (OneTrust, Cookiebot, Quantcast, TrustArc, Didomi), wired to `PrivaCPrompt.cookie({onDecline})`. Record the choice in `cookieChoice`.
  Verify: decline works on 3 real sites (list them).
- [ ] 7. [gemma] Offscreen document runs Gemma 4 E2B (Transformers.js + WebGPU, library file vendored in `lib/`, because MV3 forbids remote code). A message API: `askGemma({task, text})` returns JSON.
  Verify: a test prompt answers in the extension on the demo Mac; the time is logged.

## Sat afternoon/evening
- [ ] 8. [gemma] Unfamiliar cookie banners: send the banner text to Gemma and get back the reject button's label and one sentence. Fall back to scripted lines.
- [ ] 9. [gemma] Privacy-policy reader: find the policy link, fetch it, answer the Knowledge Map questions with quotes, and fill `policy`.
  Verify: matches a human check on 2 sites.
- [ ] 10. [data+ui] Foreign-adversary alert uses flagged-companies.json (names the list and date); unsafe-site warning overlay for F + flagged.
- [ ] 11. [gemma+ui] "Ask C why" button in the popup.
- [ ] 12. [data] RegTrack facts (`shared/regtrack-facts.json`, with page references); C quotes one in cookie advice.

## Sun (freeze 11 AM)
- [ ] 13. [ui] Polish: loading/empty/error states, animations. Run `/check-diff`.
- [ ] 14. [demo] README, "why it's recent" slide with dates, docs/DIFFICULTIES.md.
- [ ] 15. [demo] 3-minute video: problem → live demo on 3 sites → Gemma on-device → limitations.
- [ ] 16. [demo] Devpost: title, description, public repo, video, roster, challenges (Fresh off the frontier, Best Beginner Hack, any Gemma sponsor prize). **Submit by 4 PM.**
