import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getModelRepository } from '../../../../../../server/repositories/model-repository';
import { MAX_Q_LENGTH } from '@/lib/models/query';

const schema = z.object({
  q: z.string().trim().min(1).max(MAX_Q_LENGTH),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

/** GET /api/v1/models/suggest?q=...&limit=6 - search-box suggestions (error envelope per spec). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    q: searchParams.get('q') ?? '',
    limit: searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid search query',
          details: parsed.error.issues.map((i) => i.message),
        },
      },
      { status: 400 },
    );
  }
  try {
    const suggestions = await getModelRepository().suggest(parsed.data.q, parsed.data.limit);
    return NextResponse.json(
      { data: suggestions },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
    );
  } catch (err) {
    console.error('[models/suggest] failed', err);
    return NextResponse.json(
      { error: { code: 'SUGGEST_FAILED', message: 'Could not load suggestions' } },
      { status: 500 },
    );
  }
}
