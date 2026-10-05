import { getPreferencesRoute, meRoute, putPreferencesRoute } from '@server/account/routes';
import { meDeps } from '@server/account/runtime';

// Per-request, per-user: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = meRoute(getPreferencesRoute, meDeps);
export const PUT = meRoute(putPreferencesRoute, meDeps);
