# PrivaC

**A Chrome extension that shows which companies a website hands your visit to, grades the site's privacy from A to F, and sends C, a little letter-C character, to say no to tracking cookies for you.**
C also answers your questions about what it saw, using **Gemma 4 running inside Chrome on your own computer**: your browsing and questions never leave it.

Built in 48 hours at Gator Hack V (UF AI Days 2026, Oct 23-25) for the "Fresh off the frontier" challenge, by a team of five mostly first-time hackers.

> **This is the main download: the in-browser AI version.** Prefer the Ollama app? Download the [`ollama` branch](https://github.com/gormandyp/PrivaC/archive/refs/heads/ollama.zip) (frozen on Oct 24; main has every later fix).

## For judges: a 3-minute tour
1. Load PrivaC (see **Install** below) and pin it from the puzzle-piece menu.
2. Visit two or three news or shopping sites. On most sites with a cookie pop-up, **C** appears next to it: click **Protect me** and C clicks Reject for you, then says **Nice!** only when the site's own consent record confirms it. On a pop-up with no Reject button, C says **Beware!**
3. Click the C toolbar button: the site's grade (A-F), whether it was Fully or Partly checked (and how high it could go), and every reason with its source.
4. Open the dashboard: **Sites** (who each site connected you to), **C's impact**, **Safety** (data breaches, data brokers, companies in U.S.-listed countries), **Grades** (how the grade works, point by point) and **About** (the 2026 technology, with dates and proof links).
5. In **Ask C**, try "Why did cnn.com get a C?" with a site you visited and its letter (answered from the score itself) and "Is any site I visited connected to China or Russia?" (written by Gemma 4 on this computer, with a source label on every fact).
6. No Chrome handy? Open `dashboard/dashboard.html` in any browser to see the interface with sample data. Tests: `node --test` (779 passing).

The demo script, with the sites and questions we checked on a Mac and a Windows laptop, is [docs/DEMO.md](docs/DEMO.md).

## What's recent (and central)
- **Gemma 4** (Google, released March 31, 2026): C's brain, running inside Chrome with Google's **LiteRT-LM web runtime** (first published May 18, 2026; we use 0.18.0 from Oct 6, 2026), or through Ollama.
- **RegTrack** (NDSS MADWeb, February 2026; arXiv 2603.02679): measured how accepting cookies changes tracking on 743 websites. C quotes it.
- **Pentagon 1260H list** (updated June 8, 2026, adds Alibaba and Baidu): powers the foreign-adversary flag.
- **California Data Broker Registry 2026** and **Have I Been Pwned**: downloaded fresh every day.

The dashboard's **About** tab lists each one with its date, a link to proof, and the files that use it.

## What it does
- **Sees** which trackers each page loads (3,721 known tracker domains from DuckDuckGo Tracker Radar) and which cookies it sets (labeled with the Open Cookie Database).
- **Grades** each site with a rules-based exposure score (0-100) where every point is explained. See "How the grade works" on the dashboard and [docs/SPEC.md](docs/SPEC.md).
- **Acts on cookie banners.** C finds the Reject button, clicks it for you, and checks the site saved your choice (OneTrust, Ensighten, CookieYes, Cookiebot, Didomi, GOV.UK), including pop-ups drawn inside frames or shadow roots. He warns about banners that have no Reject button.
- **Flags** data breaches (Have I Been Pwned), registered data brokers (California) and companies based in U.S.-listed foreign-adversary countries (15 CFR 7.4) or on the Pentagon's 1260H list.
- **Warns** before you stay on a site graded F that also loads a listed company or had a breach reported in the last year: C names the reasons and offers "Go back" or "Continue anyway" (never blocks).
- **Ask C** answers questions from the evidence, with a source label on every fact. Questions with a factual answer (grades, breaches, "Is this site safe?", "Does this site sell my data?", where each dashboard item came from, and questions about C himself such as "Are you tracking me?") are answered by code in a tenth of a second; Gemma explains the rest.
- **Clears one site** from the pop-up: "Clear this site's data" makes Chrome forget that site's cookies and saved data, then says how many cookies it removed.

## How it works
The grade is computed by code, never by the AI, so it's the same every time and every point traces back to evidence. Gemma reads privacy policies and explains; code checks its quotes and source tags afterwards.
A diagram of the parts, the data shape and the message API: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Install
| Version | C's AI runs on | Download |
|---|---|---|
| **PrivaC** (main, recommended) | Gemma 4 E2B inside Chrome (WebGPU): nothing else to install; Ollama works as a fallback | [main.zip](https://github.com/gormandyp/PrivaC/archive/refs/heads/main.zip) · setup: [docs/IN-BROWSER-AI.md](docs/IN-BROWSER-AI.md) |
| **PrivaC (Ollama)** | Gemma 4 E4B through the Ollama app on your computer | [ollama.zip](https://github.com/gormandyp/PrivaC/archive/refs/heads/ollama.zip) · setup: [docs/OLLAMA.md](docs/OLLAMA.md) |

1. Unzip, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the unzipped folder. Load one version at a time.
2. Pin PrivaC (puzzle-piece menu), browse a few sites, then click the C icon and open the dashboard.
3. In **Ask C**, click **Download C's brain** (2.0 GB, one time). Grades and C's pop-ups work while it downloads.

After you change any file, click the circular reload arrow on PrivaC's card in `chrome://extensions` (that keeps C's brain; **Remove** deletes it).

## Privacy
PrivaC downloads whole public lists and matches them on your computer. It never sends what you visit to anyone. It stores site names and cookie names only (never full addresses or cookie contents) and deletes history after 7 days. Daily totals (numbers only, no site names) are kept 90 days for the week and month views. "Clear my PrivaC data" erases your history and daily totals. Full details: [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md).

## What's in this folder
| Path | What it is |
|---|---|
| `manifest.json`, `background.js` | The extension's entry points |
| `background/` | Records trackers, downloads public lists, reads privacy policies, decides when C warns |
| `content/` | Runs on web pages: C (`c-prompt.js`), cookie-banner detection (`cookie-detector.js`), alerts, grade box |
| `popup/` | The window that opens from the toolbar button |
| `dashboard/` | Full page: your sites, C's impact, safety, grades, Ask C, About |
| `offscreen/`, `vendor/litert-lm/` | C's brain: Gemma 4 running in Chrome with Google's LiteRT-LM |
| `shared/` | Score rules (`data.js`), Ask C (`askc.js`), AI bridge (`ai.js`, `gemma.js`), lists, look, and the data files |
| `c-poses/`, `icons/` | C's poses and the extension icons |
| `welcome/` | The page shown on first install (what PrivaC keeps and sends) |
| `preview/` | Test pages: C on 17 kinds of cookie pop-ups, and a demo site |
| `scripts/` | Rebuild the data files; package the Chrome Web Store zip |
| `store/` | Chrome Web Store screenshots |
| `tests/` | 779 automated tests (`node --test`) |
| `docs/` | Everything below |

## Documentation
| Read this | For |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the parts fit together, the data shape, the APIs |
| [docs/SPEC.md](docs/SPEC.md) | What PrivaC does, the grading rules and the honesty rules |
| [docs/DATA.md](docs/DATA.md) | Every data source with its date and license |
| [docs/DEMO.md](docs/DEMO.md) | The 3-minute demo script and the checked sites and questions |
| [docs/IN-BROWSER-AI.md](docs/IN-BROWSER-AI.md), [docs/OLLAMA.md](docs/OLLAMA.md) | Setting up C's brain, and measured speed |
| [docs/STORE.md](docs/STORE.md) | Chrome Web Store readiness, including our own security review |
| [docs/DEVPOST.md](docs/DEVPOST.md) | Our Devpost submission text |

**How we got here** (the development record, kept as written):
| Read this | For |
|---|---|
| [docs/DIFFICULTIES.md](docs/DIFFICULTIES.md) | The challenges we faced and how we solved each one |
| [docs/IDEA.md](docs/IDEA.md) | The team's idea inbox from Friday night, with what became of each idea |
| [docs/PLAN.md](docs/PLAN.md) | The build plan, step by step (R0-R19, F1-F5), with what was done, changed or dropped |
| [docs/ASKC-FIXES.md](docs/ASKC-FIXES.md) | How we tested and fixed Ask C's answers (bug, repro, fix, test) |
| [docs/TEAM.md](docs/TEAM.md) | Who built what |
| [docs/history/](docs/history/) | Saturday's status board and decision log, the hand-off note, our AI-assistant workflow |

## How we built it
- **Plain JavaScript, no build step**, so all five of us could read and change any file.
- **A written plan, one step at a time.** Every step in [docs/PLAN.md](docs/PLAN.md) got a failing test first, then the fix; the plan records what changed along the way and why.
- **An AI coding assistant.** We used Claude Code to help write, test and review code. Its project instructions are in [CLAUDE.md](CLAUDE.md) and `.claude/`; every change had to pass the full test suite before it was merged.
- **Real-browser checks** on a MacBook Pro and a Windows gaming laptop (ASUS G14) with the real in-browser Gemma: cookie pop-ups on U.K. and U.S. sites, and dozens of Ask C questions. The results drove the last round of fixes ([docs/DIFFICULTIES.md](docs/DIFFICULTIES.md)).

## Data sources and credits
Tracker data: [DuckDuckGo Tracker Radar](https://github.com/duckduckgo/tracker-radar) (CC BY-NC-SA 4.0). Breach data: [Have I Been Pwned](https://haveibeenpwned.com) (CC BY 4.0). Cookie purposes: [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database) (Apache 2.0). Data brokers: [California Privacy Protection Agency](https://cppa.ca.gov/data_broker_registry/). RegTrack facts, the 1260H list and State Media Monitor: [docs/DATA.md](docs/DATA.md).

## License
PrivaC's own code is open source under the [MIT](LICENSE) license. The data files keep their own licenses (listed at the end of [LICENSE](LICENSE)); Tracker Radar's is non-commercial, which is fine for a hackathon and would need replacing for a commercial product.

## Team
Josh Davis, Max Glassman, Matthew Finkelstein, Justin Smilowitz, and the repo owner (gormandyp). Who built what: [docs/TEAM.md](docs/TEAM.md).
