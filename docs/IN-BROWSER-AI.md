# PrivaC with C's brain in the browser (no Ollama)

This branch (`in-browser-ai`) runs **Gemma 4 E2B inside Chrome**, on your computer's graphics chip, with Google's
**LiteRT-LM** web runtime. Nothing to install besides the extension. The main branch keeps using Ollama.

## Install (about 2 minutes)
1. Download the zip: https://github.com/gormandyp/HackAGator_Privacy_Extension/archive/refs/heads/in-browser-ai.zip and unzip it.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and pick the unzipped folder.
   - If the main PrivaC is also loaded, turn it off first (both would show C's pop-ups).
3. Click the PrivaC icon, open the dashboard, go to **Ask C**, and click **Download C's brain** (2.0 GB, one time;
   about 1 minute on fast Wi-Fi). Grades and C's pop-ups work while it downloads.
4. When the download finishes, C loads Gemma right away. The very first time, Chrome sets up the graphics chip
   (~20 s, the card says "Getting C's brain ready"); after that, answers start in about a second.

**Offline / no download:** put `gemma-4-E2B-it-web.litertlm` (from
https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm, Apache 2.0) in a `models/` folder inside the extension
folder before step 2. PrivaC then uses that file and never goes online for the model.

## Needs
- Chrome 137 or newer on a computer (Mac, Windows, Linux, ChromeOS). Chromium browsers like Edge and Brave work too.
- A graphics chip Chrome can use for WebGPU: any Apple-silicon Mac, and most Windows laptops from the last few years.
- About 2 GB of free disk space, and about 2 GB of graphics/unified memory while C is answering (fine on an 8 GB laptop).
- If the browser can't run it, the dashboard says why and Ask C uses Ollama if it's running. Everything else in PrivaC works either way.

## Speed (measured on the demo MacBook Pro, Oct 24 2026)
| | In the browser (this branch, Gemma 4 E2B) | Ollama (main, Gemma 4 E4B) |
|---|---|---|
| Ask C, first words on screen | ~0.8-1.1 s | ~2.4 s |
| Ask C, whole answer | ~2.2-2.6 s | ~3.7 s |
| Reading one privacy policy (8 questions, in the background) | ~7.7 s | ~4.7 s |
| Loading the model | ~1-2 s (first time ever: ~20 s) | ~4 s |

If you ask C while a privacy policy is being read in the background, C answers first (first words ~1 s) and the
policy reading picks up right after (checked on the Mac with the real model).

Both read the test policy's 8 questions correctly, with exact quotes. The in-browser model is smaller (E2B), so it is a
little less careful in long answers; it is the right choice when nothing can be installed. Ollama's E4B is sharper.

Before the speed work on `perf`, the same Ask C question took 16 s with nothing on screen until the end.

## How it works
- `offscreen/brain.html` is a hidden page Chrome keeps open in the background. It holds Gemma in graphics memory
  (`shared/brain-core.js`), so answers don't wait for loading. After 20 minutes without questions it lets go of that memory.
- `shared/ai.js` (background) sends Ask C questions and policy questions there and streams the words back to Ask C.
  If the brain isn't downloaded or can't run, and Ollama is running, Ollama answers instead.
- Speed tricks: Gemma reads C's instructions before you ask (the next conversation is prepared right after each answer),
  Ask C sends a short summary of your browsing (~4,000 tokens) instead of everything, and background policy reading
  pauses whenever someone is waiting for C.
- The runtime is packed with the extension (`vendor/litert-lm/`): no code is loaded from the internet.

## Privacy
The only network use is the one-time download of the model file from Hugging Face: the same file for everyone, pinned to the
exact version PrivaC was tested with. Your questions, your browsing and C's answers never leave the computer.

## Use Ollama instead
In the dashboard's Ask C card, click **Use Ollama instead** (for example to use the bigger Gemma 4 E4B). Setup: docs/OLLAMA.md.
Switch back with **Use the in-browser brain**.

## Troubleshooting
- "can't run here": update Chrome (`chrome://settings/help`), and check `chrome://gpu` shows WebGPU as hardware accelerated.
- "ran out of graphics memory": close a few tabs (especially video or 3D) and ask again.
- Download stopped: click **Try again** (it starts over). **Cancel** stops it and keeps nothing.
- PrivaC only keeps the download if it is exactly the right file (2,008,432,640 bytes); a Wi-Fi sign-in page or a cut-off download is thrown away.
- To delete the 2 GB model: remove the extension in `chrome://extensions`, or click **Delete download** on the Ask C card.

## For the team
| File | What it is |
|---|---|
| `shared/ai.js` | Picks the brain (browser or Ollama), Ask C goes first, streaming, warm-up |
| `shared/brain-core.js` | Download + cache, loading Gemma, prepared conversations, cancel, idle unload (tested with a fake engine) |
| `offscreen/brain.html`, `offscreen/brain.js` | The hidden page that runs it with the real LiteRT-LM runtime |
| `dashboard/brain-card.js`, `.css` | The "C's brain" card on Ask C |
| `vendor/litert-lm/` | Google LiteRT-LM web runtime 0.18.0 (Apache 2.0), see its README |
| `tests/brain-core.test.js`, `tests/ai.test.js`, `tests/brain-card.test.js` | Tests (`node --test`) |

Model: `gemma-4-E2B-it-web.litertlm`, 2,008,432,640 bytes, Hugging Face `litert-community/gemma-4-E2B-it-litert-lm`
commit `1caa527c1e88b55f046fcd8d2b4265606680663d` (Apache 2.0, not gated).
