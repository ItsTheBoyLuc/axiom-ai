import { handleMe } from '@server/auth/handlers';
import { authDeps } from '@server/auth/runtime';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleMe(request, authDeps());
