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

export default function Home() {
  return (
    <>
      <Hero />
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
