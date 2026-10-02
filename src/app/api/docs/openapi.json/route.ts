import { buildOpenApi } from '@server/api/openapi';

/** GET /api/docs/openapi.json - OpenAPI 3.1 document generated from the Zod schemas. */
export function GET() {
  return Response.json(buildOpenApi(), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
