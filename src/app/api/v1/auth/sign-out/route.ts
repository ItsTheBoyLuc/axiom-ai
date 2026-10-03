import { handleSignOut } from '@server/auth/handlers';
import { authDeps } from '@server/auth/runtime';

export const dynamic = 'force-dynamic';

export const POST = (request: Request) => handleSignOut(request, authDeps());
