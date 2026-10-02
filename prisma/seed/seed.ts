import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '../generated/client';
import { buildDemoRaw } from './demo/bundle';
import { loadBundle, type LoadReport } from './load';
import {
  SEED_FILES,
  formatErrors,
  validateBundle,
  type SeedBundle,
  type SeedError,
  type SeedFile,
} from './schemas';

export const DEFAULT_DATA_DIR = path.join(process.cwd(), 'prisma', 'seed', 'data');

/** Thrown when validation fails. Nothing has been written to the database. */
export class SeedValidationError extends Error {
  constructor(
    public readonly errors: SeedError[],
    public readonly source: 'data' | 'demo',
  ) {
    super(
      `Seed ${source} validation failed with ${errors.length} error(s):\n${formatErrors(errors)}`,
    );
    this.name = 'SeedValidationError';
  }
}

/** Reads prisma/seed/data/*.json. A missing file means "no records"; bad JSON is an error. */
export function readSeedDir(dir: string): {
  raw: Partial<Record<SeedFile, unknown>>;
  errors: SeedError[];
} {
  const raw: Partial<Record<SeedFile, unknown>> = {};
  const errors: SeedError[] = [];
  for (const file of Object.keys(SEED_FILES) as SeedFile[]) {
    const p = path.join(dir, `${file}.json`);
    if (!existsSync(p)) continue;
    try {
      raw[file] = JSON.parse(readFileSync(p, 'utf-8'));
    } catch (err) {
      errors.push({
        file,
        index: null,
        path: '',
        message: `invalid JSON: ${(err as Error).message}`,
      });
    }
  }
  return { raw, errors };
}

export type SeedOptions = {
  dataDir?: string;
  /**
   * Load prisma/seed/data (default true). Test harnesses pass false so they run on the fictional
   * fixtures only and never depend on the real catalogue.
   */
  realData?: boolean;
  /** Also load the fictional demo fixtures (SEED_DEMO=true). Off by default: real DBs stay demo-free. */
  demo?: boolean;
};

export type SeedResult = { data: LoadReport; demo: LoadReport | null };

/**
 * Validates first, writes second. Real data files are validated with demo records FORBIDDEN;
 * demo fixtures are validated separately and loaded after (they cannot overwrite real data).
 */
export async function runSeed(db: PrismaClient, opts: SeedOptions = {}): Promise<SeedResult> {
  const { raw, errors: readErrors } =
    opts.realData === false
      ? { raw: {}, errors: [] as SeedError[] }
      : readSeedDir(opts.dataDir ?? DEFAULT_DATA_DIR);
  const dataResult = readErrors.length
    ? ({ ok: false, errors: readErrors } as const)
    : validateBundle(raw, { allowDemo: false });
  if (!dataResult.ok) throw new SeedValidationError(dataResult.errors, 'data');

  let demoBundle: SeedBundle | null = null;
  if (opts.demo) {
    const demoResult = validateBundle(buildDemoRaw(), { allowDemo: true });
    if (!demoResult.ok) throw new SeedValidationError(demoResult.errors, 'demo');
    demoBundle = demoResult.bundle;
  }

  const data = await loadBundle(db, dataResult.bundle);
  const demo = demoBundle ? await loadBundle(db, demoBundle) : null;
  return { data, demo };
}
