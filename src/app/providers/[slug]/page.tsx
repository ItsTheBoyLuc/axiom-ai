import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SectionNav } from '@/components/models/profile/section-nav';
import {
  AccessSection,
  AnnouncementsSection,
  ModelsSection,
  OverviewSection,
  PROVIDER_SECTIONS,
  ProviderHeader,
  ReleasesSection,
  ResearchSection,
} from '@/components/providers/provider-profile';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/section';
import { jsonLd } from '@/lib/json-ld';
import { getRepositories } from '../../../../server/repositories';

/**
 * Rendered per request: the CSP nonce (src/proxy.ts) cannot be applied to pages cached as static
 * HTML. The data behind it is cached in Redis (server/cache), so a request is still cheap.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getRepositories().providers.getBySlug(slug);
  if (!p) return { title: 'Provider not found', robots: { index: false } };
  const title = `${p.name} - AI models, releases and research`;
  const description = p.description.slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `/providers/${p.slug}` },
    openGraph: { title, description, type: 'website' },
    // Demo records must never be indexed as if they were real organisations.
    robots: p.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function ProviderPage({ params }: Props) {
  const { slug } = await params;
  const repos = getRepositories();
  const p = await repos.providers.getBySlug(slug);
  if (!p) notFound();
  const [{ items: releases }, { items: news }] = await Promise.all([
    repos.releases.list({ provider: slug, page: 1, pageSize: 100 }),
    repos.news.list({ provider: slug, page: 1, pageSize: 6 }),
  ]);

  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: p.name,
    description: p.description,
    url: `${origin}/providers/${p.slug}`,
    ...(p.officialWebsite ? { sameAs: [p.officialWebsite] } : {}),
  };

  return (
    <Container className="pt-10 pb-6 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Providers', href: '/providers' },
          { name: p.name, href: `/providers/${p.slug}` },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <ProviderHeader p={p} />
      <SectionNav sections={PROVIDER_SECTIONS} />
      <OverviewSection p={p} releases={releases} />
      <ModelsSection p={p} />
      <ReleasesSection p={p} releases={releases} />
      <AccessSection p={p} />
      <ResearchSection p={p} />
      <AnnouncementsSection p={p} news={news} />
    </Container>
  );
}
