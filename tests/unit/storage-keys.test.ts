import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORAGE_ITEMS } from '@/lib/legal/storage-items';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe('cookies page', () => {
  const src = files('src').filter((f) => !f.includes('storage-items') && !f.includes('cookies'));
  const code = src.map((f) => readFileSync(f, 'utf8')).join('\n');

  it('lists every browser storage key the code uses', () => {
    const keys = [...code.matchAll(/'(axiom-[a-z-]+)'/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(3);
    const listed = new Set(STORAGE_ITEMS.map((i) => i.name));
    const missing = [...new Set(keys)].filter((k) => !listed.has(k));
    expect(missing, 'storage keys used in code but not on /cookies').toEqual([]);
  });

  it('does not list keys the code no longer writes', () => {
    for (const item of STORAGE_ITEMS.filter((i) => i.kind === 'Local storage')) {
      expect(code, item.name).toContain(`'${item.name}'`);
    }
  });

  it('sets no cookie other than the session cookie', () => {
    expect(code).not.toMatch(/document\.cookie/);
    // Server code that writes a Set-Cookie header: only the two
    // handlers that send the session cookie (built in server/auth/cookie.ts). A new file here means a new cookie, which must be on /cookies.
    const setters = files('server')
      .filter((f) => /Set-Cookie/i.test(readFileSync(f, 'utf8')))
      .map((f) => f.split(sep).join('/'))
      .sort();
    expect(setters).toEqual(['server/account/routes.ts', 'server/auth/handlers.ts']);
  });
});
