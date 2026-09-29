import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BenchmarksView } from '@/components/models/profile/benchmarks-section';
import { CapabilitiesMatrix } from '@/components/models/profile/capabilities-matrix';
import { Overview } from '@/components/models/profile/overview';
import { PricingSection } from '@/components/models/profile/pricing-section';
import { ProfileHeader } from '@/components/models/profile/profile-header';
import { ProfileSection } from '@/components/models/profile/profile-section';
import { RecordView } from '@/components/models/profile/record-view';
import { RelatedModels } from '@/components/models/profile/related-models';
import { ReleaseHistory } from '@/components/models/profile/release-history';
import { SectionNav } from '@/components/models/profile/section-nav';
import { Specifications } from '@/components/models/profile/specs';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/section';
import { jsonLd } from '@/lib/json-ld';
import { getModelRepository } from '../../../../server/repositories/model-repository';

/** Static pages, refreshed hourly (data changes arrive via the sync workers in Phase 8). */
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getModelRepository().slugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const model = await getModelRepository().getBySlug(slug);
  if (!model) return { title: 'Model not found', robots: { index: false } };
  const title = `${model.name} - ${model.providerName}`;
  const description = model.overview.purpose.slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `/models/${model.slug}` },
    openGraph: { title, description, type: 'website' },
    // Demo records must never be indexed as if they were real models.
    robots: model.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function ModelPage({ params }: Props) {
  const { slug } = await params;
  const repo = getModelRepository();
  const model = await repo.getBySlug(slug);
  if (!model) notFound();
  const related = await repo.related(slug, 3);

  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: model.name,
    description: model.overview.purpose,
    applicationCategory: 'AI model',
    url: `${origin}/models/${model.slug}`,
    datePublished: model.releaseDate,
    dateModified: model.updatedAt,
    ...(model.version ? { softwareVersion: model.version } : {}),
    creator: { '@type': 'Organization', name: model.providerName },
  };

  return (
    <Container className="pt-10 pb-6 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Models', href: '/models' },
          { name: model.name, href: `/models/${model.slug}` },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <RecordView slug={model.slug} name={model.name} providerName={model.providerName} />

      <ProfileHeader model={model} />
      <SectionNav />

      <Overview model={model} />
      <Specifications model={model} />
      <PricingSection model={model} />
      <CapabilitiesMatrix model={model} />
      <ProfileSection
        id="benchmarks"
        title="Benchmarks"
        demo={model.isDemo}
        lead="Results as published, each with its own version, date, methodology and source."
      >
        <BenchmarksView results={model.benchmarks} />
      </ProfileSection>
      <ReleaseHistory model={model} />
      <RelatedModels models={related} demo={model.isDemo} />
    </Container>
  );
}
