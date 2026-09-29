import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/section';
import { pendingRoutes } from '@/lib/routes';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(pendingRoutes).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = pendingRoutes[slug];
  // Placeholder pages must not be indexed.
  return { title: page?.title ?? 'Not found', robots: { index: false, follow: false } };
}

/**
 * Honest placeholder for routes whose phase has not shipped. It keeps navigation and CTAs
 * from 404ing without pretending the feature exists. Delete the slug from pendingRoutes
 * (and add the real route) when the phase ships.
 */
export default async function PendingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pendingRoutes[slug];
  if (!page) notFound();

  return (
    <Container className="flex min-h-[60vh] flex-col items-start justify-center py-24">
      <p className="t-eyebrow mb-4">Not built yet</p>
      <h1 className="t-h2">{page.title}</h1>
      <p className="t-lead mt-4 max-w-xl">
        This page is planned for {page.phase} and does not contain real content yet.
      </p>
      <div className="mt-8">
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}
