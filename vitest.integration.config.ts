import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Integration tests: real PostgreSQL (migrations applied to a dedicated test database) and real
 * Redis. Files run one at a time because they share that database. See tests/integration/.
 */
export default defineConfig({
  resolve: { alias: { '@': dir('./src'), '@server': dir('./server') } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
