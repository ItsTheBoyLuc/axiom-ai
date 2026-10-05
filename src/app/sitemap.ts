import type { MetadataRoute } from 'next';
import { getRepositories } from '../../server/repositories';

// Generated from the database on request (it is not available at build time).
export const dynamic = 'force-dynamic';

const STATIC_PATHS = [
  '/',
  '/models',
  '/providers',
  '/benchmarks',
  '/compare',
  '/releases',
  '/news',
  '/about',
  '/methodology',
  '/sources',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
];

/**
 * Every public, indexable page: the fixed pages plus one entry per model and per provider. Filtered,
 * searched and paginated variants are deliberately absent (they are noindex and canonicalised).
 * No `lastModified`: the database does not track a page-level change time, and an invented one
 * would mislead crawlers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  const repos = getRepositories();
  const [modelSlugs, providers] = await Promise.all([
    repos.models.slugs(),
    repos.providers.listAll(),
  ]);
  const paths = [
    ...STATIC_PATHS,
    ...modelSlugs.map((s) => `/models/${s}`),
    ...providers.map((p) => `/providers/${p.slug}`),
  ];
  return paths.map((path) => ({ url: `${origin}${path === '/' ? '' : path}` }));
}
