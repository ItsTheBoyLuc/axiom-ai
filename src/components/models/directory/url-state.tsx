'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toSearchParams } from '@/lib/models/query';
import type { ModelQuery } from '@/types/model';

type Navigate = (patch: Partial<ModelQuery>, opts?: { replace?: boolean }) => void;

type Ctx = {
  /** Query with in-flight changes applied, so controls respond instantly. */
  query: ModelQuery;
  isPending: boolean;
  navigate: Navigate;
  /** Toggle one value inside a multi-select filter group. */
  toggle: (
    dim: 'provider' | 'category' | 'capability' | 'deployment' | 'pricing',
    value: string,
  ) => void;
  clearAll: () => void;
};

const UrlCtx = createContext<Ctx | null>(null);

export function useModelsUrl(): Ctx {
  const c = useContext(UrlCtx);
  if (!c) throw new Error('useModelsUrl must be used within ModelsUrlProvider');
  return c;
}

/**
 * All directory state lives in the URL. Controls call navigate(); the server re-renders the
 * results for the new URL. `useOptimistic` updates checkboxes immediately while that happens.
 * Filter/sort/page changes push a history entry (back button restores the previous view);
 * search-as-you-type uses replace so typing does not flood history.
 */
export function ModelsUrlProvider({
  query,
  children,
}: {
  query: ModelQuery;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    query,
    (cur: ModelQuery, patch: Partial<ModelQuery>): ModelQuery => ({
      ...cur,
      ...patch,
      page: patch.page ?? 1,
    }),
  );

  const navigate = useCallback<Navigate>(
    (patch, opts) => {
      const next: ModelQuery = { ...optimistic, ...patch, page: patch.page ?? 1 };
      const qs = toSearchParams(next).toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        applyOptimistic(patch);
        if (opts?.replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      });
    },
    [optimistic, pathname, router, applyOptimistic],
  );

  const toggle = useCallback<Ctx['toggle']>(
    (dim, value) => {
      const current = optimistic[dim] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      navigate({ [dim]: next } as Partial<ModelQuery>);
    },
    [optimistic, navigate],
  );

  const clearAll = useCallback(
    () =>
      navigate({ q: '', provider: [], category: [], capability: [], deployment: [], pricing: [] }),
    [navigate],
  );

  const value = useMemo(
    () => ({ query: optimistic, isPending, navigate, toggle, clearAll }),
    [optimistic, isPending, navigate, toggle, clearAll],
  );
  return <UrlCtx.Provider value={value}>{children}</UrlCtx.Provider>;
}
