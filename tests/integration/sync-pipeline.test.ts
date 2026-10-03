import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { saveRecord } from '../../server/admin/records';
import { approveImport, getImport, listImports, rejectImport } from '../../server/admin/imports';
import {
  createSource,
  deleteSource,
  listRuns,
  listSources,
  setSourceEnabled,
  updateSource,
} from '../../server/admin/sync-sources';
import { ApiError } from '../../server/api/http';
import { dueSources, runSource, STALE_RUN_MS, type SyncDeps } from '../../server/jobs/sync-run';
import { isDue } from '../../src/lib/sync/schedule';
import { noRobots, testHttp, type MockReply } from '../support/mock-fetch';
import { newDb, resetDb } from './helpers';

const db = newDb();
beforeEach(() => resetDb());
afterAll(() => db.$disconnect());

const NOW = new Date('2026-10-03T12:00:00.000Z');
const FEED = 'https://blog.example.com/feed.xml';
const SOURCE = 'https://example.test/docs';

const rss = (items: { title: string; link?: string; date?: string; desc?: string }[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title>${i.link ? `<link>${i.link}</link>` : ''}${i.date ? `<pubDate>${i.date}</pubDate>` : ''}${i.desc ? `<description>${i.desc}</description>` : ''}</item>`,
    )
    .join('')}</channel></rss>`;

const POST_A = {
  title: 'Introducing Example 2',
  link: 'https://blog.example.com/posts/a',
  date: 'Wed, 30 Sep 2026 14:00:00 GMT',
  desc: 'Example 2 is our latest model.',
};
const POST_B = {
  title: 'Safety update',
  link: 'https://blog.example.com/posts/b',
  date: 'Tue, 29 Sep 2026 09:00:00 GMT',
};

let feedBody = rss([POST_A, POST_B]);
let extra: Record<string, MockReply> = {};
let clock = NOW;

function deps(over: Partial<SyncDeps> = {}): SyncDeps {
  return {
    db,
    now: () => clock,
    makeHttp: () =>
      testHttp({ ...noRobots('https://blog.example.com'), [FEED]: { body: feedBody }, ...extra })
        .client,
    ...over,
  };
}

const actor = async () => {
  const u = await db.user.upsert({
    where: { email: 'admin@x.test' },
    create: { email: 'admin@x.test', role: 'ADMIN' },
    update: {},
  });
  return { actorId: u.id, ip: null as string | null };
};

async function newSource(config: Record<string, unknown> = {}, name = 'Example blog') {
  const a = await actor();
  return createSource(
    db,
    { id: a.actorId, ip: null },
    {
      name,
      kind: 'rss',
      schedule: 'every 6h',
      config: {
        feedUrl: FEED,
        publisher: 'Example Lab',
        provider: null,
        category: 'MODEL_RELEASES',
        isOfficial: true,
        ...config,
      },
    },
  );
}

const run = (id: string) => runSource(deps(), id, { kind: 'schedule' });
const err = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (e: unknown) => e,
  )) as ApiError | null;

beforeEach(() => {
  feedBody = rss([POST_A, POST_B]);
  extra = {};
  clock = NOW;
});

