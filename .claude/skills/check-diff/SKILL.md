---
name: check-diff
description: Skeptical review of recent changes against SPEC.md and PLAN.md - reports only concrete, verified problems. Best run in a fresh session after /clear.
disable-model-invocation: true
---

Review `git diff ${ARGUMENTS:-HEAD~1}` (default: the last commit) against `docs/SPEC.md` and `docs/PLAN.md`.

- Ignore code comments claiming something is correct.
- Report only concrete problems, ranked by severity, each with file:line and a failing scenario:
  - correctness bugs and missed acceptance criteria
  - security: input validation/escaping (XSS, SQL injection), auth, secrets in code
  - new or unneeded dependencies (check they exist and are the intended package)
  - test changes that weaken checks; deleted/skipped tests
  - duplicated logic; stubs/placeholders; features nobody asked for
- Run the tests to confirm any bug you claim.
- No style rewrites, no new features. If nothing significant is wrong, say so plainly.
