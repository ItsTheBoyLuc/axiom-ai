import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection URL from here, not from schema.prisma.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://invalid' },
});
