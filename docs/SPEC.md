# PrivaC: Spec (v3, 2026-10-24; matches the code on main and docs/IDEA.md)

## Goal
A Chrome extension that shows which companies a website connects you to, what it stores in your browser, and grades the site's privacy A-F. "C", an on-screen letter-C character, helps you decline cookie tracking, answers questions, and warns you about risky sites. **Gemma 4 (Google, March 31 2026) runs on your computer and is C's brain.**

## Users
Everyday internet users, students included, who worry their data is collected and sold but can't read network logs or privacy policies.

## Why it fits "Fresh off the frontier"
- **Gemma 4** (released March 31, 2026): runs locally through Ollama (E4B on the demo Mac). It answers Ask C questions from the evidence PrivaC collected, with a source label on every fact, and (R3) reads privacy policies. Nothing leaves the device.
- **RegTrack** (arXiv 2603.02679, March 2026): evidence that accepting all cookies brings in more trackers. C quotes it when offering to decline (R1).
- **Pentagon 1260H list** (updated June 8, 2026; adds Alibaba and Baidu): sharpens the foreign-adversary flag (R2).
- Also current: the 2026 California Data Broker Registry and Have I Been Pwned, both downloaded daily.

## How it works (built)
- **Tracker capture** (background/tracking.js): every request a page makes is matched against `shared/atlas.json`, 3,721 tracker domains from DuckDuckGo Tracker Radar (company, category, country when known, fingerprinting 0-3). Requests to the site itself or the company that owns the site don't count. Only real web pages count as visits (not new-tab or settings pages).
- **Cookie inventory** (shared/cookies.js): 4 s and 15 s after a page loads, PrivaC lists the cookies the site and its trackers keep, and labels each with the Open Cookie Database (`shared/cookie-db.json`): needed for the site / remembers settings / measures your visits / advertising and profiling. **Only cookie names, owner and lifetime are stored, never their contents.**
- **Cookie banners** (content/cookie-detector.js + content/c-prompt.js, Matthew): finds the site's reject button by its wording; C offers "Decline for me", clicks it, and confirms it worked by reading the consent tool's own record (OneTrust, Ensighten, CookieYes, Cookiebot, Didomi; yes/no only, nothing stored); elsewhere it honestly says it couldn't verify. Records `declined`, `accepted` (you clicked Accept), or `no-reject` (banner had Accept but no Reject).
- **Public lists** (shared/lists.js): at startup and once a day, downloads the **whole** Have I Been Pwned breach list and the California Data Broker Registry, then matches on the computer. Trackers owned by a registered broker are marked; a site's own breach is attached.
- **Ask C** (dashboard/ask-c.js, Max + shared/askc.js): the question goes to Gemma with the evidence (your sites riskiest first, trackers, cookies, breaches, brokers, checked background facts, and facts about any company or site named in the question). Code fixes Gemma's formatting slips and source tags. Gemma never computes scores.

