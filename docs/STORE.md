# Publishing PrivaC on the Chrome Web Store

Status (2026-10-24, branch `max/store-ready`): the code meets every Store rule we can check in code (`tests/store-ready.test.js`).
What's left is the account, the upload and the forms below; every answer is written out so you can paste it.

## 1. Before you upload (people, not code)
- [ ] **Pick whose account publishes it.** The developer email can't be changed later, so use a team or repo-owner account, not a personal one you might drop.
- [ ] **Register** at https://chrome.google.com/webstore/devconsole: accept the developer agreement and pay the one-time registration fee. Google may ask you to turn on 2-Step Verification for the account.
- [ ] **Trader or non-trader:** a free student project with no business behind it is a **non-trader**.
- [ ] **Wait until after the hackathon (Sun 4 PM).** Review can take days to weeks for an extension that runs on every site, and nothing here is needed for judging.
- [ ] **Retake screenshots with real browsing** (optional but better): the ones in `store/` use the dashboard's sample data and show a "Sample data" badge.

## 2. Build the upload
```
node --test                       # everything must pass
node scripts/package-store.js     # makes dist/privac-<version>.zip (about 8 MB)
```
Upload that zip. It leaves out tests, docs, scripts and any bundled AI model (users download the model in Ask C).
Every later update: raise `"version"` in manifest.json first (for example 0.1.0 → 0.1.1), or the Store refuses the upload.

## 3. Store listing tab
- **Name:** PrivaC (from manifest.json)
- **Summary (from manifest.json, 132 characters max):** See which companies track you on each site, get an A-F privacy grade, and let C decline extra cookies. Its AI runs on your computer.
- **Category:** Privacy & Security (if not offered: Tools)
- **Language:** English
- **Store icon:** icons/icon128.png
- **Screenshots (1280×800):** store/screenshot-1-overview.png, -2-sites, -3-impact, -4-c-on-banner, -5-grades
- **Homepage / support URL:** https://github.com/gormandyp/HackAGator_Privacy_Extension
- **Description:**

> PrivaC shows you who is watching you online, and helps you do something about it.
>
> Every site you visit quietly connects you to other companies: advertisers, data brokers, analytics and session-recording services. PrivaC lists them for each site, explains what each one does, and gives the site a privacy grade from A to F. Every point in the grade is explained, and anything PrivaC couldn't check is marked "not checked yet", never "safe".
>
> MEET C
> C is PrivaC's on-screen helper. When a site shows a cookie banner, C offers to click Reject for you, then checks the site actually saved your choice. C warns you about banners with no Reject button, and about connections to companies on U.S. government lists (the Pentagon's Section 1260H list and the Commerce Department's foreign-adversary list), always naming the list and its date.
>
> ASK C
> Ask questions like "What is this site collecting about me?" or "Who is Criteo?" C answers in seconds with a source on every fact. C's AI, Google's Gemma 4, runs inside Chrome on your own computer (a one-time 2 GB download), so your questions and browsing never leave it.
>
> ALSO
> - Reads privacy policies and tells you whether a site says it sells or shares your data, with the exact quote.
> - Flags sites with data breaches (Have I Been Pwned) and trackers owned by registered data brokers (California).
> - Daily, weekly and monthly views of what C did for you and how safe your browsing was.
> - Light and dark mode, Liquid glass or Clean style, six glass colors.
>
> YOUR DATA STAYS YOURS
> PrivaC keeps site names (never full addresses) and cookie names (never their contents) on your computer for 7 days, and number-only daily totals for 90 days. It downloads whole public lists and matches them locally, so it never reveals what you visit. Nothing is sold or shared, and the PrivaC team never sees your data. One click erases everything.
>
> PrivaC observes what sites connect to; a tracker loading means a company could collect data, not proof it was sold. Built at Gator Hack V (University of Florida, 2026).
>
> Data: DuckDuckGo Tracker Radar (CC BY-NC-SA 4.0), Have I Been Pwned (CC BY 4.0), Open Cookie Database (Apache 2.0), California Data Broker Registry. AI: Gemma 4 with LiteRT-LM (Apache 2.0).

