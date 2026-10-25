# Demo and video plan (v2, 2026-10-25 overnight; presenters Matthew, Max, Justin; recorded on the repo owner's Mac)
Video limit: **3 minutes**. Round 1 judges see only the Devpost page, this video and the repo; Monday's finals are live.
Every site and answer below was checked in real Chrome on the ASUS G14 (Windows, Gemma 4 E2B in the browser, main dde8558, Oct 25), and the fixes made after that (main d7e2026) were checked with the real Ask C code. Grades on the Mac will differ a little (different visits): rehearse once on the recording computer, and anything that fails twice gets cut.

## Words used here
- **Instant answer**: Ask C answers from PrivaC's own records in code, in about 0.1 s, with no AI. Safest on camera.
- **Gemma answer**: Gemma 4 writes it inside Chrome; words start after about 1-2 s and stream in.
- **Tag**: the [Seen on your visit] / [HIBP] / [Government list] label after a fact, naming its source.

## Before recording (15 minutes)
1. **Update**: GitHub Desktop → Fetch origin → Pull origin (main at d7e2026 or newer). Then chrome://extensions → PrivaC → the **circular reload arrow**.
   - **Never click Remove**: Remove deletes C's brain (2 GB). Reload keeps it, as long as PrivaC stays loaded from the same folder.
2. **Settings** (gear, top right of the dashboard): Show the grade box **on**; Protect me automatically **off** (so C asks on camera); every pop-up switch on; Read privacy policies with Gemma **on**.
3. **Brain**: the Ask C tab says "Gemma 4 E2B is running in your browser." Ask one question ("Who is ByteDance?") so the first, slowest load is done before recording.
   - Windows only: Settings > System > Display > Graphics → Chrome → High performance, then restart Chrome (Gemma is several times faster).
4. **Fill the week**: optionally Clear my PrivaC data first, then open each site in the table below for about 20 s, with C's brain ready, so grades, trackers and privacy policies are recorded. Open **nytimes.com** at least once (for the "share my data" answer).
5. **Screen**: window at least 1280×800, zoom 100-110%, other tabs closed, bookmarks bar hidden, Do Not Disturb on, other extensions with pop-ups off (an ID.me coupon pop-up appeared on economist.com).

## Scenes: what to open and what you should see
| Scene | Open | Backup | What you should see (G14, Oct 25) |
|---|---|---|---|
| Good grade | duckduckgo.com | wikipedia.org, youtube.com | A 0 (wikipedia A 10, youtube A 10) and the grade box top right |
| C declines for you | gov.uk | superdrug.com; Settings → "See C on 17 kinds of cookie pop-ups" | C beside the banner → **Protect me** → "Nice! Your optional cookie preferences were saved as declined." Then the grade box (gov.uk A, superdrug B 33) |
| No Reject button | cnn.com | mcdonalds.com/us | C says **Beware!** about 1.7 s after loading and hides by itself about 7 s later. cnn.com C 45 |
| Foreign-adversary alert + unsafe site | wired.com | weather.com | C's alert names **ByteDance (China)** at about 2.7 s; at about 12 s the warning "Careful: PrivaC grades this site F ... (WIRED, 2025) ... Go back / Continue anyway". F 100. weather.com: Baidu (Pentagon 1260H list), warning at about 18 s, F 85 |
| State-run media | tass.com | | The alert names Yandex (Russia) and TASS (Russia; state-run media). D 70 |
| Popup | PrivaC's toolbar button on wired.com | | F 100 with every point explained, the companies, "Clear wired.com's data", and **Ask C why it got an F** |
| Dashboard | Overview → Sites → C's impact → Safety → Grades | | Every site graded; the "How the grade works" table on Grades |

- Don't open baidu.com or tiktok.com live: some networks block them (both failed on the G14's network). weather.com shows the Baidu link instead.
- U.S. visitors rarely see cookie banners, which is why the cookie scenes use U.K. sites.

