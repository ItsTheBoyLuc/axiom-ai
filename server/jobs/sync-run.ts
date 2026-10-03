import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../prisma/generated/client';
import { protectExisting } from '../../prisma/seed/load';
import { validateBundle } from '../../prisma/seed/schemas';
import { outranks, type VerificationStatus } from '../../src/lib/verification';
import { ADMIN_ENTITIES, DEFINITIONS, type AdminEntity } from '../admin/definitions';
import { getAdapter, type AdapterContext, type Candidate } from '../adapters';
import type { HttpClient } from '../adapters/http';
import { recordAudit } from '../audit';

/**
 * One sync run for one source: fetch -> normalise (adapter) -> validate (seed schemas) -> diff
 * against what is stored -> STAGE in ImportedRecord as PENDING (docs/PROMPT.md 9 and 11).
 * Nothing here ever writes to the catalogue: publishing needs an admin's approval
 * (server/admin/imports.ts), and an import that would lower the trust of a stored record is
 * flagged so approving it takes an explicit override.
 */

export type SyncDeps = {
  db: PrismaClient;
  /** A fresh polite HTTP client per run (robots.txt cache and host throttling are per run). */
  makeHttp: () => HttpClient;
  now?: () => Date;
  secrets?: AdapterContext['secrets'];
  log?: (msg: string, extra?: unknown) => void;
};

export type RunOutcome =
  | {
      skipped: 'disabled' | 'already-running';
    }
  | {
      skipped?: undefined;
      runId: string;
      status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
      seen: number;
      staged: number;
      unchanged: number;
      duplicates: number;
      issues: number;
      error: string | null;
    };

/** A run that has been RUNNING this long is assumed dead (worker crashed) and closed as failed. */
export const STALE_RUN_MS = 15 * 60_000;
/** More candidates than this in one run is a misconfigured source, not a feed. */
export const MAX_CANDIDATES = 200;

/**
 * Fields a re-import must NOT overwrite on a record that already exists: they are curated by
 * people (own-words summaries, related-model links, classification), not by the source.
 */
const CURATED: Partial<Record<AdminEntity, string[]>> = {
  news: ['summary', 'models', 'category', 'isAiSummary', 'isOfficial', 'provider'],
  releases: ['kind', 'model', 'description', 'docsUrl'],
};
/** Never part of "did this record change": they differ on every run by construction. */
const VOLATILE = new Set(['collectedAt', 'verifiedAt', 'isDemo']);

export type Change = { before: unknown; after: unknown };
export type StagedDiff = {
  key: string;
  kind: 'new' | 'update';
  /** For updates: the fields that differ. For new records: empty (the payload is the record). */
  changes: Record<string, Change>;
  /** `downgrade` = the import would replace a higher-trust record; approval needs an override. */
  trust: 'ok' | 'downgrade';
  /** Hash of the payload, so an identical import is never staged twice. */
  hash: string;
};

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
const sha = (v: unknown) => createHash('sha256').update(stable(v)).digest('hex').slice(0, 32);
const equal = (a: unknown, b: unknown) => stable(a) === stable(b);

const isEntity = (e: string): e is AdminEntity => (ADMIN_ENTITIES as readonly string[]).includes(e);

async function knownSlugs(db: PrismaClient) {
  const [providers, models, benchmarks] = await Promise.all([
    db.provider.findMany({ select: { slug: true } }),
    db.model.findMany({ select: { slug: true } }),
    db.benchmark.findMany({ select: { slug: true } }),
  ]);
  return {
    providers: providers.map((p) => p.slug),
    models: models.map((m) => m.slug),
    benchmarks: benchmarks.map((b) => b.slug),
  };
}

