import { Redis } from 'ioredis';

/**
 * Redis read-through cache with tag invalidation (docs/PROMPT.md 10).
 *
 * Design: every entry's key embeds the current *version* of each of its tags
 * (`prefix:c:<key>:<v1>.<v2>...`). Invalidating a tag is a single INCR, which makes every entry
 * that used it unreachable immediately (they expire on their own TTL). No key scanning, no tag
 * sets to keep consistent, and it is atomic under concurrency.
 *
 * Failure policy: the cache is an optimisation, never a dependency. Any Redis error is
 * logged (rate limited) and treated as a miss, so an outage slows requests but never fails them.
 */

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export type Cache = {
  /** Returns the cached value or runs `load`, caching the result under the given tags. */
  wrap<T>(
    key: string,
    opts: { ttlSeconds: number; tags: string[] },
    load: () => Promise<T>,
  ): Promise<{ value: T; status: CacheStatus }>;
  /** Makes every entry that carries any of these tags stale. Safe to call when Redis is down. */
  invalidateTags(tags: string[]): Promise<void>;
  /** Invalidates everything (used after seeding). */
  invalidateAll(): Promise<void>;
  /** Resolves true once connected, false if Redis is not reachable within the timeout. */
  ready(timeoutMs?: number): Promise<boolean>;
  /** Test helper: deletes every key under this cache's prefix. */
  flush(): Promise<void>;
  close(): Promise<void>;
};

export type CacheOptions = {
  url: string;
  prefix?: string;
  commandTimeoutMs?: number;
  log?: (msg: string, extra?: unknown) => void;
};

const ALL = 'all';

export function createCache(opts: CacheOptions): Cache {
  const prefix = opts.prefix ?? 'axiom:v1';
  const log = opts.log ?? ((msg, extra) => console.warn(`[cache] ${msg}`, extra ?? ''));

  const redis = new Redis(opts.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    commandTimeout: opts.commandTimeoutMs ?? 400,
    enableOfflineQueue: false, // fail fast while disconnected instead of queueing requests
    retryStrategy: (times) => Math.min(times * 250, 3_000),
  });
  // Unhandled 'error' events would crash the process; report them (rate limited) instead.
  let lastLogged = 0;
  const warn = (msg: string, err?: unknown) => {
    const now = Date.now();
    if (now - lastLogged > 10_000) {
      lastLogged = now;
      log(msg, err instanceof Error ? err.message : err);
    }
  };
  redis.on('error', (err) => warn('redis error', err));
  redis.connect().catch((err) => warn('initial connect failed (will retry)', err));

  const tagKey = (t: string) => `${prefix}:t:${t}`;

  async function versionOf(tags: string[]): Promise<string> {
    const all = [ALL, ...tags];
    const vs = await redis.mget(all.map(tagKey));
    return vs.map((v) => v ?? '0').join('.');
  }

  async function invalidateTags(tags: string[]) {
    if (tags.length === 0) return;
    try {
      const p = redis.pipeline();
      for (const t of tags) p.incr(tagKey(t));
      await p.exec();
    } catch (err) {
      warn('invalidate failed (entries will expire by TTL)', err);
    }
  }

  return {
    async wrap(key, { ttlSeconds, tags }, load) {
      let fullKey: string | null = null;
      try {
        fullKey = `${prefix}:c:${key}:${await versionOf(tags)}`;
        const hit = await redis.get(fullKey);
        if (hit !== null) return { value: JSON.parse(hit) as never, status: 'HIT' };
      } catch (err) {
        warn('read failed, bypassing cache', err);
        return { value: await load(), status: 'BYPASS' };
      }
      const value = await load();
      try {
        await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (err) {
        warn('write failed', err);
      }
      return { value, status: 'MISS' };
    },

    invalidateTags,

    async invalidateAll() {
      await invalidateTags([ALL]);
    },

    ready(timeoutMs = 1_500) {
      if (redis.status === 'ready') return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          redis.off('ready', onReady);
          resolve(false);
        }, timeoutMs);
        const onReady = () => {
          clearTimeout(timer);
          resolve(true);
        };
        redis.once('ready', onReady);
      });
    },

    async flush() {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 200);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
    },

    async close() {
      redis.disconnect();
    },
  };
}

/** Process-wide cache configured from REDIS_URL. Returns null when Redis is not configured. */
const g = globalThis as unknown as { __axiomCache?: Cache | null };

export function getCache(): Cache | null {
  if (g.__axiomCache !== undefined) return g.__axiomCache;
  const url = process.env.REDIS_URL;
  g.__axiomCache = url ? createCache({ url }) : null;
  return g.__axiomCache;
}
