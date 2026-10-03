import { writeFileSync } from 'node:fs';
import { Redis } from 'ioredis';
import { runSeed } from '../../prisma/seed/seed';
import { createOrRotateAdmin } from '../../server/auth/admin-user';
import { randomPassword } from '../../server/auth/crypto';
import { hashPassword } from '../../server/auth/password';
import { E2E_CREDENTIALS_FILE } from './accounts';
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

  // Test accounts for the admin and auth specs. Passwords are random per run and written only to
  // a git-ignored file that global-setup and the specs read; there is no default password.
  await createE2eAccounts(url);

  // The app under test caches API responses in Redis: drop anything left from a previous run,
  // and the sign-in rate-limit counters (they would carry over between local runs).
  if (process.env.REDIS_URL) {
    await clearRateLimits(process.env.REDIS_URL);
    const cache = createCache({ url: process.env.REDIS_URL, log: () => {} });
    if (await cache.ready(2_000)) await cache.invalidateAll();
    await cache.close();
  }
  console.log('[e2e] database axiom_e2e is migrated and seeded with demo fixtures');
}

async function clearRateLimits(url: string) {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
  });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    const keys = await redis.keys('axiom:rl:*');
    if (keys.length) await redis.del(...keys);
  } catch {
    /* Redis is optional for the e2e run: the limiter falls back to memory */
  } finally {
    redis.disconnect();
  }
}

async function createE2eAccounts(url: string) {
  const db = createPrisma(url);
  try {
    const admin = { email: 'admin@e2e.test', password: randomPassword() };
    const user = { email: 'user@e2e.test', password: randomPassword() };
    await createOrRotateAdmin(db, admin);
    await db.user.create({
      data: { email: user.email, role: 'USER', passwordHash: await hashPassword(user.password) },
    });
    writeFileSync(E2E_CREDENTIALS_FILE, JSON.stringify({ admin, user }), { mode: 0o600 });
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[e2e] could not prepare the database:', err);
  process.exit(1);
});