## How the grade works (shared/data.js; keep popup, dashboard table and this list in sync)
An **exposure score 0-100** (higher = more exposed), computed by code from fixed rules. Only things PrivaC actually saw or found on record add points; unknown things add 0 but are shown as "not checked yet", never as safe.
- Tracker companies: 5 points per company, up to 40. **A company counts once, however many web addresses it loads from** (Google has 96 in the Atlas), and **over several visits only companies seen on at least half of the site's visits add points**; the others are listed on a 0-point line ("Also seen on fewer than half of your N visits"). A visit is one page load (background/tracking.js `countVisit`). Records without visit counts (older data, samples) count every company. **Companies that loaded only after you clicked Accept** (every one of their addresses first seen on a visit after the Accept click; `afterAccept` on the tracker) are listed on a 0-point line: the grade is about the site, and accepting already costs the 10 cookie points. If the same company later loads on a visit without an Accept click, the mark comes off and it counts. Repo owner 2026-10-24: scores swung between reloads and between people because ad auctions load different addresses and companies each time and the 7-day record only ever grew.
- Ad, data-broker or session-recording companies (among those counted): 5 points each, up to 20 (a company counts here if any of its trackers is advertising/session recording or its owner is a registered California data broker).
- Cookies: accepted all 10; banner with no Reject button 10; no banner while trackers or tracking cookies are present 10 ("you were never asked"); declined 0; no banner and no tracking 0.
- Foreign-adversary line, counted once: 15. Triggered by a tracker company based in a listed foreign-adversary country (15 CFR 7.4) or on the 1260H list, a site owned by a company in a listed country, (F1) a site whose own web address ends in a listed country's code (.cn .hk .ru .su .рф .ir .cu .kp .ve), (F2) a state-run news site of a listed country (`shared/state-media.json`: State Media Monitor, State-Controlled or Captured Public outlets only), or (F3) a site whose own server address is registered in a listed country (`shared/ip-countries.json`, regional internet registries; where the address holder is registered, not proof of where the machine is). Outside servers with those endings or registered addresses whose owner is unknown are shown as a 0-point label.
- Privacy policy: sells 15, shares 8, neither 0, not checked yet 0, read but silent 0 ("Privacy policy read, but it doesn't say whether it sells or shares"). (R3 fills this in.)
- The site's own data breaches (Have I Been Pwned), all listed, the worst one counts once: reported in the last 12 months 15; happened in the last 5 years 5; older than 5 years 0, unless major (100 million+ accounts) 5. (Rule v4, repo owner 2026-10-24.)
- Capped at 100. Grades: **A** 0-20, **B** 21-40, **C** 41-60, **D** 61-80, **F** 81-100.
- The rubric is our team's proposal, not a validated measure. Say so in the pitch.
- **Range, coverage and label** (ideas from Justin's `New-Privacy-Grade_Scale` doc, repo owner 2026-10-24: hone, don't replace). Unknown lines still add 0 to the score, but each grade also shows: the **range** (best = the score; worst = the score if every unknown line turned out as badly as it could, capped at 100), the **coverage** (share of the rubric's 115 possible points that are settled; an unread policy leaves 100 of 115, 87%), and a label: **Fully checked** when nothing is unknown, otherwise **Partly checked**, naming what's missing. Today the only line that can be unknown is the privacy policy.

## The Knowledge Map (from the team doc; built in R3)
- `shared/knowledge-map.json` lists the checks PrivaC runs on every site: id, plain-English question, evidence type (Observed / Disclosed in policy / Government list / Public record), answered by code or Gemma, and its points.
- Gemma's policy questions: Does it say it sells personal info? Share with partners or advertisers? Allow opting out? Gemma answers yes, no or unknown plus the exact sentence; code checks the sentence is really in the policy, otherwise "unknown".
- The dashboard shows it as "What C checked".

## Features and acceptance criteria
- **F1 Real tracking data. Built.** Accept: on a real news site the dashboard shows real trackers and the "sample data" note disappears (R0 live check).
- **F2 Grade. Built.** Every rule has unit tests (node --test).
- **F3 C on cookie banners. Built (JavaScript, no Gemma).** Accept: works on 3 real sites (R0: list them in STATUS.md).
- **F4 Gemma reads the privacy policy. Built, needs live check (R3).** Finds the policy link, fetches the text inside the extension, answers the Knowledge Map questions locally, fills `policy` with the quoted sentence. Accept: matches a human check on 2 demo sites.
- **F5 Foreign-adversary alert. Scoring built; on-page alert not built (R2, R4).** Triggered by a company in a 15 CFR 7.4 country or on the 1260H list. Names the company, the list and the date. Never claims data went to a government.
- **F6 Unsafe-site warning. Not built (R5, Matthew).** Grade F plus a flagged company or a recent breach shows C's warning with Go back / Continue anyway. Warns; doesn't hard-block.
- **F7 Ask C. Built** on the dashboard. R6 adds a popup "Ask C why" button and suggestions based on your own browsing.
- **F8 What a site collects. Built (in Ask C).** Cookies by purpose, named advertising cookies with company and lifetime, how many aren't needed, fingerprinting trackers.

## Privacy promise (shown in the dashboard footer)
- Browsing and questions stay on the computer. PrivaC downloads whole public lists; it never sends what you visit.
- Stores site names and cookie names only; deletes history older than 7 days. Daily totals for the impact and safety views (numbers only, no site names: C's pop-ups and clicks, grades, trackers, cookies) are kept 90 days (repo owner, 2026-10-24). "Clear my PrivaC data" erases everything.
- Gemma runs locally; do not switch to Ollama cloud models (`:cloud`) without changing this promise.

## Design
- Keep the existing look: theme.css, the mascot moods and the rounded cards. Apple-level polish: smooth, clear, one main action per screen.

## Out of scope
Tracing data after collection, mobile and other browsers, deletion requests, training models, accounts, the Chrome Web Store, GLiNER2-PII, an update server (long-term idea only).

## Honesty rules (judges will check)
- Keep labels separate: **Seen on your visits in the last 7 days** (observed; a site's record combines its visits for 7 days), **Disclosed in policy**, **Public record** (breaches, broker registry, government lists), **Unknown downstream use**.
- Every alert names its source and date.
- A tracker loading means a company *could* collect data; it doesn't prove data was sold.
- Credit sources (licenses require it): Tracker Radar (CC BY-NC-SA 4.0), Have I Been Pwned (CC BY 4.0), Open Cookie Database (Apache 2.0), CPPA registry.
