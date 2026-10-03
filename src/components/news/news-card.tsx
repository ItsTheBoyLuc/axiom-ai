import { ArrowUpRight } from 'lucide-react';
import { AiSummaryBadge, DemoBadge, IndependentBadge, OfficialBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import type { NewsItem } from '@/types/catalog';

/**
 * One news story: Official vs Independent, an "AI summary" label when the summary was written by
 * a model, the publisher and date, and the link to the real article. `showProvider` hides the
 * provider name where the page already is about that provider.
 */
export function NewsCard({
  item,
  showProvider = true,
}: {
  item: NewsItem;
  showProvider?: boolean;
}) {
  const provider = showProvider && item.provider && item.provider.name !== item.publisher;
  return (
    <Card as="article" className="flex h-full flex-col p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {item.isOfficial ? <OfficialBadge /> : <IndependentBadge />}
        {item.isAiSummary && <AiSummaryBadge />}
        {item.isDemo && <DemoBadge />}
      </div>
      <h3 className="t-h3">{item.title}</h3>
      <p className="text-fg-2 mt-2 flex-1 text-sm">{item.summary}</p>
      <p className="text-muted mt-4 text-xs">
        {item.publisher} &middot;{' '}
        {/* Some pages show only a last-updated date: say "Updated", never "Published". */}
        <time dateTime={item.publishedAt}>
          {item.dateIsUpdated ? 'Updated ' : ''}
          {formatDate(item.publishedAt)}
        </time>
        {provider && <> &middot; {item.provider!.name}</>}
      </p>
      <p className="mt-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Read at {item.publisher} <ArrowUpRight size={12} aria-hidden />
        </a>
      </p>
    </Card>
  );
}
