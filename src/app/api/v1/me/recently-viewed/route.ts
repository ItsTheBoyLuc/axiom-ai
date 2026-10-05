import { listRecentlyViewedRoute, meRoute, recordViewRoute } from '@server/account/routes';
import { meDeps } from '@server/account/runtime';

// Per-request, per-user: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = meRoute(listRecentlyViewedRoute, meDeps);
export const POST = meRoute(recordViewRoute, meDeps);
