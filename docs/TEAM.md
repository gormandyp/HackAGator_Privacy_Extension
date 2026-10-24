# Who does what (5 people, each owns one area)

Everyone: GitHub Desktop → clone the repo → make your branch (name below) → work one PLAN.md step at a time. Pull before you start; push when the step's check passes; update your row in docs/STATUS.md.

| Area | Person | Branch | Starts with (tonight) | Then |
|---|---|---|---|---|
| **core + integrator**: background script, merges to main, Ollama | Repo owner (gormandyp) | main / core | Ollama connected (done: shared/gemma.js); step 3 capture requests | Step 6 cookie detection, merges |
| **data**: lists and facts | Josh Davis | data | Step 4: pick datasets, write docs/DATA.md, trackers.json, flagged-companies.json | Steps 10, 12 |
| **Ask C**: question panel + policy questions | Max Glassman | ask-c | Step 11: "Ask C" area in the popup using `PrivaCGemma.ask` (docs/OLLAMA.md) | Step 9 policy questions; Honesty rules wording |
| **ui**: C pop-up and look | Matthew Finkelstein | ui | C's on-page pop-up (content/c-prompt.js), push the cookie pop-up test | Step 5 score display, step 13 polish |
| **demo**: pitch, testing, submission | Justin Smilowitz | demo | Devpost rules, 3-minute story, find 3 real demo sites, start docs/DIFFICULTIES.md | Steps 14-16, testing everyone's work |

Rules: don't edit another area's files without telling them. `shared/data.js` and `shared/gemma.js` are shared: ask the repo owner before changing. Post in the group chat when you push. Checkpoint: **Sat 1 PM**.
