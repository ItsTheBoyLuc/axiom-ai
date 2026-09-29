import { Client } from 'pg';
import { Redis } from 'ioredis';
import { getEnv } from '../src/lib/env';

export type CheckResult = { ok: boolean; latencyMs: number; error?: string };
export type HealthReport = {
  status: 'ok' | 'degraded';
  checks: { postgres: CheckResult; redis: CheckResult };
  timestamp: string;
};

/** Times an async probe and converts failures into a result (never throws). */
async function probe(fn: () => Promise<void>): Promise<CheckResult> {
  const start = performance.now();
  try {
    await fn();
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.name : 'UnknownError', // no details leaked to clients
    };
  }
}

export async function checkHealth(): Promise<HealthReport> {
  const env = getEnv();

  const [postgres, redis] = await Promise.all([
    probe(async () => {
      const client = new Client({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 2000,
      });
      await client.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        await client.end();
      }
    }),
    probe(async () => {
      const r = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        connectTimeout: 2000,
      });
      try {
        await r.connect();
        await r.ping();
      } finally {
        r.disconnect();
      }
    }),
  ]);

  return {
    status: postgres.ok && redis.ok ? 'ok' : 'degraded',
    checks: { postgres, redis },
    timestamp: new Date().toISOString(),
  };
}
