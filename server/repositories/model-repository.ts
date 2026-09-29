import type {
  BenchmarkOption,
  ModelDetail,
  ModelListItem,
  ModelListResult,
  ModelQuery,
  ModelSuggestion,
} from '../../src/types/model';
import { demoModelRepository } from './demo/demo-model-repository';

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
 * Data access contract for models. UI code and route handlers depend only on this.
 * Phase 3 adds a Prisma implementation and switches getModelRepository(); nothing else changes.
 */
export interface ModelRepository {
  list(query: ModelQuery): Promise<ModelListResult>;
  getBySlug(slug: string): Promise<ModelDetail | null>;
  suggest(q: string, limit?: number): Promise<ModelSuggestion[]>;
  related(slug: string, limit?: number): Promise<ModelListItem[]>;
  benchmarks(): Promise<BenchmarkOption[]>;
  slugs(): Promise<string[]>;
  /** Models shown on the homepage. */
  featured(limit: number): Promise<ModelListItem[]>;
  stats(now?: Date): Promise<ModelStats>;
}

export function getModelRepository(): ModelRepository {
  return demoModelRepository;
}
