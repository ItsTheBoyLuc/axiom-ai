import { describe, expect, it } from 'vitest';
import { getEnv } from '../../src/lib/env';

describe('getEnv', () => {
  it('applies defaults for valid input', () => {
    const env = getEnv({
      DATABASE_URL: 'postgresql://x',
      REDIS_URL: 'redis://x',
    });
    expect(env.WORKER_HEALTH_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws a readable error when required vars are missing', () => {
    expect(() => getEnv({})).toThrow(/DATABASE_URL/);
  });
});
