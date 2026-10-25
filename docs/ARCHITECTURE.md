# How PrivaC works (for developers and judges)

PrivaC is a plain-JavaScript Chrome extension (Manifest V3) with **no build step**: every file in the repo is the file Chrome runs.
Tests use Node's built-in runner: `node --test`.

## The big picture

```
 A web page you visit
   │  its requests ───────────────▶ background/tracking.js ──┐  matches shared/atlas.json (Tracker Radar)
   │  its cookies ────────────────▶ shared/cookies.js ───────┤  labels with shared/cookie-db.json
   │  its cookie pop-up ──▶ content/cookie-detector.js       │
   │                        content/c-prompt.js (C)          │
   │                        └─ "cookieChoice" message ───────┤
   │  its "Privacy" link ─▶ content/policy-link.js ──────────┤
   ▼                                                         ▼
 C on the page                                     privacData in chrome.storage.local
 (alerts, unsafe-site warning, grade box)          (only the background writes it)
   ▲                                                         │
   │                                                         ▼
 background/alerts.js ◀─────────────── shared/data.js computeScore(): the A-F grade, every point explained
                                                             │
                                                             ▼
                                   popup/ (toolbar button) and dashboard/ (full page) only read
                                                             │
                                                     Ask C question
                                                             ▼
                                   shared/askc.js: facts from the records, answered by code when it can
                                                             │  otherwise
                                                             ▼
                                   shared/ai.js ──▶ Gemma 4 E2B in Chrome (offscreen/brain.html, LiteRT-LM, WebGPU)
                                               └──▶ Ollama on the same computer (shared/gemma.js), the fallback
```

