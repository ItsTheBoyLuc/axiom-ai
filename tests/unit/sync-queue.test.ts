import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enqueueSync, workerStatus } from '../../server/jobs/queue';

/** Without Redis the web app must degrade to a clear 503 / "offline", never hang or throw. */
describe('job queue without Redis', () => {
  const saved = process.env.REDIS_URL;
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = saved;
  });

  it('enqueue is a 503 QUEUE_UNAVAILABLE', async () => {
    await expect(enqueueSync({ sourceId: 's1', trigger: 'manual' })).rejects.toMatchObject({
      status: 503,
      code: 'QUEUE_UNAVAILABLE',
    });
  });

  it('the worker reads as offline', async () => {
    expect(await workerStatus()).toEqual({ online: false, lastSeen: null });
  });
});
