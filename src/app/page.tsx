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
import { demoProviders } from '@/lib/demo-data';
import { getModelRepository } from '../../server/repositories/model-repository';

export default async function Home() {
  // The hero network is seeded through the repository layer (demo data until Phase 3).
  const models = await getModelRepository().featured(8);
  const seed = {
    providers: demoProviders
      .filter((p) => models.some((m) => m.providerSlug === p.slug))
      .map((p) => ({ slug: p.slug, name: p.name })),
    models: models.map((m) => ({ slug: m.slug, name: m.name, providerSlug: m.providerSlug })),
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
