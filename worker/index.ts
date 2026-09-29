import http from 'node:http';
import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { getEnv } from '../src/lib/env';

/**
 * Worker entrypoint. Step 0: connects to Redis, registers a `system` queue with a
 * heartbeat processor, and exposes /health for Docker. Sync adapters arrive in Phase 8.
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
  server.close();
  await worker.close();
  await queue.close();
  connection.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
