import { adminRoute } from '@server/admin/handler';
import { deleteSourceRoute, getSourceRoute, updateSourceRoute } from '@server/admin/routes';
import { adminDeps } from '@server/admin/runtime';

// Per-request, per-admin: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = adminRoute(getSourceRoute, adminDeps);
export const PUT = adminRoute(updateSourceRoute, adminDeps);
export const DELETE = adminRoute(deleteSourceRoute, adminDeps);
