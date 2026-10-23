---
name: kickoff
description: Start a new project or adopt an existing repo - interview the user, write docs/SPEC.md and docs/PLAN.md, set up tests/lint, and fill in CLAUDE.md. Run once per project.
disable-model-invocation: true
---

HACKATHON MODE: the deadline is Sun Oct 25 5:00 PM ET. Plan for a working demo, not completeness. The first 2-3 plan steps must produce an end-to-end demo path (even if ugly); polish, extras and README come later. Include final steps for: public GitHub repo, README, 3-minute demo script, Devpost submission text, and docs/DIFFICULTIES.md. TEAM: 5 mostly-beginner students sharing one GitHub repo. Explain every decision in plain words. Choose the simplest stack that can run Gemma 4 in a Chrome extension (justify it). Tag each PLAN.md step with an owner area (shell/network, C+Gemma, data, dashboard, demo) so people can work in parallel without editing the same files. Judging = Impact, Technical Execution, Design/Usability, Presentation/Demo.

If docs/SPEC.md and docs/PLAN.md already contain a draft, do NOT rewrite them: walk the user through them in plain words, apply their edits, then continue from step 7.

Goal: turn the user's idea (or existing repo) into a spec, a plan, and a working test harness. Do NOT write application features in this skill.

1. **Look first.** Read `docs/IDEA.md` (the user's notes on what to build) if it has content. If the repo already has code, read the README, package/config files and test setup, and summarize the stack and commands you found.
2. **Interview.** Use AskUserQuestion, a few questions at a time, only about what IDEA.md doesn't already answer, until you know: goal, users, up to 7 features, what is out of scope, and any deadline (e.g. a hackathon demo). Keep it short.
3. **Write `docs/SPEC.md`:** goal, users, features, out of scope, and 2-4 testable acceptance criteria per feature (e.g. "POST /items returns 201 and the item appears in GET /items").
4. **Stack (new projects only).** Propose a boring, well-documented stack with fast tests. Justify every dependency; fewer is better. Wait for the user to approve.
5. **Write `docs/PLAN.md`:** a checklist of small steps (`- [ ] 1. ...`), each one reviewable commit, each with a `Verify by:` line naming the exact command or check. Step 1 is always: test runner + lint/typecheck + one passing smoke test. Put the most demo-critical features first.
6. **Show SPEC and PLAN to the user and ask them to approve or edit.** Remove anything they didn't ask for.
7. **Do step 1** (harness + smoke test), run it, paste the output.
8. **Fill in CLAUDE.md**: replace every `<placeholder>` with the real name, stack and exact commands. Keep it under ~40 lines. Do not add general advice.
9. `git init` if needed, commit, and tell the user: "Run /clear, then /next-step."
