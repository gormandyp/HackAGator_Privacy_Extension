# Idea inbox: Gator Hack V (UF AI Days 2026)
_Last reviewed 2026-10-24 (Sat, ~7:45 PM ET, Max's Claude: statuses on every idea; open ones are PLAN R19). Ideas stay as the team wrote them; **Status** notes and corrections are marked. Source of truth for build details: docs/SPEC.md and docs/PLAN.md._

## Hard facts (from Devpost, checked 2026-10-23)
- Hacking: Fri Oct 23 5:00 PM -> **Sun Oct 25 5:00 PM ET (48h). Late submissions not accepted.**
- In person: Newell Hall, UF. Top 10 finalists present live Mon Oct 26 (Reitz Union, 10:15-11:15 AM).
- Team: 2-5 people, every member registered. Students only.
- Prizes: 1st $2,000 / 2nd $1,000 / 3rd $500. Tracks: Best Beginner Hack, Best Design, Best AI Hack, Best Social Impact. Sponsor challenges + MLH prizes exist (details not on page). One project can win several.
  - **Correction 2026-10-24:** the prize pages now list no tracks. Sponsor prizes: Best Use of Gemma (MLH), Best Open Source Project (MLH, public repo with a clear open-source license), Best Use of the Twinly API, Vobile Prize. Rules: team members from at least two UF departments; all code written during the hacking period; at least one member at the Monday 10:15 AM finals in person to win. Finalists are picked on impact, technicality, design, novelty and presentation.
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
**Status (Sat 4 PM):** tracking, grading, C on cookie banners (with decline checks on five consent tools), Ask C, the policy reader, the on-page foreign-adversary alert and the glass dashboard work. Unsafe-site warning built 2026-10-25 (PLAN R5): it warns with Go back / Continue anyway, never blocks. Ask C answers still need work (R13).
Source: team Google Doc + linked idea chats (read 2026-10-23). The Google Doc will keep changing: re-read it if unsure.
Team doc: https://docs.google.com/document/d/16WMA557yYF0qcxb9CSYCB0wrmqSXE2lS4e98C3C6bAQ/edit

- A Chrome extension that watches which companies each page you visit contacts, gives sites a privacy grade, and explains it.
- **"C"**: a letter-C stick-figure mascot that appears on the page. It points to the reject button on cookie banners, warns or blocks on abnormally unsafe sites, and links to a full site summary.
- **Dashboard**: per-site and overall privacy exposure score (0-100), with evidence. **Status:** per-site done; overall score not shown yet.
- **Foreign-adversary flag**: C alerts when a page loads a service from a company on an official U.S. government list.

## The "recent" tech (central to the build)
1. **Gemma 4 (E4B on the demo Mac, E2B on 8 GB laptops)**, released **March 31, 2026** (ai.google.dev/gemma/docs/releases). **Changed 2026-10-23:** runs locally through **Ollama** (not Transformers.js in the browser), and cookie banners are handled by plain JavaScript, not Gemma (a teammate's point: the page's own code is faster and more reliable). Gemma is C's brain for **Ask C** (answers with source labels) and, next, the **privacy-policy reader**. Nothing leaves the device.
2. **RegTrack** (arXiv 2603.02679, March 2026; NDSS MADWeb 2026). Crawls of 743 sites from 8 locations, 4 browsers, 2 consent states. It backs C's advice: "accepting brought in X more trackers." Do not claim "rejecting removes X." **Status: not in the code yet (PLAN R1).** Figures to use (from the team doc): accepting raised ad/tracking companies per site 16% for Ohio (48.5 to 56.2) and 265% for France (§IV-B, Fig. 4); EU visitors saw about 80% fewer trackers before accepting (Abstract, §V-A); Brave loaded about 31% fewer trackers than Chrome from Ohio (§IV-A); entertainment sites were 10% of sites but 28% of tracking, news 5% and 19% (Appendix F).
3. **Pentagon Section 1260H list, updated June 8, 2026** (65 entities added, including Alibaba and Baidu as parent companies; 10 removed; about 188 listed in total). It drives the foreign-adversary flag. **Status: not in the code yet (PLAN R2).**
4. **LiteRT-LM for the web** (Google; first npm release May 18, 2026; we use 0.18.0 from Oct 6, 2026): runs Gemma 4 E2B inside Chrome on the graphics chip, so the in-browser version needs no Ollama (the main download since 2026-10-24; the Ollama-only version is branch `ollama`).
5. **New since Friday, also recent:** the **2026 California Data Broker Registry** (CPPA; brokers registered Jan 2026, page updated July 2026) is downloaded daily; **Have I Been Pwned** adds breaches daily (131 added in the past year, e.g. wired.com, zara.com).

Supporting (older, so NOT the theme answer): DuckDuckGo Tracker Radar (domain to company; noncommercial license; **in use as shared/atlas.json**), Open Cookie Database (cookie purposes; Apache 2.0; **in use**), Have I Been Pwned (**in use**), California data-broker registry (**in use**). Not used: Commerce Consolidated Screening List, IP-to-country database (dropped for time).

## Rules we already agreed on
- The score is a rules-based "privacy exposure score" computed by ordinary code. AI explains it; AI does not compute it.
- Keep three labels separate: "Seen on your visits in the last 7 days", "Disclosed in policy", "Unknown downstream use". Missing data shows as "unknown", never as safe.
  - **Clarified 2026-10-23 (repo owner):** unknown things add 0 points to the score, but the screen still says "not checked yet" or "unknown", never "safe".
- Foreign-adversary alerts must name the list and its date, e.g. "This page loaded a service from Baidu, which the U.S. Defense Department lists as a Chinese military company (June 2026)". Never "this site sends your data to China".
- Domain mappings to listed companies are a hand-checked JSON file (10-20 entries for the demo). No live fuzzy matching. **Status:** the file (shared/flagged-companies.json) is not made yet (PLAN R2); today the flag uses company headquarters countries hand-mapped in scripts/build-atlas.js.
- Browsing data stays on the device. **Added 2026-10-23:** PrivaC may download whole public lists (the same file for everyone) but never sends a site or company name to any service. It stores site names and cookie names only (never full addresses or cookie contents) and deletes history after 7 days.
- Existing tools we must out-explain: Ghostery/WhoTracks.Me, Blacklight, ToS;DR, PrivacySpy, PRISMe. Our edge is clarity, evidence, and the C experience.

## Design
- Apple-like: clean, smooth, rounded corners, important things easy to reach, looks professional and polished.

## Risks to check in hour 1 (all resolved Fri night)
- Gemma 4 size and speed: E4B through Ollama answers Ask C questions on the demo Mac (24 GB). Answer time not logged yet (log it in PLAN R9). Fallback: e2b.
- RegTrack processed data: dropped (raw data ~1.5 TB). Using the paper's published figures.
- Real demo site that loads a 1260H-listed company: **still open** (PLAN R2).
- Hour-8 checkpoint: mostly passed (Gemma answers in the extension; C's cookie pop-up works in Matthew's tests; request capture passes its tests). A full live check of the latest build is PLAN R0.

## Suggested split for 5 people (from the idea chat)
1. Extension shell + network monitoring
2. C + Gemma 4 integration
3. RegTrack data + 1260H/screening-list JSON
4. Dashboard + privacy grade
5. Demo, pitch, testing, Devpost submission

## Pitch line (draft, updated Sat)
"PrivaC's C answers your privacy questions on your own computer with Google's March 2026 Gemma 4, backs every 'click no' with a March 2026 study of 743 websites, checks every site against today's data-breach and data-broker lists, and flags services from companies on the Pentagon's June 2026 Chinese military companies list."

## Team answers (2026-10-23)
- Skills: **mostly beginners**. Claude writes most of the code. Keep the stack as simple as possible and explain choices in plain words.
- Collaboration: **one shared GitHub repo**, one branch per person, merging to main often.
- Demo laptop: the repo owner's MacBook Pro (Apple Silicon, 24 GB, confirmed); a second laptop for bigger tests.
- Extra prize target: **Best Beginner Hack** (plus the main awards; Fresh off the frontier is the prompt).

## Max
- Editable UI thats customizable to what you want (i.e, green, dark mode, light mode, etc)
  - **Status: done 2026-10-24.** Settings > Appearance: Auto/Light/Dark, Liquid glass or Clean, and six glass colors (R10, R15). The older `max/themes` accent-color branch (R8) was not merged; the glass colors replace it.
- Grading scale that has a breakdown of the score and why it is that way. MAKE SURE THAT IF COOKIES ARE UNABLE TO BE DECLINED, THAT IMPACTS THE SCORE IN SOME WAY.
  - **Status: done.** Every grade lists each line and its points. A banner with no Reject button = 10 points; no banner while the site tracks you = 10 ("you were never asked").
- URGENT: CHECK TERMS OF SERVICES OF EACH WEBSITE AND INCORPORATE INTO SCORE
  - **Status (checked 2026-10-24 7:45 PM): half done.** Part 1 is built: the privacy-policy reader (R3) reads each site's policy, quotes "sells"/"shares", and feeds the grade. Part 2, terms of service (PLAN R7), is **not started** and is marked stretch, so it won't make Sunday's freeze. It stays in the plan for after the hackathon.
- Make sure that the suggested Ask C topics adjust to your browsing trends.
  - **Status: done 2026-10-24** (PLAN R6): Ask C's suggested questions are built from your own week (your riskiest site, the company that followed you most, a breached site you visited).
- Make it so we are able to customize the liquid glass (i.e., green hue background, blue hue background, etc).
  - **Status: done 2026-10-24 (branch `max/glass-tint`).** Settings > Appearance > Glass color: Aurora (original), Ocean (blue), Forest (green), Sunset, Rose, Graphite, each in light and dark.
 - Mcdonalds.com has a warning about cookies usage but C does not pop up with a warning and yield sign.
   - **Status (checked live 2026-10-24 7:45 PM): fixed 2026-10-24 night (PLAN R19a).** Was: McDonald's (US) shows a strip at the top with **no buttons at all**: "By continuing to use our website, you agree to the revised Terms…", plus a link to opt out of ad sharing ("McDonald's Privacy Rights Center"). C only reacts to banners with Accept/Reject buttons, so he stays silent. Fix: treat "by continuing to use … you agree/consent" notices with no Reject as accept-only, show C's "Beware!" with the yield sign, and point to the opt-out link. **Update 10 PM: still silent on the real site** (Max). The real strip has an Accept button and is 835 characters, over the detector's 600 limit; fixed on branch `cookie-mcd` (limit 1,000), checked in Chromium on a copy of the real strip.
 - When Ask C is generating responses, often generates a big paragraph then before it can be read cuts down half of it. May be part of the solution to the "What to do next" problem we wanted fix, but this is a bad solution as it looks confusing to the user.
   - **Status (checked in the code 2026-10-24): fixed 2026-10-24 night (PLAN R19b).** Was: Cause: while Gemma writes, the panel shows the raw text (only "What you can do" is hidden). When it finishes, the cleaned answer replaces it: repeated sentences, "Earlier I told you…", made-up source tags and unsupported tags are removed, and for plain questions the steps are dropped. So the answer visibly shrinks. Fix: run the same cleaning on the text while it streams, so what you read never changes at the end.
 - C logo in "this week tab" isnt actual C mascot - most if instances of capital C in reference to Ask C or C in general should be the C logo.
   - **Status: done 2026-10-24 night (PLAN R19c).** Was: "C stepped in" (home page, This week) and the C's impact tab use a plain orange arc icon (shared/icons.js "c"), not C's face. The new tab icons (branch `max/icon-tabs`) already use C's face for Ask C. Fix: one small C-face icon used wherever C is meant.
 - Look for ways for the home page to be decluttered and be less overwhelming and plan and render - report to either Preston or max with rendering before pushing to main
   - **Status: done 2026-10-25 (PLAN R19d): Preston picked rendering A** (cookie card moved to Safety, row Ask C buttons show on hover, top 5 companies). Renderings first (2-3 options), shown to Preston or Max before anything goes to main.
 - Headers like "Worth knowing" and "This week" should be larger or bolded in some way/more prominent so that a users eyes would first see the header before seeing whats in the box because some test users have had confusion with what each box does. 
   - **Status: done 2026-10-24 night (PLAN R19e): titles 17.5 px bold.** Was: Card titles are 15 px semibold today (dashboard.css `.card h2`), close to the text under them. Fix: bigger, bolder titles with more space below, rendered for review together with R19d.
 - Ask C answers "Has tik tok had any data breaches recently?" (with a space) from Gemma instead of the breach list: no "Have I Been Pwned" check, and an unsure answer ("I do not have information..."). "Check the I've been pwned list" right after also went to Gemma, tagged the breach claim [Seen on your visit] and repeated the after-a-breach steps although there is no breach. Minor, but fix before Sunday.
   - **Status (checked on main bb99bfc, 2026-10-24 9:10 PM): not fixed; now PLAN R19g, due before the Sunday 11 AM freeze.** **Update 10:30 PM: done on branch `askc-r19`, waiting for merge.** "TikTok" written as one word is answered from the list correctly; "tik tok" isn't recognized, so it never reaches the list, and the follow-up has no site to carry over. Also, when it works it says "no breach on record for ByteDance", not the name you asked about.
 - "Is you tube safe?" and "Is YouTube safe?" (Max, real Gemma on main, 2026-10-24 9:15 PM) got two different, vague answers. Neither gave YouTube's grade; one called Google a company "tracking you on YouTube" (Google owns YouTube); the tips list was 1 step in one, 4+ in the other.
   - **Status (checked on main 40d2501): not fixed; now PLAN R19h (with R19g), due before the Sunday 11 AM freeze.** **Update 10:30 PM: done on branch `askc-r19`, waiting for merge.** "you tube" isn't recognized (R19g). With "YouTube", Gemma *was* given YouTube's grade and its owner, and ignored both. "Is X safe?" questions should be answered from PrivaC's own records, like grade and breach questions. Worse (9:18 PM): "Is FaceBook safe?" said "Facebook has a history of data breaches ... change your password immediately" (made up, no source), while "Has meta had any data breaches?" correctly said Have I Been Pwned has no breach on record for Facebook; "Is Meta safe?" implied being US-based is a risk. Added to R19h with a guard against made-up breach claims.
 - Ask C said "PrivaC has no record of any trackers being labelled malware" while the dashboard's "What the trackers were for" shows 1 labelled malware (ECO PC - Complex Solutions, on tass.com).
   - **Status (reproduced on main b8ddd42): not fixed; now PLAN R19k, in the "Do next" list.** **Update 10:30 PM: done on branch `askc-r19`, waiting for merge.** Ask C only sees trackers from its 4 most detailed sites and the 10 companies seen most; a one-site malware tracker is cut. Fix: give Ask C the same per-purpose lists as the dashboard card.
 - Less hard-coding in Ask C (Max, 2026-10-24 9:20 PM): instead of a new special case for every wording ("tik tok", "you tube", "Is X safe?"), build two general mechanisms. (1) **Fuzzy name matching**: one matcher that ignores spaces, punctuation and small typos and compares against every known site and company, so "tik tok", "you tube", "face book" and "linkdin" all resolve without alias lists. (2) **Cite-and-check**: every sentence Gemma writes must carry a source tag that exists in the evidence and name only sites/companies the evidence is about; code drops or replaces sentences that don't (a general version of the made-up-Facebook-breach guard). Keep the code-built answers for grades, breaches and "Is X safe?" (the "code computes, AI explains" rule). Later, after the hackathon: let Gemma 4 call lookup tools (function calling) instead of keyword routing.
   - **Status: now PLAN R19i, and the preferred way to do R19g and R19h.** **Update 10:30 PM: name fixer and cite-and-check done on branch `askc-r19`, waiting for merge; tool calling (R19j) stays for after the hackathon.** Tool calling is listed as post-hackathon (R19j) because it adds a model turn per lookup and is risky before the freeze.

**Justin
- Have a "Clear Cache" button within PrivaC to clear users chache with a possible explanation for users about what it does and how its useful.
  - **Status: done 2026-10-24 (per site)**, same as Smiley's idea below: the popup's "Clear this site's data", with an explanation.

## Smiley
- Clear cache button within PrivaC, with explanation on what it means to clear ur cache and how its good
  - **Status: done 2026-10-24 (per site).** The popup's "Clear this site's data" clears that site's own cookies, storage and cache after a second tap, and explains what it does and doesn't do (other companies' tracking cookies stay). Uses Chrome's "browsingData" permission (no install warning).
- Change "decline extras" on C popup to "protect me" because its sounds better.
  - **Status: done 2026-10-24** (repo owner asked): the button says "Protect me" everywhere. Also new: Settings > "Protect me automatically" declines with no click.
-   Could not verify that the website saved your choice on a couple websites. Said "could not verify" if site made choice or not 
  - **Status: fixed 2026-10-24.** C now reads the choice from Ensighten (John Lewis), CookieYes, Cookiebot and Didomi as well as OneTrust; a site with none of these still gets the honest "couldn't verify".
- 

## From the team Google Doc (read 2026-10-24 4 PM)
- Show the PrivaC grade box in the top right as soon as you open a site, with an x to close it (you shouldn't have to click the extension).
  - **Status: done 2026-10-24.** A small grade box shows 4 seconds after a site opens, once per site a day, closes by itself after 8 seconds, has an x, and opens the full panel when clicked (content/grade-chip.js). Settings > "Show the grade box" turns it off.
- After you decline or accept cookies, a short box that explains what your choice means for your visit.
  - **Status: done 2026-10-24.** After C's "Nice!" (or after you click the site's own Accept/Reject), the same box says what the choice means: trackers can still load, and the 10 cookie points come off (or are added).
- The grade's color coding needs to be more visible and accessible.
  - **Status: done 2026-10-24.** Grade badges and grade-colored text now meet the WCAG AA contrast standard (4.5:1) in light and dark mode (tests/grade-colors.test.js).
