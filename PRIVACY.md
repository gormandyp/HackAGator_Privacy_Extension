# PrivaC privacy policy

_Last updated: October 24, 2026_

PrivaC is a free Chrome extension that shows which companies track you on the websites you visit, grades each site's privacy from A to F, and lets C, its on-screen character, decline extra cookies for you. PrivaC comes in two versions that handle data the same way: the main version runs C's AI inside Chrome, and the Ollama version uses the Ollama app on your computer instead. Lines that apply to only one version say so. This policy explains exactly what PrivaC handles, where it goes, and how to delete it. The rules for using PrivaC are in [TERMS.md](TERMS.md).

**The short version:** what PrivaC learns about your browsing stays on your computer. We (the PrivaC team) never receive it, and PrivaC never sells it, shares it, or sends it to an AI company, an advertiser or any server of ours. We have no servers, no accounts, no analytics and no ads.

## What PrivaC records, and why

PrivaC needs to see the websites you visit to do its one job: telling you who tracks you there. On your computer only (in Chrome's extension storage), it keeps:

| What | Why | How long |
|---|---|---|
| Names of websites you visit (for example `cnn.com`), never full web addresses | To grade each site and show who followed you across sites | Until 7 days after your last visit to that site. It is deleted automatically when Chrome starts, once a day, and whenever PrivaC saves a visit, so this holds even if you don't browse. |
| Which tracking companies and outside servers each site contacted, the company that owns the site when it is known, and the country of a server when it is in one of the countries on the U.S. foreign-adversary list. Never the server's IP address. | To list trackers and flag companies or servers in countries on U.S. government lists | Same as the site |
| How many times you opened each site, and on how many of those visits each tracking company showed up (counts only) | So a company that showed up only once in a while doesn't change the grade | Same as the site |
| Names, owners and lifetimes of cookies (never their contents) | To show what each site stores in your browser | Same as the site |
| Your cookie-banner choice on each site (declined, accepted, no Reject button) | To grade how the site asked for consent | Same as the site |
| Short answers about each site's privacy policy (for example "says it sells data"), the exact sentence that backs each answer, and the address of that policy page (without anything after a `?`) | Part of the grade, and so you can check the quote yourself | Same as the site |
| Daily totals (numbers only, no site names): how often C appeared, how you answered, how many trackers and risky sites you saw | The "C's impact" and "Safety" views | 90 days |
| The sites open in your tabs right now, and the sites C has already warned you about since Chrome started | So C doesn't warn you twice and the panel knows which site a tab shows | Until you close Chrome |
| Your questions to C and C's answers | To show the conversation | Only while the page you asked on is open |
| Your settings (light/dark, glass color, which pop-ups C may show, Ollama or in-browser AI) | To remember your choices | Until you change them or remove PrivaC |
| Names of sites where the grade box already appeared today, with the day (never full web addresses) | So the grade box shows once per site a day | 7 days |
| C's AI model, if you download it (main version only: about 2 GB, in Chrome's cache) | So C can answer on your computer | Until you click **Delete download** or remove PrivaC |
| Public lists of data breaches and data brokers | To flag breached sites and data-broker trackers | Replaced once a day |

PrivaC never reads or stores what you type into websites, passwords, form contents, cookie contents, page contents, or full web addresses of the pages you visit.

## What PrivaC does on websites

- **C on cookie banners.** When a site shows a cookie banner, C offers to click its Reject button (or, if you turn on **Protect me automatically**, clicks it without asking). PrivaC then reads the site's own consent cookie only to answer "are the optional cookies off?", keeps only that yes or no, and never stores the cookie.
- **"Do not sell or share my personal information."** When a page shows a button with exactly that label, PrivaC clicks it once on that page to opt you out of the site selling or sharing your data, as U.S. state privacy laws allow. This has no off switch yet, because it can only reduce what a site may do with your data.
- **Alerts.** C warns you about banners with no Reject button and about connections to companies on U.S. government lists.
- **Grade box.** A few seconds after a site opens, a small box in the top right shows its grade (once per site a day), and after you decline or accept cookies it explains what that choice means. Turn it off in **Settings › Show the grade box**.
- **Clear this site's data.** Only when you tap it twice in PrivaC's pop-up, Chrome removes that one site's own cookies, saved data and cache. PrivaC never removes your history, passwords or downloads.