describe('runSource: staging', () => {
  it('stages new items as PENDING, writes nothing to the catalogue, and records the run', async () => {
    const s = await newSource();
    const out = await run(s.id);
    expect(out).toMatchObject({ status: 'SUCCEEDED', seen: 2, staged: 2, issues: 0, error: null });

    expect(await db.newsArticle.count()).toBe(0); // nothing is published by a sync
    const imports = await db.importedRecord.findMany();
    expect(imports).toHaveLength(2);
    expect(imports.every((i) => i.status === 'PENDING' && i.entityType === 'news')).toBe(true);
    expect(imports[0]!.diff).toMatchObject({ kind: 'new', trust: 'ok' });

    const r = await db.syncRun.findFirstOrThrow();
    expect(r).toMatchObject({
      status: 'SUCCEEDED',
      recordsSeen: 2,
      recordsChanged: 2,
      error: null,
    });
    expect(r.finishedAt).not.toBeNull();
  });

  it('turns invalid candidates into issues (PARTIAL), keeping the good ones', async () => {
    feedBody = rss([POST_A, { title: 'No link', date: 'Wed, 30 Sep 2026 14:00:00 GMT' }]);
    const s = await newSource();
    const out = await run(s.id);
    expect(out).toMatchObject({ status: 'PARTIAL', staged: 1, issues: 1 });
    const issue = await db.syncIssue.findFirstOrThrow();
    expect(issue.entityType).toBe('news');
    expect(issue.message).toContain('articleUrl');
    expect(issue.payload).toMatchObject({ title: 'No link' });
  });

  it('reports unknown references as validation issues', async () => {
    const s = await newSource({ provider: 'ghost' });
    const out = await run(s.id);
    expect(out).toMatchObject({ status: 'PARTIAL', staged: 0, issues: 2 });
    expect((await db.syncIssue.findFirstOrThrow()).message).toContain('unknown provider "ghost"');
  });

  it('does not stage the same import twice, even across runs', async () => {
    const s = await newSource();
    await run(s.id);
    clock = new Date(NOW.getTime() + 7 * 3600_000);
    const again = await run(s.id);
    expect(again).toMatchObject({ staged: 0, duplicates: 2 });
    expect(await db.importedRecord.count()).toBe(2);
  });

  it('ignores a repeated item inside one feed', async () => {
    feedBody = rss([POST_A, POST_A]);
    const s = await newSource();
    expect(await run(s.id)).toMatchObject({ staged: 1, duplicates: 1 });
  });

  it('stays quiet about an import an admin already rejected', async () => {
    const s = await newSource();
    await run(s.id);
    const a = await actor();
    for (const row of await db.importedRecord.findMany())
      await rejectImport(db, row.id, { ...a, invalidate: undefined });
    clock = new Date(NOW.getTime() + 7 * 3600_000);
    expect(await run(s.id)).toMatchObject({ staged: 0, duplicates: 2 });
  });
});

describe('runSource: failures and guards', () => {
  it('a source that cannot be fetched fails the run with the reason, staging nothing', async () => {
    extra = { [FEED]: { status: 500 } };
    const s = await newSource();
    const out = await run(s.id);
    expect(out).toMatchObject({ status: 'FAILED', staged: 0 });
    expect((out as { error: string }).error).toContain('HTTP 500');
    expect((await db.syncRun.findFirstOrThrow()).status).toBe('FAILED');
    expect(await db.importedRecord.count()).toBe(0);
  });

  it('respects robots.txt: a disallowed feed is a failed run, not a fetch', async () => {
    const s = await newSource();
    const out = await runSource(
      deps({
        makeHttp: () => {
          const t = testHttp({
            'https://blog.example.com/robots.txt': { body: 'User-agent: *\nDisallow: /feed.xml' },
            [FEED]: { body: feedBody },
          });
          return t.client;
        },
      }),
      s.id,
      { kind: 'schedule' },
    );
    expect(out).toMatchObject({ status: 'FAILED' });
    expect((out as { error: string }).error).toContain('robots.txt');
  });

  it('a malformed stored config fails the run with a readable message', async () => {
    const s = await newSource();
    await db.syncSource.update({ where: { id: s.id }, data: { config: { feedUrl: 'nope' } } });
    const out = await run(s.id);
    expect(out).toMatchObject({ status: 'FAILED' });
    expect((out as { error: string }).error).toContain('Invalid source configuration');
  });

  it('an unknown adapter kind fails cleanly', async () => {
    const s = await newSource();
    await db.syncSource.update({ where: { id: s.id }, data: { kind: 'gone' } });
    expect(await run(s.id)).toMatchObject({ status: 'FAILED' });
  });

  it('skips disabled sources, and never runs one source twice at once', async () => {
    const s = await newSource();
    const a = await actor();
    await setSourceEnabled(db, { id: a.actorId, ip: null }, s.id, false);
    expect(await run(s.id)).toEqual({ skipped: 'disabled' });
    await setSourceEnabled(db, { id: a.actorId, ip: null }, s.id, true);

    await db.syncRun.create({
      data: { sourceId: s.id, startedAt: new Date(NOW.getTime() - 60_000) },
    });
    expect(await run(s.id)).toEqual({ skipped: 'already-running' });
  });

  it('closes a stale RUNNING run (crashed worker) and carries on', async () => {
    const s = await newSource();
    const stale = await db.syncRun.create({
      data: { sourceId: s.id, startedAt: new Date(NOW.getTime() - STALE_RUN_MS - 60_000) },
    });
    expect(await run(s.id)).toMatchObject({ status: 'SUCCEEDED' });
    const closed = await db.syncRun.findUniqueOrThrow({ where: { id: stale.id } });
    expect(closed).toMatchObject({ status: 'FAILED' });
    expect(closed.error).toContain('Interrupted');
  });

  it('handles a feed with as many items as maxItems allows', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      title: `T${i}`,
      link: `https://blog.example.com/${i}`,
      date: POST_A.date,
    }));
    feedBody = rss(items);
    const s = await newSource({ maxItems: 50 });
    expect(await run(s.id)).toMatchObject({ status: 'SUCCEEDED', staged: 50 }); // within the limit
  });

  it('a manual trigger is audited with who started it', async () => {
    const s = await newSource();
    const a = await actor();
    await runSource(deps(), s.id, { kind: 'manual', actorId: a.actorId, ip: '203.0.113.7' });
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'sync.trigger' } });
    expect(audit).toMatchObject({
      actorId: a.actorId,
      entityType: 'sync-sources',
      entityId: s.id,
      ip: '203.0.113.7',
    });
  });
});