/** Compares a validated candidate with the stored record and decides what, if anything, to stage. */
export function buildStaging(
  entity: AdminEntity,
  candidate: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  key: string,
): { payload: Record<string, unknown>; diff: StagedDiff } | null {
  if (!existing) {
    const payload = withoutVolatile(candidate, ['verifiedAt']);
    return {
      payload,
      diff: { key, kind: 'new', changes: {}, trust: 'ok', hash: sha(withoutVolatile(payload)) },
    };
  }

  // Start from what is stored, overlay what the source is authoritative for.
  const keep = new Set(CURATED[entity] ?? []);
  const merged: Record<string, unknown> = { ...existing };
  for (const [field, value] of Object.entries(candidate)) {
    if (!keep.has(field) && !VOLATILE.has(field)) merged[field] = value;
  }
  const changes: Record<string, Change> = {};
  for (const field of Object.keys(merged)) {
    // dataType is a note about the source, not a fact: it alone never makes a record "changed".
    if (VOLATILE.has(field) || keep.has(field) || field === 'dataType') continue;
    if (!equal(merged[field], existing[field])) {
      changes[field] = { before: existing[field] ?? null, after: merged[field] };
    }
  }
  if (Object.keys(changes).length === 0) return null; // unchanged

  const downgrade = outranks(
    String(existing.verificationStatus) as VerificationStatus,
    String(merged.verificationStatus) as VerificationStatus,
  );
  // verifiedAt moves with the status: keep the stored one unless the source's status is not lower.
  merged.verifiedAt = downgrade
    ? existing.verifiedAt
    : (candidate.verifiedAt ?? existing.verifiedAt);
  const payload = withoutVolatile(merged, ['verifiedAt']);
  return {
    payload,
    diff: {
      key,
      kind: 'update',
      changes,
      trust: downgrade ? 'downgrade' : 'ok',
      hash: sha(withoutVolatile(payload)),
    },
  };
}

