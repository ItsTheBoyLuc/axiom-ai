import { readdirSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dropDatabase, ensureDatabase, migrateDeploy, prisma } from '../support/test-db';

/**
 * Applies ALL migrations to a brand-new, empty database (not the shared test DB), then checks
 * the result. This is the "migrations apply cleanly on an empty DB" guarantee.
 */
const scratch = `axiom_mig_${Date.now().toString(36)}`;
let url: string;
let client: Client;

const rows = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await client.query<T>(sql, params)).rows;

beforeAll(async () => {
  url = await ensureDatabase(scratch);
  migrateDeploy(url);
  client = new Client({ connectionString: url });
  await client.connect();
}, 120_000);

afterAll(async () => {
  await client?.end();
  await dropDatabase(scratch);
});

describe('migrations on an empty database', () => {
  it('apply cleanly: every migration finished and none rolled back', async () => {
    const dirs = readdirSync('prisma/migrations', { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );
    const applied = await rows<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(
      'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at',
    );
    expect(applied).toHaveLength(dirs.length);
    expect(dirs.length).toBeGreaterThanOrEqual(2);
    for (const m of applied) {
      expect(m.finished_at).not.toBeNull();
      expect(m.rolled_back_at).toBeNull();
    }
  });

  it('creates every table of the data model (section 9)', async () => {
    const t = (
      await rows<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      )
    ).map((r) => r.tablename);
    for (const name of [
      'Provider',
      'Model',
      'Capability',
      'ModelCapability',
      'Pricing',
      'Benchmark',
      'BenchmarkResult',
      'Release',
      'NewsArticle',
      'Publication',
      'User',
      'Account',
      'Session',
      'VerificationToken',
      'SavedComparison',
      'SavedModel',
      'RecentlyViewed',
      'UserPreference',
      'AuditLog',
      'SyncSource',
      'SyncRun',
      'SyncIssue',
      'ImportedRecord',
      '_ModelToNewsArticle',
    ]) {
      expect(t, name).toContain(name);
    }
  });

  it('re-running deploy is a no-op', () => {
    expect(migrateDeploy(url)).toMatch(/No pending migrations/);
  });

  it('leaves no drift between schema.prisma and the migrated database', () => {
    // `--exit-code` makes the CLI exit 2 when there is any difference, which throws here.
    expect(() =>
      prisma(
        'migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code',
        url,
      ),
    ).not.toThrow();
  });

  it('enables pg_trgm and builds the search indexes', async () => {
    const ext = (await rows<{ extname: string }>('SELECT extname FROM pg_extension')).map(
      (r) => r.extname,
    );
    expect(ext).toContain('pg_trgm');

    const idx = await rows<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const def = (name: string) => idx.find((i) => i.indexname === name)?.indexdef ?? '';
    expect(def('Model_searchDocument_idx')).toMatch(/USING gin .*gin_trgm_ops/);
    expect(def('Model_searchTsv_idx')).toMatch(/USING gin/);
    expect(def('Model_categories_idx')).toMatch(/USING gin/);
    expect(def('Provider_name_idx')).toMatch(/gin_trgm_ops/);
  });

  it('has the indexes the spec requires', async () => {
    const names = (
      await rows<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
      )
    ).map((r) => r.indexname);
    for (const n of [
      'Model_providerId_releaseDate_idx', // Model(providerId, releaseDate)
      'Model_slug_key', // Model(slug) unique
      'Pricing_modelId_isCurrent_idx', // Pricing(modelId, isCurrent)
      'BenchmarkResult_benchmarkId_modelId_evaluationDate_idx',
      'Release_releaseDate_idx',
      'NewsArticle_publicationDate_idx',
      'NewsArticle_articleUrl_key', // articleUrl unique
      'Provider_slug_key',
      'Pricing_one_current_idx', // at most one current price per model/type/unit
    ]) {
      expect(names, n).toContain(n);
    }
  });

  it('stores tsvector as a generated column and sortName with the "C" collation', async () => {
    const cols = await rows<{
      column_name: string;
      is_generated: string;
      collation_name: string | null;
    }>(
      `SELECT column_name, is_generated, collation_name FROM information_schema.columns
       WHERE table_name IN ('Model', 'Provider') AND column_name IN ('searchTsv', 'sortName')`,
    );
    expect(cols.find((c) => c.column_name === 'searchTsv')?.is_generated).toBe('ALWAYS');
    for (const c of cols.filter((c) => c.column_name === 'sortName'))
      expect(c.collation_name).toBe('C');
  });
});
