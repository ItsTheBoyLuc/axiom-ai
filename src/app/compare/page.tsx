import type { Metadata } from 'next';
import { CompareView } from '@/components/comparison/compare-view';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/section';
import { parseModelsParam } from '@/lib/comparison';
import { getRepositories } from '../../../server/repositories';

// Reads the query string, so it is rendered per request; the repositories cache the heavy parts.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ models?: string | string[] }> };

const DESCRIPTION =
  'Compare up to four AI models side by side: specifications, pricing and benchmarks, each with its source. No overall score.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { slugs } = parseModelsParam((await searchParams).models);
  if (slugs.length === 0) {
    return {
      title: 'Compare AI models',
      description: DESCRIPTION,
      alternates: { canonical: '/compare' },
    };
  }
  const found = await getRepositories().models.getManyBySlugs(slugs);
  const names = found.map((m) => m.name);
  return {
    title: names.length ? `Compare ${names.join(' vs ')}` : 'Compare AI models',
    description: DESCRIPTION,
    // A specific selection is one of unboundedly many URLs: let people share it, not search engines.
    robots: { index: false, follow: true },
  };
}

export default async function ComparePage({ searchParams }: Props) {
  const { slugs, ignored } = parseModelsParam((await searchParams).models);
  const repos = getRepositories();
  const [models, providers] = await Promise.all([
    repos.models.getManyBySlugs(slugs),
    repos.providers.listAll(),
  ]);
  const have = new Set(models.map((m) => m.slug));

  return (
    <Container className="pt-10 pb-6 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Compare', href: '/compare' },
        ]}
      />
      <CompareView
        models={models}
        unknown={slugs.filter((s) => !have.has(s))}
        ignored={ignored}
        providers={providers.map((p) => ({ value: p.slug, label: p.name }))}
      />
    </Container>
  );
}
