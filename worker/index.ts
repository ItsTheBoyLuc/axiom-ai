import http from 'node:http';
import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createHttpClient } from '../server/adapters/http';
import { getPrisma } from '../server/db/client';
import {
  HEARTBEAT_KEY,
  HEARTBEAT_TTL_SECONDS,
  SYNC_QUEUE,
  type SyncJob,
} from '../server/jobs/queue';
import { dueSources, runSource, type SyncDeps } from '../server/jobs/sync-run';
import { getEnv } from '../src/lib/env';
import { isDue } from '../src/lib/sync/schedule';

/**
 * Worker entrypoint: the `system` heartbeat queue and the `sync` queue.
 *
 *  - A scheduler tick (every 30 s) enqueues a run for every enabled source whose schedule is due
 *    and refreshes the heartbeat the admin dashboard reads ("worker online").
 *  - The sync processor runs one source: fetch (polite, robots.txt aware) -> validate -> diff ->
 *    stage for admin approval. It never publishes anything itself.
 *  - /health for Docker.
 */
const env = getEnv();
const log = (msg: string, extra?: unknown) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'worker', msg, extra }));

// BullMQ requires maxRetriesPerRequest: null on its blocking connection.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (e) => log('redis error', e.message));

const queue = new Queue('system', { connection });
const worker = new Worker(
  'system',
  async (job) => {
    log('job processed', { id: job.id, name: job.name });
  },
  { connection },
);
worker.on('failed', (job, err) => log('job failed', { id: job?.id, err: err.message }));
await queue.upsertJobScheduler('heartbeat', { every: 60_000 }, { name: 'heartbeat' });

// ---------------------------------------------------------------- sync
const db = getPrisma();
const syncQueue = new Queue(SYNC_QUEUE, { connection });

const syncDeps: SyncDeps = {
  db,
  log,
  secrets: { githubToken: process.env.GITHUB_TOKEN || undefined },
  // A new client per run: robots.txt is re-read each run and host throttling starts fresh.
  makeHttp: () =>
    createHttpClient({
      userAgent: `AxiomAI-Sync/1.0 (+${env.APP_URL})`,
      productToken: 'AxiomAI-Sync',
    }),
};

const syncWorker = new Worker<SyncJob>(
  SYNC_QUEUE,
  async (job) => {
    const { sourceId, trigger, actorId, ip } = job.data;
    const outcome = await runSource(
      syncDeps,
      sourceId,
      trigger === 'manual' && actorId
        ? { kind: 'manual', actorId, ip: ip ?? null }
        : { kind: 'schedule' },
    );
    log('sync job done', { jobId: job.id, sourceId, outcome });
    return outcome;
  },
  { connection, concurrency: 2 },
);
syncWorker.on('failed', (job, err) => log('sync job failed', { id: job?.id, err: err.message }));

let ticking = false;
async function tick() {
  if (ticking) return; // never overlap two ticks
  ticking = true;
  try {
    await connection.set(HEARTBEAT_KEY, String(Date.now()), 'EX', HEARTBEAT_TTL_SECONDS);
    const due = await dueSources(db, new Date(), isDue);
    for (const s of due) {
      // The id is stable until the source has run, so a slow run is never queued twice.
      await syncQueue.add('run-source', { sourceId: s.id, trigger: 'schedule' } satisfies SyncJob, {
        jobId: `sched:${s.id}:${s.lastStartedAt?.getTime() ?? 0}`,
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 1,
      });
      log('sync queued', { source: s.name });
    }
  } catch (err) {
    log('scheduler tick failed', err instanceof Error ? err.message : String(err));
  } finally {
    ticking = false;
  }
}
void tick();
const ticker = setInterval(() => void tick(), 30_000);

const server = http.createServer((req, res) => {
  if (req.url !== '/health') {
    res.writeHead(404).end();
    return;
  }
  const ok = connection.status === 'ready';
  res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', redis: connection.status }));
});
server.listen(env.WORKER_HEALTH_PORT, () =>
  log('worker started', { port: env.WORKER_HEALTH_PORT }),
);

// Graceful shutdown so in-flight jobs finish on `docker stop`.
async function shutdown(signal: string) {
  log('shutting down', { signal });
  clearInterval(ticker);
  server.close();
  await syncWorker.close();
  await worker.close();
  await syncQueue.close();
  await queue.close();
  await db.$disconnect();
  connection.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
