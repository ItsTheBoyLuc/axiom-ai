import { getPrisma, type Db } from '../db/client';
import type {
  BenchmarkRepository,
  NewsRepository,
  ProviderRepository,
  ReleaseRepository,
  SearchRepository,
} from './catalog';
import type { ModelRepository } from './model-repository';
import {
  createPrismaBenchmarkRepository,
  createPrismaNewsRepository,
  createPrismaProviderRepository,
  createPrismaReleaseRepository,
  createPrismaSearchRepository,
} from './prisma/catalog-repositories';
import { createPrismaModelRepository } from './prisma/model-repository';

export type Repositories = {
  models: ModelRepository;
  providers: ProviderRepository;
  benchmarks: BenchmarkRepository;
  releases: ReleaseRepository;
  news: NewsRepository;
  search: SearchRepository;
};

/** Wires every repository to one database client (tests pass their own client). */
export function createRepositories(db: Db): Repositories {
  const models = createPrismaModelRepository(db);
  return {
    models,
    providers: createPrismaProviderRepository(db),
    benchmarks: createPrismaBenchmarkRepository(db),
    releases: createPrismaReleaseRepository(db),
    news: createPrismaNewsRepository(db),
    search: createPrismaSearchRepository(db, models),
  };
}

let instance: Repositories | undefined;

/** Process-wide repositories backed by the shared Prisma client. */
export function getRepositories(): Repositories {
  instance ??= createRepositories(getPrisma());
  return instance;
}
