import { getEnv } from '../../src/lib/env';
import { getCache } from '../cache/cache';
import { cookieConfig } from '../auth/cookie';
import { getRateLimiter } from '../auth/rate-limit';
import { getPrisma } from '../db/client';
import { enqueueSync, workerStatus } from '../jobs/queue';
import type { AdminDeps } from './handler';

/** Production wiring for the admin routes: shared Prisma client, Redis limiter and cache. */
export function adminDeps(): AdminDeps {
  const env = getEnv();
  return {
    db: getPrisma(),
    limiter: getRateLimiter(),
    cookie: cookieConfig(env.APP_URL),
    allowedOrigins: [env.APP_URL],
    enqueueSync,
    workerStatus,
    invalidate: async (tags) => {
      await getCache()?.invalidateTags(tags);
      // Pages render per request (CSP nonce), so dropping the Redis cache tags is all it takes
      // for an admin change to show up everywhere at once.
    },
  };
}
