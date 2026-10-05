import {
  guardedRoute,
  READ_RULE,
  WRITE_RULE,
  type GuardCtx,
  type GuardDeps,
  type GuardResult,
} from '../auth/guard';
import type { RateRule } from '../auth/rate-limit';
import type { SyncJob, WorkerStatus } from '../jobs/queue';

/**
 * The wrapper every /api/v1/admin route goes through (see server/auth/guard.ts for the checks):
 * session, ADMIN role, same-origin on writes, per-admin rate limit, uniform no-store JSON.
 */

export type AdminDeps = GuardDeps & {
  /** Makes cached reads stale after a write (cache tags, see server/admin/definitions.ts). */
  invalidate: (tags: string[]) => Promise<void>;
  /** Queues a sync run for the worker ("Run now"). Throws ApiError 503 when the queue is down. */
  enqueueSync: (job: SyncJob) => Promise<void>;
  /** Whether a worker has reported in recently (dashboard). */
  workerStatus: () => Promise<WorkerStatus>;
};

export type AdminCtx = GuardCtx<AdminDeps>;
export type AdminResult = GuardResult;
export { READ_RULE, WRITE_RULE };

export function adminRoute(
  run: (ctx: AdminCtx) => Promise<AdminResult>,
  deps: () => AdminDeps,
  opts: { rule?: RateRule } = {},
) {
  return guardedRoute<AdminDeps>('ADMIN', run, deps, { ...opts, bucket: 'admin' });
}
