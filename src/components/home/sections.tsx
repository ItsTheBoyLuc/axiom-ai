import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ModelCard, Monogram } from '@/components/models/model-card';
import { AiSummaryBadge, DemoBadge, IndependentBadge, OfficialBadge } from '@/components/ui/badges';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Counter } from '@/components/ui/counter';
import { Container, Section } from '@/components/ui/section';
import { RevealGroup, RevealItem, Reveal } from '@/components/ui/reveal';
import { demoNews, demoReleases, providerBySlug } from '@/lib/demo-data';
import { formatDate } from '@/lib/format';
import { getModelRepository } from '../../../server/repositories/model-repository';
import { listProviders } from '../../../server/repositories/provider-repository';
import { getStats } from '../../../server/services/stats';
import { ComparisonPreview } from './comparison-preview';

export async function StatsSection() {
  const s = await getStats();
  const items = [
    { label: 'Models', value: s.totalModels },
    { label: 'Providers', value: s.providers },
    { label: 'Released this month', value: s.releasedThisMonth },
    { label: 'Benchmarks', value: s.benchmarks },
    { label: 'Recently updated', value: s.recentlyUpdated },
  ];
  return (
    <section
      aria-labelledby="stats-title"
      className="border-line bg-bg-2 border-y"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <Container className="py-12">
        <div className="mb-8 flex items-center gap-3">
          <h2 id="stats-title" className="t-eyebrow">
            Platform statistics
          </h2>
          {s.isDemo && <DemoBadge />}
        </div>
        <RevealGroup as="div" className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-5">
          {items.map((i) => (
            <RevealItem key={i.label}>
              <p className="text-fg text-4xl font-medium tracking-tight sm:text-5xl">
                <Counter value={i.value} />
              </p>
              <p className="text-fg-2 mt-1 text-sm">{i.label}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

export async function FeaturedModels() {
  const models = await getModelRepository().featured(6);
  if (models.length === 0) return null; // nothing to show yet: render no empty section
  return (
    <Section
      id="featured"
      eyebrow="Featured models"
      title="A directory built for precision."
      lead="Every model carries its source and verification status."
      demo={<DemoBadge />}
      action={
        <ButtonLink href="/models" variant="secondary" arrow>
          Browse all models
        </ButtonLink>
      }
    >
      <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((m) => (
          <RevealItem key={m.slug}>
            <ModelCard model={m} />
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

export async function ProvidersOverview() {
  const providers = await listProviders();
  if (providers.length === 0) return null;
  return (
    <Section
      id="providers"
      eyebrow="Providers"
      title="The organisations behind the models."
      demo={<DemoBadge />}
      action={
        <ButtonLink href="/providers" variant="secondary" arrow>
          All providers
        </ButtonLink>
      }
    >
      <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => (
          <RevealItem as="li" key={p.slug}>
            <Card className="flex h-full items-start gap-4 p-5">
              <Monogram letter={p.monogram} size={44} />
              <div className="min-w-0 flex-1">
                <h3 className="t-h3">{p.name}</h3>
                <p className="text-fg-2 mt-1 text-sm">{p.description}</p>
                <p className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-fg-2 font-mono">
                    {p.modelCount} {p.modelCount === 1 ? 'model' : 'models'}
                  </span>
                  <Link
                    href="/providers"
                    aria-label={`View ${p.name}`}
                    className="text-accent inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    View <ArrowUpRight size={14} aria-hidden />
                  </Link>
                </p>
              </div>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

export async function ComparisonSection() {
  const models = await getModelRepository().featured(6);
  if (models.length === 0) return null;
  return (
    <Section
      id="compare"
      eyebrow="Comparison"
      title="Side by side, without the noise."
      lead="Compare up to four models. Benchmarks stay separate: there is no blended score."
      demo={<DemoBadge />}
    >
      <Reveal>
        <ComparisonPreview models={models} />
      </Reveal>
    </Section>
  );
}

export function LatestReleases() {
  return (
    <Section
      id="releases"
      eyebrow="Latest releases"
      title="A timeline of what shipped."
      demo={<DemoBadge />}
      action={
        <ButtonLink href="/releases" variant="secondary" arrow>
          Full timeline
        </ButtonLink>
      }
    >
      <RevealGroup as="ol" className="border-line-strong relative ml-2 space-y-8 border-l pl-8">
        {demoReleases.map((r) => (
          <RevealItem as="li" key={r.id} className="relative">
            <span
              aria-hidden
              className="border-accent bg-bg absolute top-2 -left-[37px] size-2.5 rounded-full border-2"
            />
            <time dateTime={r.date} className="text-muted font-mono text-sm">
              {formatDate(r.date)}
            </time>
            <h3 className="t-h3 mt-1">
              {r.model}{' '}
              <span className="text-fg-2 font-normal">
                &middot; {providerBySlug(r.providerSlug)?.name}
              </span>
            </h3>
            <p className="text-fg-2 mt-1 max-w-2xl">{r.description}</p>
            <p className="text-muted mt-2 text-xs">No announcement link: demo entry.</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

export function LatestNews() {
  return (
    <Section
      id="news"
      eyebrow="Latest news"
      title="Announcements and reporting, clearly labelled."
      demo={<DemoBadge />}
      action={
        <ButtonLink href="/news" variant="secondary" arrow>
          All news
        </ButtonLink>
      }
    >
      <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {demoNews.map((n, i) => (
          // First story is featured: spans both columns at md so the 2-col grid (sm and up) has no orphan.
          <RevealItem key={n.id} className={i === 0 ? 'sm:col-span-2 lg:col-span-1' : undefined}>
            <Card as="article" className="flex h-full flex-col p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {n.isOfficial ? <OfficialBadge /> : <IndependentBadge />}
                {n.isAiSummary && <AiSummaryBadge />}
              </div>
              <h3 className="t-h3">{n.title}</h3>
              <p className="text-fg-2 mt-2 flex-1 text-sm">{n.summary}</p>
              <p className="text-muted mt-4 text-xs">
                {n.publisher} &middot; <time dateTime={n.date}>{formatDate(n.date)}</time> &middot;{' '}
                {providerBySlug(n.providerSlug)?.name}
              </p>
              <p className="text-muted mt-1 text-xs">No source link: demo entry.</p>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="bg-noise relative isolate overflow-hidden py-24 sm:py-32"
    >
      <div aria-hidden className="bg-ambient absolute inset-0 -z-10" />
      <Container className="text-center">
        <Reveal>
          <h2 id="cta-title" className="t-h2 mx-auto max-w-3xl text-balance">
            Understand the Models Defining Tomorrow.
          </h2>
          <p className="t-lead mx-auto mt-5 max-w-xl text-balance">
            Explore the technology, performance, and capabilities behind modern AI.
          </p>
          <div className="mt-9">
            <ButtonLink href="/models" size="lg" arrow>
              Start Exploring
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
