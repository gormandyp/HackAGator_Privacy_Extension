# Data sources and why each is "recent"
Owners: Max (checked the dates and the 1260H and RegTrack files) and Josh (data lane). Merged 2026-10-24 with a file-by-file table.

**Privacy rule for every source: download the whole file, match on the computer.** PrivaC never sends a site, company or cookie to any service.

Checked 2026-10-23 by Max. Every date below was read from the source itself, not from memory. Use this page for the Devpost "what makes it recent" answer and the pitch slide.

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

## Every file, how it updates, and its license
| Source | What we use | File / how it updates | License / credit | Recent? |
|---|---|---|---|---|
| DuckDuckGo Tracker Radar (US crawl) | Tracker domain → company, category, fingerprinting score | `shared/atlas.json` (3,721 domains, 1,943 companies), rebuilt with `node scripts/build-atlas.js <tracker-radar clone>` | CC BY-NC-SA 4.0, non-commercial, credit required | No (supporting) |
| Open Cookie Database (new Fri night) | Cookie name → company, purpose, lifetime | `shared/cookie-db.json` (~2,000 cookies + 261 patterns), `node scripts/build-cookie-db.js <csv>` | Apache 2.0 | No (supporting) |
| Have I Been Pwned breaches | A site's own breaches: date, accounts, data exposed | Downloaded whole by the extension daily (`https://haveibeenpwned.com/api/v3/breaches`, ~1,050 breaches, no key) | CC BY 4.0, must link haveibeenpwned.com | Updated daily |
| California Data Broker Registry (CPPA) | Is a tracker's owner a registered data broker | Downloaded whole daily (`https://cppa.ca.gov/data_broker_registry/registry.csv`, 603 brokers in 2026) | Public record | Yes (2026 registrations) |
| Company headquarters countries | Foreign-adversary flag (15 CFR 7.4 countries) | Hand list `COUNTRY` in scripts/build-atlas.js (~70 companies) | Our own | — |
| DoD Section 1260H list | Chinese military companies (Baidu and Alibaba added June 8, 2026) | `shared/flagged-companies.json` (Max, checked against the Federal Register); used in the score label, Ask C and the on-page alert | Public record | Yes (June 2026) |
| Regional internet registries (RIPE NCC, LACNIC; APNIC pending) | Which listed country a server's IP address block is registered to (F3) | `shared/ip-countries.json`, `node scripts/build-ip-countries.js <delegated-extended files>`; downloaded whole, only CN HK RU IR CU KP VE kept | Public statistics | Yes (Oct 2026) |
| RegTrack (arXiv 2603.02679) | Published figures on how accepting cookies changes tracking | `shared/regtrack-facts.json` (Max, with page numbers); used by Ask C, and available to C's cookie pop-up | Cite the paper | Yes (Feb/March 2026) |


## Known gaps
- Countries are known for only ~10% of tracker domains; unknown never triggers a flag.
- Broker matching uses exact names (minus "Inc", "LLC"...) or the broker's website; the registered name is shown so a person can check it.
- HIBP matches the site's own domain only (not the trackers').
- Dropped: Globus RegTrack raw data (1.5 TB), Commerce Consolidated Screening List, commercial IP-to-country databases (we use the registries' own public lists instead).

## State Media Monitor (F2: state-run news sites)
- What: classification of state and public media worldwide by the Media and Journalism Research Center (MJRC). We use outlets in the six 15 CFR 7.4 countries classified **State-Controlled** or **Captured Public** (not privately owned or independent ones).
- Where: https://statemediamonitor.com/ ; dataset: Dragomir, M. (2025), *State Media Monitor Global Dataset 2025*, Zenodo, https://doi.org/10.5281/zenodo.17219015. Outlet profiles used were updated June-September 2026.
- File: `shared/state-media.json` (hand-built 2026-10-24; 20 outlets, 61 domains). Each domain records its evidence: the outlet's profile, DuckDuckGo Tracker Radar's owner record, the outlet's Wikipedia infobox, or the team's Saturday test.
- Updates: by hand. The site states no license, so we store only outlet names, classifications, dates and links, and credit the source.
- Gaps: outlets without a confirmed domain are listed under `notYetListed`; their .cn/.ru/.ir/.cu/.kp addresses are still caught by F1.
