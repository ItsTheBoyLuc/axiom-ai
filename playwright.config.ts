import { defineConfig } from '@playwright/test';
import { loadDotEnv, urlForDatabase } from './tests/support/test-db';

loadDotEnv();

const PORT = Number(process.env.E2E_PORT ?? 3210);
// The app under test reads a dedicated database that prepare-db.ts migrates and seeds.
const E2E_DATABASE_URL = urlForDatabase('axiom_e2e');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, browserName: 'chromium' },
  // Serves the production build. ENABLE_DESIGN_PAGE exposes /design for the scans.
  webServer: {
    // Prepare the database first (Playwright starts webServer before globalSetup), then serve.
    command: `npx tsx tests/e2e/prepare-db.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false, // always start against the e2e database, never a stale server
    env: {
      // The original (development) URL, so prepare-db can derive and safeguard test databases.
      DB_BASE_URL: process.env.DB_BASE_URL ?? process.env.DATABASE_URL ?? '',
      ENABLE_DESIGN_PAGE: 'true',
      APP_URL: `http://localhost:${PORT}`,
      DATABASE_URL: E2E_DATABASE_URL,
    },
    timeout: 120_000,
  },
});
