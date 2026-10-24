# PrivaC: Spec (v2, 2026-10-23 7:30 PM; matches the UI already built in popup/, dashboard/, content/, shared/)

## Goal
A Chrome extension that shows which companies a website connects you to and grades the site's privacy A-F. "C", an on-screen letter-C character, helps you decline cookie tracking and warns you about risky sites. **Gemma 4 (event sponsor; Google, 2026) runs on your device and is C's brain.**

## Users
Everyday internet users, students included, who worry their data is collected and sold but can't read network logs or privacy policies.

## Why it fits "Fresh off the frontier"
- **Gemma 4 E2B** (2026): runs locally in the browser (Transformers.js + WebGPU). It reads cookie banners and privacy policies, answers the Knowledge Map questions, and explains the grade. Nothing leaves the device.
- **RegTrack** (arXiv, March 2026): evidence that "accepting all cookies brought in more trackers."
- **Pentagon 1260H list** (updated June 8, 2026): names specific Chinese military companies such as Baidu and Alibaba. This sharpens the foreign-adversary flag.

## How the grade works (already built in shared/data.js; keep popup, dashboard and this table in sync)
- Code computes an **exposure score 0-100** from fixed rules (v3, Oct 23 9:45 PM: only things PrivaC actually saw or found on record add points; unknown = 0):
  - Trackers: 5 points each, up to 40. Tracker list = shared/atlas.json (DuckDuckGo Tracker Radar). Requests to the site's own company don't count.
  - Ad, data-broker or session-recording trackers: 5 points each, up to 20.
  - Cookies: accepted all 10, banner with no Reject button 10, no banner while trackers or tracking cookies are present 10 (you were never asked), declined 0, no banner and no tracking 0.
  - Foreign-adversary-country company present: 15.
  - Privacy policy: sells 15, shares 8, neither 0, not checked yet 0.
  - The site's own data breach (Have I Been Pwned): added in the last 12 months 15, older 5.
  - Capped at 100.
- **Shown to users as a Privacy Score = 100 - exposure** (higher is safer), with a letter grade:
  - **A** 80-100
  - **B** 60-79
  - **C** 40-59
  - **D** 20-39
  - **F** 0-19
- AI never computes points. Gemma supplies evidence (the policy answers, with a quoted sentence), and code applies the points.

## The Knowledge Map (from the team doc)
- `shared/knowledge-map.json` is the checklist PrivaC runs on every site.
- Each check has: an id, a plain-English question, its evidence type (Observed / Disclosed in policy / Government list), how it's answered (code or Gemma), and its points.
- Example Gemma questions about the policy:
  - Does it say it sells personal info?
  - Does it share with partners or advertisers?
  - Does it allow opting out?
- Gemma must answer yes, no or unknown, plus the exact sentence it relied on. If no sentence is found, the answer is "unknown".
- The dashboard shows the map as "What C checked".

## Features and acceptance criteria
- **F1 Real tracking data.** A background service worker records each tab's third-party requests and maps them to company, category and country (a Tracker Radar subset). It writes them to `chrome.storage.local.privacData` in the shape documented in shared/data.js. Accept: on a real news site, the popup shows real trackers and the "sample data" note disappears.
- **F2 Grade.** The popup and dashboard show the Privacy Score + letter from the rules above. Accept: unit tests for every rule, the caps and the grade boundaries.
- **F3 C on cookie banners.** C appears when a banner is detected (common consent tools by selectors; anything else by Gemma) and "Decline for me" clicks the real reject button. If it fails, C says where to look. Accept: works on 3 real sites, and still works with Gemma off.
- **F4 Gemma reads the privacy policy.** It finds the site's privacy-policy link, fetches the text, answers the Knowledge Map questions locally, and fills `policy.sells/shares/source` with the quoted sentence. Accept: on 2 demo sites, the answers match the policy text a human checked.
- **F5 Foreign-adversary alert.** It is triggered by a company in a listed country (15 CFR 7.4, already built) or on the 1260H list. The alert names the company, the list and the date. It never claims the data went to a government. Accept: shows on a real demo site.
- **F6 Unsafe-site warning.** Grade F plus a flagged company shows C's full warning with Go back / Continue anyway. It warns; it doesn't hard-block.
- **F7 "Ask C why".** In the popup, Gemma explains the grade in 2-3 sentences, using only the evidence shown.

## Design
- Keep the existing look: theme.css, the mascot moods and the rounded cards.
- Team goal is Apple-level polish: smooth, clear, one main action per screen.

## Out of scope
Tracing data after collection, mobile and other browsers, deletion requests, training models, accounts, the Chrome Web Store, GLiNER2-PII.

## Honesty rules (judges will check)
- Keep three labels separate: **Observed during your visit**, **Disclosed in policy**, **Unknown downstream use**.
- Every alert names its source and date.
- The rubric is our proposal, not a validated measure. Say so in the pitch.
