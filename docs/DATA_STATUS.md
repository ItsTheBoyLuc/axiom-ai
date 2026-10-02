# Data status

What is in the real catalogue (`prisma/seed/data/*.json`), where it came from, what is missing and why. Updated with every data batch. Rules: `CLAUDE.md` section 2 and `docs/PROMPT.md` section 2.

**Method.** Every value was read in-session from the cited official page on **2026-10-02** (no training-data recall). Pages that block plain HTTP fetchers (`openai.com`, `anthropic.com` announcements, `deepmind.google` model cards) were read in a normal browser session as any visitor would. Each record carries `sourceUrl`, `verificationStatus`, `verifiedAt`, `collectedAt` and `isDemo = false`; the database also enforces these rules with CHECK constraints. `tests/unit/real-seed-data.test.ts` guards the files in CI.

## Batch 1: OpenAI, Anthropic, Google DeepMind (2026-10-02)

| Provider        | Models | Prices | Benchmark results | Releases |
| --------------- | ------ | ------ | ----------------- | -------- |
| OpenAI          | 5      | 18     | 19                | 9        |
| Anthropic       | 4      | 28     | 26                | 5        |
| Google DeepMind | 6      | 31     | 22                | 7        |

Plus 34 benchmark definitions (one per benchmark _variant_, see below) and 3 provider records.

### Included models

- **OpenAI:** GPT-6 Astra, GPT-6.1 Sol, GPT-6 Sol, GPT-6 Luna, GPT-Image-2.5 Sunburst.
- **Anthropic:** Claude Fable 5.1, Claude Opus 5.5, Claude Sonnet 5.5, Claude Haiku 4.5 (the four models on the official models overview).
- **Google DeepMind:** Gemini 3.8 Flash, 3.7 Flash, 3.6 Flash, 3.5 Flash, 3.5 Flash-Lite, 3.1 Pro (preview).

### Deliberately not included (yet)

- Older or legacy models (GPT-5.x, GPT-4.x, o-series, Claude 4.x and earlier 5.x, Gemini 2.5): still listed by the providers but not the current lineup. Can be added with the same pipeline.
- **Claude Mythos 5.1** (limited-availability, invitation only), OpenAI **GPT-6 Astra Pro**, **GPT-Rosalind**, **GPT-Image-2.5 Flare**, realtime/audio/transcription models, and Google's media models (Veo, Lyria, Nano Banana, TTS, Live, embeddings, robotics, agents). No in-session spec, price and release date were collected for them.
- OpenAI **GPT-5.6** family: pricing page and one model page were read, but no release date was found, and the schema requires one. Not guessed.

### Not publicly disclosed or not found (stored as `null`, rendered "Not publicly disclosed")

- Knowledge cutoff for all Gemini models and for GPT-Image-2.5 (not shown on the official model pages).
- Context window and maximum output for GPT-Image-2.5 (not applicable to image models; the UI shows "Not publicly disclosed").
- Architecture and training data for every model (providers do not publish them in the pages read).
- `streaming` and `structured output` flags for Claude models and `streaming` for Gemini models (not stated on the pages read, so `null`, not `false`).
- Benchmark scores: GPT-6.1 Sol has none (its launch post shows charts without readable numbers); the Gemini 3.6 Flash, 3.5 Flash, 3.5 Flash-Lite and 3.1 Pro pages publish none; the image model has none. Sonnet 5.5's FrontierCode cell was skipped as ambiguous (see conventions).

### Conventions (so values are comparable and honest)

