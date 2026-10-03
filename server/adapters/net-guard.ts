import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for the sync fetcher. Source URLs are entered by admins, but a mistaken or
 * compromised entry must not be able to make the worker call internal services (cloud metadata,
 * localhost, the database network). Only https on the default port to PUBLIC addresses is
 * allowed. Known limit: the name is resolved here and again by fetch, so a hostile DNS server
 * could answer differently the second time; the deployment guide therefore also recommends an
 * egress firewall for the worker.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const v4 = (a: string): number[] => a.split('.').map(Number);

/** True for loopback, private, link-local, CGNAT, reserved and multicast addresses. */
export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = v4(address) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (kind === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return (
      lower === '::' ||
      lower === '::1' ||
      /^f[cd]/.test(lower) || // fc00::/7 unique local
      /^fe[89ab]/.test(lower) || // fe80::/10 link local
      /^ff/.test(lower) // multicast
    );
  }
  return true; // not an IP at all: never treat as public
}

export type Lookup = (host: string) => Promise<string[]>;
export const dnsLookup: Lookup = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

/**
 * Throws UnsafeUrlError unless the URL is safe to fetch. `allowInsecure` is for tests only: it
 * permits http and non-public hosts (the mock server runs on localhost).
 */
export async function assertSafeUrl(
  url: URL,
  resolve: Lookup = dnsLookup,
  allowInsecure = false,
): Promise<void> {
  if (allowInsecure) return;
  if (url.protocol !== 'https:') throw new UnsafeUrlError('Only https URLs are allowed.');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are refused.');
  if (url.port && url.port !== '443')
    throw new UnsafeUrlError('Only the default https port is allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('That host is not allowed.');
  }
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0) throw new UnsafeUrlError('The host did not resolve.');
  if (addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError('That host resolves to a private or reserved address.');
  }
}
