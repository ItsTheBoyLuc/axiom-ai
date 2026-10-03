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

## Batch 2: Meta, xAI, DeepSeek, Mistral (2026-10-02)

| Provider       | Models | Prices | Benchmark results | Releases |
| -------------- | ------ | ------ | ----------------- | -------- |
| Meta           | 3      | 9      | 7                 | 4        |
| xAI (SpaceXAI) | 3      | 9      | 15                | 3        |
| DeepSeek       | 2      | 12     | 12                | 5        |
| Mistral AI     | 3      | 6      | 3                 | 3        |

Plus 12 new benchmark variants and 4 provider records. Catalogue totals after batch 2: 7 providers, 26 models, 113 prices, 104 benchmark results, 46 benchmark variants, 36 releases.

### Included models

- **Meta:** Muse Spark 1.1, Muse Spark 1.2 (Meta Model API), Muse Glimmer 30B (open weights, Apache 2.0).
- **xAI:** Grok 4.7, Grok 4.6, Grok 4.5. The company's own pages now brand it SpaceXAI; the record is "xAI (SpaceXAI)".
- **DeepSeek:** DeepSeek-V4.1-Flash (`deepseek-flash`) and DeepSeek-V4-Pro (the 0813 build, `deepseek-v4-pro`), both MIT-licensed open weights.
- **Mistral AI:** Mistral Medium 3.5, Mistral Small 4, Mistral Large 3 (all open weights).

### Deliberately not included, and why

