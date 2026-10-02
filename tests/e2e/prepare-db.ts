import { runSeed } from '../../prisma/seed/seed';
import { createCache } from '../../server/cache/cache';
import { createPrisma } from '../../server/db/client';
import { ensureDatabase, loadDotEnv, migrateDeploy, truncateAll } from '../support/test-db';

/**
 * Prepares the dedicated end-to-end database (axiom_e2e): creates it, applies every migration,
 * and loads the fictional demo fixtures, so the pages under test read real PostgreSQL rows
 * exactly as production does. The development database is never touched.
 *
 * Playwright starts its web server BEFORE any globalSetup, so this runs as part of the server's
 * start command (see playwright.config.ts) to guarantee the database exists first.
 */
async function main() {
  loadDotEnv();
  const url = await ensureDatabase('axiom_e2e');
  migrateDeploy(url);
  await truncateAll(url);

  const db = createPrisma(url);
  try {
    await runSeed(db, { demo: true, realData: false });
  } finally {
    await db.$disconnect();
  }

  // The app under test caches API responses in Redis: drop anything left from a previous run.
  if (process.env.REDIS_URL) {
    const cache = createCache({ url: process.env.REDIS_URL, log: () => {} });
    if (await cache.ready(2_000)) await cache.invalidateAll();
    await cache.close();
  }
  console.log('[e2e] database axiom_e2e is migrated and seeded with demo fixtures');
}

main().catch((err) => {
  console.error('[e2e] could not prepare the database:', err);
  process.exit(1);
});