You can turn each of C's pop-ups, and automatic declining, on or off in **Settings › C on websites**.

## Network requests PrivaC makes

PrivaC downloads whole public files (the same file for everyone) and does all matching on your computer, so these requests never say which sites you visit. Like any download, each request shows the server your computer's IP address, which that service handles under its own privacy policy.

| Request | When | What is sent |
|---|---|---|
| `haveibeenpwned.com` (public list of data breaches) | About once a day (when Chrome starts, if the copy is over a day old) | An ordinary request for the whole list. No site names. |
| `cppa.ca.gov` (California Data Broker Registry) | About once a day (when Chrome starts, if the copy is over a day old) | An ordinary request for the whole list. No site names. |
| `huggingface.co` (C's AI model, Gemma 4, about 2 GB; main version only) | Only when you click **Download C's brain** | An ordinary file download. No browsing data. |
| A site's own privacy-policy page | When you visit a site that links to its privacy policy and policy reading is on (**Settings › On this computer**) | A request to that same site for the page its own "Privacy" link points to, sent **without your cookies** so you aren't identified. If the site forwards the request within the same site, PrivaC follows it. If it forwards it to another website, or to an address on your own computer or home network, PrivaC throws the reply away and reads nothing. After a successful read, PrivaC waits a week before reading that site's policy again. If C's AI isn't set up yet, nothing is saved; the page is kept in memory only (never saved) for up to a day, so a later visit tries again without fetching it again. |
| `localhost:11434` (Ollama, only if you installed it) | When you ask C a question, or a policy is read, and Ollama is the AI in use | Your question (or the policy text) and a summary of your PrivaC data, sent to the Ollama app **on your own computer**. PrivaC uses only models that run on your computer, never Ollama's cloud models. |

C's AI runs on your computer, inside Chrome (or in Ollama on your computer). Your questions and your browsing are never sent to an AI company or any other server.

## Sharing and selling

PrivaC does not sell, rent, share, or transfer your data to anyone, does not use it for advertising, credit decisions, or any purpose other than showing you your own privacy information, and has no servers that receive it. The PrivaC team cannot see your data.

## Limited Use

The use of information received from Chrome APIs by PrivaC adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. Specifically, PrivaC uses browsing data only to provide its single purpose, showing you who tracks you and helping you limit it; does not transfer it to third parties; does not use it for advertising; and no human reads it.

## Deleting your data

- **Settings › Clear my PrivaC data** deletes your site history, daily totals and the grade box's list of sites right away, and forgets the sites in your open tabs. Your settings stay.
- **Delete download** on the Ask C card deletes C's 2 GB AI model (main version).
- Closing Chrome deletes the open-tab and already-warned lists.
- Removing the extension in `chrome://extensions` deletes all of it.

Because all of this lives only on your computer, these buttons are the whole story: there is no copy anywhere else for us to delete, export or correct.

## Children

PrivaC is a general-audience tool and is not directed at children under 13. It collects no personal information from anyone, and the PrivaC team receives nothing.

## Changes

If PrivaC ever changes what it records or sends, we will update this page and tell you inside the extension before the change takes effect. The date at the top shows the latest version.

## Contact

Questions: open an issue at https://github.com/gormandyp/HackAGator_Privacy_Extension/issues.

PrivaC was built at Gator Hack V (University of Florida, 2026) by Josh Davis, Max Glassman, Matthew Finkelstein, Justin Smilowitz and Preston (gormandyp).