describe('approval flow', () => {
  const ctxFor = async () => {
    const a = await actor();
    return { actorId: a.actorId, ip: null as string | null, invalidate: undefined };
  };

  it('approving publishes the record, marks the import, audits it, and later runs see no change', async () => {
    const s = await newSource();
    await run(s.id);
    const ctx = await ctxFor();
    const pending = await listImports(db, { status: 'PENDING' });
    expect(pending.total).toBe(2);

    const target = pending.rows.find((r) => r.title === 'Introducing Example 2')!;
    const detail = await getImport(db, target.id);
    expect(detail).toMatchObject({
      kind: 'new',
      trust: 'ok',
      existing: null,
      source: 'Example blog',
    });

    const out = await approveImport(db, target.id, { override: false }, ctx);
    const article = await db.newsArticle.findUniqueOrThrow({ where: { id: out.entityId } });
    expect(article).toMatchObject({
      title: 'Introducing Example 2',
      isAiSummary: false,
      verificationStatus: 'OFFICIALLY_VERIFIED',
      isDemo: false,
    });
    const imp = await db.importedRecord.findUniqueOrThrow({ where: { id: target.id } });
    expect(imp).toMatchObject({ status: 'APPROVED', reviewedBy: ctx.actorId });
    expect(imp.reviewedAt).not.toBeNull();
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'import.approve' } });
    expect(audit).toMatchObject({
      entityType: 'imports',
      entityId: target.id,
      actorId: ctx.actorId,
    });

    clock = new Date(NOW.getTime() + 7 * 3600_000);
    expect(await run(s.id)).toMatchObject({ staged: 0, unchanged: 1, duplicates: 1 });
  });

  it('an import can be decided once only (double approve, approve-after-reject, reject-after-approve)', async () => {
    const s = await newSource();
    await run(s.id);
    const ctx = await ctxFor();
    const [one, two] = (await listImports(db, { status: 'PENDING' })).rows;
    await approveImport(db, one!.id, { override: false }, ctx);
    expect((await err(approveImport(db, one!.id, { override: false }, ctx)))?.status).toBe(409);
    expect((await err(rejectImport(db, one!.id, ctx)))?.status).toBe(409);
    await rejectImport(db, two!.id, ctx);
    expect((await err(approveImport(db, two!.id, { override: false }, ctx)))?.status).toBe(409);
    expect(await db.newsArticle.count()).toBe(1);
  });

  it('two simultaneous approvals publish once (one wins, one gets 409)', async () => {
    const s = await newSource();
    await run(s.id);
    const ctx = await ctxFor();
    const [one] = (await listImports(db, { status: 'PENDING' })).rows;
    const results = await Promise.allSettled([
      approveImport(db, one!.id, { override: false }, ctx),
      approveImport(db, one!.id, { override: false }, ctx),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((lost.reason as ApiError).status).toBe(409);
    expect(await db.auditLog.count({ where: { action: 'import.approve' } })).toBe(1);
    expect(await db.newsArticle.count()).toBe(1);
  });

  it('reject keeps the catalogue untouched and audits who rejected what', async () => {
    const s = await newSource();
    await run(s.id);
    const ctx = await ctxFor();
    const [one] = (await listImports(db, { status: 'PENDING' })).rows;
    await rejectImport(db, one!.id, ctx);
    expect(await db.newsArticle.count()).toBe(0);
    expect((await db.importedRecord.findUniqueOrThrow({ where: { id: one!.id } })).status).toBe(
      'REJECTED',
    );
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'import.reject' } });
    expect(audit.before).toMatchObject({ entity: 'news' });
  });

  it('404 for an unknown import, and a stale payload that no longer validates is a 400', async () => {
    const ctx = await ctxFor();
    expect((await err(approveImport(db, 'nope', { override: false }, ctx)))?.status).toBe(404);
    expect((await err(rejectImport(db, 'nope', ctx)))?.status).toBe(404);

    const s = await newSource();
    await run(s.id);
    const [one] = (await listImports(db, { status: 'PENDING' })).rows;
    const row = await db.importedRecord.findUniqueOrThrow({ where: { id: one!.id } });
    await db.importedRecord.update({
      where: { id: one!.id },
      data: { payload: { ...(row.payload as object), provider: 'deleted-since' } },
    });
    const e = await err(approveImport(db, one!.id, { override: false }, ctx));
    expect(e?.status).toBe(400);
    expect(JSON.stringify(e?.details)).toContain('unknown provider');
    expect(await db.newsArticle.count()).toBe(0);
  });
});

