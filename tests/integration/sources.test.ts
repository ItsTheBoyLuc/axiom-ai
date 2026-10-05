import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../prisma/seed/seed';
import { createRepositories } from '../../server/repositories';
import { newDb, resetDb, seedDemo } from './helpers';

const db = newDb();
const repos = createRepositories(db);
afterAll(() => db.$disconnect());

describe('sources summary', () => {
  it('never counts demo fixtures as sources', async () => {
    await seedDemo(db);
    const s = await repos.sources.summary();
    expect(s.totalRecords).toBe(0);
    expect(s.hosts).toEqual([]);
  });

  describe('with real data loaded', () => {
    beforeAll(async () => {
      await resetDb();
      await runSeed(db, { demo: false, realData: true });
    });

    it('accounts for every factual record exactly once, by status and by host', async () => {
      const s = await repos.sources.summary();
      const byStatusTotal = Object.values(s.byStatus).reduce((a, b) => a + b, 0);
      const byHostTotal = s.hosts.reduce((a, h) => a + h.records, 0);
      expect(s.totalRecords).toBeGreaterThan(300);
      expect(byStatusTotal).toBe(s.totalRecords);
      expect(byHostTotal + s.withoutSource).toBe(s.totalRecords);
      for (const h of s.hosts) {
        expect(Object.values(h.byStatus).reduce((a, b) => a + (b ?? 0), 0)).toBe(h.records);
      }
    });

    it('lists hosts as bare lowercase domains, largest first, without scheme, www or path', async () => {
      const { hosts } = await repos.sources.summary();
      expect(hosts.length).toBeGreaterThan(5);
      for (const h of hosts) expect(h.host).toMatch(/^[a-z0-9.-]+(:\d+)?$/);
      for (let i = 1; i < hosts.length; i++) {
        expect(hosts[i - 1]!.records).toBeGreaterThanOrEqual(hosts[i]!.records);
      }
    });

    it('records without a source are only ever unverified or undisclosed (data integrity)', async () => {
      const s = await repos.sources.summary();
      const sourced = s.hosts.reduce((a, h) => a + h.records, 0);
      expect(sourced).toBeGreaterThan(0);
      // The CHECK constraints (migration 2) forbid a verified record without a source URL.
      expect(s.withoutSource).toBeLessThanOrEqual(
        s.byStatus.UNVERIFIED + s.byStatus.NOT_PUBLICLY_DISCLOSED,
      );
    });
  });
});
