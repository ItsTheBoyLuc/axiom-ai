import type { MetadataRoute } from 'next';

/**
 * Crawlers may read the public site. The account, admin and API surfaces are not content; the
 * API reference is the one place a crawler may look at /api (docs), the data lives in the pages.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/account',
          '/settings',
          '/sign-in',
          '/sign-up',
          '/api/v1/',
          '/search',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
