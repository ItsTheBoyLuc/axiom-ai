import { ensureDatabase, loadDotEnv, migrateDeploy } from '../support/test-db';

/**
 * Runs once before the integration suite: creates the dedicated test database (never the
 * development one), applies every migration to it, and points DATABASE_URL at it for all
 * workers so nothing can accidentally reach development data.
 */
export default async function globalSetup() {
  loadDotEnv();
  const name = process.env.TEST_DATABASE_NAME ?? 'axiom_test';
  const url = await ensureDatabase(name);
  migrateDeploy(url);
  process.env.TEST_DATABASE_URL = url;
  process.env.DATABASE_URL = url;
}
