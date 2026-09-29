import { NextResponse } from 'next/server';
import { getStats } from '../../../../../server/services/stats';

/** GET /api/v1/stats - platform statistics (demo values flagged with isDemo). */
export function GET() {
  return NextResponse.json(getStats(), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