function withoutVolatile(record: Record<string, unknown>, keep: string[] = []) {
  return Object.fromEntries(
    Object.entries(record).filter(([k]) => !VOLATILE.has(k) || keep.includes(k)),
  );
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

export async function runSource(
  deps: SyncDeps,
  sourceId: string,
  trigger: { kind: 'schedule' } | { kind: 'manual'; actorId: string; ip: string | null },
): Promise<RunOutcome> {
  const { db } = deps;
  const log = deps.log ?? (() => undefined);
  const now = deps.now?.() ?? new Date();

  const source = await db.syncSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`sync source ${sourceId} not found`);
  if (!source.enabled) return { skipped: 'disabled' };

  // One run per source at a time; a crashed worker's run is closed so it cannot block forever.
  await db.syncRun.updateMany({
    where: {
      sourceId,
      status: 'RUNNING',
      startedAt: { lt: new Date(now.getTime() - STALE_RUN_MS) },
    },
    data: {
      status: 'FAILED',
      finishedAt: now,
      error: 'Interrupted: the worker stopped during this run.',
    },
  });
  if (await db.syncRun.count({ where: { sourceId, status: 'RUNNING' } })) {
    return { skipped: 'already-running' };
  }

  const run = await db.syncRun.create({ data: { sourceId, startedAt: now } });
  if (trigger.kind === 'manual') {
    await recordAudit(db, {
      actorId: trigger.actorId,
      action: 'sync.trigger',
      entityType: 'sync-sources',
      entityId: sourceId,
      after: { runId: run.id, source: source.name },
      ip: trigger.ip,
    });
  }

  const finish = async (data: {
    status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
    seen?: number;
    staged?: number;
    error?: string | null;
  }) => {
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: data.status,
        finishedAt: deps.now?.() ?? new Date(),
        recordsSeen: data.seen ?? 0,
        recordsChanged: data.staged ?? 0,
        error: data.error ?? null,
      },
    });
  };
  const fail = async (error: string): Promise<RunOutcome> => {
    log('sync failed', { source: source.name, error });
    await finish({ status: 'FAILED', error });
    return {
      runId: run.id,
      status: 'FAILED',
      seen: 0,
      staged: 0,
      unchanged: 0,
      duplicates: 0,
      issues: 0,
      error,
    };
  };

  const adapter = getAdapter(source.kind);
  if (!adapter) return fail(`Unknown adapter kind "${source.kind}".`);
  const config = adapter.configSchema.safeParse(source.config);
  if (!config.success) {
    return fail(
      `Invalid source configuration: ${config.error.issues.map((i) => `${i.path.join('.') || 'config'}: ${i.message}`).join('; ')}`,
    );
  }

  let candidates: Candidate[];
  let seen: number;
  try {
    const result = await adapter.run(
      { http: deps.makeHttp(), now, secrets: deps.secrets ?? {} },
      config.data as never,
    );
    candidates = result.candidates;
    seen = result.seen;
  } catch (err) {
    return fail(message(err));
  }
  if (candidates.length > MAX_CANDIDATES) {
    return fail(
      `The source returned ${candidates.length} records; the limit per run is ${MAX_CANDIDATES}.`,
    );
  }

  const known = await knownSlugs(db);
  const nowIso = now.toISOString();
  let staged = 0;
  let unchanged = 0;
  let duplicates = 0;
  const issues: { entityType: string; message: string; payload: object }[] = [];
  const seenKeys = new Set<string>();

  for (const c of candidates) {
    const entity = c.entity;
    if (!isEntity(entity)) {
      issues.push({
        entityType: String(entity),
        message: 'Unsupported record type.',
        payload: c.record,
      });
      continue;
    }
    const def = DEFINITIONS[entity];
    const result = validateBundle(
      { [def.seedFile]: [{ ...c.record, collectedAt: nowIso, isDemo: false }] },
      { allowDemo: false, known },
    );
    if (!result.ok) {
      issues.push({
        entityType: entity,
        message: result.errors
          .map((e) => `${e.path || 'record'}: ${e.message}`)
          .join('; ')
          .slice(0, 1000),
        payload: c.record,
      });
      continue;
    }
    const parsed = (result.bundle[def.seedFile] as unknown as Record<string, unknown>[])[0]!;
    const key = def.keyOf(parsed);
    if (seenKeys.has(`${entity}|${key}`)) {
      duplicates++;
      continue;
    }
    seenKeys.add(`${entity}|${key}`);

    const existingId = await def.findIdByKey(db, parsed);
    const existing = existingId ? await def.get(db, existingId) : null;
    const staging = buildStaging(entity, parsed, existing, key);
    if (!staging) {
      unchanged++;
      continue;
    }
    // The same import (identical payload) already waits for review or was rejected: stay quiet.
    const already = await db.importedRecord.findFirst({
      where: {
        entityType: entity,
        status: { in: ['PENDING', 'REJECTED'] },
        diff: { path: ['hash'], equals: staging.diff.hash },
      },
      select: { id: true },
    });
    if (already) {
      duplicates++;
      continue;
    }
    await db.importedRecord.create({
      data: {
        runId: run.id,
        entityType: entity,
        payload: staging.payload as object,
        diff: staging.diff as unknown as object,
      },
    });
    staged++;
  }

  if (issues.length) {
    await db.syncIssue.createMany({
      data: issues.map((i) => ({
        runId: run.id,
        entityType: i.entityType,
        message: i.message,
        payload: i.payload,
      })),
    });
  }
  const status = issues.length > 0 ? 'PARTIAL' : 'SUCCEEDED';
  await finish({ status, seen, staged });
  log('sync finished', {
    source: source.name,
    status,
    seen,
    staged,
    unchanged,
    duplicates,
    issues: issues.length,
  });
  return {
    runId: run.id,
    status,
    seen,
    staged,
    unchanged,
    duplicates,
    issues: issues.length,
    error: null,
  };
}

/** Enabled sources whose schedule says they are due (used by the worker's scheduler tick). */
export async function dueSources(
  db: PrismaClient,
  now: Date,
  isDue: (schedule: string, last: Date | null, now: Date) => boolean,
): Promise<{ id: string; name: string; lastStartedAt: Date | null }[]> {
  const sources = await db.syncSource.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      schedule: true,
      runs: { orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true } },
    },
  });
  return sources
    .map((s) => ({
      id: s.id,
      name: s.name,
      schedule: s.schedule,
      lastStartedAt: s.runs[0]?.startedAt ?? null,
    }))
    .filter((s) => isDue(s.schedule, s.lastStartedAt, now))
    .map(({ id, name, lastStartedAt }) => ({ id, name, lastStartedAt }));
}

export { protectExisting };
