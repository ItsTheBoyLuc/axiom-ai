# Performance

Lighthouse and Core Web Vitals numbers, measured before (2026-10-05) and after (2026-10-06) Phase 11 (the cinematic scroll experience). Budget (docs/PROMPT.md section 13): LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

## How it is measured

- Production build (`npm run build`, `next start`) against the development database with the real catalogue (34 models, 12 providers), Lighthouse 13.5 in headless Chrome, one machine, nothing else running. **Median of 3 runs** per page and mode; numbers vary by a few percent between runs.
- Three modes: **mobile, applied throttling** (Slow 4G and 4x CPU slowdown actually applied to the browser, `--throttling-method=devtools`: what a slow phone experiences), **mobile, Lighthouse simulated** (the default mobile preset, which models all script work as a dependency of the paint and is therefore much more pessimistic about LCP), and **desktop**.
- INP is not reported by Lighthouse (it needs real interactions); it was not measured.
- The 2026-10-06 comparison adds a same-session A/B (BEFORE commit built in a separate worktree with its own `npm ci`, both served by `next start`, interleaved runs, median of 5) because the host's speed differed between the two days. The runner is not part of the repository (Lighthouse is installed in a scratch directory); the command per page was `lighthouse <url> --only-categories=performance,accessibility,seo` with `--throttling-method=devtools` or `--preset=desktop` as above.

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

## AFTER Phase 11 (final build, 2026-10-06)

Same method as the baseline (median of 3, production build, real catalogue), measured on the final code of the sync-up (code of commit `7916db1`: cinematic engine, canvas background, pinned scenes, motion setting, arrive-at-load fix, dependency patch bumps) in the rebuilt Docker images. Each cell is **baseline of 2026-10-05 / final of 2026-10-06**.

**Read the applied-throttling table together with the A/B below it.** The host was slower on 2026-10-06 than on 2026-10-05: routes that Phase 11 does not touch (`/models`, the profile, `/compare`) also got worse in applied-throttling mode (TBT +22 to +65%) even though their code did not change. Cross-day numbers therefore overstate any regression; the same-session A/B is the valid comparison.

### Mobile, applied throttling (Slow 4G, 4x CPU)

| Page                                        | Perf before / after | LCP (s) before / after | TBT (ms) before / after | CLS before / after | A11y | SEO |
| ------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------ | ---- | --- |
| `/`                                         | 70 / **62**         | 2.73 / **2.7**         | 1038 / **1285**         | 0 / 0              | 100  | 100 |
| `/models`                                   | 94 / **92**         | 2.22 / **2.37**        | 155 / **194**           | 0 / 0              | 100  | 100 |
| `/models/claude-opus-5-5`                   | 92 / **86**         | 2.17 / **2.3**         | 243 / **400**           | 0 / 0              | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 73 / **72**         | 2.05 / **2.07**        | 1029 / **1253**         | 0.07 / 0.07        | 100  | 91  |
| `/releases`                                 | 89 / **86**         | 2.04 / **2.22**        | 339 / **400**           | 0 / 0              | 100  | 100 |

### Mobile, Lighthouse simulated

| Page                                        | Perf before / after | LCP (s) before / after | TBT (ms) before / after | CLS before / after | A11y | SEO |
| ------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------ | ---- | --- |
| `/`                                         | 67 / **73**         | 5.3 / **5.07**         | 543 / **348**           | 0 / 0              | 100  | 100 |
| `/models`                                   | 86 / **88**         | 3.9 / **3.97**         | 152 / **64**            | 0 / 0              | 100  | 100 |
| `/models/claude-opus-5-5`                   | 83 / **89**         | 3.74 / **3.67**        | 302 / **92**            | 0 / 0              | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 71 / **79**         | 4.22 / **4.23**        | 541 / **284**           | 0.07 / 0.07        | 100  | 91  |
| `/releases`                                 | 87 / **89**         | 3.71 / **3.67**        | 200 / **65**            | 0 / 0              | 100  | 100 |

### Desktop

| Page                                        | Perf before / after | LCP (s) before / after | TBT (ms) before / after | CLS before / after | A11y | SEO |
| ------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------ | ---- | --- |
| `/`                                         | 98 / **98**         | 1.1 / **1.03**         | 0 / **0**               | 0 / 0              | 100  | 100 |
| `/models`                                   | 99 / **100**        | 0.82 / **0.79**        | 0 / **0**               | 0 / 0              | 100  | 100 |
| `/models/claude-opus-5-5`                   | 99 / **100**        | 0.83 / **0.78**        | 0 / **0**               | 0.001 / 0.001      | 100  | 100 |
| `/compare?models=claude-opus-5-5,gpt-6-sol` | 99 / **99**         | 0.85 / **0.83**        | 3 / **0**               | 0.004 / 0.004      | 100  | 91  |
| `/releases`                                 | 99 / **100**        | 0.83 / **0.79**        | 0 / **0**               | 0 / 0              | 100  | 100 |

### Same-session A/B (the valid before/after for the throttled phone)

