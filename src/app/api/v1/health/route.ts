import { NextResponse } from 'next/server';
import { checkHealth } from '@server/health';

export const dynamic = 'force-dynamic';

/** GET /api/v1/health - 200 when Postgres and Redis respond, 503 otherwise. Never cached. */
export async function GET() {
  try {
    const report = await checkHealth();
    return NextResponse.json(report, {
      status: report.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[health] unexpected failure', err);
    return NextResponse.json(
      { error: { code: 'HEALTH_CHECK_FAILED', message: 'Health check failed' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
