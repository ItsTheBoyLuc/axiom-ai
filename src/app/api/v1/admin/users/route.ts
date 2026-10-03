import { adminRoute } from '@server/admin/handler';
import { listUsersRoute } from '@server/admin/routes';
import { adminDeps } from '@server/admin/runtime';

// Per-request, per-admin: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = adminRoute(listUsersRoute, adminDeps);
