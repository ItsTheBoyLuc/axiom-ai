import { CinematicRoot } from '@/components/cinematic/cinematic-root';
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
import { getCinematicSeed } from '../../server/services/cinematic-seed';

// Rendered per request: the content comes from PostgreSQL, which is not available at build time,
// and the signed-in "For you" section depends on the session.
export const dynamic = 'force-dynamic';

/** The debug overlay (`?debug=scroll`) exists in development and when the server opts in. */
const debugAllowed = () =>
  process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_OVERLAY === 'true';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The network (static SVG and the live background) is seeded through the repository layer:
  // every provider and every model, so it is dense enough to read as a network.
  const [seed, user, params] = await Promise.all([
    getCinematicSeed(),
    getCurrentUser(),
    searchParams,
  ]);
  const debug = params.debug === 'scroll' && debugAllowed();

  // Signed in and not switched off in settings: a personalised section right under the hero.
  const prefs = user ? await getPreferences(getPrisma(), user.id) : null;

  return (
    <CinematicRoot level="full" seed={seed} debug={debug}>
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
    </CinematicRoot>
  );
}