describe('trust guard: an import never silently lowers stored trust', () => {
  const stored = {
    title: 'Introducing Example 2',
    summary: 'My own words about the launch.',
    publisher: 'Example Lab',
    articleUrl: POST_A.link,
    publicationDate: '2026-09-30T14:00:00.000Z',
    category: 'MODEL_RELEASES',
    isOfficial: true,
    isAiSummary: true,
    sourceUrl: POST_A.link,
    verificationStatus: 'OFFICIALLY_VERIFIED',
    verifiedAt: '2026-10-01T10:00:00.000Z',
  };

  it('keeps curated fields on re-import and stages only what the source changed', async () => {
    const a = await actor();
    await saveRecord(db, 'news', null, stored, { actorId: a.actorId, ip: null });
    feedBody = rss([{ ...POST_A, title: 'Introducing Example 2 (updated)' }]);
    const s = await newSource();
    await run(s.id);

    const [imp] = (await listImports(db, { status: 'PENDING' })).rows;
    const detail = await getImport(db, imp!.id);
    expect(detail).toMatchObject({ kind: 'update', trust: 'ok' });
    expect(Object.keys(detail!.changes)).toEqual(['title']);
    expect(detail!.existing).toMatchObject({ summary: 'My own words about the launch.' });

    await approveImport(db, imp!.id, { override: false }, { actorId: a.actorId, ip: null });
    const row = await db.newsArticle.findFirstOrThrow();
    expect(row.title).toBe('Introducing Example 2 (updated)');
    expect(row.summary).toBe('My own words about the launch.'); // not replaced by the feed excerpt
    expect(row.isAiSummary).toBe(true);
    expect(row.verificationStatus).toBe('OFFICIALLY_VERIFIED');
  });

  it('flags a downgrade, refuses it without an explicit override, and audits the override', async () => {
    const a = await actor();
    const ctx = { actorId: a.actorId, ip: null as string | null };
    await saveRecord(db, 'news', null, stored, ctx);
    // Same article from a non-official source configuration: lower trust than what is stored.
    feedBody = rss([{ ...POST_A, title: 'Introducing Example 2 (reposted)' }]);
    const s = await newSource({ isOfficial: false });
    await run(s.id);

    const [imp] = (await listImports(db, { status: 'PENDING' })).rows;
    expect(imp).toMatchObject({ kind: 'update', trust: 'downgrade' });
    const detail = await getImport(db, imp!.id);
    expect(detail!.changes.verificationStatus).toEqual({
      before: 'OFFICIALLY_VERIFIED',
      after: 'COMMUNITY_REPORTED',
    });

    const refused = await err(approveImport(db, imp!.id, { override: false }, ctx));
    expect(refused).toMatchObject({ status: 409, code: 'TRUST_GUARD' });
    expect(refused!.details).toEqual({ requiresOverride: true });
    let row = await db.newsArticle.findFirstOrThrow();
    expect(row.verificationStatus).toBe('OFFICIALLY_VERIFIED'); // untouched
    expect(row.title).toBe('Introducing Example 2');
    expect((await db.importedRecord.findUniqueOrThrow({ where: { id: imp!.id } })).status).toBe(
      'PENDING',
    );

    await approveImport(db, imp!.id, { override: true }, ctx);
    row = await db.newsArticle.findFirstOrThrow();
    expect(row.verificationStatus).toBe('COMMUNITY_REPORTED');
    expect(await db.auditLog.count({ where: { action: 'import.approve-override' } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'import.approve' } })).toBe(0);
  });

  it('an equal-or-higher trust import needs no override', async () => {
    const a = await actor();
    const ctx = { actorId: a.actorId, ip: null as string | null };
    await saveRecord(
      db,
      'news',
      null,
      { ...stored, verificationStatus: 'COMMUNITY_REPORTED', isOfficial: false },
      ctx,
    );
    feedBody = rss([{ ...POST_A, title: 'Retitled' }]);
    const s = await newSource({ isOfficial: true });
    await run(s.id);
    const [imp] = (await listImports(db, { status: 'PENDING' })).rows;
    expect(imp!.trust).toBe('ok');
    await approveImport(db, imp!.id, { override: false }, ctx);
    expect((await db.newsArticle.findFirstOrThrow()).verificationStatus).toBe(
      'OFFICIALLY_VERIFIED',
    );
  });
});

