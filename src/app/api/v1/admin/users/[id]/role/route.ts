import { adminRoute } from '@server/admin/handler';
import { setUserRoleRoute } from '@server/admin/routes';
import { adminDeps } from '@server/admin/runtime';

// Per-request, per-admin: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const PUT = adminRoute(setUserRoleRoute, adminDeps);
