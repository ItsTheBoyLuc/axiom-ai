import { NextResponse } from 'next/server';
import { getStats } from '../../../../../server/services/stats';

/** GET /api/v1/stats - platform statistics (demo values flagged with isDemo). */
export async function GET() {
  try {
    return NextResponse.json(await getStats(), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[stats] failed', err);
    return NextResponse.json(
      { error: { code: 'STATS_FAILED', message: 'Could not load statistics' } },
      { status: 500 },
    );
  }
}
