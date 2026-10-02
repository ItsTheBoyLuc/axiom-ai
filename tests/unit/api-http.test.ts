import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildCompareRows } from '../../server/api/compare-csv';
import { csvCell, toCsv } from '../../server/api/csv';
import {
  ApiError,
  cachedResponse,
  errorResponse,
  etagMatches,
  etagOf,
  parseQuery,
  toErrorResponse,
} from '../../server/api/http';
import { demoModelDetails } from '../../prisma/seed/demo/models';

const req = (headers: Record<string, string> = {}) =>
  new Request('http://x.test/api/v1/a', { headers });

describe('csv', () => {
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(true)).toBe('true');
  });

  it('neutralises spreadsheet formula injection', () => {
    for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) {
      expect(csvCell(evil).replace(/^"/, '')).toMatch(/^'/);
    }
    expect(csvCell('=HYPERLINK("http://e.test","x")')).toBe(
      `"'=HYPERLINK(""http://e.test"",""x"")"`,
    );
  });

  it('leaves real negative numbers alone', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(0.25)).toBe('0.25');
  });

  it('joins rows with CRLF and ends with a newline', () => {
    expect(
      toCsv([
        ['a', 'b'],
        [1, 2],
      ]),
    ).toBe('a,b\r\n1,2\r\n');
  });
});

describe('comparison CSV rows', () => {
  const pick = (...slugs: string[]) =>
    slugs.map((s) => demoModelDetails.find((m) => m.slug === s)!);

  it('has one column per model and a header row', () => {
    const rows = buildCompareRows(pick('sample-model-1', 'sample-model-2'));
    expect(rows[0]).toEqual(['Attribute', 'Sample Model 1', 'Sample Model 2']);
    expect(rows.every((r) => r.length === 3)).toBe(true);
  });

  it('writes "Not publicly disclosed" for missing values, never blank or zero', () => {
    const rows = buildCompareRows(pick('sample-model-14'));
    const cell = (label: string) => rows.find((r) => r[0] === label)![1];
    expect(cell('Context window (tokens)')).toBe('Not publicly disclosed');
    expect(cell('Max output (tokens)')).toBe('Not publicly disclosed');
    expect(cell('Input price')).toBe('Not publicly disclosed');
    expect(cell('Knowledge cutoff')).toBe('Not publicly disclosed');
  });

  it('lists each benchmark on its own row with evaluation type and date, and "No verified data" gaps', () => {
    const rows = buildCompareRows(pick('sample-model-2', 'sample-model-14'));
    const b1 = rows.find((r) => r[0] === 'Benchmark: Sample Benchmark 1')!;
    // newest result for model 2 is the independent 74%, not the older provider-reported 78%
    expect(b1[1]).toMatch(/^74%.*independent.*2026-07-15/);
    expect(b1[2]).toBe('No verified data');
    expect(rows.filter((r) => String(r[0]).startsWith('Benchmark:')).length).toBeGreaterThanOrEqual(
      2,
    );
    // never a blended score row
    expect(rows.some((r) => /overall|average|combined/i.test(String(r[0])))).toBe(false);
  });

  it('flags demo data', () => {
    const rows = buildCompareRows(pick('sample-model-1'));
    expect(rows.find((r) => r[0] === 'Demo data')![1]).toBe('Yes');
  });
});

describe('ETag and conditional requests', () => {
  it('produces stable strong ETags', () => {
    expect(etagOf('abc')).toBe(etagOf('abc'));
    expect(etagOf('abc')).not.toBe(etagOf('abd'));
    expect(etagOf('abc')).toMatch(/^"[A-Za-z0-9_-]+"$/);
  });

  it('matches exact, weak, listed and wildcard If-None-Match values', () => {
    const e = etagOf('x');
    expect(etagMatches(e, e)).toBe(true);
    expect(etagMatches(`W/${e}`, e)).toBe(true);
    expect(etagMatches(`"other", ${e}`, e)).toBe(true);
    expect(etagMatches('*', e)).toBe(true);
    expect(etagMatches('"nope"', e)).toBe(false);
    expect(etagMatches(null, e)).toBe(false);
  });

  it('answers 304 with no body when the ETag matches, 200 otherwise', async () => {
    const policy = { maxAge: 60, swr: 300 };
    const first = cachedResponse(req(), { a: 1 }, { policy });
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    const etag = first.headers.get('etag')!;
    const again = cachedResponse(req({ 'If-None-Match': etag }), { a: 1 }, { policy });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    expect(again.headers.get('etag')).toBe(etag);
    expect(cachedResponse(req({ 'If-None-Match': etag }), { a: 2 }, { policy }).status).toBe(200);
  });

  it('supports no-store and custom content types', () => {
    const r = cachedResponse(req(), 'a,b', { policy: 'no-store', contentType: 'text/csv' });
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('content-type')).toBe('text/csv');
  });
});

describe('errors', () => {
  it('uses the spec envelope and is never cacheable', async () => {
    const r = errorResponse(400, 'INVALID_QUERY', 'bad', [{ path: 'q' }]);
    expect(r.status).toBe(400);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({
      error: { code: 'INVALID_QUERY', message: 'bad', details: [{ path: 'q' }] },
    });
    expect(await errorResponse(404, 'NOT_FOUND', 'nope').json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'nope' },
    });
  });

  it('maps ApiError to its status and hides unexpected errors', async () => {
    expect((await toErrorResponse(new ApiError(404, 'NOT_FOUND', 'gone')).json()).error.code).toBe(
      'NOT_FOUND',
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = toErrorResponse(new Error('password=hunter2 in stack'));
    const body = await r.json();
    expect(r.status).toBe(500);
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('parseQuery', () => {
  const schema = z.strictObject({ page: z.string().optional() });

  it('rejects unknown parameters so typos cannot silently return unfiltered data', () => {
    expect(() => parseQuery(schema, new URL('http://x.test/?pagee=2'))).toThrow(ApiError);
    try {
      parseQuery(schema, new URL('http://x.test/?pagee=2'));
    } catch (e) {
      expect((e as ApiError).status).toBe(400);
      expect((e as ApiError).code).toBe('INVALID_QUERY');
    }
  });

  it('uses the first value of a repeated parameter', () => {
    expect(parseQuery(schema, new URL('http://x.test/?page=1&page=2'))).toEqual({ page: '1' });
  });
});
