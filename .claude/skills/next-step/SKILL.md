---
name: next-step
description: Implement the next unchecked step in docs/PLAN.md test-first, verify it with real command output, and commit. Use after /clear for each step.
disable-model-invocation: true
---

1. Read `docs/PLAN.md` and `docs/SPEC.md`. Pick the first unchecked step (or the step number given in the arguments: $ARGUMENTS). State which step and its acceptance criteria.
2. **Explore (no edits):** read the relevant files and search for existing code that already does part of this. Say what you will reuse. If the step looks bigger than one small reviewable commit, propose splitting it and stop.
3. **Test first:** write tests that encode the acceptance criteria. Run them and show they fail.
4. **Implement the minimum** to pass. Rules: small diff; no new dependencies without asking; never modify, skip or delete existing tests; no stubs/placeholders; follow existing patterns.
5. **Verify:** run the full test command and lint/typecheck from CLAUDE.md, plus the step's `Verify by:` check. Paste the output. For UI, take a screenshot or run the browser test.
6. **Report:** files changed, anything you were unsure about, and anything the user should look at in the diff (test changes, new packages).
7. Tick the step in PLAN.md and commit with a clear message.
8. Tell the user: "Review the diff (`git show`), then /clear and /next-step."
