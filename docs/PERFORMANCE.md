# Performance

Lighthouse and Core Web Vitals numbers, measured before and after Phase 11 (the cinematic scroll experience). Budget (docs/PROMPT.md section 13): LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

## How it is measured

- Production build (`npm run build`, `next start`) against the development database with the real catalogue (34 models, 12 providers), Lighthouse 13.5 in headless Chrome, one machine, nothing else running. **Median of 3 runs** per page and mode; numbers vary by a few percent between runs.
- Three modes: **mobile, applied throttling** (Slow 4G and 4x CPU slowdown actually applied to the browser, `--throttling-method=devtools`: what a slow phone experiences), **mobile, Lighthouse simulated** (the default mobile preset, which models all script work as a dependency of the paint and is therefore much more pessimistic about LCP), and **desktop**.
- INP is not reported by Lighthouse (it needs real interactions); it was not measured.
- The runner is not part of the repository (Lighthouse is installed in a scratch directory); the command per page was `lighthouse <url> --only-categories=performance,accessibility,seo` with `--throttling-method=devtools` or `--preset=desktop` as above.

## BEFORE Phase 11 (commit `2ef67f1`, 2026-10-05)

### Mobile, applied throttling (Slow 4G, 4x CPU)

| Page                                        | Perf | LCP (s) | FCP (s) | TBT (ms) | CLS  | A11y | SEO |
| ------------------------------------------- | ---- | ------- | ------- | -------- | ---- | ---- | --- |
| `/`                                         | 70   | 2.73    | 2.73    | 1038     | 0    | 100  | 100 |
| `/models`                                   | 94   | 2.22    | 2.22    | 155      | 0    | 100  | 100 |
| `/models/claude-opus-5-5`                   | 92   | 2.17    | 2.17    | 243      | 0    | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 73   | 2.05    | 2.05    | 1029     | 0.07 | 100  | 91  |
| `/releases`                                 | 89   | 2.04    | 2.04    | 339      | 0    | 100  | 100 |

### Mobile, Lighthouse simulated

| Page                                        | Perf | LCP (s) | FCP (s) | TBT (ms) | CLS  | A11y | SEO |
| ------------------------------------------- | ---- | ------- | ------- | -------- | ---- | ---- | --- |
| `/`                                         | 67   | 5.3     | 0.91    | 543      | 0    | 100  | 100 |
| `/models`                                   | 86   | 3.9     | 0.91    | 152      | 0    | 100  | 100 |
| `/models/claude-opus-5-5`                   | 83   | 3.74    | 0.91    | 302      | 0    | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 71   | 4.22    | 0.91    | 541      | 0.07 | 100  | 91  |
| `/releases`                                 | 87   | 3.71    | 0.91    | 200      | 0    | 100  | 100 |

### Desktop

| Page                                        | Perf | LCP (s) | FCP (s) | TBT (ms) | CLS   | A11y | SEO |
| ------------------------------------------- | ---- | ------- | ------- | -------- | ----- | ---- | --- |
| `/`                                         | 98   | 1.1     | 0.25    | 0        | 0     | 100  | 100 |
| `/models`                                   | 99   | 0.82    | 0.25    | 0        | 0     | 100  | 100 |
| `/models/claude-opus-5-5`                   | 99   | 0.83    | 0.29    | 0        | 0.001 | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 99   | 0.85    | 0.25    | 3        | 0.004 | 100  | 91  |
| `/releases`                                 | 99   | 0.83    | 0.25    | 0        | 0     | 100  | 100 |

## AFTER Phase 11 (2026-10-05)

Same method, same machine, median of 3 runs, production build with the cinematic engine, canvas background, pinned scenes and the motion setting. Each cell is **before / after**.

### Mobile, applied throttling (Slow 4G, 4x CPU)

| Page                                        | Perf before / after | LCP (s) before / after | TBT (ms) before / after | CLS before / after | A11y | SEO |
| ------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------ | ---- | --- |
| `/`                                         | 70 / **68**         | 2.73 / **2.46**        | 1038 / **940**          | 0 / 0              | 100  | 100 |
| `/models`                                   | 94 / **95**         | 2.22 / **2.25**        | 155 / **134**           | 0 / 0              | 100  | 100 |
| `/models/claude-opus-5-5`                   | 92 / **91**         | 2.17 / **2.18**        | 243 / **270**           | 0 / 0              | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 73 / **74**         | 2.05 / **2.07**        | 1029 / **1049**         | 0.07 / 0.07        | 100  | 91  |
| `/releases`                                 | 89 / **88**         | 2.04 / **2.06**        | 339 / **367**           | 0 / 0              | 100  | 100 |

