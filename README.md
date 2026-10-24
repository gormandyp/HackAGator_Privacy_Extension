# PrivaC

> **This is the main download: the in-browser AI version.** C's AI, Gemma 4 E2B, runs inside Chrome on your computer's graphics chip
> (Google's LiteRT-LM, WebGPU): no Ollama needed. Setup, needs and measured speed: [docs/IN-BROWSER-AI.md](docs/IN-BROWSER-AI.md).
> Prefer Ollama only? Download the [`ollama` branch](https://github.com/gormandyp/HackAGator_Privacy_Extension/archive/refs/heads/ollama.zip).

A Chrome extension that shows which companies a website connects you to, what it stores in your browser, and grades the site's privacy A to F. **C**, a letter-C character, pops up to decline cookie tracking for you and answers questions like "Who is LiveRamp and should I worry?", using **Gemma 4 running on your own computer** (here: inside Chrome).

Built at Gator Hack V (UF AI Days 2026) for the "Fresh off the frontier" challenge.

## What's recent (and central)
- **Gemma 4** (Google, released March 31, 2026): C's brain, running inside Chrome with Google's **LiteRT-LM web runtime** (first published May 18, 2026; we use 0.18.0 from Oct 6, 2026), or through Ollama. Your browsing and questions never leave the computer.
- **RegTrack** (NDSS MADWeb, February 2026; arXiv 2603.02679): measured how accepting cookies changes tracking on 743 websites. C quotes it.
- **Pentagon 1260H list** (updated June 8, 2026, adds Alibaba and Baidu): powers the foreign-adversary flag.
- **California Data Broker Registry 2026** and **Have I Been Pwned**: downloaded fresh every day.

Judges: the dashboard's **About** tab lists each one with its date, a link to proof, and the files that use it.

## What it does
- Records which trackers each page loads (3,721 known tracker domains from DuckDuckGo Tracker Radar) and which cookies it sets (labeled with the Open Cookie Database).
- Grades each site with a rules-based exposure score (0-100). Every point is explained. See "How the grade works" on the dashboard and docs/SPEC.md.
- C detects cookie banners, clicks "Reject" for you, checks the site saved it (OneTrust, Ensighten, CookieYes, Cookiebot, Didomi), and warns about banners that have no Reject button.
- Flags data breaches (Have I Been Pwned), registered data brokers (California) and companies based in U.S.-listed foreign-adversary countries (15 CFR 7.4).
- **Ask C**: questions answered by Gemma from the evidence, with a source label on every fact.

## Privacy
PrivaC downloads whole public lists and matches them on your computer. It never sends what you visit to anyone. It stores site names and cookie names only (never full addresses or cookie contents) and deletes history after 7 days. Daily totals (numbers only, no site names) are kept 90 days for the week and month views. "Clear my PrivaC data" erases your history and daily totals. Full details: [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md).

## Download
| Version | C's AI runs on | Download |
|---|---|---|
| **PrivaC** (main, recommended) | Gemma 4 E2B inside Chrome (WebGPU): nothing else to install; Ollama works as a fallback | [main.zip](https://github.com/gormandyp/HackAGator_Privacy_Extension/archive/refs/heads/main.zip) · setup: [docs/IN-BROWSER-AI.md](docs/IN-BROWSER-AI.md) |
| **PrivaC (Ollama)** | Gemma 4 E4B through the Ollama app on your computer | [ollama.zip](https://github.com/gormandyp/HackAGator_Privacy_Extension/archive/refs/heads/ollama.zip) · setup: [docs/OLLAMA.md](docs/OLLAMA.md) |

Unzip, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the unzipped folder. Load one version at a time.

## Try it
1. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder.
2. Pin PrivaC (puzzle-piece menu), browse a few sites, then click the C icon and open the dashboard.
3. In **Ask C**, click **Download C's brain** (2.0 GB, one time). Nothing else to install. Prefer Ollama? See [docs/OLLAMA.md](docs/OLLAMA.md).

After you change any file, click the circular reload arrow on the PrivaC card in `chrome://extensions`. Tests: `node --test`.

Without installing anything, you can open `dashboard/dashboard.html` or `popup/popup.html?site=flightdeals.example` to see the interface with sample data.

## What's in this folder
| Path | What it is |
|---|---|
| `popup/` | The window that opens from the toolbar icon |
| `dashboard/` | Full page: your sites, who followed you across sites, Ask C, how grading works |
| `content/` | C on web pages (`c-prompt.js`) and cookie-banner detection (`cookie-detector.js`) |
| `background.js`, `background/` | Records trackers and cookies, downloads public lists, answers Ask C |
| `shared/` | Score rules (`data.js`), Gemma bridge (`gemma.js`), Ask C brain (`askc.js`), lists, cookie labels, tracker and cookie data files |
| `scripts/` | Rebuild `atlas.json` and `cookie-db.json` from their sources |
| `docs/` | Idea, spec, plan, team, data sources, difficulties |
| `icons/` | Toolbar icons, logo and C poses |

## Data sources and credits
Tracker data: [DuckDuckGo Tracker Radar](https://github.com/duckduckgo/tracker-radar) (CC BY-NC-SA 4.0). Breach data: [Have I Been Pwned](https://haveibeenpwned.com) (CC BY 4.0). Cookie purposes: [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database) (Apache 2.0). Data brokers: [California Privacy Protection Agency](https://cppa.ca.gov/data_broker_registry/). Details: [docs/DATA.md](docs/DATA.md).

## Team
Josh Davis, Max Glassman, Matthew Finkelstein, Justin Smilowitz, and the repo owner (gormandyp). Teamwork rules: [docs/TEAM.md](docs/TEAM.md).

## For the extension builder

### Data the interface reads

The interface reads one object from `chrome.storage.local` under the key `privacData`. The background script only has to keep this up to date:

```js
chrome.storage.local.set({
  privacData: {
    sites: [
      {
        domain: "example.com",
        lastVisit: new Date().toISOString(),
        cookieChoice: "declined",            // "declined" | "accepted" | "no-reject" | "none"
        policy: { sells: null, shares: null, source: null }, // true / false / null if unknown
        trackers: [
          { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" }
        ]
      }
    ]
  }
});
```

- The background script (background/tracking.js) writes this; `company`, `category` and `country` come from `shared/atlas.json`. It also adds `cookies` (names only) and the data pages add `breach` and tracker `broker` from the public lists. Full shape: comments at the top of `shared/data.js`.
- Scores and grades are calculated in `shared/data.js` (`computeScore`), so the popup and dashboard always agree. Change the rubric there, and update the "How the grade works" table in `dashboard/dashboard.html` to match.
- Until real data exists, every screen shows the sample data with a "sample data" note.

### Showing C on a website

`content/c-prompt.js` is already listed in `manifest.json`. From the content script, once a cookie banner is detected:

```js
PrivaCPrompt.cookie({
  onDecline: async () => { /* click the site's "Reject all" button */ return true; },
  onChoose:  () => { /* open the site's cookie settings */ }
});

PrivaCPrompt.adversary({ companies: ["Yandex (Russia)"] });
```

Return `false` from `onDecline` if you couldn't find the reject button; C will tell the user where to look instead.

## Before the demo

- Make sure Ollama is running and `OLLAMA_ORIGINS` is set (it resets when the Mac restarts).
- The foreign-adversary list in `shared/data.js` follows 15 CFR § 7.4 (China including Hong Kong, Cuba, Iran, North Korea, Russia, Venezuela). Double-check the current version of the regulation.
- Fonts (Bricolage Grotesque and Figtree) load from Google Fonts. Without internet, the pages fall back to the system font and still work.
- Tracker data from DuckDuckGo Tracker Radar has a non-commercial license; fine for a hackathon, worth mentioning if judges ask about turning PrivaC into a product.

## Ask C (dashboard chat panel)

Files: `dashboard/ask-c.js`, the "Ask C" section in `dashboard/dashboard.html`, and the Ask C styles at the bottom of `dashboard/dashboard.css`. It works on its own with sample answers until the AI is connected.

### How Ask C talks to the AI (built: background.js + shared/askc.js)

The dashboard sends one message to the background script and waits up to 90 seconds:

```js
chrome.runtime.sendMessage({ type: "askC", question: "Who is LiveRamp and should I worry?" })
```

Reply with:

```js
{
  answer: "LiveRamp is a registered data broker. [CA Broker Registry] ...",
  trace: [ { tool: "lookup_company" }, { tool: "where_seen", label: "Your browsing" } ],  // label is optional
  error: "only if something went wrong"
}
```

In the background script, answer asynchronously and `return true` so Chrome keeps the channel open:

```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "askC") {
    askC(msg.question).then(sendResponse).catch(e => sendResponse({ error: "I couldn't reach Gemma. Is Ollama running?" }));
    return true;
  }
});
```

Source tags written exactly like these inside `answer` become colored labels: `[Seen on your visit]` `[Tracker Radar]` `[CA Broker Registry]` `[HIBP]` `[RegTrack]` `[Privacy policy]`. Put that list in Gemma's system prompt.

Known tool names get friendly labels in the "C checked" line (`get_site_report`, `where_seen`, `lookup_company`, `find_companies`, `regtrack_compare`). Any other tool shows its `label`, or its name.

Other parts of the dashboard can open a question with `PrivaCAsk.ask("...")`. The "Ask C" link next to each company in the cross-site table already does this.
