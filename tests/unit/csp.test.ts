import { describe, expect, it } from 'vitest';
import { buildCsp, HSTS_VALUE, newNonce } from '@/lib/security/csp';

describe('buildCsp', () => {
  const csp = buildCsp({ nonce: 'abc123' });
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  it('allows scripts only from self and the request nonce, never inline or eval', () => {
    const script = directive('script-src');
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain('unsafe-inline');
    expect(script).not.toContain('unsafe-eval');
  });

  it('locks down framing, plugins, base and forms', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it('allows inline style attributes only, not inline <style> elements, in production', () => {
    expect(directive('style-src')).toBe("style-src 'self' 'nonce-abc123'");
    expect(directive('style-src-attr')).toBe("style-src-attr 'unsafe-inline'");
  });

  it('relaxes eval and inline styles in development only', () => {
    const dev = buildCsp({ nonce: 'n', dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('upgrades insecure requests only over HTTPS', () => {
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(buildCsp({ nonce: 'n', https: true })).toContain('upgrade-insecure-requests');
  });

  it('generates a different 128-bit nonce each time', () => {
    const a = newNonce();
    expect(a).not.toBe(newNonce());
    expect(atob(a)).toHaveLength(16);
  });

  it('sends HSTS for two years including subdomains', () => {
    expect(HSTS_VALUE).toBe('max-age=63072000; includeSubDomains');
  });
});
