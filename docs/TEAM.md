# Who does what (updated 2026-10-24 Sat)

Everyone: GitHub Desktop → **Fetch origin, then Pull** → work on your branch → one PLAN.md step at a time → push when the step's check passes → update your row in docs/STATUS.md. Never click "Force push". Push code, not zip files.

| Area | Person | Branch | Now | Next |
|---|---|---|---|---|
| **core + integrator**: background, data plumbing, merges (with Claude) | Repo owner (gormandyp) | main | R0 live check, R1 RegTrack, R2 1260H | R4 adversary alert, R9 reliability |
| **data**: lists and facts | Josh Davis | data | Away; Claude covers R2 | Check R2 entries and sources when back; docs/DATA.md |
| **ask-c**: Ask C, policy and terms questions | Max Glassman | ask-c | R3 privacy-policy reader (wording of the questions, honesty) | R6 suggestions, R7 terms of service |
| **ui**: C on the page, popup, dashboard look | Matthew Finkelstein | ui | C pop-ups (warnings) | R5 unsafe-site warning, R8 themes, step 13 polish |
| **demo**: pitch, testing, submission | Justin Smilowitz | demo | Devpost draft, 3 demo sites, DIFFICULTIES.md | Steps 14-16, test everyone's work |

Shared files (ask the repo owner before changing): shared/data.js (score rules), shared/askc.js, shared/gemma.js, shared/lists.js, background/tracking.js, manifest.json.
Rules: don't edit another area's files without telling them. Post in the group chat when you push. Checkpoint (proposed, confirm in chat): **Sat 6 PM** (R0-R2 done), freeze **Sun 11 AM**.