Two rules shape everything:
- **Code computes, the AI explains.** The grade, breach answers, "Is X safe?" and "Does X sell my data?" are built by code from the records. Gemma writes explanations from the same evidence, and its answers are checked afterwards (source tags, names that aren't in the evidence, made-up breaches).
- **Nothing about your browsing leaves the computer.** Public lists are downloaded whole and matched locally. Gemma runs on the computer. See [PRIVACY.md](../PRIVACY.md).

## Parts

| Part | Files | What it does |
|---|---|---|
| Who may ask what | `background/senders.js` | Content scripts may only report what they saw; only PrivaC's own pages can read data or control C |
| Tracker recorder | `background/tracking.js`, `shared/atlas.json` | Matches every request against 3,721 Tracker Radar domains; skips the site's own company; counts visits per company |
| Cookies | `shared/cookies.js`, `shared/cookie-db.json` | Lists cookie names (never values) 4 s and 15 s after a page loads and labels their purpose |
| Public lists | `shared/lists.js` | Downloads the whole Have I Been Pwned breach list and California Data Broker Registry daily |
| Government lists | `shared/flagged-companies.json`, `shared/state-media.json`, `shared/ip-countries.json`, `shared/ipgeo.js` | Pentagon 1260H companies, state-run media, server addresses registered in listed countries |
| Score | `shared/data.js` | `computeScore()`: the single source of truth for the grade; the popup, dashboard and Ask C all use it |
| Cookie pop-ups | `content/cookie-detector.js`, `content/c-prompt.js`, `content/c-placement.js`, `content/c-events.js`, `background/frames.js` | Finds the Reject button (also in frames and shadow roots), shows C beside the pop-up, clicks Reject, checks the consent tool's own record |
| Alerts on the page | `background/alerts.js`, `content/alerts.js`, `content/unsafe.js`, `content/grade-chip.js` | Foreign-adversary alert, unsafe-site warning (Go back / Continue anyway), grade box |
| Privacy-policy reader | `background/policy-reader.js`, `shared/policy.js`, `shared/knowledge-map.json` | Reads a site's policy at most once a week and keeps an answer only if its quote is really in the policy. Selling and sharing go first and are saved as soon as they're answered; the newest site is read next; session storage `privacPolicyReading` tells the UI a read is under way |
| Ask C | `dashboard/ask-c.js`, `shared/askc.js` | Routes each question to a code-built answer or to Gemma with the evidence; cleans and checks Gemma's answer |
| C's brain | `shared/ai.js`, `shared/brain-core.js`, `offscreen/brain.html`, `vendor/litert-lm/` | Downloads Gemma 4 E2B once (2 GB) and runs it on the graphics chip; Ollama is the fallback ([IN-BROWSER-AI.md](IN-BROWSER-AI.md), [OLLAMA.md](OLLAMA.md)) |
| Counters | `shared/stats.js`, `background/stats.js` | Daily numbers only (no site names) for 90 days: C's pop-ups, clicks, grades |
| Look | `shared/theme.css`, `shared/ui.css`, `shared/liquid-glass.js`, `shared/mascot.js`, `c-poses/` | One design system for the popup and dashboard; C's poses and moods |

## Data the interface reads

The popup and dashboard read one object from `chrome.storage.local` under the key `privacData`. Only the background writes it:

```js
{
  sites: [
    {
      domain: "example.com",
      lastVisit: "2026-10-24T14:02:00Z",
      cookieChoice: "declined",            // "declined" | "accepted" | "no-reject" | "none"
      cookies: [ { name, domain, firstParty, category, company, purpose, days } ],   // names only, never values
      breach: { name, breachDate, addedDate, pwnCount } | null,                      // Have I Been Pwned
      policy: { sells: null, shares: null, source: null },                           // true / false / null if unknown
      trackers: [
        { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" }
      ]
    }
  ]
}
```

- `company`, `category` and `country` come from `shared/atlas.json`. Full shape: the comment at the top of `shared/data.js`.
- Change the rubric only in `shared/data.js`, then update the "How the grade works" table in `dashboard/dashboard.html` and [SPEC.md](SPEC.md) to match.
- Opened outside Chrome (or before any real data exists), every screen shows sample data with a "sample data" note.

## Showing C on a website

`content/c-prompt.js` gives content scripts one API:

```js
PrivaCPrompt.cookie({
  onDecline: async () => { /* click the site's "Reject all" button */ return true; },
  onChoose:  () => { /* open the site's cookie settings */ }
});
PrivaCPrompt.adversary({ companies: ["Yandex (Russia)"] });
PrivaCPrompt.hide();
```

Return `false` from `onDecline` if the Reject button couldn't be found; C then tells the person where to look.

## How Ask C talks to the background

The dashboard streams answers over a port (`chrome.runtime.connect({ name: "privac-ask" })`, messages `start`, `token`, `done`).
Without streaming it sends one message and waits up to 90 seconds:

```js
chrome.runtime.sendMessage({ type: "askC", question: "Who is LiveRamp and should I worry?", history })
// → { answer: "LiveRamp is a registered data broker. [CA Broker Registry] ...", trace: [ { tool: "lookup_company" } ], error }
```

Source tags inside `answer` become colored labels: `[Seen on your visit]` `[Tracker Radar]` `[CA Broker Registry]` `[HIBP]` `[RegTrack]` `[Privacy policy]` `[Government list]` `[State Media Monitor]`.
Other parts of the dashboard open a question with `PrivaCAsk.ask("...")`.

## Rebuilding the data files

| File | Command | Source |
|---|---|---|
| `shared/atlas.json` | `node scripts/build-atlas.js <tracker-radar clone>` | DuckDuckGo Tracker Radar |
| `shared/cookie-db.json` | `node scripts/build-cookie-db.js <open-cookie-database.csv>` | Open Cookie Database |
| `shared/ip-countries.json` | `node scripts/build-ip-countries.js <registry files>` | RIPE NCC and LACNIC delegation lists (APNIC, for China, Hong Kong and North Korea, not added yet) |
| Wallpapers, dark poses | `node scripts/build-wallpapers.js`, `node scripts/build-dark-poses.js` | Generated |
| Chrome Web Store zip | `node scripts/package-store.js` | [STORE.md](STORE.md) |

Sources, dates and licenses: [DATA.md](DATA.md).

## Things to know
- The foreign-adversary countries follow 15 CFR § 7.4 (China including Hong Kong, Cuba, Iran, North Korea, Russia, Venezuela), in `shared/data.js`. Check the current regulation before relying on it.
- Fonts (Bricolage Grotesque and Figtree) are bundled in `shared/fonts/`, so pages make no Google Fonts request.
- After changing a file, click the circular reload arrow on PrivaC's card in `chrome://extensions`. That keeps C's 2 GB brain; **Remove** deletes it.
- Try the interface without Chrome: open `dashboard/dashboard.html`, or `popup/popup.html?site=flightdeals.example`.
- `preview/c-variations.html` shows C on 17 kinds of cookie pop-ups (also linked from Settings > C on websites); `preview/demo-site.html` is a page with a cookie pop-up for demos, since U.S. visitors rarely see real ones.
