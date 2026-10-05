import { deleteAccountRoute, meRoute } from '@server/account/routes';
import { meDeps } from '@server/account/runtime';

// Per-request, per-user: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const DELETE = meRoute(deleteAccountRoute, meDeps);
