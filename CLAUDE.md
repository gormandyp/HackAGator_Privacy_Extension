# Project: PrivaC (Gator Hack V, deadline Sun Oct 25 5 PM ET)
Chrome extension that shows who a website connects you to, grades its privacy A-F, and uses an on-screen "C" to decline cookie tracking and flag services from companies on U.S. government lists. Team of 5 beginners: explain decisions in plain words. Spec: docs/SPEC.md (read its Honesty rules before writing any user-facing text).

## Stack
- Plain JavaScript Chrome extension (Manifest V3), **no build step**. Load unpacked at chrome://extensions, then click reload after changes.
- Gemma 4 E2B via Transformers.js (vendored file in `lib/`), run in an offscreen document with WebGPU.
- Tests: Node's built-in runner, `node --test` (no npm installs needed).

## Commands (run these; don't guess)
- Test all: `node --test`
- Try the UI without Chrome: open `dashboard/dashboard.html`, or `popup/popup.html?site=flightdeals.example`

## Layout (non-obvious only)
- `shared/data.js` is the single source of truth for the score and data shape (`privacData` in chrome.storage.local). The UI only reads; background.js writes.
- `content/c-prompt.js`: the C on-page prompt API (`PrivaCPrompt.cookie/adversary/hide`).
- Spec: `docs/SPEC.md` | Plan: `docs/PLAN.md` | Team doc (re-read for updates): https://docs.google.com/document/d/16WMA557yYF0qcxb9CSYCB0wrmqSXE2lS4e98C3C6bAQ/edit

## Conventions that differ from defaults
- Prefer simple functions over new abstractions.
- No new dependency without asking me first; confirm the package really exists.
- Keep the existing visual style (shared/theme.css, mascot moods).
- If you change the scoring rules, update the "How the grade works" table in dashboard.html too.

## Working rules
- Search for existing code before writing new code.
- Write or update a failing test first; never delete, skip, or weaken existing tests.
- No placeholder/stub/TODO implementations.
- Keep diffs small: one PLAN.md step per commit.
- Show command output as evidence; never claim "done" without it.
- If you are corrected twice on the same thing, stop and tell me to run /clear.

## Gotchas
- (Add a line here only when Claude repeats a real mistake.)

## When compacting
- Preserve: modified files, current PLAN.md step, test commands.
