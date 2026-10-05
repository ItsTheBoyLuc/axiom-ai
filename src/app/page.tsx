import { Hero } from '@/components/hero/hero';
import { ForYou } from '@/components/home/for-you';
import {
  ComparisonSection,
  FeaturedModels,
  FinalCta,
  LatestNews,
  LatestReleases,
  ProvidersOverview,
  StatsSection,
} from '@/components/home/sections';
import { getPreferences } from '../../server/account/service';
import { getCurrentUser } from '../../server/auth/current-user';
import { getPrisma } from '../../server/db/client';
import { getRepositories } from '../../server/repositories';

// Rendered per request: the content comes from PostgreSQL, which is not available at build time,
// and the signed-in "For you" section depends on the session.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // The hero network is seeded through the repository layer.
  const repos = getRepositories();
  const [models, providers, user] = await Promise.all([
    repos.models.featured(8),
    repos.providers.listAll(),
    getCurrentUser(),
  ]);
  const seed = {
    providers: providers
      .filter((p) => models.some((m) => m.providerSlug === p.slug))
      .map((p) => ({ slug: p.slug, name: p.name })),
    models: models.map((m) => ({ slug: m.slug, name: m.name, providerSlug: m.providerSlug })),
    isDemo: models.some((m) => m.isDemo),
  };

  // Signed in and not switched off in settings: a personalised section right under the hero.
  const prefs = user ? await getPreferences(getPrisma(), user.id) : null;

  return (
    <>
      <Hero seed={seed} />
      {user && prefs?.personalized && (
        <ForYou userId={user.id} providers={prefs.preferredProviders} />
      )}
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