- **Meta Muse Spark 1.3** (Meta's latest model, with benchmark numbers on its model page): **no official page states its release date**, and the schema requires one. Third-party sites say 2026-09-02; that is not an acceptable source, so the model is omitted rather than guessed. Add it once Meta dates it, or if a decision is taken to allow a null release date.
- Meta **Muse Image**, **Muse Voice Transcribe**, **SAM 3.1**, **Muse Code**; xAI **Grok 4.3**, the **Grok 4.20** family, **Grok Build 0.1**, Imagine and Voice models; DeepSeek legacy and retired names; Mistral **Ministral 3** (3B, 8B, 14B), Codestral, OCR, Voxtral, embeddings, moderation and the hosted third-party GLM models. No in-session release date (or no release date at all) was collected for them.
- Meta **Muse Spark** (April 2026, the original) has no API model record; it appears only as a release entry.

### Not publicly disclosed or not found (stored as `null`)

- Maximum output tokens for Meta, xAI and Mistral models (not shown on the pages read).
- Knowledge cutoff for all models except Grok 4.7 (May 2026, from the xAI docs).
- Benchmark scores for Muse Spark 1.1 and 1.2 (charts without readable numbers) and Mistral Large 3 (charts only).
- `openWeights = false` for Muse Spark and Grok means "no weights are published on the pages read", not an explicit "closed" statement by the provider.
- DeepSeek-V4-Pro (0813) scores other than the three in the API update notes. The Hugging Face card with many more scores was last modified on 2026-06-22 and describes the **original April V4-Pro**, so those scores were **not** attributed to the 0813 build.

### Conventions specific to this batch

- **xAI prices** are for prompts up to 200K tokens (the unit says so). The docs say higher rates apply above 200K, but the exact numbers were not verified from a page, so they are not stored.
- **DeepSeek prices** have peak and off-peak variants and cache hit/miss rows, each with its own unit; the effective-from date is 2026-10-02 (first observed). Peak hours are 01:00-04:00 and 06:00-10:00 UTC on weekdays; off-peak is half of peak. The structure took effect on 2026-08-16.
- **Meta prices** are the Standard tier ($1.25 in / $4.25 out / $0.15 cached). Muse Spark 1.2 also has a Contributor tier ($0.10 / $0.20 / $0.002), which permits Meta to train on prompts and completions; it is a separate unit.
- **Card price summary.** A card shows a price only when exactly one unit carries both an input and an output price (`headlineTokenPrice`). Models with several variants show "See profile for units", so variants are never collapsed into one number.
- **Benchmark evaluation dates.** For Meta Glimmer (the card says "August 2026") and Mistral Medium 3.5 and Small 4 (model cards undated) the evaluation date is the model's release date, the earliest the numbers could have been published.
- **Variants kept apart:** Glimmer's `terminal-bench-2-1` is with the Terminus 2 harness; Grok 4.5's `deepswe-1-1` (53%) used the mini-swe-agent harness by Datacurve; Glimmer's GPQA Diamond is the "(AA)" variant. Each is described in `methodologyNotes`.
- **Search-tool summaries are not a source.** Two search summaries stated wrong release dates for Grok 4.5 and 4.6 (the announcement pages say 2026-07-16 and 2026-08-12). Every date in this batch was read from the provider's own page.

### Verification (batch 2)

Rather than a random sample, every fact that came through the summarising fetcher alone was re-read in the browser from its source page: the Meta and Mistral pricing tables (verbatim match), the three Mistral release dates, the four Meta announcement dates, the DeepSeek update-note dates and pricing table, the Muse Glimmer scores, and all xAI benchmark tables and docs pages (read directly). **Mismatches in stored values: 0.** Two wrong dates from search summaries were rejected before storing.

### Records Claude is least sure about (batch 2)

1. Muse Spark 1.1 and 1.2 `openWeights = false` (absence of published weights, not an explicit statement).
2. Grok 4.5 and 4.6 cached-input `effectiveFrom` (2026-10-02, first observed).
3. DeepSeek-V4-Pro `openWeights = true`: the weights on Hugging Face are the earlier release, not the 0813 build the API serves (noted in the model's limitations).
4. DeepSeek-V4-Pro 0813 `hle-with-tools` 60.0%: from the API update note, which does not say which tools or effort.
5. Muse Glimmer `gpqa-diamond` 83.5%: the card labels the row "(AA)", possibly Artificial Analysis settings.
6. Mistral Small 4 `aa-lcr` 0.72: a 0-1 score with reasoning enabled, stored as unit `score`.
7. Mistral Medium 3.5 `tau3-telecom` and SWE-Bench Verified: read from the Hugging Face card (undated); evaluation date set to the release date.
8. Grok 4.7 DeepSWE v1.1 71.0%: high effort, while the rest of that table is xhigh.
9. Model category assignments for these models (editorial, from how providers describe them).
10. Mistral context windows ("256k") stored as 256,000 tokens, not 262,144.

## Batch 3: Microsoft, NVIDIA, Alibaba, Cohere, Amazon, news, publications (2026-10-02 and 2026-10-03)

**Status: loaded into the dev database, checked in the browser at 390, 768 and 1440, source re-check and self-audit done (below).** News and publications are loaded as collected on 2026-10-02; no further news research was done (Phase 7 re-checks the sources).

| Provider       | Models | Prices | Benchmark results | Releases |
| -------------- | ------ | ------ | ----------------- | -------- |
| Microsoft      | 1      | 3      | 2                 | 2        |
| NVIDIA         | 2      | 0      | 20                | 3        |
| Alibaba (Qwen) | 2      | 4      | 18                | 4        |
| Cohere         | 2      | 0      | 6                 | 2        |
| Amazon         | 1      | 2      | 0                 | 1        |

Plus 13 new benchmark variants, 5 provider records, 18 news items (15 official, 3 independent) and 6 publications. Catalogue totals as loaded: 12 providers, 34 models, 122 prices, 150 benchmark results, 59 benchmark variants, 48 releases, 18 news items, 6 publications.

### Included models

Microsoft MAI-Thinking-1 (public preview 2026-08-12); NVIDIA Nemotron 3 Ultra (2026-06-04) and Nemotron 3.5 Lightning (2026-08-11); Alibaba Qwen3.8-Max (2026-08-03) and Qwen3.8-Flash (2026-08-27); Cohere Command A+ (2026-05-20) and Command A (2025-03-12); Amazon Nova 2 Lite (GA 2025-12-02).

### Verified directly (rendered page text, Playwright)

NVIDIA Ultra and Lightning scores and release dates (model cards); Qwen3.8-Max and Qwen3.8-Flash scores (model cards) and Model Studio international prices (qwen3.8-max $2 / $6, qwen3.8-flash $0.15 / $0.47, up to 1M tokens); MAI-Thinking-1 date, AIME scores and Foundry prices ($2 / $0.20 cached / $8, global); Command A+ specs and scores (launch post); DeepSeek V4 technical document date (April 27, 2026; read visually); Muse Glimmer / Muse Spark dates (batch 2).

### Re-checked on 2026-10-03 (previously read only through a summarising fetcher)

All of these now match the rendered source page: Command A+ release date (May 20, 2026), 128K context, 64K output, Apache 2.0, model ID command-a-plus-05-2026; Command A blog date (March 12, 2025) and context/output (256k / 8k, Cohere models page); Command A weights licence (CC-BY-NC-4.0, Hugging Face API tags); Amazon Nova 2 Lite (What's New post dated Dec 2, 2025; 1M-token context and 65,536 max output on the Nova 2 user guide; AWS blog post exists and is dated 2025-12-02); Qwen3.6-Plus (April 2, 2026) and Qwen3.7-Plus (June 3, 2026) release dates; NVIDIA Nano Omni post (April 28, 2026); NVIDIA Ultra technical report page (June 4, 2026); arXiv Command A paper (v1 1 Apr 2025); Amazon Nova Premier report page (April 30, 2025); Hugging Face Muse Glimmer article (August 10, 2026) and WinBuzzer article (September 4, 2026).

**One caveat found:** the DataCamp article shows "Updated Sep 3, 2026", not a publication date. The stored date (2026-09-03) is therefore the last-updated date; the original publication date is not shown on the page.

### Amazon Nova 2 Lite price (resolved 2026-10-03)

The earlier fetch could not read AWS's pricing tables. Rendering https://aws.amazon.com/nova/pricing/ with Playwright works: Amazon Nova 2 Lite, Standard tier, global cross-Region inference, US East (Ohio): **$0.30 per 1M input tokens, $2.50 per 1M output tokens** (stored with that unit label, effective 2026-10-03, OFFICIALLY_VERIFIED). The same page lists Priority ($0.525 / $4.375) and Flex/Batch ($0.15 / $1.25) tiers and Geo/in-region prices ($0.33 / $2.75); those variants are NOT stored. The page footnote says cache reads cost 75% less than the on-demand input price; no cached price is stored (that would be a derived value). The Nova 2 Lite model still has no benchmark scores (none read in an official source).

### Self-audit (batch 3, 2026-10-03)

Eight random records (fixed-seed pick across tables), source re-fetched and compared:

| Record                                     | Stored            | Source says                                         | Result                                       |
| ------------------------------------------ | ----------------- | --------------------------------------------------- | -------------------------------------------- |
| Nemotron 3.5 Lightning, Terminal-Bench 2.1 | 24.58             | 24.58 (first column, Hugging Face card)             | match                                        |
| Qwen3.8-Max, GPQA Diamond                  | 92.6              | 92.6 (last column "Qwen3.8-Max", Hugging Face card) | match                                        |
| Qwen3.6-Plus release                       | 2026-04-02        | April 2, 2026 (Alibaba Cloud press release)         | match                                        |
| MAI-Thinking-1 input price                 | $2 per 1M, global | $2 Global (Azure Foundry pricing)                   | match                                        |
| Qwen3.7-Plus release                       | 2026-06-03        | June 3, 2026 (Alibaba Cloud blog)                   | match                                        |
| DataCamp GPT-6 Astra article               | 2026-09-03        | "Updated Sep 3, 2026"                               | match, but it is an update date (see caveat) |
| Muse Glimmer developer post                | 2026-08-12        | Aug 12, 2026                                        | match                                        |
| Qwen3.8-Max output price                   | $6 per 1M         | $2 in / $6 out, 0 to 1M tokens, international       | match                                        |

0 value mismatches; 1 labelling caveat (DataCamp date).

### Known gaps and decisions

- **Cohere has no per-token prices** (the pricing page lists only legacy models; Command A+ production limits are "contact sales"), so both models are `pricingKind = custom` with no price rows.
- **NVIDIA models have no prices** (open checkpoints; `pricingKind = free`, meaning the weights are free to download).
- **Microsoft:** only MAI-Thinking-1 is included. MAI-Image-2.5, MAI-Code-1.1-Flash, MAI Transcribe and MAI-Voice were announced on 2026-06-02 without a dated availability, and MAI-Cyber-1 Flash was not read (it is on the Foundry pricing page at $0.60 / $0.06 / $3.50, but no release was read); Phi models are not in the current lineup read.
- **Alibaba:** Qwen3.7-Plus and 3.6-Plus appear only as release entries (their listed prices carry a "limited-time 20% off" qualifier that was not interpreted); Qwen3.7-Max and the Omni/LiveTranslate models are not included. Qwen3.8-Max's scores come from the open-weight model card's "Qwen3.8-Max" column (repository created 2026-08-08), dated 2026-08-08.
- **Muse Glimmer date caveat:** Meta's developer post is dated 2026-08-12 (used), but Hugging Face's day-zero article is dated 2026-08-10 and the model repository was created 2026-08-09, so the weights may have been public earlier than the date stored.
- **DataCamp date is an "Updated" date.** The article page shows "Updated Sep 3, 2026" and no publication date, so the stored `publicationDate` (2026-09-03) is the last-updated date. It is flagged `dateIsUpdated: true` in `news.json` and the UI shows "Updated 3 Sept 2026" (never "Published"); structured data uses `dateModified`.
- **News:** every summary is AI-written and flagged `isAiSummary`; 3 independent items (Hugging Face Blog, DataCamp, WinBuzzer) are `COMMUNITY_REPORTED`, not official. The WinBuzzer item mentions Muse Spark 1.3 only as news.

### Excluded: no verified release date

- **Muse Spark 1.3 (Meta).** Not stored as a model or release. The only source is a third-party article (WinBuzzer, 2026-09-04); Meta's own blog index has no post for it, so there is no official release date. Decision 2026-10-02: leave it out until an official source exists.
