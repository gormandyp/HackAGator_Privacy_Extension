# PrivaC — interface

The look and feel of the PrivaC Chrome extension: the logo, C the mascot, the toolbar popup, the dashboard, and C's on-page cookie prompt. It runs on sample data until the tracking logic writes real data (see "For the extension builder" below).

## What's in this folder

| Folder | What it is |
|---|---|
| `popup/` | The small window that opens when you click the PrivaC icon in Chrome's toolbar |
| `dashboard/` | The full-page view: who followed you across sites, every site's grade, and how grading works |
| `content/c-prompt.js` | C popping up on websites to offer to decline cookies, or to flag a foreign-adversary link |
| `shared/mascot.js` | Draws C in four moods: happy, uneasy, alarmed, wave |
| `shared/data.js` | Sample data, the scoring rubric, and where real data gets read from |
| `shared/theme.css` | Colors and fonts used everywhere |
| `icons/` | Toolbar icons (PNG) and logo/mascot files (SVG) for slides and posters |
| `preview/demo-site.html` | A fake website to show off C's on-page prompt |
| `manifest.json` | Tells Chrome what the extension is |

## See it without installing anything

Double-click any of these to open them in Chrome:

- `dashboard/dashboard.html`
- `popup/popup.html` (add `?site=flightdeals.example` to the end of the address to see the F grade with a foreign-adversary flag)
- `preview/demo-site.html`

## Try it as a real extension

1. In Chrome, go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder (the one with `manifest.json` in it).
4. Pin PrivaC from the puzzle-piece menu and click the C icon.

After you change any file, click the circular reload arrow on the PrivaC card in `chrome://extensions`.

## Putting it on GitHub (no coding needed)

The easiest route is **GitHub Desktop**, a regular app with buttons instead of commands.

**If your teammate already made the repository:**

1. Ask him for the repository link and to add you as a collaborator (GitHub repo page, then Settings, then Collaborators).
2. Install GitHub Desktop from desktop.github.com and sign in.
3. File, then Clone repository, then pick the PrivaC repo. This makes a folder on your computer that's linked to GitHub.
4. Copy this folder's contents into that folder. If he already has a `manifest.json`, **don't overwrite his**. See "Merging manifests" below.
5. Back in GitHub Desktop, you'll see your new files listed. Type a short summary like `Add PrivaC interface and logo`, click **Commit to main**, then click **Push origin**.

**If nobody has made the repository yet:**

1. In GitHub Desktop: File, then Add local repository, then choose this folder. It will offer to "create a repository"; click that.
2. Click **Publish repository**. Uncheck "Keep this code private" if the hackathon wants a public repo.
3. Invite your teammates as collaborators on github.com.

**Without installing anything:** on the repo's page on github.com, click **Add file**, then **Upload files**, and drag the folders in. This works but is clumsier when two people are editing the same files.

**Avoiding conflicts with your teammate:** if you both edit the same file at the same time, GitHub will make you choose which version wins. Simplest rule for a 48-hour build: you own `popup/`, `dashboard/`, `shared/theme.css`, `shared/mascot.js`, and `icons/`; he owns the background script and the tracking logic. Before you start working each time, click **Fetch origin / Pull** in GitHub Desktop.

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
        cookieChoice: "declined",            // "declined" | "accepted" | "none"
        policy: { sells: null, shares: null, source: null }, // true / false / null if unknown
        trackers: [
          { domain: "doubleclick.net", company: "Google", category: "Advertising", country: "US" }
        ]
      }
    ]
  }
});
```

- `company`, `category`, and `country` can come from DuckDuckGo Tracker Radar (its entity and category fields).
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

### Merging manifests

If you already have a `manifest.json`, keep yours and copy in from this one: the `icons` block, `action.default_popup` and `action.default_icon`, the `storage` and `activeTab` permissions, and the `content_scripts` entry (put `shared/mascot.js` before your own content script so `PrivaCPrompt` can draw C). Your `webRequest` permission and `background` service worker stay as they are.

## Before the demo

- The foreign-adversary list in `shared/data.js` follows 15 CFR § 7.4 (China including Hong Kong, Cuba, Iran, North Korea, Russia, Venezuela). Double-check the current version of the regulation.
- Fonts (Bricolage Grotesque and Figtree) load from Google Fonts. Without internet, the pages fall back to the system font and still work.
- Tracker data from DuckDuckGo Tracker Radar has a non-commercial license; fine for a hackathon, worth mentioning if judges ask about turning PrivaC into a product.
