import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DemoBadge, Tag, VerificationBadge } from '@/components/ui/badges';
import { providerBySlug, type DemoModel } from '@/lib/demo-data';
import { formatDate, formatTokens } from '@/lib/format';
import { NOT_DISCLOSED } from '@/lib/verification';

/** Provider monogram tile (used instead of a logo: we never redraw a company's logo). */
export function Monogram({ letter, size = 40 }: { letter: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="border-line-strong bg-elevated text-fg-2 inline-flex shrink-0 items-center justify-center rounded-xl border font-mono font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </span>
  );
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function ModelCard({ model }: { model: DemoModel }) {
  const provider = providerBySlug(model.providerSlug);
  return (
    <Card as="article" className="flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <Monogram letter={provider?.monogram ?? '?'} />
        <div className="min-w-0 flex-1">
          <h3 className="t-h3 truncate">{model.name}</h3>
          <p className="text-fg-2 truncate text-sm">
            {provider?.name} &middot; {model.family}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {model.modalities.map((m) => (
          <Tag key={m}>{m}</Tag>
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="t-eyebrow">Released</dt>
          <dd className="text-fg mt-0.5 font-mono">{formatDate(model.releaseDate)}</dd>
        </div>
        <div>
          <dt className="t-eyebrow">Context</dt>
          <dd className="text-fg mt-0.5 font-mono">{formatTokens(model.contextWindow)} tokens</dd>
        </div>
        <div>
          <dt className="t-eyebrow">Pricing</dt>
          <dd className="text-fg mt-0.5 font-mono">
            {model.pricing ? (
              <>
                {money(model.pricing.input)} / {money(model.pricing.output)}
                <span className="text-muted block text-xs">in / out {model.pricing.unit}</span>
              </>
            ) : (
              <span className="text-fg-2">{NOT_DISCLOSED}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="t-eyebrow">Availability</dt>
          <dd className="text-fg mt-0.5">{model.availability}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex flex-wrap gap-2">
          <VerificationBadge status={model.verificationStatus} />
          <DemoBadge />
        </div>
        <Link
          href="/models"
          aria-label={`View ${model.name}`}
          className="group text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          View
          <ArrowUpRight
            size={15}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
      </div>
    </Card>
  );
}
