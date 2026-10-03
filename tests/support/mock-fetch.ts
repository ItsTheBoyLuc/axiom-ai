import { createHttpClient, type HttpClientOptions } from '../../server/adapters/http';

/**
 * A scripted fetch for adapter and sync tests: no network is ever touched. Routes are matched by
 * exact URL (query included); an unmatched URL is a test bug and throws loudly.
 */
export type MockReply =
  { status?: number; body?: string; headers?: Record<string, string> } | Error;

export function mockFetch(routes: Record<string, MockReply>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: { ...((init?.headers as Record<string, string>) ?? {}) } });
    const reply = routes[url];
    if (reply === undefined) throw new Error(`mockFetch: no route for ${url}`);
    if (reply instanceof Error) throw reply;
    return new Response(reply.body ?? '', { status: reply.status ?? 200, headers: reply.headers });
  }) as typeof fetch;
  return { fetch: impl, calls, urls: () => calls.map((c) => c.url) };
}

/** A polite client wired to a scripted fetch; sleeps are instant, DNS says "public". */
export function testHttp(routes: Record<string, MockReply>, over: Partial<HttpClientOptions> = {}) {
  const mock = mockFetch(routes);
  const sleeps: number[] = [];
  const client = createHttpClient({
    userAgent: 'AxiomAI-Sync/test',
    productToken: 'AxiomAI-Sync',
    fetchImpl: mock.fetch,
    lookup: async () => ['93.184.216.34'],
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...over,
  });
  return { client, mock, sleeps };
}

/** Routes for a host that has no robots.txt. */
export const noRobots = (origin: string): Record<string, MockReply> => ({
  [`${origin}/robots.txt`]: { status: 404 },
});
