import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { getEnv } from '../../src/lib/env';

export { PrismaClient };
export type { Prisma } from '../../prisma/generated/client';

/**
 * The delegates the repositories use. Typing against this (instead of the full PrismaClient
 * generic) lets tests pass a client configured with query-event logging.
 */
export type Db = Pick<
  PrismaClient,
  | 'model'
  | 'provider'
  | 'benchmark'
  | 'benchmarkResult'
  | 'release'
  | 'newsArticle'
  | 'publication'
  | 'capability'
  | 'modelCapability'
  | 'pricing'
  | '$queryRaw'
  | '$transaction'
>;

/** Builds a client with a bounded pg pool (Prisma 7 talks to Postgres through the pg adapter). */
export function createAdapter(connectionString: string) {
  return new PrismaPg({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export function createPrisma(connectionString: string = getEnv().DATABASE_URL): PrismaClient {
  return new PrismaClient({ adapter: createAdapter(connectionString) });
}

/** One client per process (survives Next.js dev hot reloads). */
const globalForPrisma = globalThis as unknown as { __axiomPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  globalForPrisma.__axiomPrisma ??= createPrisma();
  return globalForPrisma.__axiomPrisma;
}
