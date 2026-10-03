import { describe, expect, it } from 'vitest';
import { isDue, nextRunAt, normalizeSchedule, parseSchedule } from '../../src/lib/sync/schedule';
import { allowAll, disallowAll, isAllowed, parseRobots } from '../../server/adapters/robots';
import { assertSafeUrl, isPrivateAddress } from '../../server/adapters/net-guard';
import { excerpt, plainText, toIso, absoluteHttpUrl } from '../../server/adapters/text';

describe('schedule', () => {
  it('parses intervals and manual, tolerant of case and spacing', () => {
    expect(parseSchedule('manual')).toEqual({ kind: 'manual' });
    expect(parseSchedule(' Every 6H ')).toEqual({ kind: 'interval', minutes: 360 });
    expect(parseSchedule('every 15m')).toEqual({ kind: 'interval', minutes: 15 });
    expect(parseSchedule('every 1d')).toEqual({ kind: 'interval', minutes: 1440 });
    expect(parseSchedule('every 6 h')).toEqual({ kind: 'interval', minutes: 360 });
  });

  it('refuses anything more frequent than 15 minutes, rarer than 30 days, or malformed', () => {
    for (const bad of [
      'every 14m',
      'every 0h',
      'every 31d',
      'every 1s',
      'daily',
      '*/5 * * * *',
      '',
      'every h',
    ]) {
      expect(parseSchedule(bad), bad).toBeNull();
    }
    expect(parseSchedule('every 30d')).not.toBeNull();
  });

  it('normalises to the shortest canonical text', () => {
    expect(normalizeSchedule('EVERY 60m')).toBe('every 1h');
    expect(normalizeSchedule('every 1440m')).toBe('every 1d');
    expect(normalizeSchedule('every 90m')).toBe('every 90m');
    expect(normalizeSchedule('nope')).toBeNull();
  });

  it('computes the next run and due-ness', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    expect(nextRunAt('every 6h', null, now)).toEqual(now); // never ran: due now
    expect(nextRunAt('every 6h', new Date('2026-10-03T08:00:00Z'), now)?.toISOString()).toBe(
      '2026-10-03T14:00:00.000Z',
    );
    expect(nextRunAt('manual', null, now)).toBeNull();
    expect(nextRunAt('garbage', null, now)).toBeNull();
    expect(isDue('every 6h', new Date('2026-10-03T06:00:00Z'), now)).toBe(true);
    expect(isDue('every 6h', new Date('2026-10-03T06:00:01Z'), now)).toBe(false);
    expect(isDue('manual', null, now)).toBe(false);
  });
});

