import { adminRoute } from '@server/admin/handler';
import { revokeSessionsRoute } from '@server/admin/routes';
import { adminDeps } from '@server/admin/runtime';

// Per-request, per-admin: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const DELETE = adminRoute(revokeSessionsRoute, adminDeps);
