import { Redis } from 'ioredis';

/**
 * Fixed-window rate limiting for sign-in and the admin API (docs/PROMPT.md 12: Redis rate
 * limiting, stricter on auth and admin). Redis keeps the count shared across instances; if Redis
 * is unreachable the in-memory counter takes over, so protection degrades to per-instance instead
 * of disappearing (a limiter that fails open is an attacker's first target).
 */

export type RateRule = { limit: number; windowSeconds: number };
export type RateResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export interface RateLimiter {
  hit(key: string, rule: RateRule): Promise<RateResult>;
}

/** In-process limiter. Also the test double; entries are pruned so the map cannot grow forever. */
export function createMemoryLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let lastPrune = 0;
  return {
    async hit(key, rule) {
      const t = now();
      if (t - lastPrune > 60_000) {
        lastPrune = t;
        for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
      }
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        w = { count: 0, resetAt: t + rule.windowSeconds * 1000 };
        windows.set(key, w);
      }
      w.count++;
      return {
        allowed: w.count <= rule.limit,
        remaining: Math.max(0, rule.limit - w.count),
        retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - t) / 1000)),
      };
    },
  };
}

type RedisLike = Pick<Redis, 'incr' | 'expire' | 'pttl'>;

/** Redis-backed limiter that falls back to `fallback` whenever Redis errors. */
export function createRedisLimiter(
  redis: RedisLike,
  fallback: RateLimiter,
  prefix = 'axiom:rl',
): RateLimiter {
  return {
    async hit(key, rule) {
      try {
        const k = `${prefix}:${key}`;
        const count = await redis.incr(k);
        let ttl = await redis.pttl(k);
        // Also repair a counter that lost its expiry (a crash between INCR and EXPIRE would
        // otherwise lock that key out forever).
        if (count === 1 || ttl === -1) {
          await redis.expire(k, rule.windowSeconds);
          ttl = rule.windowSeconds * 1000;
        }
        return {
          allowed: count <= rule.limit,
          remaining: Math.max(0, rule.limit - count),
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((ttl > 0 ? ttl : rule.windowSeconds * 1000) / 1000),
          ),
        };
      } catch {
        return fallback.hit(key, rule);
      }
    },
  };
}

let shared: RateLimiter | undefined;

/** Process-wide limiter: Redis from REDIS_URL when set, otherwise memory only. */
export function getRateLimiter(): RateLimiter {
  if (shared) return shared;
  const memory = createMemoryLimiter();
  const url = process.env.REDIS_URL;
  if (!url) return (shared = memory);
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    commandTimeout: 300,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 500, 5_000),
  });
  redis.on('error', () => {
    /* handled by the fallback in hit(); an unhandled 'error' event would crash the process */
  });
  void redis.connect().catch(() => undefined);
  return (shared = createRedisLimiter(redis, memory));
}

/**
 * The caller's address for rate limiting and audit logs. It is read from a request header that
 * the REVERSE PROXY in front of the app sets (default `x-forwarded-for`, first entry; set
 * CLIENT_IP_HEADER=cf-connecting-ip behind Cloudflare). The app must therefore never be reachable
 * directly from the internet: a client could otherwise choose its own address and dodge per-IP
 * limits. Per-account and global limits do not depend on this value.
 */
export function clientIp(request: { headers: Pick<Headers, 'get'> }): string {
  const header = (process.env.CLIENT_IP_HEADER || 'x-forwarded-for').toLowerCase();
  const first = request.headers.get(header)?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}
