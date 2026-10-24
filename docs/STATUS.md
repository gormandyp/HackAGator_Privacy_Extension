# Team status board

Update your row every time you push. Keep it to one line per column.

| Person | Area | Branch | Working on (PLAN step) | Blocked by | Next |
|---|---|---|---|---|---|
| Repo owner (gormandyp) | core + integrator | main | R4 adversary alert, demo prep | - | UI mockups |
| Josh Davis | data | data | Away | - | Check DATA.md |
| Max Glassman | ask-c + data | max-state-media | F2 done: shared/state-media.json (20 outlets, 61 domains, State Media Monitor) in score, alert and Ask C | Live check on the Mac | Human check of 2 policies (R3) |
| Matthew Finkelstein | ui | ui | C pop-ups and poses (max/mascot-poses held until he's done) | - | R5 unsafe-site warning |
| Justin Smilowitz | demo | demo | Video + Devpost with Matthew and Max | - | Steps 14-16 |

## Live check log (R0)
| Site | Grade | Cookie pop-up? | Notes |
|---|---|---|---|
| wired.com | F (85) | No banner (US) | Breach (WIRED, 2025) +15; "never asked" +10 |
| cnn.com | C (55) | Agree-only box | "No Reject button" +10 |
| google.com | B (40) | No banner | Bug: Google's own tag manager + preloaded Temu/Baidu counted; fixed Sat (needs recheck) |
| ikea.com/us | - | Ok + "Your privacy choices" only | No-Reject recorded; C silent (needs a pop-up, Matthew) |
| stackoverflow, theguardian, bbc, economist, onetrust, cookiebot | - | No banner shown in Florida | US visitors rarely see banners: demo "Decline for me" on preview/demo-site.html |

## Decisions (write the date and who decided)
- 2026-10-23: Gemma runs through Ollama on the demo Mac for now; in-browser Transformers.js is a stretch goal.
- 2026-10-23: Skip Globus raw RegTrack data; use facts from the RegTrack paper with page numbers (PLAN step 12).
- 2026-10-23: Cookie banners handled by JavaScript, not Gemma (Max's partner; Max's plan chat).
- 2026-10-23 (repo owner): scoring v3: only observed or on-record things add points; unknown = 0 but shown as "not checked yet". No-Reject banner 10, recent breach 15, older breach 5.
- 2026-10-23 (repo owner): no banner while the site tracks you = 10 ("you were never asked").
- 2026-10-23: download whole public lists (HIBP, CA registry) daily; never look up single sites. Store names only, 7-day history.
- 2026-10-24: keep the exposure score (higher = more exposed) as in IDEA.md; drop the "100 - exposure" Privacy Score from plan v2.
- 2026-10-24: long-term update server is out of scope for the hackathon.
- 2026-10-24 (repo owner): wait on in-browser Gemma until the kinks are out; Ollama stays for the demo (recorded on the repo owner's Mac).
- 2026-10-24 (repo owner): 1260H and foreign-adversary country never double count (one 15-point line). A site owned by a company in a listed country counts as that line too.
- 2026-10-24 (repo owner): video presenters Matthew, Max and Justin; recorded on the repo owner's Mac.
- 2026-10-24: hold max/mascot-poses until Matthew finishes; old ask-c branch deleted (superseded by max-askc).
- 2026-10-24 1:30 AM: merged Max's R3 policy reader (89 tests). Found state-run sites in listed countries aren't flagged; fix plan F1-F5 in PLAN.md and HANDOFF.md.