describe('robots.txt', () => {
  const TOKEN = 'AxiomAI-Sync';

  it('applies the longest matching rule, Allow winning a tie', () => {
    const rules = parseRobots(
      [
        'User-agent: *',
        'Disallow: /private/',
        'Allow: /private/public/',
        'Disallow: /tie',
        'Allow: /tie',
      ].join('\n'),
      TOKEN,
    );
    expect(isAllowed(rules, '/blog')).toBe(true);
    expect(isAllowed(rules, '/private/x')).toBe(false);
    expect(isAllowed(rules, '/private/public/x')).toBe(true);
    expect(isAllowed(rules, '/tie')).toBe(true);
  });

  it('supports * wildcards and $ anchors', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /*.json$\nDisallow: /a*b/c', TOKEN);
    expect(isAllowed(rules, '/data.json')).toBe(false);
    expect(isAllowed(rules, '/data.json?x=1')).toBe(true); // $ anchors the end
    expect(isAllowed(rules, '/aXXb/c')).toBe(false);
    expect(isAllowed(rules, '/ab')).toBe(true);
  });

  it('prefers the group naming our product token over *', () => {
    const text = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: axiomai-sync',
      'Disallow: /secret',
      'Crawl-delay: 5',
    ].join('\n');
    const rules = parseRobots(text, TOKEN);
    expect(isAllowed(rules, '/feed.xml')).toBe(true);
    expect(isAllowed(rules, '/secret')).toBe(false);
    expect(rules.crawlDelaySeconds).toBe(5);
  });

  it('joins consecutive user-agent lines into one group, ignores comments and junk', () => {
    const rules = parseRobots(
      '# hi\nUser-agent: botA\nUser-agent: *\nDisallow: /x # trailing\nnot a rule\n',
      TOKEN,
    );
    expect(isAllowed(rules, '/x')).toBe(false);
    expect(isAllowed(rules, '/y')).toBe(true);
  });

  it('an empty Disallow allows everything; no matching group allows everything', () => {
    expect(isAllowed(parseRobots('User-agent: *\nDisallow:', TOKEN), '/anything')).toBe(true);
    expect(isAllowed(parseRobots('User-agent: otherbot\nDisallow: /', TOKEN), '/anything')).toBe(
      true,
    );
    expect(isAllowed(allowAll(), '/x')).toBe(true);
    expect(isAllowed(disallowAll(), '/x')).toBe(false);
  });
});

describe('net guard', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('%s is private/reserved', (a) => expect(isPrivateAddress(a)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    '%s is public',
    (a) => expect(isPrivateAddress(a)).toBe(false),
  );

  const resolveTo =
    (...addrs: string[]) =>
    async () =>
      addrs;
  const url = (s: string) => new URL(s);

  it('allows https to a public host', async () => {
    await expect(
      assertSafeUrl(url('https://example.com/feed'), resolveTo('93.184.216.34')),
    ).resolves.toBeUndefined();
  });

  it('refuses http, credentials, odd ports, localhost and internal names', async () => {
    const ok = resolveTo('93.184.216.34');
    for (const bad of [
      'http://example.com/',
      'https://user:pw@example.com/',
      'https://example.com:8443/',
      'https://localhost/',
      'https://app.localhost/',
      'https://db.internal/',
      'ftp://example.com/',
    ]) {
      await expect(assertSafeUrl(url(bad), ok), bad).rejects.toThrow();
    }
  });

  it('refuses IP literals and names that resolve to private addresses (DNS pointing inwards)', async () => {
    await expect(assertSafeUrl(url('https://169.254.169.254/latest/meta-data'))).rejects.toThrow(
      /private/,
    );
    await expect(assertSafeUrl(url('https://[::1]/'))).rejects.toThrow(/private/);
    await expect(
      assertSafeUrl(url('https://evil.example/'), resolveTo('8.8.8.8', '10.0.0.5')),
    ).rejects.toThrow(/private/);
    await expect(assertSafeUrl(url('https://nx.example/'), resolveTo())).rejects.toThrow(/resolve/);
  });
});

describe('text helpers', () => {
  it('strips tags, CDATA, scripts and decodes basic entities', () => {
    expect(plainText('<p>Hello &amp; <b>welcome</b></p><script>alert(1)</script>')).toBe(
      'Hello & welcome',
    );
    expect(plainText('<![CDATA[A <i>b</i>]]>')).toBe('A b');
    expect(plainText(undefined)).toBe('');
    expect(plainText('## Title\n\n* item')).toBe('Title item');
  });

  it('cuts excerpts at a word boundary with an ellipsis, never beyond the limit', () => {
    const long = 'word '.repeat(100).trim();
    const out = excerpt(long, 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith('…')).toBe(true);
    expect(excerpt('short', 50)).toBe('short');
  });

  it('toIso and absoluteHttpUrl return null instead of guessing', () => {
    expect(toIso('not a date')).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso('2026-10-03T10:00:00+02:00')).toBe('2026-10-03T08:00:00.000Z');
    expect(absoluteHttpUrl('/post/1', 'https://example.com/feed')).toBe(
      'https://example.com/post/1',
    );
    expect(absoluteHttpUrl('javascript:alert(1)')).toBeNull();
    expect(absoluteHttpUrl('')).toBeNull();
    expect(absoluteHttpUrl(42)).toBeNull();
  });
});
