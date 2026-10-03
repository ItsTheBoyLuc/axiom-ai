import { DemoBadge } from '@/components/ui/badges';
import { Reveal } from '@/components/ui/reveal';

export const PROFILE_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'specifications', label: 'Specifications' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'history', label: 'Release history' },
  { id: 'related', label: 'Related models' },
] as const;

/** A profile section: anchored heading (offset for the sticky navs), optional demo flag. */
export function ProfileSection({
  id,
  title,
  demo = false,
  lead,
  children,
}: {
  id: string;
  title: string;
  demo?: boolean;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-line scroll-mt-16 border-t py-12 first:border-t-0"
    >
      <Reveal>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 id={`${id}-title`} className="t-h2 !text-[clamp(1.5rem,1.1rem+1.4vw,2.125rem)]">
            {title}
          </h2>
          {demo && <DemoBadge />}
        </div>
        {lead && <p className="text-fg-2 -mt-3 mb-6 max-w-2xl text-sm">{lead}</p>}
        {children}
      </Reveal>
    </section>
  );
}
