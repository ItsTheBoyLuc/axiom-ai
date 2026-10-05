import { getEnv } from '../../src/lib/env';
import type { GuardDeps } from '../auth/guard';
import { cookieConfig } from '../auth/cookie';
import { getRateLimiter } from '../auth/rate-limit';
import { getPrisma } from '../db/client';

/** Production wiring for the /api/v1/me routes: shared Prisma client, Redis limiter, APP_URL. */
export function meDeps(): GuardDeps {
  const env = getEnv();
  return {
    db: getPrisma(),
    limiter: getRateLimiter(),
    cookie: cookieConfig(env.APP_URL),
    allowedOrigins: [env.APP_URL],
  };
}
