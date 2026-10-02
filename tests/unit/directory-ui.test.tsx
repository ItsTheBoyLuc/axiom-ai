import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterGroups } from '@/components/models/directory/filter-groups';
import { pageWindow } from '@/components/models/directory/pagination';
import { SearchBox } from '@/components/models/directory/search-box';
import { ModelsUrlProvider } from '@/components/models/directory/url-state';
import { ErrorState } from '@/components/ui/error-state';
import { highlightParts } from '@/lib/models/highlight';
import { defaultQuery } from '@/lib/models/query';
import type { ModelFacets } from '@/types/model';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/models',
}));

const facets: ModelFacets = {
  provider: [
    { value: 'demo-provider-a', label: 'Demo Provider A', count: 3 },
    { value: 'other', label: 'Other', count: 2 },
  ],
  category: [
    { value: 'coding', label: 'Coding', count: 4 },
    { value: 'llm', label: 'LLM', count: 9 },
  ],
  capability: [{ value: 'reasoning', label: 'Reasoning', count: 5 }],
  deployment: [{ value: 'local', label: 'Local deployment', count: 3 }],
  pricing: [
    { value: 'free', label: 'Free', count: 1 },
    { value: 'paid', label: 'Paid', count: 0 },
  ],
};

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

describe('FilterGroups', () => {
  const setup = (over: Partial<typeof defaultQuery> = {}, activeCount = 0) => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    render(
      <FilterGroups
        facets={facets}
        query={{ ...defaultQuery, ...over }}
        onToggle={onToggle}
        onClear={onClear}
        activeCount={activeCount}
      />,
    );
    return { onToggle, onClear };
  };

  it('lists options with counts and reports toggles', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /Demo Provider A/ }));
    expect(onToggle).toHaveBeenCalledWith('provider', 'demo-provider-a');
    await userEvent.click(screen.getByRole('checkbox', { name: /Coding/ }));
    expect(onToggle).toHaveBeenCalledWith('category', 'coding');
  });

  it('reflects the current selection as checked', () => {
    setup({ category: ['llm'], provider: ['other'] }, 2);
    expect(screen.getByRole('checkbox', { name: /^LLM/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Other/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Coding/ })).not.toBeChecked();
  });

  it('collapses and expands groups (aria-expanded)', async () => {
    setup();
    const btn = screen.getByRole('button', { name: /^Category/ });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: /Coding/ })).not.toBeInTheDocument();
  });

  it('starts only Provider and Category open unless a group has a selection', () => {
    setup();
    const open = (name: RegExp) =>
      screen.getByRole('button', { name }).getAttribute('aria-expanded');
    expect(open(/^Provider/)).toBe('true');
    expect(open(/^Category/)).toBe('true');
    expect(open(/^Capabilities/)).toBe('false');
    expect(open(/^Deployment/)).toBe('false');
    expect(open(/^Pricing/)).toBe('false');
  });

  it('opens a collapsed group when it has an active selection', () => {
    setup({ pricing: ['free'], deployment: ['local'] }, 2);
    expect(screen.getByRole('button', { name: /^Pricing/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Deployment/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows Clear all only when filters are active', async () => {
    const { onClear } = setup({ category: ['llm'] }, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('hides Clear all with no active filters', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });
});

describe('SearchBox', () => {
  const suggestions = [
    {
      slug: 'sample-model-1',
      name: 'Sample Model 1',
      providerName: 'Demo Provider A',
      family: 'Sample Family X',
      isDemo: true,
    },
    {
      slug: 'sample-model-2',
      name: 'Sample Model 2',
      providerName: 'Demo Provider B',
      family: 'Sample Family Y',
      isDemo: true,
    },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: suggestions }) })),
    );
  });

  const setup = () =>
    render(
      <ModelsUrlProvider query={defaultQuery}>
        <SearchBox />
      </ModelsUrlProvider>,
    );

  it('is an accessible combobox', () => {
    setup();
    const box = screen.getByRole('combobox', { name: 'Search models' });
    expect(box).toHaveAttribute('aria-autocomplete', 'list');
    expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows suggestions, moves with the arrow keys and opens the highlighted model on Enter', async () => {
    setup();
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'sample');
    const list = await screen.findByRole('listbox');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(box).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{ArrowDown}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}'); // wraps
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}'); // wraps back
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/models/sample-model-2');
    expect(list).toBeDefined();
  });

  describe('opening a suggested model while the debounced ?q= update is still pending', () => {
    // Regression: the pending `replace('/models?q=...')` used to fire after `push('/models/<slug>')`
    // while the profile page was still loading, sending the user back to the directory. Fake timers
    // make the "still pending" state exact instead of depending on machine speed. fireEvent (not
    // userEvent) because RTL's async wrapper only advances jest fake timers and would hang here.
    const openWithPendingDebounce = async (choose: () => void) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        setup();
        const box = screen.getByRole('combobox');
        fireEvent.change(box, { target: { value: 'sample' } }); // schedules ?q= in 250ms
        await act(() => vi.advanceTimersByTimeAsync(150)); // suggestions arrive after 120ms
        expect(screen.getAllByRole('option')).toHaveLength(2);
        expect(replace).not.toHaveBeenCalled(); // still pending

        choose();
        expect(push).toHaveBeenCalledWith('/models/sample-model-1');

        await act(() => vi.advanceTimersByTimeAsync(1_000)); // the debounce window passes
        expect(replace).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    };

    it('Enter cancels it', async () => {
      await openWithPendingDebounce(() => {
        const box = screen.getByRole('combobox');
        fireEvent.keyDown(box, { key: 'ArrowDown' });
        fireEvent.keyDown(box, { key: 'Enter' });
      });
    });

    it('clicking a suggestion cancels it', async () => {
      await openWithPendingDebounce(() => {
        fireEvent.click(screen.getAllByRole('option')[0]!);
      });
    });
  });

  it('Enter without a highlighted suggestion applies the search to the URL', async () => {
    setup();
    await userEvent.type(screen.getByRole('combobox'), 'coding{Enter}');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/models?q=coding', { scroll: false }));
  });

  it('typing updates ?q= with history replacement (debounced)', async () => {
    setup();
    await userEvent.type(screen.getByRole('combobox'), 'abc');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/models?q=abc', { scroll: false }));
    expect(push).not.toHaveBeenCalled();
  });

  it('Escape closes the list first, then clears the field', async () => {
    setup();
    const box = screen.getByRole('combobox') as HTMLInputElement;
    await userEvent.type(box, 'sam');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    // The list animates out, so wait for it to leave the DOM.
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(box.value).toBe('sam');
    await userEvent.keyboard('{Escape}');
    expect(box.value).toBe('');
  });

  it('survives a failing suggestion request (suggestions are optional)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    setup();
    await userEvent.type(screen.getByRole('combobox'), 'sam');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('helpers', () => {
  it('highlightParts marks matching tokens case-insensitively', () => {
    expect(highlightParts('Sample Model 1', 'model')).toEqual([
      { text: 'Sample ', match: false },
      { text: 'Model', match: true },
      { text: ' 1', match: false },
    ]);
    expect(highlightParts('abc', '')).toEqual([{ text: 'abc', match: false }]);
  });

  it('highlightParts treats regex characters literally', () => {
    expect(() => highlightParts('a (b)', '(b')).not.toThrow();
    expect(highlightParts('a.b', '.').some((p) => p.match)).toBe(true);
  });

  it('pageWindow shows first, last and neighbours with gaps', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, 'gap', 10]);
  });
});

describe('ErrorState', () => {
  it('shows a safe message, no stack trace, and can retry', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error('secret db password leaked'), { digest: 'abc123' });
    render(<ErrorState error={error} reset={reset} title="Could not load models" scope="models" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load models');
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    expect(screen.queryByText(/secret db password/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
