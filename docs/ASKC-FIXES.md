# Ask C fixes (PLAN R13): instructions for the repo owner's Claude

Found 2026-10-24 ~6 PM ET by Max's Claude, testing `shared/askc.js` on main (`ceeb94f`) with the real code and a fake Gemma
(48 checks: 26 probes + every question the app's own buttons send). All 454 existing tests pass; none cover these.
**Confirmed with real Gemma on Max's Mac (in-browser brain, 2026-10-24 6:15 PM ET):** Fixes 1, 4 and 5 (see each fix's
"Seen live" line). The answers he got are quoted under each fix.
**Do the fixes in this order: 1, 5, 4, then 2, 3, 6.** The first three are bugs people actually saw.

**Rules for this work:** branch `askc-fixes` from main. One fix per commit, each with a failing test first (CLAUDE.md).
Only `shared/askc.js` and `tests/` change. Run `node --test` before every commit. Don't push to main until the repo
owner says so. Each fix below was tried on a scratch copy: all the probes passed and only the tests named under
"Tests to update" changed.

---

## Fix 1 (worst): "What can you do about X?" gets C's intro instead of an answer
**Repro:** `answer("What can you do about trackers on cnn.com?")` never calls Gemma and returns C's canned intro "I'm C,
PrivaC's privacy guide…". The same happens for "What could you do about Baidu tracking me?", "What can you do to protect me on
wired.com?" and "How can you help me with cookies on ikea.com?" (4 of 4).
**Seen live:** asked "What can you do about trackers on cnn.com?" and got the full intro paragraph, with no answer about cnn.com.
**Cause:** `ABOUT_C` matches "what can you do" at the start of any question.
**Fix:** only treat it as a question about C when that phrase is the whole question. At the end of `ABOUT_C`, replace
`|help\s*[?!.]*\s*$)/i` with
`|help)\s*(?:you|for\s+me|here|exactly|me\s+with)?\s*[?!.]*\s*$/i`
**New test:** the 4 questions above reach Gemma (`calls === 1`), and "What can you do?", "what can you do for me?",
"Who are you?", "help" and "What can I ask you?" still get the intro (`calls === 0`).
**Tests to update:** none. Check that `askc-behavior` test "What can you do?… get C's own answer" still passes,
especially "What can I ask you?".

## Fix 2: the "the user" → "you" swap leaves bad grammar
**Repro:** `cleanAnswer("The user has visited 5 sites.")` gives "You has visited 5 sites." The same goes for "You is tracked",
"You was", and "what you does". The prompt says Gemma writes "the user", so this shows on screen.
**Fix:** in `cleanAnswer`, after replacing "the user's" with "your", fix the verb that follows "the user":
is→are, was→were, has→have, does→do (also isn/wasn/hasn/doesn before "'t"). For other verbs: -sses/-shes/-ches/-xes/-zes/-oes
drop "es"; consonant + "ies" becomes "y"; otherwise drop the final "s" (not after s or u). Then do the plain "the user" → "you" swap.
**New test:** "The user has / is / was / wants / visits / watches / accesses / is not…" become "You have / are / were / want /
visit / watch / access / are not…".
**Tests to update:** none.

## Fix 3: a policy that says it doesn't sell is reported as "no clear answer"
**Repro:** a site with `policy: { sells: false, checkedAt }` (no answer on sharing) reaches Gemma as "read on …, no clear answer
about selling or sharing". The reader answers each question separately, so this mix is common, and the quoted "we don't sell"
fact is lost.
**Fix:** in `policyText`, after the `sells === false && shares === false` line, add:
`sells === false` → "says it doesn't sell personal info (quote); it doesn't say clearly whether it shares [Privacy policy]",
and `shares === false` → "says it doesn't share with partners (quote); it doesn't say clearly whether it sells [Privacy policy]".
**New test:** the ikea-style site above → context contains "doesn't sell personal info" and not "no clear answer".
**Tests to update:** none.

