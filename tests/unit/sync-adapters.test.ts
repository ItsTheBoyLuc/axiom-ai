import { describe, expect, it } from 'vitest';
import { validateBundle } from '../../prisma/seed/schemas';
import { ADAPTER_KINDS, getAdapter } from '../../server/adapters';
import { githubReleasesAdapter } from '../../server/adapters/github-releases';
import { huggingFaceAdapter } from '../../server/adapters/huggingface';
import { parseFeed, rssAdapter } from '../../server/adapters/rss';
import { noRobots, testHttp } from '../support/mock-fetch';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const ctx = (http: ReturnType<typeof testHttp>['client'], secrets = {}) => ({
  http,
  now: NOW,
  secrets,
});

const FEED = 'https://blog.example.com/feed.xml';
const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Lab</title>
    <item>
      <title>Introducing Example 2 &amp; friends</title>
      <link>https://blog.example.com/posts/example-2</link>
      <pubDate>Wed, 30 Sep 2026 14:00:00 GMT</pubDate>
      <description><![CDATA[<p>Example 2 is <b>our latest</b> model. It reads long documents and writes code, and this sentence keeps going so that the excerpt has to be cut somewhere sensible before it reaches the end of the text we were given by the feed.</p>]]></description>
    </item>
    <item>
      <title>Relative link post</title>
      <link>/posts/relative</link>
      <pubDate>Tue, 29 Sep 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>No link and a bad date</title>
      <pubDate>not a date</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Updated only</title>
    <link rel="alternate" href="https://blog.example.com/posts/updated"/>
    <updated>2026-09-15T10:00:00Z</updated>
    <summary>Short summary.</summary>
  </entry>
  <entry>
    <title>Has published</title>
    <link href="https://blog.example.com/posts/published"/>
    <published>2026-09-01T00:00:00Z</published>
    <updated>2026-09-20T00:00:00Z</updated>
  </entry>