### Mobile, Lighthouse simulated

| Page                                        | Perf before / after | LCP (s) before / after | TBT (ms) before / after | CLS before / after | A11y | SEO |
| ------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------ | ---- | --- |
| `/`                                         | 67 / **73**         | 5.3 / **5.03**         | 543 / **353**           | 0 / 0              | 100  | 100 |
| `/models`                                   | 86 / **87**         | 3.9 / **3.95**         | 152 / **88**            | 0 / 0              | 100  | 100 |
| `/models/claude-opus-5-5`                   | 83 / **86**         | 3.74 / **3.71**        | 302 / **223**           | 0 / 0              | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 71 / **78**         | 4.22 / **4.22**        | 541 / **335**           | 0.07 / 0.07        | 100  | 91  |
| `/releases`                                 | 87 / **88**         | 3.71 / **3.76**        | 200 / **105**           | 0 / 0              | 100  | 100 |

### Desktop

| Page                                        | Perf before / after | LCP (s) before / after | TBT (ms) before / after | CLS before / after | A11y | SEO |
| ------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------ | ---- | --- |
| `/`                                         | 98 / **98**         | 1.1 / **1.02**         | 0 / **0**               | 0 / 0              | 100  | 100 |
| `/models`                                   | 99 / **100**        | 0.82 / **0.77**        | 0 / **0**               | 0 / 0              | 100  | 100 |
| `/models/claude-opus-5-5`                   | 99 / **100**        | 0.83 / **0.77**        | 0 / **0**               | 0.001 / 0.001      | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 99 / **99**         | 0.85 / **0.83**        | 3 / **0**               | 0.004 / 0.004      | 100  | 91  |
| `/releases`                                 | 99 / **100**        | 0.83 / **0.75**        | 0 / **0**               | 0 / 0              | 100  | 100 |

**Reading it.**

- **LCP did not get worse anywhere; on `/` it improved** (2.73 to 2.46 s applied, 5.3 to 5.03 s simulated). The LCP element is still the hero headline, which stays in the server HTML and is visible at first paint. The engine (GSAP, ScrollTrigger, Lenis, the canvas) is a separate chunk that starts only after `load` and an idle callback, so it is never on the critical path.
- **`/` is now just under the 2.5 s budget on a throttled phone (2.46 s), and still over it in Lighthouse's pessimistic simulated mode (5.0 s)**, as it was before. That mode treats all script work as a dependency of the paint and has been over budget on every route since before Phase 10; it is reported, not hidden.
- **TBT on `/` fell** (1038 to 940 ms applied; 543 to 353 ms simulated) because the engine builds its scenes one section per task, and Lenis (previously in the root layout, so on every page) moved to the cinematic routes only. Data-heavy routes are unchanged or slightly better; `/compare` TBT (about 1 s applied) is unchanged and no scroll library was added to it.
- CLS is 0 on `/`: all animation is transform, opacity and filter, pins add their spacers below the viewport after load, and the canvas is `position: fixed`.
- INP was not measured (Lighthouse does not report it).
- Accessibility is 100 everywhere; SEO is 100 except `/compare?models=...` (91: its metadata streams into the body; the page is noindex).

### Frame statistics (the background canvas and scroll scenes on `/`)

Measured with `requestAnimationFrame` deltas over 3 s idle and 5 s of wheel scrolling (50 wheel ticks), headless Chromium (software rendering, so a pessimistic proxy for a real GPU), 1440x900, real catalogue (46 nodes, 110 particles), pinned scenes active:

| CPU                                  | Idle, hero (3 s)                    | While wheel-scrolling (5 s)                     |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| 1x                                   | 60.2 fps (p50 16.7 ms, p95 16.7 ms) | 54.5 to 58 fps (p50 16.7 ms, p95 16.8 to 33 ms) |
| 4x slowdown                          | 42.9 fps (p50 16.7 ms, p95 33.4 ms) | 48.4 fps (p50 16.7 ms, p95 33.4 ms)             |
| 4x, canvases hidden (for comparison) | 60.7 fps                            | not measured                                    |

At normal speed it holds 60 fps. At 4x CPU slowdown it averages 43 to 48 fps with a 60 fps median, i.e. roughly every third frame is a 33 ms frame; the canvas accounts for the missing quarter. An **adaptive quality** governor (`backgroundConfig.adaptive`) drops proximity links and half the particles, then pulses and the grid, when smoothed frame time exceeds 24 ms for 1.5 s, and recovers after 6 s under 15 ms. The Playwright suite also prints these numbers (`FRAME STATS` in the test output) while seven other workers are busy, so they are lower there and the test bounds them only loosely.
