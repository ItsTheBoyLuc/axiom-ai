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
