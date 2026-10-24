# Data sources and why each is "recent"

Checked 2026-10-23 by Max (with Claude). Every date below was read from the source itself, not from memory. Use this page for the Devpost "what makes it recent" answer and the pitch slide.

## Theme answer: recent (first public after Oct 23, 2025)

| What | First public | Proof | What PrivaC uses it for |
|---|---|---|---|
| **Gemma 4** (E4B, run locally through Ollama) | **Mar 31, 2026** | [Google's Gemma releases page](https://ai.google.dev/gemma/docs/releases?hl=en) | C's brain: Ask C answers, on this computer |
| **RegTrack** (UBC research) | **Feb 2026** (NDSS MADWeb), arXiv 2603.02679 Mar 2026 | [Paper PDF](https://www.ndss-symposium.org/wp-content/uploads/madweb2026-10.pdf), [UBC page](https://spg.cs.ubc.ca/publication/2026-madweb/), [code](https://github.com/ubc-spg/RegTrack) | `shared/regtrack-facts.json`: what accepting cookies does to tracking, with page numbers |
| **Section 1260H list update** | **Jun 8, 2026** (Federal Register Jun 10, 2026) | [Federal Register 2026-11571](https://www.federalregister.gov/documents/2026/06/10/2026-11571/notice-of-availability-of-designation-of-chinese-military-companies), [official PDF](https://media.defense.gov/2026/Jun/08/2003945537/-1/-1/1/ENTITIES-IDENTIFIED-AS-CHINESE-MILITARY-COMPANIES-OPERATING-IN-THE-UNITED-STATES-IN-ACCORDANCE-WITH-SECTION-1260H.PDF) | `shared/flagged-companies.json`: first time Baidu and Alibaba are listed |

## Supporting sources (older, NOT the theme answer)

| What | License / terms | Used in |
|---|---|---|
| DuckDuckGo Tracker Radar | CC BY-NC-SA 4.0 (non-commercial, credit required) | `shared/atlas.json` (built by `scripts/build-atlas.js`) |
| Have I Been Pwned breach list | Must credit "Breach data from Have I Been Pwned" with a link | Daily breach refresh (`shared/lists.js`) |
| California Data Broker Registry | Public state data | Daily broker refresh (`shared/lists.js`) |
| Commerce "foreign adversary" countries, 15 CFR 7.4 | Federal regulation | Country flag in the score (`shared/data.js`) |

## Two different government lists: don't mix them up
- **15 CFR 7.4 (Commerce)** lists *countries*: China (incl. Hong Kong), Cuba, Iran, North Korea, Russia, Venezuela. The score's foreign-adversary points use this. It's why Yandex (Russia) and TikTok/ByteDance (China) get flagged.
- **Section 1260H (Department of War)** lists *companies*. On it and seen in our tracker data: **Baidu, Alibaba, Tencent, Qihoo 360, TP-Link**. **Not on it: ByteDance/TikTok, Yandex.** Never say "TikTok is on the Pentagon list."
- Alibaba is suing to get off the 1260H list (N.D. Cal. No. 5:26-cv-06227, filed Jun 23, 2026; no ruling removing it as of Aug 28, 2026). Say so when flagging Alibaba.

## RegTrack wording rules (judges may check)
- It tested **no click vs. accept-all only**. It never measured rejecting. Say "accepting all brought in more trackers," never "rejecting removes X."
- Figures are crawl averages over 743 sites, not a measurement of the user's site.
- Strongest line for a U.S. demo: from Ohio, accepting all raised tracking domains per site from 48.5 to 56.2 (p. 4). In France it went from 9.3 to 33.9 (p. 4), which shows how much regulation matters.

## Not wired in yet
`flagged-companies.json` and `regtrack-facts.json` are data files only. Connecting them to Ask C and the popup touches `shared/askc.js`, `shared/data.js` and `popup/popup.js`, so it waits for the repo owner.
