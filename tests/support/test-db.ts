import { execSync } from 'node:child_process';
import { Client } from 'pg';

/**
 * Helpers for tests that need a real PostgreSQL. They create and migrate SEPARATE databases on
 * the same server as development (axiom_test, axiom_e2e, ...), never touching the dev database.
 */

/** Loads .env if present (never overrides real environment variables). */
export function loadDotEnv() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* no .env: the environment (CI) provides DATABASE_URL and REDIS_URL */
  }
}

const NAME = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * The development server URL that test databases are derived from. Processes whose DATABASE_URL
 * already points at a test database (the e2e web server) pass the original as DB_BASE_URL, so
 * the "never touch the development database" guard below keeps comparing against the real one.
 */
const baseUrl = () => process.env.DB_BASE_URL ?? process.env.DATABASE_URL;

/** Same server and credentials as DATABASE_URL, different database name. */
export function urlForDatabase(name: string, base = baseUrl()): string {
  if (!base) throw new Error('DATABASE_URL is required to run database tests');
  if (!NAME.test(name)) throw new Error(`unsafe database name: ${name}`);
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
}

export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

async function withAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const admin = new Client({
    connectionString: urlForDatabase('postgres'),
    connectionTimeoutMillis: 5_000,
  });
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

/** Creates the database if it does not exist. Refuses to touch the development database. */
export async function ensureDatabase(name: string): Promise<string> {
  if (!NAME.test(name)) throw new Error(`unsafe database name: ${name}`);
  const dev = databaseNameOf(baseUrl() ?? '');
  if (name === dev) throw new Error(`refusing to use the development database "${dev}" for tests`);
  await withAdmin(async (c) => {
    const { rowCount } = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await c.query(`CREATE DATABASE "${name}"`);
  });
  return urlForDatabase(name);
}

export async function dropDatabase(name: string): Promise<void> {
  if (!NAME.test(name)) throw new Error(`unsafe database name: ${name}`);
  const dev = databaseNameOf(baseUrl() ?? '');
  if (name === dev) throw new Error(`refusing to drop the development database "${dev}"`);
  await withAdmin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
}

/** Runs a Prisma CLI command against `url`. Returns stdout; throws with the CLI output on failure. */
export function prisma(args: string, url: string): string {
  try {
    return execSync(`npx prisma ${args}`, {
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    throw new Error(`prisma ${args} failed:\n${e.stdout ?? ''}\n${e.stderr ?? e.message}`);
  }
}

export const migrateDeploy = (url: string) => prisma('migrate deploy', url);

/** Removes every row from every application table (keeps the migration history). */
export async function truncateAll(url: string): Promise<void> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const { rows } = await c.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length) {
      await c.query(
        `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await c.end();
  }
}
