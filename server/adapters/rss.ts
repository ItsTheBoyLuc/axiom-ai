import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { NEWS_CATEGORIES } from '../../src/types/catalog';
import { HttpError } from './http';
import { absoluteHttpUrl, excerpt, plainText, toIso } from './text';
import type { Adapter, Candidate } from './types';

/**
 * RSS 2.0 / Atom feed -> news candidates. Only the feed's own title, link, date and excerpt are
 * used. The excerpt is cut to 200 characters (a syndication-sized snippet, not the article) and
 * the admin sees it in the staging diff before anything is published.
 */

const configSchema = z.strictObject({
  feedUrl: z.url().max(500),
  publisher: z.string().trim().min(1).max(200),
  provider: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .nullable()
    .default(null),
  category: z.enum(NEWS_CATEGORIES).default('COMPANIES'),
  isOfficial: z.boolean().default(false),
  maxItems: z.number().int().min(1).max(50).default(20),
});
type Config = z.output<typeof configSchema>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // Feeds are untrusted input: no external entities, bounded expansion.
  processEntities: true,
  maxNestedTags: 20,
});

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
/** fast-xml-parser gives either a string or { '#text': ..., '@_attr': ... }. */
const text = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number'
    ? String(v)
    : v && typeof v === 'object' && '#text' in v
      ? String((v as Record<string, unknown>)['#text'])
      : '';

type Item = Record<string, unknown>;

function atomLink(entry: Item): string {
  const links = arr(entry.link as Item | Item[] | undefined);
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
  return alt ? String(alt['@_href'] ?? text(alt)) : '';
}

export function parseFeed(xml: string): { items: Item[]; kind: 'rss' | 'atom' } {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new HttpError('network', 'The feed is not valid XML.');
  }
  const rss = doc.rss as { channel?: { item?: Item | Item[] } } | undefined;
  if (rss?.channel) return { kind: 'rss', items: arr(rss.channel.item) };
  const feed = doc.feed as { entry?: Item | Item[] } | undefined;
  if (feed) return { kind: 'atom', items: arr(feed.entry) };
  throw new HttpError('network', 'The document is neither an RSS nor an Atom feed.');
}

export const rssAdapter: Adapter<Config> = {
  kind: 'rss',
  label: 'RSS / Atom news feed',
  help: 'Reads an official blog or news feed and stages one news story per entry. Use the feed the publisher advertises; robots.txt and rate limits are respected.',
  exampleConfig: {
    feedUrl: 'https://example.com/blog/feed.xml',
    publisher: 'Example Lab',
    provider: 'example-lab',
    category: 'MODEL_RELEASES',
    isOfficial: true,
    maxItems: 20,
  },
  configSchema,

  async run({ http, now }, config) {
    const res = await http.get(config.feedUrl, {
      accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
    });
    const { items, kind } = parseFeed(res.text);
    const nowIso = now.toISOString();
    const candidates: Candidate[] = [];

    for (const item of items.slice(0, config.maxItems)) {
      const link = absoluteHttpUrl(
        kind === 'rss' ? text(item.link) : atomLink(item),
        config.feedUrl,
      );
      const title = plainText(text(item.title)).slice(0, 400);
      const published = toIso(
        kind === 'rss' ? text(item.pubDate) || text(item['dc:date']) : text(item.published),
      );
      // Atom entries without `published` only carry an "updated" date: say so, as the DataCamp
      // item taught us (a date that is not a publication date must not be shown as one).
      const updated = kind === 'atom' && !published ? toIso(text(item.updated)) : null;
      const body = plainText(
        kind === 'rss'
          ? text(item.description) || text(item['content:encoded'])
          : text(item.summary) || text(item.content),
      );

      candidates.push({
        entity: 'news',
        record: {
          title,
          summary: body ? excerpt(body, 200) : `${config.publisher}: ${title}`,
          publisher: config.publisher,
          articleUrl: link,
          publicationDate: published ?? updated,
          category: config.category,
          isOfficial: config.isOfficial,
          isAiSummary: false,
          dateIsUpdated: updated !== null,
          provider: config.provider,
          models: [],
          sourceUrl: link,
          verificationStatus: config.isOfficial ? 'OFFICIALLY_VERIFIED' : 'COMMUNITY_REPORTED',
          verifiedAt: nowIso,
          dataType: 'news feed',
        },
      });
    }
    return { candidates, seen: items.length };
  },
};
