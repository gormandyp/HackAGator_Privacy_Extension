# PrivaC privacy policy

_Last updated: October 24, 2026_

PrivaC is a Chrome extension that shows which companies track you on the websites you visit, grades each site's privacy from A to F, and lets C, its on-screen character, decline extra cookies for you. This policy explains exactly what PrivaC handles, where it goes, and how to delete it.

**The short version:** everything PrivaC learns about your browsing stays on your computer. We (the PrivaC team) never receive it, and PrivaC never sells it, shares it, or sends it to anyone.

## What PrivaC records, and why

PrivaC needs to see the websites you visit to do its one job: telling you who tracks you there. On your computer only, it keeps:

| What | Why | How long |
|---|---|---|
| Names of websites you visit (for example `cnn.com`, never full web addresses) | To grade each site and show who followed you across sites | 7 days, then deleted automatically |
| Which tracking companies and servers each site contacted, and the country of the site's server when it is known | To list trackers and flag companies or servers in countries on U.S. government lists | 7 days |
| Names, owners and lifetimes of cookies (never their contents) | To show what each site stores in your browser | 7 days |
| Your cookie-banner choice on each site (declined, accepted, no Reject button) | To grade how the site asked for consent | 7 days |
| Short answers about each site's privacy policy (for example "says it sells data", with the quoted sentence) | Part of the grade | 7 days |
| Daily totals (numbers only, no site names): how often C appeared, how you answered, how many trackers and risky sites you saw | The "C's impact" and "Safety" views | 90 days |
| Your questions to C and C's answers | To show the conversation | Only while the dashboard is open |
| Your settings (light/dark, glass color, which pop-ups C may show) | To remember your choices | Until you change them |

PrivaC never reads or stores what you type into websites, passwords, cookie contents, page contents, or full web addresses.

## What PrivaC does on websites

- **C on cookie banners.** When a site shows a cookie banner, C offers to click its Reject button (or, if you turn on **Protect me automatically**, clicks it without asking). PrivaC then checks the site's own consent record (yes/no only, nothing stored) to confirm your choice was saved.
- **"Do not sell or share my personal information."** On sites that show this link, PrivaC clicks it once per page to opt you out of the site selling or sharing your data, as U.S. state privacy laws allow.
- **Alerts.** C warns you about banners with no Reject button and about connections to companies on U.S. government lists.

You can turn each of C's pop-ups, and automatic declining, on or off in **Settings › C on websites**. The "Do not sell or share" opt-out always runs, because it only ever reduces what a site may do with your data.

## Network requests PrivaC makes

PrivaC downloads whole public files (the same file for everyone) and does all matching on your computer, so these requests never reveal which sites you visit:

| Request | When | What is sent |
|---|---|---|
| `haveibeenpwned.com` (public list of data breaches) | Once a day | An ordinary request for the whole list. No site names. |
| `cppa.ca.gov` (California Data Broker Registry) | Once a day | An ordinary request for the whole list. No site names. |
| `huggingface.co` (C's AI model, Gemma 4, about 2 GB) | Once, only when you click **Download C's brain** | An ordinary file download. No browsing data. |
| A site's own privacy-policy page | At most once a week per site you visit, if policy reading is on | A request to that same site, sent **without your cookies** so you aren't identified. Turn it off in **Settings › On this computer**. |
| `localhost:11434` (Ollama, only if you installed it) | When you ask C a question and the in-browser AI isn't ready | Your question and a summary of your PrivaC data, sent to the Ollama app **on your own computer**. It never leaves the computer. |

C's AI runs on your computer, inside Chrome (or in Ollama on your computer). Your questions and your browsing are never sent to an AI company or any other server.

## Sharing and selling

PrivaC does not sell, rent, share, or transfer your data to anyone, does not use it for advertising, credit decisions, or any purpose other than showing you your own privacy information, and has no servers that receive it. The PrivaC team cannot see your data.

## Limited Use

The use of information received from Chrome APIs by PrivaC adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. Specifically, PrivaC uses browsing data only to provide its single purpose, showing you who tracks you and helping you limit it; does not transfer it to third parties; does not use it for advertising; and no human reads it.

## Deleting your data

- **Settings › Clear my PrivaC data** deletes everything PrivaC has recorded, right away.
- **Delete download** on the Ask C card deletes C's 2 GB AI model.
- Removing the extension in `chrome://extensions` deletes all of it.

## Children

PrivaC is a general-audience tool and does not knowingly collect information from children. It collects no personal information from anyone.

## Changes

If PrivaC ever changes what it records or sends, we will update this page and tell you inside the extension before the change takes effect.

## Contact

Questions: open an issue at https://github.com/gormandyp/HackAGator_Privacy_Extension/issues.

PrivaC was built at Gator Hack V (University of Florida, 2026) by Josh Davis, Max Glassman, Matthew Finkelstein, Justin Smilowitz and the repo owner (gormandyp).
