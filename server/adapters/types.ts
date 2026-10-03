import type { z } from 'zod';
import type { SeedFile } from '../../prisma/seed/schemas';
import type { HttpClient } from './http';

/**
 * A sync adapter turns ONE external source (an official feed or API) into candidate records in
 * the same shape as seed files. It never writes to the database: the pipeline (server/jobs)
 * validates every candidate with the seed schemas, diffs it against what is stored and stages
 * it for admin approval (docs/PROMPT.md 9 and 11).
 */

export type Candidate = {
  /** Which seed file (entity) this record belongs to. */
  entity: SeedFile;
  /** Seed-shaped record WITHOUT collectedAt / isDemo (the pipeline sets them). */
  record: Record<string, unknown>;
};

export type AdapterContext = {
  http: HttpClient;
  now: Date;
  /** Optional credentials, read from the environment by the runtime; never logged or staged. */
  secrets: { githubToken?: string };
};

export type AdapterResult = {
  candidates: Candidate[];
  /** How many items the source returned (before any filtering). */
  seen: number;
};

export type Adapter<C = unknown> = {
  kind: string;
  label: string;
  /** One-paragraph help and an example config shown in the admin form. */
  help: string;
  exampleConfig: Record<string, unknown>;
  configSchema: z.ZodType<C>;
  run(ctx: AdapterContext, config: C): Promise<AdapterResult>;
};
