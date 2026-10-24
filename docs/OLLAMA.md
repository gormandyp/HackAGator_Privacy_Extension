# Running Gemma with Ollama (for "Ask C")

PrivaC talks to Gemma through Ollama on the same computer (`shared/gemma.js`, address `http://localhost:11434`).

## One-time setup (Mac)
1. Install Ollama from https://ollama.com/download and open it.
2. In Terminal, download the model:
   - 16 GB+ memory: `ollama pull gemma4:e4b`
   - 8 GB memory: `ollama pull gemma4:e2b` (then change `MODEL` in shared/gemma.js on your branch only)
3. Allow Chrome extensions to talk to Ollama:
   `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"`
4. Quit Ollama (llama icon in the menu bar → Quit Ollama), then open it again.
5. Test in Terminal:
   `curl http://localhost:11434/api/chat -d '{"model":"gemma4:e4b","messages":[{"role":"user","content":"Say hi in 5 words"}],"stream":false}'`
   You should see JSON with a "content" answer.

Step 3 resets when the Mac restarts. Repeat steps 3-4 after a restart.

## Using it in code (extension pages only: popup, dashboard)
Add `<script src="../shared/gemma.js"></script>` before your own script, then:

```js
const text = await PrivaCGemma.ask("Why did this site get a D?", {
  system: "You are C, a friendly privacy guide. Answer in 2-3 sentences using only the evidence.",
  context: "Grade D. Trackers: Google Ads, Meta, Criteo. Cookies accepted."
});
```

For policy questions, pass `{ json: true }` and ask for `{"answer":"yes|no|unknown","quote":"..."}`.
Errors come back as plain sentences (Ollama not running, blocked origin), so you can show them in C's bubble.

Tests: `node --test` (tests/gemma.test.js uses a fake Ollama, so it runs anywhere).

## Keep it local
Use local models only (`gemma4:e4b` / `gemma4:e2b`). Cloud models (names ending in `:cloud`) send questions to Ollama's servers and would break the privacy promise on the dashboard.
