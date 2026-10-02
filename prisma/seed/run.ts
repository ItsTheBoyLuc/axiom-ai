import { createCache } from '../../server/cache/cache';
import { createPrisma } from '../../server/db/client';
import { DEFAULT_DATA_DIR, SeedValidationError, runSeed } from './seed';

/**
 * CLI: `npm run db:seed` (real data only) or `npm run db:seed:demo` (also loads the fictional
 * demo fixtures). Validation happens before any write; on error nothing is written and the
 * process exits non-zero.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const demo = process.env.SEED_DEMO === 'true';
  const dataDir = process.env.SEED_DATA_DIR ?? DEFAULT_DATA_DIR;

  console.log(`[seed] data dir: ${dataDir}`);
  console.log(`[seed] demo fixtures: ${demo ? 'ON (SEED_DEMO=true)' : 'off'}`);

  const db = createPrisma(url);
  try {
    const { data, demo: demoReport } = await runSeed(db, { dataDir, demo });
    console.log('[seed] data:', JSON.stringify(data.counts));
    if (demoReport) console.log('[seed] demo:', JSON.stringify(demoReport.counts));
    for (const s of [...data.skipped, ...(demoReport?.skipped ?? [])]) {
      console.warn(`[seed] SKIPPED ${s.entity} ${s.key}: ${s.reason}`);
    }

    // Make API responses reflect the new data immediately (best effort).
    if (process.env.REDIS_URL) {
      const cache = createCache({ url: process.env.REDIS_URL });
      if (await cache.ready()) {
        await cache.invalidateAll();
        console.log('[seed] cache invalidated');
      } else {
        console.warn('[seed] Redis not reachable: cached API responses will expire by TTL');
      }
      await cache.close();
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  if (err instanceof SeedValidationError) console.error(`[seed] ${err.message}`);
  else console.error('[seed] failed:', err);
  process.exit(1);
});