The BEFORE commit (`2ef67f1`, with its own lockfile: next 16.3.7) and the final build served by `next start` side by side on the same host, alternating runs (BEFORE, AFTER, AFTER, BEFORE, ...), mobile with applied throttling (Slow 4G, 4x CPU), **median of 5**, performance category only. Run-to-run spread is small (about 30 ms of TBT), so these differences are real.

| Page                      | Perf before / after | LCP (s) before / after | TBT (ms) before / after | TBT runs, after (ms)         |
| ------------------------- | ------------------- | ---------------------- | ----------------------- | ---------------------------- |
| `/`                       | 72 / **62**         | 2.62 / **2.73**        | 930 / **1278**          | 1309, 1198, 1278, 1312, 1253 |
| `/models`                 | 93 / **92**         | 2.25 / **2.35**        | 209 / **186**           | 212, 183, 177, 186, 196      |
| `/models/claude-opus-5-5` | 87 / **86**         | 2.23 / **2.28**        | 382 / **392**           | 385, 393, 367, 392, 401      |
| `/releases`               | 86 / **87**         | 2.13 / **2.14**        | 419 / **395**           | 398, 342, 377, 398, 395      |

**Reading it, honestly.**

- **The cinematic home page costs something on a slow phone.** On `/` under applied 4x CPU throttling the final build has TBT 1278 ms against 930 ms (+350 ms), LCP 2.73 s against 2.62 s (+0.11 s) and Lighthouse performance 62 against 72. Both builds are over the 2.5 s LCP budget in this mode on this host; the earlier note in this file that LCP on `/` fell below 2.5 s and TBT fell to 940 ms was **not reproducible** and has been removed. Where it came from (a lighter engine at the time, or a quieter host) was not established.
- **The routes that are not cinematic are unchanged** within noise (`/models`, the profile: LCP +0.05 to +0.10 s, TBT -23 to +10 ms), as are the light-level `/releases` (87 against 86, TBT 395 against 419 ms). No scroll library or canvas reaches `/models`, `/compare`, `/benchmarks`, `/news`, `/search`, `/admin`, `/settings` or `/account`.
- **Lighthouse's default simulated mobile mode and desktop show no regression** (`/` simulated: performance 67 to 73, TBT 543 to 348 ms, LCP 5.3 to 5.07 s; desktop `/` 98, LCP 1.1 to 1.03 s). The two mobile modes disagree about `/` because the simulated mode models script cost from a trace on a fast CPU, whereas applied throttling really slows the main thread 4x and so exposes the engine start (GSAP, ScrollTrigger and Lenis parsing, then one scene per task) inside the blocking-time window.
- The LCP element is still the hero headline, in the server HTML and visible at first paint; the engine is a separate chunk started after `load` and an idle callback (`startConfig.idleTimeoutMs`, 1200 ms). The `/` TBT is the engine's start-up work. **Lever if this should be bought back:** start the engine later or lighter (`startConfig.idleTimeoutMs`, fewer scenes built at start, the canvas first frame deferred); each of these trades hero liveliness for blocking time. Not changed: that is a decision for the owner.
- CLS is 0 on `/`: all animation is transform, opacity and filter, pins add their spacers below the viewport, the canvas is `position: fixed`. INP was not measured (Lighthouse does not report it). Accessibility is 100 everywhere; SEO is 100 except `/compare?models=...` (91: its metadata streams into the body; the page is noindex).

### Frame statistics (the background canvas and scroll scenes on `/`)

Measured with `requestAnimationFrame` deltas over 3 s idle and 5 s of wheel scrolling (50 wheel ticks), headless Chromium (software rendering, so a pessimistic proxy for a real GPU), 1440x900, real catalogue (46 nodes, 110 particles), pinned scenes active:

| CPU                                  | Idle, hero (3 s)                    | While wheel-scrolling (5 s)                     |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| 1x                                   | 60.2 fps (p50 16.7 ms, p95 16.7 ms) | 54.5 to 58 fps (p50 16.7 ms, p95 16.8 to 33 ms) |
| 4x slowdown                          | 42.9 fps (p50 16.7 ms, p95 33.4 ms) | 48.4 fps (p50 16.7 ms, p95 33.4 ms)             |
| 4x, canvases hidden (for comparison) | 60.7 fps                            | not measured                                    |

At normal speed it holds 60 fps. At 4x CPU slowdown it averages 43 to 48 fps with a 60 fps median, i.e. roughly every third frame is a 33 ms frame; the canvas accounts for the missing quarter. An **adaptive quality** governor (`backgroundConfig.adaptive`) drops proximity links and half the particles, then pulses and the grid, when smoothed frame time exceeds 24 ms for 1.5 s, and recovers after 6 s under 15 ms. **Re-measured on the final build (2026-10-06, `FRAME STATS` from the Playwright suite, one worker, alone, 4x CPU, 70 wheel ticks):** median 59.9 fps, p95 29.9 fps, 79 of 300 frames slow (26%): the same picture as above. The 1x rows were not re-measured (the canvas code did not change after they were taken). The Playwright suite also prints these numbers (`FRAME STATS` in the test output) while seven other workers are busy, so they are lower there and the test bounds them only loosely.
