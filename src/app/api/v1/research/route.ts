import { endpoints } from '@server/api/endpoints';
import { createHandler } from '@server/api/runtime';

// Always rendered on request: the data lives in PostgreSQL, never prerendered at build time.
export const dynamic = 'force-dynamic';

export const GET = createHandler(endpoints.research);