## Ask C: questions that work
**Instant answers** (best for the video):
| Ask | You get |
|---|---|
| "Why did wired.com get an F?" (suggestion button, or the popup's "Ask C why") | Score 100, each point with its tag: 88 tracker companies, Baidu on the 1260H list, the WIRED breach (2025), no cookie banner |
| "Is wired.com safe?" | The grade, its foreign-adversary companies, the breach (2.4 million accounts), what to do |
| "Was zara.com hacked?" (suggestion button) | April 2026, 197 thousand accounts, what was exposed, what to do |
| "Did any site I visited get hacked?" | Every visited site in Have I Been Pwned (zara, linkedin, wired, facebook) |
| "Which site tracks me the most?" | weather.com: 156 trackers from 130 companies |
| "Should I trust cnn?" → "why?" → "and espn?" | cnn.com's grade and points; "why?" explains them; "and espn?" gives espn's (follow-ups fixed overnight) |
| "Who is Google and should I worry?" (suggestion button) | Tracker domains and reach, sites it was on, what its trackers could see, no breach on record (fixed overnight; Gemma used to say Google does "data brokering") |
| "Does nytimes share my data?" | "Yes, by its own words." with the sentence from nytimes's own privacy policy, which Gemma read on this computer |
| "Does wired.com sell my data?" | An honest "I don't know yet" (policy not read), the ad companies and California data brokers it loaded, and "it doesn't prove your data was sold" |
| "Is Meta safe?" / "Is you tube safe?" | Owner names and typos work |
| "Are you made with Gemma?" | Gemma 4 (Mar 31, 2026) inside Chrome with LiteRT-LM; nothing leaves the computer |
| "Does my browsing leave my computer?" | C's privacy promise |
| "Write me a poem" | A polite no: C sticks to privacy |

**Gemma answers** (show at least one; it's the proof for Best Use of Gemma):
| Ask | Why it's good |
|---|---|
| "Is any site I visited connected to China or Russia?" | On the G14 it named wired.com → ByteDance and tass.com → Yandex, with tags |
| "Which data brokers have seen me?" (suggestion button) | Names the registered California data brokers seen on your visits ("Collective Roll" is the company Tracker Radar lists for stackadapt.com; the registry lists it as StackAdapt Inc.) |
| "How many data breaches happen without people knowing?" | Worked out from Have I Been Pwned's own list (fixed overnight): half were added at least 4 months after the breach, over a third more than a year later |
| "Who is ByteDance?" | China-based, its tracker reach; it no longer claims ByteDance is on the 1260H list (fixed overnight) |
| "What did C do for me this week?" | Uses the C's impact numbers (fixed overnight) |

**Don't ask on camera** (known weak spots):
- "What is wired.com collecting about me?": Gemma may treat a past breach as what the site collects.
- "Check the ive been pwned list": repeats the previous answer.
- A site you didn't open this week: an honest but flat "I don't know".
- Long chains of follow-ups: only "why?" and "and <site>?" are built for it.

## Resets (to film a scene again)
| To see again | Do this |
|---|---|
| A cookie banner and C's offer | PrivaC popup → "Clear gov.uk's data" (tap twice) → reload the page |
| The foreign-adversary alert (once per site per browser session) | Reload PrivaC with the circular arrow (the brain stays), or restart Chrome |
| The unsafe-site warning and the grade box (once per site per day) | chrome://extensions → PrivaC → "service worker" → Console → paste `chrome.storage.local.remove(["privacUnsafeSeen", "privacChipSeen"])` → Enter. It keeps the week's history (Clear my PrivaC data would empty the dashboard) |

## 3-minute script
- **0:00-0:20 Justin, the problem.** "One visit to wired.com handed me to 88 outside companies, including ByteDance and Baidu from China. I never saw a cookie banner, and nobody reads the privacy policy." (Use the number your own popup shows.)
- **0:20-1:30 Matthew, C on the page.** wired.com: C's alert (ByteDance, China), then the F warning and Go back. Popup: F 100 and why. gov.uk: C → Protect me → "Nice!". cnn.com: Beware! (only an Agree button). duckduckgo.com: an A, for contrast.
- **1:30-2:20 Max, Ask C.** From the popup, "Ask C why it got an F" (instant, every fact tagged). "Is any site I visited connected to China or Russia?" (Gemma streams). "Was zara.com hacked?". "Does nytimes share my data?" (the sentence Gemma found in its policy). Say: "Gemma 4 runs inside Chrome on this laptop; my browsing never leaves it."
- **2:20-3:00 Justin, what's new and the limits.** The Ask C tab: "Gemma 4 E2B is running in your browser." Gemma 4 (Mar 31, 2026) inside Chrome with LiteRT-LM (May 2026), the Pentagon 1260H list (Jun 8, 2026), RegTrack (2026, 743 sites), the 2026 California broker registry. Limits: a tracker loading doesn't prove data was sold; the rubric is ours; the AI needs a one-time 2 GB download. Close: "Without PrivaC you never know who's watching. With it, C has your back."

## Lines that sell it (real numbers, Oct 25)
- "weather.com loaded 156 trackers from 130 companies in one visit." (G14)
- "Google's trackers were on 14 of the 21 sites I opened this week." (G14)
- "In Have I Been Pwned's own list, half the breaches were added at least 4 months after they happened, and over a third more than a year later. You can't wait for the news." (979 breaches; median 144 days; 350 over a year)
- "RegTrack (2026): accepting all cookies raised tracking from 48.5 to 56.2 tracker domains per site."
- "C says no for you, then checks the site really saved it."

## If something fails live
- Gemma slow or not loading: use the instant answers. Grades, C's pop-ups and the popup never need Gemma.
- No cookie banner: Settings → "See C on 17 kinds of cookie pop-ups".
- A pop-up already shown: see Resets.
- Keep a backup clip of every scene (record them Sunday morning).