## Fix 4: Gemma sees country codes (CN, FR, US) instead of names
Already a suspect in PLAN R13; now confirmed. The per-site tracker list reads "Baidu (Analytics, based in CN)", the "Companies
seen on the most sites" line reads "Criteo (Advertising, FR)", and `lookupFacts` says "based in US". So C can answer
"based in CN". (The foreign-adversary lines already use names.)
**Seen live:** "Who is yandex" got: "Yandex is a company based in Russia that runs 12 tracker domains… They are based in RU
[Tracker Radar]." Gemma repeated the fact, once with the name and once with the code (the code came from `lookupFacts`).
**Fix:** let `countryName()` fall back to `new Intl.DisplayNames(["en"], { type: "region" })` (works in Chrome and Node; wrap it
in try/catch) for every code, and use `countryName(...)` in `siteLine` (tracker text), `overview` (top companies) and
`lookupFacts`. **Also update `rank()` in `siteLine`**: it looks for `based in (CN|HK|RU|IR|CU|KP|VE)`, so change it to the
names, `based in (China|Hong Kong \(China\)|Russia|Iran|Cuba|North Korea|Venezuela)`, or foreign-adversary trackers stop being
kept first on busy sites.
**New test:** context contains "based in China" and "(Advertising, France)" and no `based in [A-Z]{2}\)`.
**Tests to update (the expected text only, same meaning):** `tests/askc-context.test.js` lines 41, 69 and 70,
`tests/askc-facts.test.js` line 24, `tests/askc.test.js` line 14 ("based in US" → "based in United States", "based in CN" →
"based in China"), and the "brokers, breaches and foreign-adversary links are summarized" test ("(Advertising, US)" →
"(Advertising, United States)"). Run the "keeps its foreign-adversary and broker links in the short list" test to check the `rank()` change.

