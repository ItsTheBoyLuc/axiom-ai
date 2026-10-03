import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ApiError } from '../api/http';

/**
 * The sync job queue and the worker heartbeat, as seen from the web app: "Run now" enqueues a
 * job for the worker, and the dashboard shows whether a worker is alive. The worker itself
 * (worker/index.ts) owns the processing. Connections fail fast (no offline queue, short
 * timeouts), so a down Redis becomes a clear 503 instead of a hanging request.
 */

export const SYNC_QUEUE = 'sync';
export const HEARTBEAT_KEY = 'axiom:worker:heartbeat';
/** The worker refreshes the heartbeat every 30 s; it counts as online for twice that. */
export const HEARTBEAT_TTL_SECONDS = 90;

export type SyncJob = {
  sourceId: string;
  trigger: 'schedule' | 'manual';
  actorId?: string;
  ip?: string | null;
};

const g = globalThis as unknown as { __axiomSyncQueue?: { queue: Queue; redis: Redis } };

function connection() {
  const url = process.env.REDIS_URL;
  if (!url)
    throw new ApiError(503, 'QUEUE_UNAVAILABLE', 'The job queue is not configured (REDIS_URL).');
  if (!g.__axiomSyncQueue) {
    const redis = new Redis(url, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    });
    redis.on('error', () => {
      /* surfaced as a 503 on use; an unhandled 'error' event would crash the process */
    });
    g.__axiomSyncQueue = { redis, queue: new Queue(SYNC_QUEUE, { connection: redis }) };
  }
  return g.__axiomSyncQueue;
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

/** Queues a run for the worker. Throws ApiError 503 when the queue cannot be reached. */
export async function enqueueSync(job: SyncJob): Promise<void> {
  try {
    const { queue } = connection();
    await withTimeout(
      queue.add('run-source', job, {
        // One manual run per source per minute collapses accidental double clicks.
        jobId: `manual:${job.sourceId}:${Math.floor(Date.now() / 60_000)}`,
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 1,
      }),
      2_500,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      503,
      'QUEUE_UNAVAILABLE',
      'The job queue is unreachable. Check that Redis and the worker are running.',
    );
  }
}

export type WorkerStatus = { online: boolean; lastSeen: string | null };

/** Reads the worker's heartbeat. Never throws: an unreadable heartbeat means "offline". */
export async function workerStatus(): Promise<WorkerStatus> {
  try {
    const { redis } = connection();
    const raw = await withTimeout(redis.get(HEARTBEAT_KEY), 1_500);
    if (!raw) return { online: false, lastSeen: null };
    const at = new Date(Number(raw));
    return Number.isNaN(at.getTime())
      ? { online: false, lastSeen: null }
      : { online: true, lastSeen: at.toISOString() };
  } catch {
    return { online: false, lastSeen: null };
  }
}
