# Data sources (what PrivaC uses, why, and how it stays private)
Owner: Josh (data). Written 2026-10-24 by Claude while Josh was away; Josh to check.

Privacy rule for every source: **download the whole file, match on the computer.** PrivaC never sends a site, company or cookie to any service.

| Source | What we use | File / how it updates | License / credit | Recent? |
|---|---|---|---|---|
| DuckDuckGo Tracker Radar (US crawl) | Tracker domain → company, category, fingerprinting score | `shared/atlas.json` (3,721 domains, 1,943 companies), rebuilt with `node scripts/build-atlas.js <tracker-radar clone>` | CC BY-NC-SA 4.0, non-commercial, credit required | No (supporting) |
| Open Cookie Database | Cookie name → company, purpose, lifetime | `shared/cookie-db.json` (~2,000 cookies + 261 patterns), `node scripts/build-cookie-db.js <csv>` | Apache 2.0 | No (supporting) |
| Have I Been Pwned breaches | A site's own breaches: date, accounts, data exposed | Downloaded whole by the extension daily (`https://haveibeenpwned.com/api/v3/breaches`, ~1,050 breaches, no key) | CC BY 4.0, must link haveibeenpwned.com | Updated daily |
| California Data Broker Registry (CPPA) | Is a tracker's owner a registered data broker | Downloaded whole daily (`https://cppa.ca.gov/data_broker_registry/registry.csv`, 603 brokers in 2026) | Public record | Yes (2026 registrations) |
| Company headquarters countries | Foreign-adversary flag (15 CFR 7.4 countries) | Hand list `COUNTRY` in scripts/build-atlas.js (~70 companies) | Our own | — |
| DoD Section 1260H list | Chinese military companies (Alibaba, Baidu added June 8, 2026) | **To do (PLAN R2):** `shared/flagged-companies.json`, 10-20 hand-checked entries with source URLs | Public record | Yes (June 2026) |
| RegTrack (arXiv 2603.02679) | Published figures on how accepting cookies changes tracking | **To do (PLAN R1):** `shared/regtrack-facts.json` with section numbers | Cite the paper | Yes (March 2026) |

## Known gaps
- Countries are known for only ~10% of tracker domains; unknown never triggers a flag.
- Broker matching uses exact names (minus "Inc", "LLC"...) or the broker's website; the registered name is shown so a person can check it.
- HIBP matches the site's own domain only (not the trackers').
- Dropped: Globus RegTrack raw data (1.5 TB), Commerce Consolidated Screening List, IP-to-country database.
