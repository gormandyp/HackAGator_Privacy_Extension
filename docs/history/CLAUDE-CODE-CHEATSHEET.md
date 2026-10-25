> **History.** The one-page workflow our team of beginners followed with Claude Code, our AI coding assistant (see "How we built it" in the [README](../../README.md)). The project instructions it refers to are in [CLAUDE.md](../../CLAUDE.md) and the step commands in `.claude/skills/`. Kept as a record of how we worked.

# Claude Code cheat sheet (your only job is the bold parts)

## Once per project
1. Open the Claude desktop app → **Code** tab → choose the folder `Desktop/Projects/HackAGator_Privacy_Extension` (no terminal needed).
2. Type `/kickoff` → **approve or edit the drafted SPEC and PLAN.** It then sets up the project and pushes to GitHub.

## Every step (repeat until the plan is done)
1. `/clear`
2. `/next-step`
3. **Read the diff** (`git show`). Look for: changed/deleted tests, new packages, features you didn't ask for.
4. Good → keep going. Bad → `Esc` to stop, `/rewind` to undo, say what's wrong once.

## When things go wrong
- Bug: `/clear` → `/fix-bug <what happened + paste the error>`
- Corrected Claude twice and it's still wrong → **`/clear` and start that step again.** Don't keep arguing.
- Before a demo or merge: `/clear` → `/check-diff HEAD~5` (reviews the last 5 commits).

## Defaults (don't overthink)
- Model: Sonnet 5.5 or Opus 5.5 at medium effort. Set it at the start (`/model`), don't switch mid-session.
- One hard problem? Put `ultrathink` in that one message. ("think hard" no longer does anything.)
- Check spend: `/usage`. Check context: `/context`.
- Don't add subagents, MCP servers, hooks or parallel sessions until something is actually slow.
- Claude repeats a mistake → **add one line to "Gotchas" in CLAUDE.md.** Nothing else goes in there.

## Hackathon mode vs keeper mode
- Hackathon/prototype: fewer tests are fine, but keep one smoke/end-to-end test green.
- Code you'll maintain: every step test-first, review every diff, approve every new dependency.

## Optional: measure
- After each task, add a row to an experiment log (minutes, `/usage` cost, corrections, did it pass first check). We did not end up keeping one.
