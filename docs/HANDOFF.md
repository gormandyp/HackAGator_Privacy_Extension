# Handoff for a new Claude chat (written 2026-10-24 Sat ~1:30 AM)
Read this first, then CLAUDE.md, docs/PLAN.md, docs/STATUS.md, docs/SPEC.md. Deadline: freeze **Sun Oct 25 11 AM**, submit by **4 PM** (hard deadline 5 PM ET).

## Setup facts
- Repo on the repo owner's Mac: `~/Documents/GitHub/HackAGator_Privacy_Extension` (GitHub: gormandyp/HackAGator_Privacy_Extension). **Not** the old Desktop/Projects copy.
- The device shell can't reach GitHub: commit with `git -c user.name=gormandyp -c user.email=gormandyp@users.noreply.github.com commit ...`, then **push with GitHub Desktop** (computer use: Fetch origin with cmd+shift+t, then Push origin). If Desktop offers **Force push, cancel**. Git needs delete permission in the repo folder (lock files).
- Chrome extension ID: `ffibpbmkiobahnldklmnmfjmagkcahdp`. Claude can't open chrome:// or chrome-extension:// pages; the repo owner reloads the extension and opens the dashboard. Use Claude in Chrome to browse test sites.
- Gemma 4 E4B via Ollama on the Mac. After a restart: `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"` and reopen Ollama (repo owner does this in Terminal).
- Tests: `node --test` (89 passing after the R3 merge).
- Cloud workspace can reach GitHub (used to build shared/atlas.json and shared/cookie-db.json) but not haveibeenpwned.com, cppa.ca.gov or the IP registries; fetch those through Chrome.

## Team right now
- Matthew (fink827): C pop-ups and poses. **Don't edit content/c-prompt.js, content/cookie-detector.js, shared/mascot.js.** Hold branch `max/mascot-poses` until he's done.
- Max: data and Ask C. Branch `max/themes` (R8) is **held** until the dashboard mockups. Owns F2.
- Justin, Matthew, Max: present the video (recorded on the repo owner's Mac). Script: docs/DEMO.md.
- Josh: away.

## Just merged (needs a live check by the repo owner)
- R3 privacy-policy reader (Max). R4 on-page foreign-adversary alert. 1260H list in the score. Tracking fixes (Atlas wait, prerender, site owner, tab state).
- Live check: reload extension, Clear my PrivaC data, visit google.com, baidu.com, ya.ru, cnn.com, wired.com; expect the adversary pop-up on baidu.com/ya.ru, no Temu/Baidu on google.com, policy answers appearing in the popup/dashboard after a minute.

## Problem found Sat 1 AM: state-run sites aren't flagged
Tested by listing every server each page contacted (Claude in Chrome, `performance.getEntriesByType('resource')`; replace dots in output, the tool redacts long hostnames) and running them through atlas.json:

| Site | Run by | Flagged? | Why not |
|---|---|---|---|
| en.irna.ir | Iran state news | No | owner unknown to Tracker Radar; only own analytics |
| english.news.cn | Xinhua (China) | No | loads nothing outside news.cn |
| cgtn.com | China state TV | No | only Google |
| granma.cu | Cuba state paper | No | cip.cu analytics not in Tracker Radar |
| presstv.ir → presstv.co.uk | Iran state TV | No | UK address, US trackers |
| temu.com | PDD Holdings | No | Pinduoduo country unknown; kwcdn.com not in Atlas |
| rt.com, tass.com | Russia state media | Yes | only via Yandex trackers |
| tiktok.com | ByteDance | Yes | owner known |

Causes: (1) site owner only known for big tracking companies; (2) country web address ignored; (3) local Russian/Chinese trackers missing from the US-crawl Tracker Radar (b37mrtl.ru, tns-counter.ru, yadro.ru, cip.cu); (4) only ~70 companies have a country; (5) server location unused (webRequest gives `details.ip`).

Fix plan (rules first; AI never sets points): F1 country web address → F4 more countries → F3 server location → F2 state-media list (Max) → F5 Gemma "who runs this site" with verified quote. See PLAN.md.

## Open questions for the repo owner
- F1: site's own country code = full 15 points (my suggestion), unknown outside servers with those endings = label only. Confirm.
- F3: OK to download the registries' lists (~30 MB, ripe.net / apnic.net / lacnic.net) through Chrome?
- R10 dashboard mockups (clickable variations, published as artifacts) are next after F1-F4; the repo owner will send a design prompt.
- R11 in-browser Gemma: later, only after kinks and UI.
