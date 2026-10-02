'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { highlightParts } from '@/lib/models/highlight';
import { spring } from '@/lib/motion';
import type { ModelSuggestion } from '@/types/model';
import { useModelsUrl } from './url-state';

const SUGGEST_DELAY_MS = 120;
const URL_DELAY_MS = 250;

function Highlighted({ text, term }: { text: string; term: string }) {
  return (
    <>
      {highlightParts(text, term).map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-accent/20 text-fg rounded-sm">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Search combobox (ARIA 1.2 pattern). Typing updates `?q=` (debounced, history-replacing) so the
 * grid filters as you type, and shows model suggestions from /api/v1/models/suggest.
 * Arrow keys move through suggestions, Enter opens the highlighted model (or applies the
 * search), Escape closes the list, then clears the field.
 */
export function SearchBox() {
  const { query, navigate } = useModelsUrl();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listId = useId();

  const [term, setTerm] = useState(query.q);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [fetched, setFetched] = useState<ModelSuggestion[]>([]);

  // The field is uncontrolled so URL round-trips never fight the user's typing. When the URL
  // changes from elsewhere (back button, "clear all"), mirror it unless the user is typing.
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement !== el && el.value !== query.q) el.value = query.q;
  }, [query.q]);

  useEffect(() => () => clearTimeout(urlTimer.current), []);

  // Suggestions: debounced fetch, aborted when the term changes.
  useEffect(() => {
    const t = term.trim();
    if (!t) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/models/suggest?q=${encodeURIComponent(t)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data: ModelSuggestion[] };
        setFetched(json.data);
        setActive(-1);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setFetched([]); // suggestions are optional
      }
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [term]);

  const trimmed = term.trim();
  const items = trimmed ? fetched : [];
  const expanded = open && items.length > 0;

  const applySearch = (value: string) => {
    clearTimeout(urlTimer.current);
    navigate({ q: value.trim() }, { replace: false });
  };

  /**
   * Opens a suggested model. The pending debounced `?q=` update must be cancelled first, or it
   * can fire while the profile page is still loading and send the user back to the directory.
   */
  const openModel = (slug: string) => {
    clearTimeout(urlTimer.current);
    setOpen(false);
    router.push(`/models/${slug}`);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTerm(v);
    setOpen(true);
    setActive(-1);
    clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => navigate({ q: v.trim() }, { replace: true }), URL_DELAY_MS);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = '';
    setTerm('');
    setFetched([]);
    setOpen(false);
    applySearch('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        if (items.length === 0) return;
        e.preventDefault();
        setOpen(true);
        setActive((a) => (a + 1) % items.length);
        break;
      case 'ArrowUp':
        if (items.length === 0) return;
        e.preventDefault();
        setOpen(true);
        setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
        break;
      case 'Enter': {
        e.preventDefault();
        const chosen = expanded ? items[active] : undefined;
        if (chosen) {
          openModel(chosen.slug);
        } else {
          setOpen(false);
          applySearch(e.currentTarget.value);
        }
        break;
      }
      case 'Escape':
        if (expanded) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (e.currentTarget.value) {
          e.preventDefault();
          clear();
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div
      className="relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search models
      </label>
      <Search
        size={18}
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
      />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-opt-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        defaultValue={query.q}
        placeholder="Search models, providers…"
        onChange={onChange}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="border-line-strong bg-elevated text-fg placeholder:text-muted focus-visible:border-accent h-12 w-full rounded-xl border pr-11 pl-11 text-base transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      {term && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="text-fg-2 hover:bg-card hover:text-fg absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg"
        >
          <X size={16} aria-hidden />
        </button>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {expanded ? `${items.length} suggestion${items.length === 1 ? '' : 's'} available` : ''}
      </p>

      <AnimatePresence>
        {expanded && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label="Model suggestions"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={spring.snappy}
            className="border-line-strong bg-elevated absolute inset-x-0 top-[calc(100%+8px)] z-30 origin-top overflow-hidden rounded-xl border p-1.5 shadow-[var(--shadow-pop)]"
          >
            {items.map((s, i) => (
              <li
                key={s.slug}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => openModel(s.slug)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  i === active ? 'bg-card text-fg' : 'text-fg-2'
                }`}
              >
                <span className="min-w-0 truncate">
                  <span className="text-fg">
                    <Highlighted text={s.name} term={trimmed} />
                  </span>
                  <span className="text-muted">
                    {' '}
                    &middot; <Highlighted text={s.providerName} term={trimmed} />
                  </span>
                </span>
                <span className="text-muted shrink-0 text-xs">
                  <Highlighted text={s.family} term={trimmed} />
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