## 4. Privacy practices tab (paste these)
**Single purpose:**
> PrivaC shows users which companies track them on the websites they visit, grades each site's privacy, and helps them limit that tracking by declining optional cookies. Every feature (tracker list, grade, cookie help, alerts, and the on-device AI assistant that answers questions about this data) serves that one purpose.

**Permission justifications:**
| Permission | Justification |
|---|---|
| `storage` | Saves the user's 7-day list of visited site names, the trackers and cookie names seen on them, daily totals and settings, on the user's computer. |
| `unlimitedStorage` | The optional on-device AI model (Gemma 4, about 2 GB) is cached locally after the user clicks "Download C's brain"; it exceeds the default storage quota. |
| `webRequest` | Observes which third-party domains each page contacts so PrivaC can list the tracking companies on that site. Read-only; no requests are blocked or changed. |
| `webNavigation` | Knows when a tab starts a new page so trackers are counted for the right site, and ignores background pre-loads that the user never saw. |
| `cookies` | Lists the names, owners and lifetimes of cookies a site sets so PrivaC can show what it stores in the browser. Cookie values are never read into storage. |
| `alarms` | Refreshes the public breach and data-broker lists once a day. |
| `scripting` | When the user clicks the toolbar button on a tab that was open before PrivaC was installed, adds PrivaC's panel to that one tab. |
| `offscreen` | Runs the on-device AI model (Gemma 4 via WebGPU) in a hidden extension page, because a service worker can't use WebGPU. |
| Host permission `http://*/*`, `https://*/*` | PrivaC's purpose is to show who tracks the user on every site they visit, which requires observing requests on all sites, detecting cookie banners in the page so C can offer to decline them, and showing C's alerts on the page. |

**Remote code:** "No, I am not using remote code." All JavaScript and WebAssembly, including Google's LiteRT-LM runtime, is in the package (`vendor/litert-lm/`). The optional download from Hugging Face is model weights (data), pinned to one exact file and checked by size; it contains no code.

**Data usage, what PrivaC collects** (it stays on the device, but the Store counts anything the extension handles):
- [x] **Web history**: names of sites visited (not full URLs), kept 7 days on the device.
- [x] **Website content**: reads cookie-banner buttons and a site's privacy-policy text, on the device, to decline cookies and answer policy questions.
- [ ] Personally identifiable info, health, financial, authentication, personal communications, location, user activity (keystrokes, mouse): **not collected**.

**Certifications:** check all three: no selling or transferring to third parties outside the approved uses; no use or transfer for purposes unrelated to the single purpose; no use for creditworthiness or lending.

**Privacy policy URL:** https://github.com/gormandyp/HackAGator_Privacy_Extension/blob/main/PRIVACY.md (after `max/store-ready` is merged into main).

## 5. Things a reviewer may question (and our answer)
- **Runs on every site.** Needed for the single purpose; the justification above says why. Expect a longer "in-depth" review.
- **Clicks buttons on websites** (Reject, "Do not sell or share"). Disclosed in the description, the welcome page and PRIVACY.md. The cookie offer and automatic declining have switches in Settings › C on websites; the "Do not sell or share" click has no switch yet (it's in content/cookie-detector.js, Matthew's file). A switch for it would make review smoother.
- **Large WebAssembly file** (LiteRT-LM, 22 MB, Google's Apache 2.0 build, unmodified). It's minified, not obfuscated; its source is public.
- **Tracker Radar license is non-commercial (CC BY-NC-SA 4.0).** PrivaC must stay free, with no ads or paid features, and keep the credit.
- **Disclosure on install** (rule enforced since Aug 1, 2026): the welcome page (welcome/welcome.html) opens on first install and says what PrivaC keeps, what it does on websites and what it downloads. If PrivaC ever changes what it records or sends, update PRIVACY.md and the welcome page and tell users in the extension before shipping.

Sources: [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [2026 policy updates](https://developer.chrome.com/blog/cws-policy-updates-2026), [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [Listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Register](https://developer.chrome.com/docs/webstore/register).
