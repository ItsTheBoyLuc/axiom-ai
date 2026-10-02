import { Hero } from '@/components/hero/hero';
import {
  ComparisonSection,
  FeaturedModels,
  FinalCta,
  LatestNews,
  LatestReleases,
  ProvidersOverview,
  StatsSection,
} from '@/components/home/sections';
import { getRepositories } from '../../server/repositories';

// Rendered per request: the content comes from PostgreSQL, which is not available at build time.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // The hero network is seeded through the repository layer.
  const repos = getRepositories();
  const [models, providers] = await Promise.all([
    repos.models.featured(8),
    repos.providers.listAll(),
  ]);
  const seed = {
    providers: providers
      .filter((p) => models.some((m) => m.providerSlug === p.slug))
      .map((p) => ({ slug: p.slug, name: p.name })),
    models: models.map((m) => ({ slug: m.slug, name: m.name, providerSlug: m.providerSlug })),
    isDemo: models.some((m) => m.isDemo),
  };

  return (
    <>
      <Hero seed={seed} />
      <StatsSection />
      <FeaturedModels />
      <ProvidersOverview />
      <ComparisonSection />
      <LatestReleases />
      <LatestNews />
      <FinalCta />
    </>
  );
}
