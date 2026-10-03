import { adminRoute } from '@server/admin/handler';
import { deleteRecordRoute, getRecordRoute, updateRecordRoute } from '@server/admin/routes';
import { adminDeps } from '@server/admin/runtime';

// Per-request, per-admin: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = adminRoute(getRecordRoute, adminDeps);
export const PUT = adminRoute(updateRecordRoute, adminDeps);
export const DELETE = adminRoute(deleteRecordRoute, adminDeps);
