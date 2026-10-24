# Ask C fixes (PLAN R13): instructions for the repo owner's Claude

Found 2026-10-24 ~6 PM ET by Max's Claude, testing `shared/askc.js` on main (`ceeb94f`) with the real code and a fake Gemma
(48 checks: 26 probes + every question the app's own buttons send). All 454 existing tests pass; none cover these.
**Confirmed with real Gemma on Max's Mac (in-browser brain, 2026-10-24 6:15 PM ET):** Fixes 1, 4 and 5 (see each fix's
"Seen live" line). Max's screenshots are in the Project doc `claude/askc-fixes.md`'s chat; the answers are quoted below.
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

## Status
- [ ] Fix 1: about-C questions (confirmed live)
- [ ] Fix 2: grammar after "the user"
- [ ] Fix 3: doesn't-sell policy
- [ ] Fix 4: country names (confirmed live)
- [ ] Fix 5: lowercase grade letters (confirmed live)
- [ ] Fix 6: brackets rule in the prompt
- [ ] Real-Gemma check on the Mac