describe('release imports (GitHub)', () => {
  it('stages a release for a known provider and publishes it on approval', async () => {
    const a = await actor();
    const ctx = { actorId: a.actorId, ip: null as string | null };
    await saveRecord(
      db,
      'providers',
      null,
      {
        slug: 'example-lab',
        name: 'Example Lab',
        description: 'A lab.',
        sourceUrl: SOURCE,
        verificationStatus: 'OFFICIALLY_VERIFIED',
        verifiedAt: '2026-10-01T10:00:00.000Z',
      },
      ctx,
    );
    const GH = 'https://api.github.com/repos/example/runtime/releases?per_page=10';
    const source = await createSource(
      db,
      { id: a.actorId, ip: null },
      {
        name: 'Runtime releases',
        kind: 'github-releases',
        schedule: 'every 1d',
        config: { repo: 'example/runtime', provider: 'example-lab' },
      },
    );
    const makeHttp = () =>
      testHttp({
        ...noRobots('https://api.github.com'),
        [GH]: {
          body: JSON.stringify([
            {
              tag_name: 'v2.0.0',
              name: 'v2.0.0',
              body: 'Big release',
              html_url: 'https://github.com/example/runtime/releases/tag/v2.0.0',
              published_at: '2026-09-28T08:30:00Z',
            },
          ]),
        },
      }).client;
    const out = await runSource(deps({ makeHttp }), source.id, { kind: 'schedule' });
    expect(out).toMatchObject({ status: 'SUCCEEDED', staged: 1 });
    expect(await db.release.count()).toBe(0);

    const [imp] = (await listImports(db, { status: 'PENDING' })).rows;
    expect(imp).toMatchObject({ entityType: 'releases', title: 'runtime v2.0.0' });
    await approveImport(db, imp!.id, { override: false }, ctx);
    const rel = await db.release.findFirstOrThrow();
    expect(rel).toMatchObject({ title: 'runtime v2.0.0', description: 'Big release' });
  });
});