</feed>`;

const config = (over = {}) =>
  rssAdapter.configSchema.parse({
    feedUrl: FEED,
    publisher: 'Example Lab',
    provider: null,
    category: 'MODEL_RELEASES',
    isOfficial: true,
    ...over,
  });

describe('registry', () => {
  it('registers every adapter kind', () => {
    expect(ADAPTER_KINDS.sort()).toEqual(['github-releases', 'huggingface', 'rss']);
    expect(getAdapter('rss')?.label).toBeTruthy();
    expect(getAdapter('nope')).toBeUndefined();
  });

  it('every adapter example config is valid for its own schema', () => {
    for (const kind of ADAPTER_KINDS) {
      const a = getAdapter(kind)!;
      expect(a.configSchema.safeParse(a.exampleConfig).success, kind).toBe(true);
    }
  });
});

describe('rss adapter', () => {
  it('turns RSS items into news candidates with a short excerpt, never the article', async () => {
    const { client } = testHttp({ ...noRobots('https://blog.example.com'), [FEED]: { body: RSS } });
    const { candidates, seen } = await rssAdapter.run(ctx(client), config());
    expect(seen).toBe(3);
    expect(candidates).toHaveLength(3);
    const first = candidates[0]!.record;
    expect(first).toMatchObject({
      title: 'Introducing Example 2 & friends',
      articleUrl: 'https://blog.example.com/posts/example-2',
      publicationDate: '2026-09-30T14:00:00.000Z',
      publisher: 'Example Lab',
      category: 'MODEL_RELEASES',
      isOfficial: true,
      isAiSummary: false,
      dateIsUpdated: false,
      verificationStatus: 'OFFICIALLY_VERIFIED',
      verifiedAt: NOW.toISOString(),
      sourceUrl: 'https://blog.example.com/posts/example-2',
    });
    const summary = String(first.summary);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith('…')).toBe(true);
    expect(summary).not.toMatch(/<|&amp;/);
    // Relative links resolve against the feed.
    expect(candidates[1]!.record.articleUrl).toBe('https://blog.example.com/posts/relative');
    // No description: a plain "publisher: title" line, not an invented summary.
    expect(candidates[1]!.record.summary).toBe('Example Lab: Relative link post');
  });

  it('does not guess: a missing link or unparsable date stays null for the validator to reject', async () => {
    const { client } = testHttp({ ...noRobots('https://blog.example.com'), [FEED]: { body: RSS } });
    const { candidates } = await rssAdapter.run(ctx(client), config());
    const bad = candidates[2]!.record;
    expect(bad.articleUrl).toBeNull();
    expect(bad.publicationDate).toBeNull();
    const v = validateBundle(
      { news: [{ ...bad, collectedAt: NOW.toISOString(), isDemo: false }] },
      { allowDemo: false },
    );
    expect(v.ok).toBe(false);
  });

  it('every good candidate passes the seed schema', async () => {
    const { client } = testHttp({ ...noRobots('https://blog.example.com'), [FEED]: { body: RSS } });
    const { candidates } = await rssAdapter.run(ctx(client), config());
    const good = candidates
      .slice(0, 2)
      .map((c) => ({ ...c.record, collectedAt: NOW.toISOString(), isDemo: false }));
    const v = validateBundle({ news: good }, { allowDemo: false });
    expect(v.ok ? [] : v.errors).toEqual([]);
  });

  it('marks Atom entries that only carry an updated date as "updated", not published', async () => {
    const { client } = testHttp({
      ...noRobots('https://blog.example.com'),
      [FEED]: { body: ATOM },
    });
    const { candidates } = await rssAdapter.run(ctx(client), config({ isOfficial: false }));
    expect(candidates[0]!.record).toMatchObject({
      publicationDate: '2026-09-15T10:00:00.000Z',
      dateIsUpdated: true,
      verificationStatus: 'COMMUNITY_REPORTED',
    });
    expect(candidates[1]!.record).toMatchObject({
      publicationDate: '2026-09-01T00:00:00.000Z',
      dateIsUpdated: false,
    });
  });

  it('respects maxItems and rejects documents that are not feeds', async () => {
    const { client } = testHttp({ ...noRobots('https://blog.example.com'), [FEED]: { body: RSS } });
    const { candidates, seen } = await rssAdapter.run(ctx(client), config({ maxItems: 1 }));
    expect(candidates).toHaveLength(1);
    expect(seen).toBe(3);
    expect(() => parseFeed('<html><body>hi</body></html>')).toThrow(/neither an RSS nor an Atom/);
    expect(() => parseFeed('<<<not xml')).toThrow();
  });

  it('validates its configuration strictly', () => {
    const s = rssAdapter.configSchema;
    expect(s.safeParse({ feedUrl: 'not a url', publisher: 'x' }).success).toBe(false);
    expect(s.safeParse({ feedUrl: FEED, publisher: '' }).success).toBe(false);
    expect(s.safeParse({ feedUrl: FEED, publisher: 'x', extra: 1 }).success).toBe(false);
    expect(s.safeParse({ feedUrl: FEED, publisher: 'x', maxItems: 500 }).success).toBe(false);
  });
});

const GH = 'https://api.github.com/repos/example/runtime/releases?per_page=10';
const ghRelease = (over: Record<string, unknown>) => ({
  tag_name: 'v1.2.0',
  name: 'v1.2.0',
  body: '## Highlights\n\n* Faster loading\n* New `serve` command',
  html_url: 'https://github.com/example/runtime/releases/tag/v1.2.0',
  published_at: '2026-09-28T08:30:00Z',
  draft: false,
  prerelease: false,
  ...over,
});

describe('github releases adapter', () => {
  const cfg = (over = {}) =>
    githubReleasesAdapter.configSchema.parse({
      repo: 'example/runtime',
      provider: 'example-lab',
      ...over,
    });

  it('stages published releases, skipping drafts and pre-releases by default', async () => {
    const { client, mock } = testHttp({
      ...noRobots('https://api.github.com'),
      [GH]: {
        body: JSON.stringify([
          ghRelease({}),
          ghRelease({ tag_name: 'v1.3.0-rc1', name: 'v1.3.0-rc1', prerelease: true }),
          ghRelease({ tag_name: 'v1.4.0', draft: true }),
        ]),
      },
    });
    const { candidates, seen } = await githubReleasesAdapter.run(ctx(client), cfg());
    expect(seen).toBe(3);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.entity).toBe('releases');
    expect(candidates[0]!.record).toMatchObject({
      provider: 'example-lab',
      model: null,
      kind: 'MINOR',
      releaseDate: '2026-09-28',
      title: 'runtime v1.2.0',
      announcementUrl: 'https://github.com/example/runtime/releases/tag/v1.2.0',
      sourceUrl: 'https://github.com/example/runtime/releases/tag/v1.2.0',
      verificationStatus: 'OFFICIALLY_VERIFIED',
      verifiedAt: NOW.toISOString(),
    });
    expect(String(candidates[0]!.record.description)).toBe(
      'Highlights Faster loading New serve command',
    );
    expect(mock.calls.at(-1)!.headers.Accept).toBe('application/vnd.github+json');
    expect(mock.calls.at(-1)!.headers.Authorization).toBeUndefined();
  });

  it('includes pre-releases when asked, and sends the token only as a header', async () => {
    const { client, mock } = testHttp({
      ...noRobots('https://api.github.com'),
      [GH]: { body: JSON.stringify([ghRelease({ prerelease: true })]) },
    });
    const { candidates } = await githubReleasesAdapter.run(
      ctx(client, { githubToken: 'ghp_test_token' }),
      cfg({ includePrereleases: true }),
    );
    expect(candidates).toHaveLength(1);
    expect(mock.calls.at(-1)!.headers.Authorization).toBe('Bearer ghp_test_token');
    expect(JSON.stringify(candidates)).not.toContain('ghp_test_token');
    expect(mock.calls.at(-1)!.url).not.toContain('ghp_test_token');
  });

  it('leaves unknowns null (no date, no url) so the validator rejects them', async () => {
    const { client } = testHttp({
      ...noRobots('https://api.github.com'),
      [GH]: { body: JSON.stringify([ghRelease({ published_at: null, html_url: null })]) },
    });
    const { candidates } = await githubReleasesAdapter.run(ctx(client), cfg());
    expect(candidates[0]!.record.releaseDate).toBeNull();
    expect(candidates[0]!.record.announcementUrl).toBeNull();
  });

  it('rejects an unexpected payload and path-traversing repo names', async () => {
    const { client } = testHttp({
      ...noRobots('https://api.github.com'),
      [GH]: { body: '{"message":"Not Found"}' },
    });
    await expect(githubReleasesAdapter.run(ctx(client), cfg())).rejects.toThrow(
      /Unexpected GitHub response/,
    );
    const s = githubReleasesAdapter.configSchema;
    for (const repo of [
      'owner/..',
      '../repo',
      'noslash',
      'a/b/c',
      'owner/name?x=1',
      'owner/ name',
    ]) {
      expect(s.safeParse({ repo, provider: 'p' }).success, repo).toBe(false);
    }
    expect(s.safeParse({ repo: 'owner/my.repo-1', provider: 'p' }).success).toBe(true);
  });
});

const HF =
  'https://huggingface.co/api/models?author=example-lab&sort=createdAt&direction=-1&limit=20';

describe('hugging face adapter', () => {
  const cfg = () =>
    huggingFaceAdapter.configSchema.parse({ author: 'example-lab', provider: 'example-lab' });

  it('stages public repositories as provider-reported releases using only what the API states', async () => {
    const { client } = testHttp({
      ...noRobots('https://huggingface.co'),
      [HF]: {
        body: JSON.stringify([
          {
            id: 'example-lab/Tiny-1B',
            createdAt: '2026-07-16T10:24:13.000Z',
            pipeline_tag: 'text-generation',
          },
          { id: 'example-lab/Private', createdAt: '2026-07-01T00:00:00.000Z', private: true },
          { id: 'example-lab/No-Task', createdAt: '2026-06-01T00:00:00.000Z' },
        ]),
      },
    });
    const { candidates, seen } = await huggingFaceAdapter.run(ctx(client), cfg());
    expect(seen).toBe(3);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.record).toMatchObject({
      title: 'example-lab/Tiny-1B published on Hugging Face',
      releaseDate: '2026-07-16',
      announcementUrl: 'https://huggingface.co/example-lab/Tiny-1B',
      verificationStatus: 'PROVIDER_REPORTED',
      verifiedAt: null,
    });
    expect(String(candidates[0]!.record.description)).toContain('(task: text-generation)');
    expect(String(candidates[1]!.record.description)).not.toContain('task');
    const v = validateBundle(
      {
        releases: candidates.map((c) => ({
          ...c.record,
          collectedAt: NOW.toISOString(),
          isDemo: false,
        })),
      },
      { allowDemo: false, known: { providers: ['example-lab'] } },
    );
    expect(v.ok ? [] : v.errors).toEqual([]);
  });

  it('encodes the author and validates the config', () => {
    const s = huggingFaceAdapter.configSchema;
    for (const author of ['a/b', 'a b', '', '-lead', 'x&y=1']) {
      expect(s.safeParse({ author, provider: 'p' }).success, author).toBe(false);
    }
    expect(s.safeParse({ author: 'Mistral-AI_1.x', provider: 'p' }).success).toBe(true);
  });
});