- **Benchmark variants are separate records.** Different versions or scoring protocols are never merged: for example `osworld-2-0-offline-partial` (run by OpenAI), `osworld-2-0-aug-2026-partial` and `-strict` (Anthropic), `osworld-2-0-partial-batch-tool` (Google), `osworld-2-1-partial`; `gdpval-aa-v2` vs `v2-1`; `cursorbench-3-2-0` vs `4-0`; `hle-no-tools`, `hle-with-tools`, `hle-verified`. Each result also records the model version, evaluation date, reasoning effort or settings in `methodologyNotes`, and the exact source page.
- **Only each provider's own page is used for that provider's models.** Scores that a provider printed for _competitor_ models were not copied.
- **Evaluation type.** All 67 results are `PROVIDER_REPORTED` (read on the provider's own launch post or model card). Some benchmarks are run by third parties (GDPval-AA and AA-Briefcase by Artificial Analysis; AutomationBench for Opus 5.5 by Zapier), but we read them on the provider's page, so they are labelled provider-reported with a note. No result is marked independently evaluated until it is read on the independent organisation's own page.
- **Ambiguous table cells were skipped** rather than guessed: Sonnet 5.5's FrontierCode cell (two values for one column in the extracted table), Gemini 3.8 Flash's LVBench (static vs agentic columns).
- **Price `effectiveFrom`.** Where a launch post states the price (OpenAI GPT-6 family, Anthropic 5.x models, Gemini 3.8 Flash) `effectiveFrom` is the launch date. Where only the current price page was read, `effectiveFrom` is **2026-10-02, the date the price was first observed**, not necessarily when it began. No price history was invented: nothing is marked historical.
- **Gemini 3.8/3.7/3.6 Flash prices are introductory** (pricing page note: they increase on 2027-01-01; the 3.8 launch post gives the regular price as $1.50 in / $7.50 out). Only the current introductory price is stored; the future price is mentioned in the 3.8 release text, not stored as data.
- **Gemini 3.1 Pro** is tiered by prompt length (up to 200K and over 200K tokens); the tier is part of the price `unit`.
- **Units.** Token prices are USD per 1M tokens. Cache writes (5-minute, 1-hour) are stored as `OTHER` with the duration in the unit. Image model prices keep their own units (per 1M text, image input or image output tokens) so the token cost estimator, which only handles plain per-1M-token prices, reports the price as partial instead of mixing units.
- **Categories.** `Benchmark.category` is a controlled list (`BENCHMARK_CATEGORIES`); the profile capabilities matrix only fills a row from benchmarks in that category.

### Self-audit (batch 1, 2026-10-02)

Eight records drawn at random (a random generator, stratified over four tables), each re-read from its `sourceUrl` and compared with the stored value.

| #   | Table            | Record                                      | Stored                         | Source says                                                    | Result |
| --- | ---------------- | ------------------------------------------- | ------------------------------ | -------------------------------------------------------------- | ------ |
| 1   | benchmark result | Claude Opus 5.5, Terminal-Bench Science 0.1 | 58.7%                          | 58.7% (Opus 5.5 column, launch post)                           | match  |
| 2   | benchmark result | GPT-6 Luna, DeepSWE v1.1                    | 66.6%                          | 66.6% at max effort (launch post)                              | match  |
| 3   | benchmark result | Gemini 3.7 Flash, HLE-Verified              | 53.6%                          | 53.6% (second column of the 3.8 Flash model card)              | match  |
| 4   | model            | Claude Opus 5.5                             | 1M, 128K, Jun 2026, 2026-09-22 | Released Sep 22 2026; 1M context; 128K output; Jun 2026 cutoff | match  |
| 5   | model            | Gemini 3.1 Pro (preview)                    | 1,048,576 / 65,536, no cutoff  | 1,048,576 / 65,536; cutoff not shown; updated Feb 2026         | match  |
| 6   | price            | Claude Sonnet 5.5, 5-minute cache write     | $2.50 / 1M                     | $2.50 / MTok (pricing table row $2 / $2.50 / $4 / $0.20 / $10) | match  |
| 7   | price            | Gemini 3.5 Flash, input                     | $1.50 / 1M                     | $1.50 (also output $9.00, cache $0.15, batch $0.75 / $4.50)    | match  |
| 8   | release          | GPT-6 Sol released                          | 2026-09-22                     | Launch post lists Sep 22 2026; changelog 2026-09-22            | match  |

**Mismatches found: 0.** (While drafting, one table cell was ambiguous and was dropped, see above; it was not in the sample.)

### Records Claude is least sure about (batch 1)

1. Release dates for Gemini Flash models: taken from the changelog "generally available" dates, not from a model-page release date (pages only show a month).
2. Gemini 3.6/3.7 Flash `effectiveFrom` (2026-10-02, first observed).
3. Gemini 3.7 Flash benchmark scores: read from another model's card (the 3.8 Flash card), so they are Google's figures as of 2026-09-02, not a 3.7-era document.
4. GPT-6 Astra `FrontierCode 1.1 (Main)` 53.3%: Anthropic's Opus 5.5 page prints the same number for Astra, but OpenAI's own footnote says it used a special developer message. Stored with that note.
5. Haiku 4.5 `effectiveFrom` (first observed, not from the 2025 launch).
6. OpenAI cached-input prices for Astra, Sol and Luna: read from the model pages only (the 6.1 Sol launch post is the only post that states a cached price).
7. Opus 5.5 AutomationBench 40.0%: run by Zapier, quoted by Anthropic.
8. Model category assignments (e.g. "coding", "reasoning"): derived from how providers describe the models; they are editorial, not a provider field.
9. `capabilities` lists: derived from the supported-features lists on the model pages.
10. Fable 5.1 CursorBench 3.2.0 at "max effort": the table and a partner quote agree on 73.4%, but the table does not state the effort.