## Fix 5: lowercase grade questions skip the instant answer
**Repro:** "Why did cnn.com get an F?" gets the exact breakdown from the score. "why did cnn.com get an f" and "why does cnn.com
have a c grade" go to Gemma instead, which is slower and can reply "I don't know yet" (the bug from the team doc).
**Seen live:** "why did tass.com get a d" went to Gemma, which answered "tass.com received a grade of F because it is
state-run media… high exposure score of 85/100". That's wrong: the 85 is a sum, and state-run media is only its 15-point line.
The instant answer lists every line, so it can't make this mistake.
**Fix:** in `GRADE_LETTER`, allow lowercase letters (`[A-Fa-f]`), and uppercase the letter where it's read:
`const asked = ((q.match(GRADE_LETTER) || [])[1] || "").toUpperCase() || undefined;`
**New test:** the two lowercase questions → answered locally with "cnn.com got a…". "Why is cnn.com a concern?" still goes to
Gemma (the letter must stand alone, so the "c" in "concern" doesn't count).
**Tests to update:** none.

## Fix 6 (small): button names in square brackets are deleted
**Repro:** `cleanAnswer("Click the [Reject all] button.")` gives "Click the button." The tag cleaner deletes any bracket that
isn't a known tag. Deleting made-up tags is on purpose (`tests/askc.test.js`, "[Made up]"), so keep that.
**Fix:** add one line to `SYSTEM_PROMPT`'s rules: `Write button and menu names in quotes ("Reject all"), never in square brackets.`
**New test:** `SYSTEM_PROMPT` contains that rule. **Tests to update:** none.

---

## Fix 7 (seen live 2026-10-24 7 PM): "Was linkedin.com hacked?" said C had no information (branch `askc-breach`)
**Seen live:** C answered "I do not have information about a hack on linkedin.com. However, I can tell you about past data
breaches involving LinkedIn [HIBP]", showing a "Have I Been Pwned" check mark. The follow-up "Okay yes tell me about past data
breaches involving linked in" got "Earlier in this conversation, I told you about past data breaches" and the same cookie tips.
**Causes:** (1) Gemma only saw a site's newest breach (LinkedIn's 2021 scraped data) and dropped the 2012 hack (164.6 million
emails and passwords); (2) breaches were found only by web address or breach name, so "Was LinkedIn hacked?", "linked in" and
follow-ups found nothing; (3) any [HIBP] tag Gemma wrote showed the check mark, even with no breach evidence.
**Fix:** "Was X hacked / breached / leaked?" is answered straight from the Have I Been Pwned list, like grade questions: every
breach on record (date, accounts, what was exposed), then breach steps (change the password, two-step sign-in, phishing).
Sites are found by web address, name, or two words run together ("linked in"); a "yes, tell me about its breaches" follow-up
uses the last question's site. A web address with no record says so ("doesn't prove it was never breached"), never "safe".
Other questions about a company get its whole breach record in the evidence. A source tag with no evidence behind it is removed,
so its check mark doesn't show. Gemma's rules: scraped or leaked data counts as a breach, and a "yes" to an offer gets the thing
offered. `shared/lists.js` keeps what each earlier breach exposed (shows after the next daily list refresh or an extension reload).
**Part 2 (seen live 7:10 PM, "Was google hacked?"):** Google has no breach on record and the question had no web address, so it
went to Gemma, which answered "I do not have information... I stick to your privacy and suggest a privacy question instead" and listed
every step. Now anything PrivaC knows gets the honest "no breach on record" answer from the list: a web address, a site you visited
("was tass hacked") or a tracker company ("Google", "Amazon" for "Amazon.com", "Criteo"), plus what PrivaC did see ("Google's trackers
were on 5 of your 6 sites this week, which is about tracking, not a breach") and password steps. "What about google?" right after a
breach question counts as one. Gemma only gets what PrivaC knows nothing about ("Was my bank hacked?"); its rules no longer contain the
sentence it parroted, say hacks/breaches/security are always on topic, and ask for only the 2 or 3 steps that fit. Checked against the
real tracker list (~1,900 companies): everyday words ("my crypto exchange", "my router", "the store", "my digital wallet") don't match a company.
**Tests:** `tests/askc-breach.test.js` (10 tests); generic questions ("What is a data breach?", "Was my email in a breach?") and
the app's own breach questions still go to Gemma, also checked with breached sites named "data", "site", "cookie" and "email".

## Backtest, 2026-10-24 ~11:45 PM UTC (repo owner: "C gives different answers to similar prompts, repeats itself, and says less than it knows")
About 150 wordings of 19 everyday questions, plus follow-ups, through the real `shared/askc.js` with a recording stand-in for Gemma
(the real tracker list, a realistic week of browsing, Have I Been Pwned and broker lists). Root causes found and fixed, each with a test in
`tests/askc-backtest.test.js` (on every branch):
1. **Random sampling.** Gemma picked words with a random seed, so the same question twice gave two answers. Now a fixed seed (`SEED` in
   askc.js and shared/ai.js; LiteRT-LM and Ollama both take it). Similar questions can still differ in wording, never in facts.
2. **Three different company matchers** (facts, sites shown in full, breach answers). "Who is Amazon?" found no facts while "Was Amazon hacked?"
   did; "Who is Meta?" found nothing (Tracker Radar says Facebook). Now one `companiesIn()`, with Meta/Instagram/WhatsApp, YouTube/Alphabet,
   TikTok, LinkedIn, Yahoo and Amazon mapped to the tracker company (the fact line says who owns whom).
3. **Everyday-word company names.** "Did any site I visit get hacked?" was answered about a tracker company named VISIT; "How can I make it
   better?" pulled in Better Commerce Group. Everyday names (VISIT, Next, Impact, About You...) and first words count only written with
   their capital, and not as the first word.
4. **Grade questions** went to the instant breakdown only when they started with why/how: "explain cnn.com's grade", "cnn grade?",
   "What grade did cnn.com get?" and "why is cnn so bad" went to Gemma. Now a visited site plus a grade word (or "why ... so bad") is enough.
5. **"Why does CNN have a bad grade?"** said "not an A": the "a" in "have a bad" was read as the letter. A lowercase "a" is the letter only at
   the end or before "grade".
6. **Grade follow-ups** ("and espn?", "what about wired.com?") went to Gemma; now they get that site's breakdown too.
7. **"Did any site I visited get hacked?"** (6 wordings, 3 different paths): now one answer listing your visited sites in Have I Been Pwned,
   every breach with date, accounts and what was exposed.
8. **Follow-ups lost the facts**: "Does it fingerprint me?" after "Who is Criteo?" had no Criteo facts (facts came only from the new
   question). A follow-up that names nothing now keeps the last question's facts.
9. **Repeats.** Repeated sentences in one answer, "Earlier I told you..." instead of an answer, and the last answer's steps copied into
   the next: the first two are removed in `cleanAnswer`, and C's memory no longer includes earlier "What you can do" lines.
Also added: a "Who tracked me the most this week?" example in the prompt (counts sites, uses [Seen on your visit]); "what are you able
to do" gets C's intro. Still needs the real-Gemma check on the Mac: wording quality can only be judged with Gemma itself.

## Fix 8 (seen live 2026-10-24 7:30 PM): "Are you made with gemma" got "You are not made with Gemma" (branch `askc-model`)
Gemma 4 is our headline "recent technology", so this answer contradicted the pitch. Gemma's evidence never said what C runs on.
**Fix:** questions about what C is or runs on ("Are you made with Gemma?", "What AI are you?", "Are you ChatGPT?", "Who made you?",
"Is my data sent to Google when I ask you?", "What is Gemma?") get a fixed, true answer: Gemma 4 (Mar 31, 2026) on this computer, in
Chrome (E2B, LiteRT-LM) or Ollama; questions and browsing never leave the computer; Gemma writes the words, the facts come from
PrivaC's code and public lists. Each pattern needs C ("you", "C", "PrivaC", "Ask C") or the model itself, so tracker questions like
"Is my data sent to Google?" or "What can you tell me about Google?" still go to Gemma. C's intro ("Who are you?") and Gemma's
background facts now say it too. Tests: `tests/askc-model.test.js`. (`askc-breach` isn't needed any more: main already has Fix 7.)

## Also seen live (add to PLAN R13's list of bad answers; no code fix yet)
- "Who tracked me the most this week?" got one sentence, "Google tracked you the most. [Tracker Radar]", with no count of sites,
  and labeled [Tracker Radar] instead of [Seen on your visit]. The evidence already has "on N of M sites" in the "Companies seen
  on the most sites" line, so a prompt example for "most / which" questions would likely fix it.

## Check with real Gemma (repo owner's Mac, after the fixes)
Reload PrivaC, open Ask C, and ask each of these. Write down the answer and which brain answered (in Chrome or Ollama):
1. What can you do about trackers on cnn.com? (expect a real answer, not the intro)
2. What can you do? (expect the intro)
3. why did tass.com get a d (lowercase: expect the instant "tass.com got a…" breakdown)
4. Who is Yandex? (expect "Russia", never "RU")
5. Does ikea.com sell my data? (if its policy was read: expect the quote, not "no clear answer")
6. Who tracked me the most this week? (look for "You has / You is" and bare country codes)
Also note any answer that's wrong, too long, missing source tags, or that says "the user" or "you are currently visiting";
those go in PLAN R13's list of bad answers.

## Status (2026-10-24 ~6:40 PM: all six done by Max's Claude on branch `askc-fixes`, 492 tests pass; waiting for the repo owner's review)
- [x] Fix 1: about-C questions (confirmed live), branch `askc-fixes`
- [x] Fix 2: grammar after "the user", branch `askc-fixes` (verb changes only where "the user" is the subject)
- [x] Fix 3: doesn't-sell policy, branch `askc-fixes`
- [x] Fix 4: country names (confirmed live), branch `askc-fixes` (5 test expectations: codes changed to names)
- [x] Fix 5: lowercase grade letters (confirmed live), branch `askc-fixes`
- [x] Fix 6: brackets rule in the prompt, branch `askc-fixes`
- [x] Fix 7: breach questions (LinkedIn, then Google and any known company or site), branch `askc-breach` (built on `askc-fixes`, so merging it brings fixes 1-6 too)
- [x] Backtest root causes 1-9 (above), on every branch
- [x] Fix 8: questions about C's AI, branch `askc-model`
- [ ] Real-Gemma check on the Mac
