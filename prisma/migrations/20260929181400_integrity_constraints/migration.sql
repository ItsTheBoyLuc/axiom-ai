-- Data-integrity rules from docs/PROMPT.md section 2, enforced by the database itself.
-- Prisma cannot model CHECK constraints or partial indexes, so they live in this migration.

-- 1. A record without a source URL may only be UNVERIFIED or NOT_PUBLICLY_DISCLOSED.
-- 2. The two highest-trust statuses must say when they were verified.
-- 3. Demo data can never claim to be verified (demo and verified data must not mix silently).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Provider', 'Model', 'ModelCapability', 'Pricing', 'Benchmark',
    'BenchmarkResult', 'Release', 'NewsArticle', 'Publication'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK ("sourceUrl" IS NOT NULL OR "verificationStatus" IN (''UNVERIFIED'', ''NOT_PUBLICLY_DISCLOSED''))',
      t, t || '_requires_source_chk');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK ("verificationStatus" NOT IN (''OFFICIALLY_VERIFIED'', ''INDEPENDENTLY_EVALUATED'') OR "verifiedAt" IS NOT NULL)',
      t, t || '_verified_needs_date_chk');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (NOT "isDemo" OR "verificationStatus" NOT IN (''OFFICIALLY_VERIFIED'', ''INDEPENDENTLY_EVALUATED''))',
      t, t || '_demo_not_verified_chk');
  END LOOP;
END $$;

-- Prices must be non-negative and have a sane date range.
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_price_nonneg_chk" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_dates_chk" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
-- A price that is still current cannot have ended.
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_current_open_chk" CHECK (NOT "isCurrent" OR "effectiveTo" IS NULL);

-- At most one CURRENT price per model, type and unit (history stays in the table).
CREATE UNIQUE INDEX "Pricing_one_current_idx" ON "Pricing" ("modelId", "pricingType", "unit") WHERE "isCurrent";

-- Sensible value ranges.
ALTER TABLE "Model" ADD CONSTRAINT "Model_context_pos_chk" CHECK ("contextWindow" IS NULL OR "contextWindow" > 0);
ALTER TABLE "Model" ADD CONSTRAINT "Model_maxout_pos_chk" CHECK ("maxOutputTokens" IS NULL OR "maxOutputTokens" > 0);
