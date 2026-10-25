# LiteRT-LM web runtime (vendored)

Google's on-device LLM runtime for the web, used to run Gemma 4 in Chrome with WebGPU (offscreen/brain.js).

- Packages: `@litert-lm/core` 0.18.0 and `@litertjs/wasm-utils` 2.6.0 from npm (Apache License 2.0, see LICENSE).
- `litert-lm.mjs`: the two packages' `dist/` bundled into one ES module with esbuild 0.23.1
  (`--bundle --format=esm --platform=browser --target=chrome120`), so the extension needs no build step.
- `wasm/litertlm_wasm_internal.js` + `.wasm`: the WebAssembly build for browsers with JSPI and relaxed SIMD (Chrome 137+).
  The package's other three builds (for older browsers) are left out to keep the extension small.
- Produced by the `vendor-litert-lm` GitHub Actions workflow (kept in docs/history/vendor-litert-lm.yml; its branch was later deleted) because the team's machines and
  Claude's workspace couldn't reach npm directly; nothing was changed by hand.

SHA-256:
```
6d793405c885ee905da6dbdaa34b6fa6951ed166c5ba2749c7ab3e69ecd44f7d  litert-lm.mjs
195ef5a529df718bc1320e292b4c4d750059350d162ec99654e250ab8a14efa7  wasm/litertlm_wasm_internal.js
83e8af6e4deecfb3bb24b6602851dcb8a0c5656547d98eefc5fbd5640ce49ab5  wasm/litertlm_wasm_internal.wasm
```
Source: https://github.com/google-ai-edge/LiteRT-LM (js/packages/core) · Docs: https://ai.google.dev/edge/litert-lm/js
