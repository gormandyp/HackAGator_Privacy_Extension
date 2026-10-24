# Devpost submission draft (paste into gatorhack2026.devpost.com; due Sun Oct 25 5:00 PM ET, aim for 4 PM)
Checked against the code on main, 2026-10-24. Before pasting, re-read docs/SPEC.md "Honesty rules" and change any number that has changed.

**Prizes to select:** Best Use of Gemma (MLH; Devpost calls it "Best Use of Gemini", the UF prizes page says "Build with Gemma, Google's open model, free on the Gemini API or run locally"), Best Open Source Project (MLH; the repo is MIT licensed since 2026-10-24), Vobile Prize. The main awards need no selection. Twinly needs Twinly's own APIs, so skip it.

---

## Project name
PrivaC

## Tagline (under 200 characters)
See which companies a website hands your visit to, get a privacy grade from A to F, and let C, a little letter-C mascot, say no to tracking cookies for you.

## Inspiration
One website visit can quietly hand you to dozens of companies. Cookie banners are confusing, often have no Reject button, and many U.S. visitors never see one at all. Nobody reads privacy policies. Our team of five, mostly first-time hackers, wanted something an ordinary person could understand at a glance, built on public data and 2026 research, without sending anyone's browsing to a server.

## What it does
- **Sees** which tracker companies each page loads (3,721 known tracker domains from DuckDuckGo Tracker Radar) and which cookies it sets, labeled by purpose with the Open Cookie Database. It stores names only, never cookie contents or full web addresses.
- **Grades** every site from A to F with a rules-based score in which every point is explained: trackers, data brokers, breaches, cookie banners with no Reject button, and links to companies in countries on the U.S. foreign-adversary list.
- **Acts on cookie banners.** C appears beside the pop-up and offers "Protect me", clicks Reject for you, and checks the site really saved your choice (OneTrust, Ensighten, CookieYes, Cookiebot, Didomi and GOV.UK records). C says "Beware!" when a banner only lets you accept.
- **Flags foreign-adversary links.** When a page loads a service from a company on the Pentagon's Section 1260H list (updated June 8, 2026), C names the company, the list and its date.
- **Checks public records** downloaded whole every day: Have I Been Pwned breaches and the 2026 California Data Broker Registry (603 companies). PrivaC never looks up a single site, so nobody learns what you visit.
- **Ask C**: questions answered by Gemma 4 from what PrivaC saw, with a source tag on every fact. C also reads privacy policies for "sells" and "shares" and only shows a quote if it appears word for word in the policy.

## How we built it
- A plain-JavaScript Chrome extension (Manifest V3), no build step, so all five of us could read and change it.
- **Gemma 4 E2B runs inside Chrome** on the computer's graphics chip with Google's LiteRT-LM web runtime (WebGPU). On our MacBook Pro the first words of an answer appear in about 0.8 seconds. Ollama with Gemma 4 E4B is the fallback. Nothing leaves the computer.
- The grade is computed by code, not by the AI, so it is the same every time and every point can be traced to evidence. Gemma explains and reads; it never sets the score.
- 425 automated tests (Node's built-in test runner), plus live checks on real sites logged in docs/STATUS.md.

## What's new (Fresh off the frontier)
Each of these was first made public in the 12 months before the hackathon and does real work in PrivaC (dashboard > About lists dates, proof links and the files that use each one):
- **Gemma 4** (Google, March 31, 2026): C's brain.
- **LiteRT-LM for the web** (Google, first released May 18, 2026): runs Gemma 4 inside Chrome.
- **RegTrack study** (NDSS MADWeb, February 2026; 743 websites from 8 locations): accepting all cookies raised tracking from 48.5 to 56.2 domains per site from Ohio. C quotes it with section numbers.
- **Pentagon Section 1260H list** (June 8, 2026 update, first listing Alibaba and Baidu): drives the foreign-adversary alert.
- **California Data Broker Registry** (2026 registrations).

## Challenges we ran into
- Running Gemma in the browser: loading the model froze Chrome for 15 to 20 seconds while it built about 150 graphics programs; we now build them the non-blocking way first (check the `brain-no-freeze` fix is on main before pasting).
- Every consent tool saves your choice differently, and some pop-ups live inside frames or shadow roots where a normal content script can't see them.
- U.S. visitors rarely see cookie banners, so we test on U.K. sites and our own demo page.
- Gemma sometimes invented source labels; code now cleans the answer and every evidence line carries its tag.
- Five beginners sharing one Git repo: zip uploads and a scary "Force push" button taught us to pull first and push small.
More in docs/DIFFICULTIES.md.

## Accomplishments that we're proud of
- An AI assistant that runs fully on your own computer, inside the browser, with no app to install.
- A grade where every point has a reason and a source.
- C actually clicks Reject and checks it worked, instead of just telling you to.

## What we learned
- Detecting a tracker is easy; explaining it honestly is hard. A tracker loading means a company could collect data; it doesn't prove your data was sold, and PrivaC says so.
- Plain code beats an AI model for clicking buttons; the AI is best at explaining.

## What's next
- A Chrome Web Store release, with tracker data we're licensed to use commercially (Tracker Radar is non-commercial).
- More consent tools and button wordings, collected from real sites.
- A warning page before you open a site with an F grade and a flagged owner.

## Limitations (say these out loud)
- The grading rubric is ours, not a validated measure.
- The owner country is known for only some tracker companies.
- The AI needs a one-time 2 GB download and a computer whose graphics chip Chrome can use (any Apple-silicon Mac, most recent Windows laptops). Grades and C's pop-ups work without it.
- English-language sites only.

## Built with
javascript, chrome-extension, manifest-v3, gemma, litert-lm, webgpu, ollama, duckduckgo-tracker-radar, have-i-been-pwned, open-cookie-database, node.js

## Links
- Code: https://github.com/gormandyp/HackAGator_Privacy_Extension (MIT license; download main.zip; setup in README)
- Privacy policy: PRIVACY.md in the repo
- Video: (paste the YouTube or Vimeo link, 3:00 or shorter)
