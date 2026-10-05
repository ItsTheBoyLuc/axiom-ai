import { handleSession } from '@server/auth/handlers';
import { authDeps } from '@server/auth/runtime';

// Per-request, per-user: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleSession(request, authDeps());
