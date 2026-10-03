import { Pager } from '@/components/ui/pager';
import { pageWindow } from '@/lib/pagination';
import { toSearchParams } from '@/lib/models/query';
import type { ModelQuery } from '@/types/model';

export { pageWindow };

/**
 * The directory's pagination: every link carries the full current query, so filters and sort
 * survive page changes.
 */
export function Pagination({
  query,
  page,
  pageCount,
}: {
  query: ModelQuery;
  page: number;
  pageCount: number;
}) {
  const href = (p: number) => {
    const qs = toSearchParams({ ...query, page: p }).toString();
    return qs ? `/models?${qs}` : '/models';
  };
  return <Pager page={page} pageCount={pageCount} hrefFor={href} />;
}
