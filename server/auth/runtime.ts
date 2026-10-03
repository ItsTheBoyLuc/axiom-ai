import { getEnv } from '../../src/lib/env';
import { getPrisma } from '../db/client';
import { cookieConfig } from './cookie';
import type { AuthDeps } from './handlers';
import { getRateLimiter } from './rate-limit';

/** Production wiring for the auth handlers: shared Prisma client, Redis-backed limiter, APP_URL. */
export function authDeps(): AuthDeps {
  const env = getEnv();
  return {
    db: getPrisma(),
    limiter: getRateLimiter(),
    cookie: cookieConfig(env.APP_URL),
    allowedOrigins: [env.APP_URL],
  };
}
