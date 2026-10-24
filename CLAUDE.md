# Project: PrivaC (Gator Hack V, deadline Sun Oct 25 5 PM ET)
Chrome extension that shows who a website connects you to, grades its privacy A-F, and uses an on-screen "C" to decline cookie tracking and flag services from companies on U.S. government lists. Team of 5 beginners: explain decisions in plain words. Spec: docs/SPEC.md (read its Honesty rules before writing any user-facing text).

## Stack
- Plain JavaScript Chrome extension (Manifest V3), **no build step**. Load unpacked at chrome://extensions, then click reload after changes.
- Fallback (and the `ollama` branch): Gemma 4 E4B through **Ollama** on the same computer (`shared/gemma.js`, http://localhost:11434). Setup: docs/OLLAMA.md. Never use `:cloud` models (breaks the privacy promise).
- **main is the in-browser version (since 2026-10-24); branch `ollama` is the Ollama-only download.** Gemma 4 E2B runs inside Chrome with Google's LiteRT-LM (`vendor/litert-lm/`, WebGPU): `shared/brain-core.js` in `offscreen/brain.html`, chosen by `shared/ai.js` (Ollama is the fallback). Details: docs/IN-BROWSER-AI.md.
- Tests: Node's built-in runner, `node --test` (no npm installs needed).

## Commands (run these; don't guess)
- Test all: `node --test`
- Rebuild tracker data: `node scripts/build-atlas.js <path to tracker-radar clone>`; cookie data: `node scripts/build-cookie-db.js <open-cookie-database.csv>`
- Try the UI without Chrome: open `dashboard/dashboard.html`, or `popup/popup.html?site=flightdeals.example`

## Layout (non-obvious only)
- `shared/data.js` is the single source of truth for the score and data shape (`privacData` in chrome.storage.local). The UI only reads; background.js writes.
- `content/c-prompt.js`: the C on-page prompt API (`PrivaCPrompt.cookie/adversary/hide`). `content/cookie-detector.js` finds banners and reports choices to the background.
- `background.js` loads `background/senders.js` (who may ask what) first, then `shared/lists.js, cookies.js, data.js, gemma.js, askc.js, policy.js` and `background/tracking.js, alerts.js, policy-reader.js`. Policy questions live in `shared/knowledge-map.json`. Only the background writes `privacData` (content scripts send messages).
- Data: `shared/atlas.json` (trackers), `shared/cookie-db.json` (cookies), `privacLists` in storage (HIBP + CA brokers, refreshed daily). Sources and licenses: docs/DATA.md.
- Spec: `docs/SPEC.md` | Plan: `docs/PLAN.md` | Team doc (re-read for updates): https://docs.google.com/document/d/16WMA557yYF0qcxb9CSYCB0wrmqSXE2lS4e98C3C6bAQ/edit

## Conventions that differ from defaults
- Prefer simple functions over new abstractions.
- No new dependency without asking me first; confirm the package really exists.
- Keep the existing visual style (shared/theme.css, mascot moods).
- If you change the scoring rules, update the "How the grade works" table in dashboard.html and docs/SPEC.md too.
- Never store full URLs or cookie values. Never send a site or company name to an outside service; download whole lists only.

## Working rules
- Search for existing code before writing new code.
- Write or update a failing test first; never delete, skip, or weaken existing tests.
- No placeholder/stub/TODO implementations.
- Keep diffs small: one PLAN.md step per commit.
- Show command output as evidence; never claim "done" without it.
- If you are corrected twice on the same thing, stop and tell me to run /clear.

## Gotchas
- Teammates sometimes upload zip files to GitHub: unzip outside the repo, diff against the last version, copy only their changes, delete the zip.
- GitHub Desktop may offer "Force push" when it hasn't fetched: cancel, Fetch origin, then push normally.

## When compacting
- Preserve: modified files, current PLAN.md step, test commands.
