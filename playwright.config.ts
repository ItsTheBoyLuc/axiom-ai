import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, browserName: 'chromium' },
  // Serves the production build. ENABLE_DESIGN_PAGE exposes /design for the scans.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { ENABLE_DESIGN_PAGE: 'true', APP_URL: `http://localhost:${PORT}` },
    timeout: 120_000,
  },
});
