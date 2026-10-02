import type {
  BenchmarkOption,
  ModelDetail,
  ModelListItem,
  ModelListResult,
  ModelQuery,
  ModelSuggestion,
} from '../../src/types/model';
import { getPrisma } from '../db/client';
import { createPrismaModelRepository } from './prisma/model-repository';

export type ModelStats = {
  total: number;
  releasedThisMonth: number;
  recentlyUpdated: number;
  benchmarks: number;
  isDemo: boolean;
  /** ISO timestamp of the newest data update, or null when nothing is loaded. */
  lastDataUpdate: string | null;
};

/**
 * Data access contract for models. UI code and route handlers depend only on this; the
 * PostgreSQL implementation lives in ./prisma/, and tests use an in-memory reference
 * implementation (tests/support) to prove both behave the same.
 */
export interface ModelRepository {
  list(query: ModelQuery): Promise<ModelListResult>;
  getBySlug(slug: string): Promise<ModelDetail | null>;
  /** Details for several models in one round trip, in the requested order (unknown slugs are skipped). */
  getManyBySlugs(slugs: string[]): Promise<ModelDetail[]>;
  suggest(q: string, limit?: number): Promise<ModelSuggestion[]>;
  related(slug: string, limit?: number): Promise<ModelListItem[]>;
  benchmarks(): Promise<BenchmarkOption[]>;
  slugs(): Promise<string[]>;
  /** Models shown on the homepage. */
  featured(limit: number): Promise<ModelListItem[]>;
  stats(now?: Date): Promise<ModelStats>;
}

let instance: ModelRepository | undefined;

export function getModelRepository(): ModelRepository {
  instance ??= createPrismaModelRepository(getPrisma());
  return instance;
}
