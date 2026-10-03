import { allowAll, disallowAll, isAllowed, parseRobots, type RobotsRules } from './robots';
import { assertSafeUrl, dnsLookup, UnsafeUrlError, type Lookup } from './net-guard';

/**
 * The only way adapters reach the network. It is polite and defensive by construction:
 * robots.txt is honoured (per origin, cached for the client's lifetime, redirects included),
 * requests to one host are spaced out (and Crawl-delay is respected), every request has a timeout
 * and a response size cap, redirects are followed manually (max 3) with every hop re-checked, and
 * URLs that point at private or non-https destinations are refused (see net-guard.ts).
 */

export type HttpErrorKind = 'robots' | 'unsafe' | 'timeout' | 'status' | 'size' | 'network';

export class HttpError extends Error {
  constructor(
    public readonly kind: HttpErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export type HttpClientOptions = {
  /** Full User-Agent header, identifying the project and a contact. */
  userAgent: string;
  /** Token matched against robots.txt groups, e.g. "AxiomAI-Sync". */
  productToken: string;
  fetchImpl?: typeof fetch;
  minDelayMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Tests only: allow http and non-public hosts. */
  allowInsecure?: boolean;
  lookup?: Lookup;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type HttpResponse = { status: number; text: string; headers: Headers; url: string };

export type HttpClient = {
  get(
    url: string,
    init?: { accept?: string; headers?: Record<string, string> },
  ): Promise<HttpResponse>;
  getJson<T = unknown>(url: string, init?: { headers?: Record<string, string> }): Promise<T>;
  /** Requests actually sent (robots.txt included), for run statistics and tests. */
  readonly requestCount: () => number;
};

export const DEFAULT_MIN_DELAY_MS = 1_000;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const minDelay = opts.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? 3;
  const resolve = opts.lookup ?? dnsLookup;

  const lastRequest = new Map<string, number>();
  const robots = new Map<string, Promise<RobotsRules>>();
  let requests = 0;

  /** Waits so that two requests to the same host are at least `delay` ms apart. */
  async function throttle(host: string, delay: number) {
    const last = lastRequest.get(host);
    if (last !== undefined) {
      const wait = last + delay - now();
      if (wait > 0) await sleep(wait);
    }
    lastRequest.set(host, now());
  }

  async function readCapped(res: Response): Promise<string> {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError('size', `The response is larger than ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
  }

  async function rawGet(url: URL, headers: Record<string, string>, delay: number) {
    await throttle(url.host, delay);
    requests++;
    try {
      return await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': opts.userAgent, ...headers },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new HttpError('timeout', `Timed out after ${timeoutMs} ms.`);
      }
      throw new HttpError('network', err instanceof Error ? err.message : 'Network error');
    }
  }

  function rulesFor(origin: URL): Promise<RobotsRules> {
    const key = origin.origin;
    let pending = robots.get(key);
    if (!pending) {
      pending = (async () => {
        const res = await rawGet(
          new URL('/robots.txt', origin),
          { Accept: 'text/plain' },
          minDelay,
        ).catch(() => null);
        if (!res) return disallowAll(); // unreachable: assume disallowed (RFC 9309 2.3.1.4)
        if (res.status >= 500) {
          await res.body?.cancel().catch(() => undefined);
          return disallowAll();
        }
        if (res.status >= 400 || (res.status >= 300 && res.status < 400)) {
          await res.body?.cancel().catch(() => undefined);
          return allowAll(); // no robots.txt: no restrictions
        }
        const text = await readCapped(res).catch(() => '');
        return parseRobots(text, opts.productToken);
      })();
      robots.set(key, pending);
    }
    return pending;
  }

  async function get(
    rawUrl: string,
    init: { accept?: string; headers?: Record<string, string> } = {},
  ): Promise<HttpResponse> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new HttpError('unsafe', `Not a valid URL: ${rawUrl}`);
    }

    for (let hop = 0; hop <= maxRedirects; hop++) {
      try {
        await assertSafeUrl(url, resolve, opts.allowInsecure);
      } catch (err) {
        if (err instanceof UnsafeUrlError) throw new HttpError('unsafe', err.message);
        throw err;
      }
      const rules = await rulesFor(url);
      if (!isAllowed(rules, url.pathname + url.search)) {
        throw new HttpError('robots', `robots.txt of ${url.origin} disallows ${url.pathname}.`);
      }
      const delay = Math.max(minDelay, (rules.crawlDelaySeconds ?? 0) * 1000);
      const res = await rawGet(url, { Accept: init.accept ?? '*/*', ...init.headers }, delay);

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        await res.body?.cancel().catch(() => undefined);
        if (hop === maxRedirects) throw new HttpError('network', 'Too many redirects.');
        url = new URL(res.headers.get('location')!, url);
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        await res.body?.cancel().catch(() => undefined);
        throw new HttpError(
          'status',
          `HTTP ${res.status} from ${url.origin}${url.pathname}`,
          res.status,
        );
      }
      return {
        status: res.status,
        text: await readCapped(res),
        headers: res.headers,
        url: url.href,
      };
    }
    throw new HttpError('network', 'Too many redirects.');
  }

  return {
    get,
    async getJson<T>(url: string, init: { headers?: Record<string, string> } = {}) {
      const res = await get(url, { accept: 'application/json', headers: init.headers });
      try {
        return JSON.parse(res.text) as T;
      } catch {
        throw new HttpError('network', 'The response was not valid JSON.');
      }
    },
    requestCount: () => requests,
  };
}
