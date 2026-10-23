---
name: fix-bug
description: Debug a problem by reproducing it first, testing ranked hypotheses, then applying the smallest fix with evidence. Pass the symptom and any error output as arguments.
disable-model-invocation: true
---

Bug report: $ARGUMENTS

Do not fix anything until step 3.
1. **Reproduce** it with a failing test or a small script. Show the failure. If you can't reproduce it, ask the user for the exact steps/logs.
2. **Hypotheses:** list 2-4 likely causes ranked by likelihood, each with the cheapest check. Run the checks and report the evidence. For a regression, consider `git bisect`.
3. **Fix** with the smallest change. Show the reproduction now passes, then run the full test suite and lint.
4. If a fix would require changing an existing test's expectation, STOP and ask the user.
5. Commit with a message describing the cause.
