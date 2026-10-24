# Idea inbox: Gator Hack V (UF AI Days 2026)

## Hard facts (from Devpost, checked 2026-10-23)
- Hacking: Fri Oct 23 5:00 PM -> **Sun Oct 25 5:00 PM ET (48h). Late submissions not accepted.**
- In person: Newell Hall, UF. Top 10 finalists present live Mon Oct 26 (Reitz Union, 10:15-11:15 AM).
- Team: 2-5 people, every member registered. Students only.
- Prizes: 1st $2,000 / 2nd $1,000 / 3rd $500. Tracks: Best Beginner Hack, Best Design, Best AI Hack, Best Social Impact. Sponsor challenges + MLH prizes exist (details not on page). One project can win several.
- Sponsors: Vobile, Data Science & Informatics, MLH, Twinly. No sponsor APIs listed.
- Submit: title + description, **public GitHub repo**, **demo video <=3 min (or slides)**, team roster, tracks/challenges to be considered for. WIP demo is OK.

## Judging criteria
- Impact: meaningful problem, useful to real users
- Technical Execution: works, ambition, quality, work done during the hackathon
- Design & Usability: intuitive, accessible
- Presentation & Demo: clear problem/solution/approach/limitations, demo shows it running

## Challenge we are targeting: "Fresh off the frontier" (from the user's screenshot)
> Build a project that uses a technology, dataset, or discovery first made publicly available within the past 12 months to solve a problem, explore an idea, or create an experience in a field you care about. Bring your own field (biology, music, history...). The new technology/resource must be CENTRAL. Be ready to show what it does, what difficulties you faced, and explain what makes it recent.

- "Recent" means first public after ~Oct 23, 2025. We must be able to state the release date of the thing we use.
- Judges will ask: what is new, why central, what was hard. Keep a running log of difficulties in docs/DIFFICULTIES.md.

## What we are building: PrivaC (Chrome extension)
Source: team Google Doc + linked idea chats (read 2026-10-23). The Google Doc will keep changing: re-read it if unsure.
Team doc: https://docs.google.com/document/d/16WMA557yYF0qcxb9CSYCB0wrmqSXE2lS4e98C3C6bAQ/edit

- A Chrome extension that watches which companies each page you visit contacts, gives sites a privacy grade, and explains it.
- **"C"**: a letter-C stick-figure mascot that appears on the page. It points to the reject button on cookie banners, warns or blocks on abnormally unsafe sites, and links to a full site summary.
- **Dashboard**: per-site and overall privacy exposure score (0-100), with evidence.
- **Foreign-adversary flag**: C alerts when a page loads a service from a company on an official U.S. government list.

## The "recent" tech (central to the build)
1. **Gemma 4 E2B on-device** (Google, 2026; confirm exact date on ai.google.dev/gemma/docs/releases). Runs in the browser via Transformers.js + WebGPU. It is C's brain: it reads cookie-banner text, finds the real reject option, and explains in one sentence. Nothing leaves the device, which fits a privacy tool. Reference build: Hugging Face's "Transformers.js Gemma 4 Browser Assistant" extension (offscreen document runs the model, service worker routes messages, content script draws the UI).
2. **RegTrack** (arXiv 2603.02679, March 2026; NDSS MADWeb 2026). Crawls of 743 sites from 8 locations, 4 browsers, 2 consent states (no-click vs accept-all). It backs C's advice: "accepting brought in X more trackers." Do not claim "rejecting removes X."
3. **Pentagon Section 1260H list, updated June 8 2026** (188 entities, adds Alibaba and Baidu; Alibaba is contesting it in court). It drives the foreign-adversary flag.

Supporting (older, so NOT the theme answer): DuckDuckGo Tracker Radar (domain to company; noncommercial license), Commerce Consolidated Screening List (CSV/JSON), Have I Been Pwned (service-level breaches), California data-broker registry, IP-to-country database.

## Rules we already agreed on
- The score is a rules-based "privacy exposure score" computed by ordinary code. AI explains it; AI does not compute it.
- Keep three labels separate: "Observed during your visit", "Disclosed in policy", "Unknown downstream use". Missing data shows as "unknown", never as safe.
- Foreign-adversary alerts must name the list and its date, e.g. "This page loaded a service from Baidu, which the U.S. Defense Department lists as a Chinese military company (June 2026)". Never "this site sends your data to China".
- Domain mappings to listed companies are a hand-checked JSON file (10-20 entries for the demo). No live fuzzy matching.
- Browsing data stays on the device.
- Existing tools we must out-explain: Ghostery/WhoTracks.Me, Blacklight, ToS;DR, PrivacySpy, PRISMe. Our edge is clarity, evidence, and the C experience.

## Design
- Apple-like: clean, smooth, rounded corners, important things easy to reach, looks professional and polished.

## Risks to check in hour 1
- Gemma 4 E2B download size (reports range from ~500 MB to ~3 GB) and speed on the demo laptop. Fallback: C uses scripted lines for common banners; Gemma only does the dashboard Q&A.
- Whether RegTrack's processed data can be downloaded (the raw data is ~1.5 TB). Fallback: use the paper's published figures.
- Find a real demo site that loads a service from a 1260H-listed company.
- **Hour-8 checkpoint**: Gemma loads on the demo laptop, C appears on one real cookie banner, network requests are being captured.

## Suggested split for 5 people (from the idea chat)
1. Extension shell + network monitoring
2. C + Gemma 4 integration
3. RegTrack data + 1260H/screening-list JSON
4. Dashboard + privacy grade
5. Demo, pitch, testing, Devpost submission

## Pitch line (draft)
"PrivaC's C reads cookie banners on your device with Google's 2026 Gemma 4, backs every 'click no' with a March 2026 study of 743 websites, and flags services from companies on the Pentagon's June 2026 Chinese military companies list."

## Team answers (2026-10-23)
- Skills: **mostly beginners**. Claude writes most of the code. Keep the stack as simple as possible and explain choices in plain words.
- Collaboration: **one shared GitHub repo**, one branch per person, merging to main often.
- Demo laptop: the user's Mac (Apple Silicon assumed; confirm) or a second laptop they own.
- Extra prize target: **Best Beginner Hack** (plus the main awards; Fresh off the frontier is the prompt).

## Max
- Editable UI thats customizable to what you want (i.e, green, dark mode, light mode, etc)
- Grading scale that has a breakdown of the score and why it is that way. MAKE SURE THAT IF COOKIES ARE UNABLE TO BE DECLINED, THAT IMPACTS THE SCORE IN SOME WAY.
- URGENT: CHECK TERMS OF SERVICES OF EACH WEBSITE AND INCORPORATE INTO SCORE

