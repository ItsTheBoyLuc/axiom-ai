import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertTriangle, Inbox } from 'lucide-react';
import { BarChart } from '@/components/charts/bar-chart';
import { ModelCard } from '@/components/models/model-card';
import {
  AiSummaryBadge,
  DemoBadge,
  IndependentBadge,
  OfficialBadge,
  Tag,
  VerificationBadge,
} from '@/components/ui/badges';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { Container } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/skeleton';
import { getModelRepository } from '../../../server/repositories/model-repository';
import { distance, duration, ease, spring, staggerDelay } from '@/lib/motion';
import { VERIFICATION_STATUSES } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};
// Evaluated per request so ENABLE_DESIGN_PAGE can be toggled without a rebuild.
export const dynamic = 'force-dynamic';

const swatches = [
  ['bg-primary', 'bg-bg'],
  ['bg-secondary', 'bg-bg-2'],
  ['bg-elevated', 'bg-elevated'],
  ['bg-card', 'bg-card'],
  ['accent', 'bg-accent'],
  ['accent-2', 'bg-accent-2'],
  ['accent-3', 'bg-accent-3'],
  ['text', 'bg-fg'],
  ['text-2', 'bg-fg-2'],
  ['text-muted', 'bg-muted'],
] as const;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`d-${title}`} className="border-line border-t py-12">
      <h2 id={`d-${title}`} className="t-eyebrow mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function DesignPage() {
  // Dev-only: hidden in production unless explicitly enabled.
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DESIGN_PAGE !== 'true')
    notFound();

  const { items: models } = await getModelRepository().list({
    q: '',
    provider: [],
    category: [],
    capability: [],
    deployment: [],
    pricing: [],
    sort: 'recent',
    benchmark: null,
    page: 1,
    pageSize: 4,
  });

  return (
    <Container className="py-16">
      <p className="t-eyebrow mb-3">Living style guide</p>
      <h1 className="t-h2">Design system</h1>
      <p className="t-lead mt-3 max-w-2xl">
        Tokens, type, components and states. Use the theme toggle to check both themes.
      </p>

      <Block title="Logo">
        <div className="flex flex-wrap items-center gap-10">
          <Logo variant="full" size={40} />
          <Logo variant="mark" size={40} />
          <Logo variant="mark" size={16} />
          <Logo variant="mark" size={24} />
        </div>
      </Block>

      <Block title="Color tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {swatches.map(([name, cls]) => (
            <li key={name} className="border-line rounded-xl border p-3">
              <div className={`border-line h-12 rounded-lg border ${cls}`} />
              <p className="text-fg-2 mt-2 font-mono text-xs">--{name}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Typography">
        <div className="space-y-5">
          <p className="t-display">Display headline</p>
          <p className="t-h2">Section heading</p>
          <p className="t-h3">Card title</p>
          <p className="t-lead max-w-2xl">
            Lead paragraph in Geist Sans with generous line height for comfortable reading.
          </p>
          <p className="text-fg-2 max-w-2xl">
            Body text. Specifications use monospace:{' '}
            <code className="text-fg font-mono">128K tokens</code>,{' '}
            <code className="text-fg font-mono">$1.00 / 1M</code>.
          </p>
          <p className="t-eyebrow">Eyebrow label</p>
        </div>
      </Block>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/design" arrow>
            Primary
          </ButtonLink>
          <ButtonLink href="/design" variant="secondary">
            Secondary
          </ButtonLink>
          <ButtonLink href="/design" variant="ghost">
            Ghost
          </ButtonLink>
          <Button disabled>Disabled</Button>
          <ButtonLink href="/design" size="lg" arrow>
            Large
          </ButtonLink>
        </div>
      </Block>

      <Block title="Badges">
        <div className="flex flex-wrap gap-3">
          {VERIFICATION_STATUSES.map((s) => (
            <VerificationBadge key={s} status={s} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <DemoBadge /> <OfficialBadge /> <IndependentBadge /> <AiSummaryBadge /> <Tag>Text</Tag>{' '}
          <Tag>Image</Tag>
        </div>
      </Block>

      <Block title="Cards">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ModelCard model={models[0]!} />
          <Card className="p-5">
            <h3 className="t-h3">Generic card</h3>
            <p className="text-fg-2 mt-2">
              Hover for the lift, border brighten and cursor spotlight.
            </p>
          </Card>
        </div>
      </Block>

      <Block title="Chart">
        <div className="max-w-xl">
          <BarChart
            title="Context window"
            unit="tokens"
            data={models.map((m) => ({ label: m.name, value: m.contextWindow ?? 0 }))}
            valueFormat="tokens"
            footnote="Demo values for layout testing."
          />
        </div>
      </Block>

      <Block title="States">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div aria-busy="true" className="border-line bg-card rounded-2xl border p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <p className="text-muted mt-4 text-xs">Loading (skeleton)</p>
          </div>
          <div className="border-line-strong flex flex-col items-center rounded-2xl border border-dashed p-8 text-center">
            <Inbox aria-hidden className="text-muted" />
            <p className="mt-3 font-medium">No results</p>
            <p className="text-fg-2 text-sm">Try clearing a filter.</p>
          </div>
          <div
            role="alert"
            className="border-danger/40 bg-danger/5 flex flex-col items-center rounded-2xl border p-8 text-center"
          >
            <AlertTriangle aria-hidden className="text-danger" />
            <p className="mt-3 font-medium">Something went wrong</p>
            <p className="text-fg-2 text-sm">Please try again.</p>
          </div>
        </div>
      </Block>

      <Block title="Motion values">
        <pre className="border-line bg-card text-fg-2 overflow-x-auto rounded-xl border p-4 font-mono text-xs">
          {JSON.stringify({ ease, duration, spring, staggerDelay, distance }, null, 2)}
        </pre>
      </Block>
    </Container>
  );
}
