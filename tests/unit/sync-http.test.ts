import { describe, expect, it } from 'vitest';
import { HttpError } from '../../server/adapters/http';
import { noRobots, testHttp } from '../support/mock-fetch';

const O = 'https://example.com';
const reject = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (e: unknown) => e,
  )) as HttpError | null;

describe('polite HTTP client', () => {
  it('reads robots.txt first, identifies itself, then fetches', async () => {
    const { client, mock } = testHttp({ ...noRobots(O), [`${O}/feed`]: { body: 'hello' } });
    const res = await client.get(`${O}/feed`);
    expect(res.text).toBe('hello');
    expect(mock.urls()).toEqual([`${O}/robots.txt`, `${O}/feed`]);
    expect(mock.calls[1]!.headers['User-Agent']).toBe('AxiomAI-Sync/test');
  });

  it('caches robots.txt per origin for the client lifetime', async () => {
    const { client, mock } = testHttp({
      ...noRobots(O),
      [`${O}/a`]: { body: 'a' },
      [`${O}/b`]: { body: 'b' },
    });
    await client.get(`${O}/a`);
    await client.get(`${O}/b`);
    expect(mock.urls().filter((u) => u.endsWith('robots.txt'))).toHaveLength(1);
    expect(client.requestCount()).toBe(3);
  });

  it('does not fetch a path robots.txt disallows', async () => {
    const { client, mock } = testHttp({
      [`${O}/robots.txt`]: { body: 'User-agent: *\nDisallow: /private' },
      [`${O}/private/feed`]: { body: 'secret' },
    });
    const err = await reject(client.get(`${O}/private/feed`));
    expect(err).toMatchObject({ kind: 'robots' });
    expect(mock.urls()).toEqual([`${O}/robots.txt`]);
  });

  it('treats a missing robots.txt (404) as allow-all, but an erroring one (5xx / network) as disallow', async () => {
    const ok = testHttp({ ...noRobots(O), [`${O}/x`]: { body: 'x' } });
    await expect(ok.client.get(`${O}/x`)).resolves.toMatchObject({ text: 'x' });

    const five = testHttp({ [`${O}/robots.txt`]: { status: 503 }, [`${O}/x`]: { body: 'x' } });
    expect(await reject(five.client.get(`${O}/x`))).toMatchObject({ kind: 'robots' });

    const down = testHttp({
      [`${O}/robots.txt`]: new Error('ECONNRESET'),
      [`${O}/x`]: { body: 'x' },
    });
    expect(await reject(down.client.get(`${O}/x`))).toMatchObject({ kind: 'robots' });
  });

  it('follows redirects but re-checks robots.txt and safety on every hop', async () => {
    const other = 'https://other.example';
    const { client, mock } = testHttp({
      ...noRobots(O),
      [`${O}/old`]: { status: 301, headers: { location: `${other}/new` } },
      [`${other}/robots.txt`]: { body: 'User-agent: *\nDisallow: /' },
      [`${other}/new`]: { body: 'never fetched' },
    });
    expect(await reject(client.get(`${O}/old`))).toMatchObject({ kind: 'robots' });
    expect(mock.urls()).not.toContain(`${other}/new`);

    const ok = testHttp({
      ...noRobots(O),
      [`${O}/old`]: { status: 302, headers: { location: '/new' } },
      [`${O}/new`]: { body: 'moved' },
    });
    expect((await ok.client.get(`${O}/old`)).text).toBe('moved');
  });

  it('refuses a redirect that points at a private address', async () => {
    const { client } = testHttp({
      ...noRobots(O),
      [`${O}/r`]: {
        status: 302,
        headers: { location: 'https://169.254.169.254/latest/meta-data/' },
      },
    });
    expect(await reject(client.get(`${O}/r`))).toMatchObject({ kind: 'unsafe' });
  });

  it('stops after 3 redirects', async () => {
    const routes: Record<string, { status: number; headers: Record<string, string> }> = {};
    for (let i = 0; i < 6; i++)
      routes[`${O}/r${i}`] = { status: 302, headers: { location: `/r${i + 1}` } };
    const { client } = testHttp({ ...noRobots(O), ...routes });
    expect(await reject(client.get(`${O}/r0`))).toMatchObject({
      kind: 'network',
      message: /redirects/,
    });
  });

  it('reports HTTP errors with the status, timeouts, and oversized bodies', async () => {
    const { client } = testHttp({
      ...noRobots(O),
      [`${O}/404`]: { status: 404 },
      [`${O}/500`]: { status: 500 },
      [`${O}/slow`]: Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }),
      [`${O}/big`]: { body: 'x'.repeat(2000) },
    });
    expect(await reject(client.get(`${O}/404`))).toMatchObject({ kind: 'status', status: 404 });
    expect(await reject(client.get(`${O}/500`))).toMatchObject({ kind: 'status', status: 500 });
    expect(await reject(client.get(`${O}/slow`))).toMatchObject({ kind: 'timeout' });

    const small = testHttp(
      { ...noRobots(O), [`${O}/big`]: { body: 'x'.repeat(2000) } },
      { maxBytes: 1000 },
    );
    expect(await reject(small.client.get(`${O}/big`))).toMatchObject({ kind: 'size' });
  });

  it('spaces requests to the same host, and honours Crawl-delay', async () => {
    let t = 1_000_000;
    const { client, sleeps } = testHttp(
      { ...noRobots(O), [`${O}/a`]: { body: 'a' }, [`${O}/b`]: { body: 'b' } },
      { minDelayMs: 1000, now: () => t },
    );
    await client.get(`${O}/a`);
    t += 200; // only 200 ms later
    await client.get(`${O}/b`);
    expect(sleeps.at(-1)).toBeGreaterThan(0);
    expect(sleeps.at(-1)).toBeLessThanOrEqual(1000);

    const slow = testHttp(
      {
        [`${O}/robots.txt`]: { body: 'User-agent: *\nCrawl-delay: 5' },
        [`${O}/a`]: { body: 'a' },
        [`${O}/b`]: { body: 'b' },
      },
      { minDelayMs: 1000, now: () => t },
    );
    await slow.client.get(`${O}/a`);
    await slow.client.get(`${O}/b`);
    expect(slow.sleeps.at(-1)).toBeGreaterThan(1000); // longer than the default spacing
  });

  it('refuses unsafe destinations before any request is made', async () => {
    const { client, mock } = testHttp({});
    for (const url of [
      'http://example.com/',
      'https://localhost/',
      'https://10.0.0.1/',
      'not a url',
    ]) {
      expect(await reject(client.get(url)), url).toMatchObject({ kind: 'unsafe' });
    }
    expect(mock.calls).toHaveLength(0);
  });

  it('getJson parses JSON and rejects anything else', async () => {
    const { client } = testHttp({
      ...noRobots(O),
      [`${O}/ok`]: { body: '{"a":1}' },
      [`${O}/bad`]: { body: '<html>' },
    });
    expect(await client.getJson(`${O}/ok`)).toEqual({ a: 1 });
    expect(await reject(client.getJson(`${O}/bad`))).toBeInstanceOf(HttpError);
  });
});
