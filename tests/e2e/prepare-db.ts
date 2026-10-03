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
  await seedSync(url);

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

/**
 * Sync fixtures for the dashboard and approval specs: one source, one PARTIAL run with a
 * validation issue, and three staged imports (two new news stories to approve / reject, and one
 * update that would LOWER the trust of a record the admin-write spec creates first).
 */
async function seedSync(url: string) {
  const db = createPrisma(url);
  try {
    const source = await db.syncSource.create({
      data: {
        name: 'E2E news feed',
        kind: 'rss',
        schedule: 'every 6h',
        enabled: true,
        config: {
          feedUrl: 'https://example.test/feed.xml',
          publisher: 'E2E Lab',
          provider: null,
          category: 'COMPANIES',
          isOfficial: false,
          maxItems: 20,
        },
      },
    });
    const run = await db.syncRun.create({
      data: {
        sourceId: source.id,
        startedAt: new Date('2026-10-03T08:00:00Z'),
        finishedAt: new Date('2026-10-03T08:00:04Z'),
        status: 'PARTIAL',
        recordsSeen: 4,
        recordsChanged: 3,
      },
    });
    await db.syncIssue.create({
      data: {
        runId: run.id,
        entityType: 'news',
        message: 'articleUrl: Invalid input: expected string, received null',
        payload: { title: 'Post without a link', articleUrl: null },
      },
    });
    const news = (title: string, articleUrl: string, over: Record<string, unknown> = {}) => ({
      title,
      summary: 'An excerpt cut from the feed.',
      publisher: 'E2E Lab',
      articleUrl,
      publicationDate: '2026-09-30T14:00:00.000Z',
      category: 'COMPANIES',
      isOfficial: false,
      isAiSummary: false,
      dateIsUpdated: false,
      provider: null,
      models: [],
      sourceUrl: articleUrl,
      verificationStatus: 'COMMUNITY_REPORTED',
      verifiedAt: '2026-10-03T08:00:00.000Z',
      dataType: 'news feed',
      ...over,
    });
    const staged = (payload: Record<string, unknown>, diff: Record<string, unknown>) =>
      db.importedRecord.create({
        data: {
          runId: run.id,
          entityType: 'news',
          payload: payload as object,
          diff: diff as object,
        },
      });
    await staged(news('E2E approve candidate', 'https://example.test/e2e/approve'), {
      key: 'https://example.test/e2e/approve',
      kind: 'new',
      changes: {},
      trust: 'ok',
      hash: 'e2e-approve',
    });
    await staged(news('E2E reject candidate', 'https://example.test/e2e/reject'), {
      key: 'https://example.test/e2e/reject',
      kind: 'new',
      changes: {},
      trust: 'ok',
      hash: 'e2e-reject',
    });
    await staged(news('E2E trusted story (reposted)', 'https://example.test/e2e/trusted'), {
      key: 'https://example.test/e2e/trusted',
      kind: 'update',
      changes: {
        title: { before: 'E2E trusted story', after: 'E2E trusted story (reposted)' },
        verificationStatus: { before: 'OFFICIALLY_VERIFIED', after: 'COMMUNITY_REPORTED' },
      },
      trust: 'downgrade',
      hash: 'e2e-trusted',
    });
  } finally {
    await db.$disconnect();
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