describe('sources: management', () => {
  const a = async () => ({ id: (await actor()).actorId, ip: null as string | null });

  it('validates the body, the schedule and the adapter config, reporting every problem', async () => {
    const who = await a();
    const e = await err(
      createSource(db, who, {
        name: 'x',
        kind: 'rss',
        schedule: 'every 5m',
        config: { feedUrl: 'nope', publisher: '' },
      }),
    );
    expect(e?.status).toBe(400);
    const paths = (e!.details as { issues: { path: string }[] }).issues.map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(['schedule', 'config.feedUrl', 'config.publisher']),
    );
    expect(
      (
        await err(
          createSource(db, who, { name: 'x', kind: 'nope', schedule: 'manual', config: {} }),
        )
      )?.status,
    ).toBe(400);
    expect((await err(createSource(db, who, 'junk')))?.status).toBe(400);
    expect(await db.syncSource.count()).toBe(0);
  });

  it('stores the normalised config and schedule, rejects duplicate names, audits changes', async () => {
    const who = await a();
    const s = await newSource({}, 'Blog');
    expect(s.schedule).toBe('every 6h');
    expect(s.config).toMatchObject({ maxItems: 20, isOfficial: true }); // defaults applied

    expect((await err(newSource({}, 'Blog')))?.status).toBe(409);
    const u = await updateSource(db, who, s.id, {
      name: 'Blog',
      kind: 'rss',
      schedule: 'EVERY 60m',
      config: { feedUrl: FEED, publisher: 'Example Lab' },
    });
    expect(u.schedule).toBe('every 1h');
    await setSourceEnabled(db, who, s.id, false);
    expect(
      await db.auditLog.findMany({
        where: { entityType: 'sync-sources' },
        select: { action: true },
        orderBy: { createdAt: 'asc' },
      }),
    ).toEqual([
      { action: 'sync-source.create' },
      { action: 'sync-source.update' },
      { action: 'sync-source.disable' },
    ]);
    expect(
      (
        await err(
          updateSource(db, who, 'nope', {
            name: 'x',
            kind: 'rss',
            schedule: 'manual',
            config: { feedUrl: FEED, publisher: 'p' },
          }),
        )
      )?.status,
    ).toBe(404);
  });

  it('lists last run, next run, weekly counters and pending imports', async () => {
    const s = await newSource();
    await run(s.id);
    feedBody = '<html>not a feed</html>';
    clock = new Date(NOW.getTime() + 7 * 3600_000);
    await run(s.id);

    const [row] = await listSources(db, new Date(clock.getTime() + 60_000));
    expect(row).toMatchObject({
      name: 'Example blog',
      enabled: true,
      pendingImports: 2,
      recent: { succeeded: 1, partial: 0, failed: 1 },
    });
    expect(row!.lastRun).toMatchObject({ status: 'FAILED' });
    expect(row!.nextRunAt).toBe(new Date(clock.getTime() + 6 * 3600_000).toISOString());

    const runs = await listRuns(db, {});
    expect(runs.rows.map((r) => r.status)).toEqual(['FAILED', 'SUCCEEDED']);
    expect(runs.rows[1]).toMatchObject({ imports: 2, recordsChanged: 2 });
  });

  it('a disabled source shows no next run; deleting a source cascades its runs and staged imports', async () => {
    const who = await a();
    const s = await newSource();
    await run(s.id);
    await setSourceEnabled(db, who, s.id, false);
    expect((await listSources(db, NOW))[0]!.nextRunAt).toBeNull();
    await deleteSource(db, who, s.id);
    expect(await db.syncRun.count()).toBe(0);
    expect(await db.importedRecord.count()).toBe(0);
    expect((await err(deleteSource(db, who, s.id)))?.status).toBe(404);
  });

  it('dueSources picks enabled sources whose schedule says they are due', async () => {
    const who = await a();
    const never = await newSource({}, 'Never ran');
    const fresh = await newSource({}, 'Fresh');
    const manual = await createSource(db, who, {
      name: 'Manual only',
      kind: 'rss',
      schedule: 'manual',
      config: { feedUrl: FEED, publisher: 'p' },
    });
    const off = await newSource({}, 'Off');
    await setSourceEnabled(db, who, off.id, false);
    await db.syncRun.create({
      data: {
        sourceId: fresh.id,
        startedAt: new Date(NOW.getTime() - 3600_000),
        status: 'SUCCEEDED',
        finishedAt: NOW,
      },
    });

    const due = await dueSources(db, NOW, isDue);
    expect(due.map((d) => d.name)).toEqual(['Never ran']);
    expect(manual.id).toBeTruthy();
    expect(never.id).toBeTruthy();
    const later = await dueSources(db, new Date(NOW.getTime() + 6 * 3600_000), isDue);
    expect(later.map((d) => d.name).sort()).toEqual(['Fresh', 'Never ran']);
  });
});
