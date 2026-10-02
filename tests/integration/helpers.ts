import { PrismaClient, createAdapter, createPrisma } from '../../server/db/client';
import { runSeed } from '../../prisma/seed/seed';
import { truncateAll } from '../support/test-db';

export const testUrl = () => process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!;

/** A client for the dedicated test database. Remember to `$disconnect()` in afterAll. */
export const newDb = () => createPrisma(testUrl());

export const resetDb = () => truncateAll(testUrl());

/** Loads the fictional demo fixtures (the 16 Sample Models) into the test database. */
export async function seedDemo(db: PrismaClient) {
  await resetDb();
  return runSeed(db, { demo: true });
}

/** A client that records every SQL statement it runs, to assert query counts and columns. */
export function queryLoggingDb() {
  const queries: string[] = [];
  const client = new PrismaClient({
    adapter: createAdapter(testUrl()),
    log: [{ emit: 'event', level: 'query' }],
  });
  client.$on('query', (e) => {
    queries.push(e.query);
  });
  return { client, queries };
}

export { PrismaClient };
