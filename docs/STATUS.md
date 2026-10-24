# Team status board

Update your row every time you push. Keep it to one line per column.

| Person | Area | Branch | Working on (PLAN step) | Blocked by | Next |
|---|---|---|---|---|---|
| Repo owner (gormandyp) | core + integrator | main | R0 live check | Reload + dashboard screenshot | R1, R2 |
| Josh Davis | data | data | Away | - | Check R2 sources |
| Max Glassman | ask-c | ask-c | R3 policy reader | - | R6, R7 |
| Matthew Finkelstein | ui | ui | C warning pop-ups | - | R5, R8 |
| Justin Smilowitz | demo | demo | Devpost draft, demo sites | - | Steps 14-16 |

## Live check log (R0)
| Site | Grade | Cookie pop-up? | Notes |
|---|---|---|---|

## Decisions (write the date and who decided)
- 2026-10-23: Gemma runs through Ollama on the demo Mac for now; in-browser Transformers.js is a stretch goal.
- 2026-10-23: Skip Globus raw RegTrack data; use facts from the RegTrack paper with page numbers (PLAN step 12).
- 2026-10-23: Cookie banners handled by JavaScript, not Gemma (Max's partner; Max's plan chat).
- 2026-10-23 (repo owner): scoring v3: only observed or on-record things add points; unknown = 0 but shown as "not checked yet". No-Reject banner 10, recent breach 15, older breach 5.
- 2026-10-23 (repo owner): no banner while the site tracks you = 10 ("you were never asked").
- 2026-10-23: download whole public lists (HIBP, CA registry) daily; never look up single sites. Store names only, 7-day history.
- 2026-10-24: keep the exposure score (higher = more exposed) as in IDEA.md; drop the "100 - exposure" Privacy Score from plan v2.
- 2026-10-24: long-term update server is out of scope for the hackathon.
