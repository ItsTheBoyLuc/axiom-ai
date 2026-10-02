import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself. Load it if present (never overrides real env vars, so
// CI and Docker keep working with plain environment variables).
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env file: rely on the process environment */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `prisma db seed` and `prisma migrate reset` run this (real data only, no demo rows).
    seed: 'tsx prisma/seed/run.ts',
  },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://invalid' },
});
