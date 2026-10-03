import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaletteBody } from '@/components/search/palette-body';
import type { SearchResults } from '@/types/catalog';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function stubLayout() {
  // cmdk measures; jsdom has no layout.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

const empty: SearchResults['results'] = {
  models: [],
  providers: [],
  benchmarks: [],
  releases: [],
  news: [],
  research: [],
};
const hit = (
  type: keyof SearchResults['results'],
  id: string,
  title: string,
  href: string,
  subtitle: string | null = null,
) => ({
  type,
  id,
  title,
  subtitle,
  href,
  isDemo: false,
});

const RESULTS: SearchResults['results'] = {
  ...empty,
  models: [
    hit(
      'models',
      'gemini-3-8-flash',
      'Gemini 3.8 Flash',
      '/models/gemini-3-8-flash',
      'Google DeepMind · Gemini Flash',
    ),
  ],
  releases: [
    hit(
      'releases',
      'r1',
      'Gemini 3.8 Flash generally available',
      '/providers/google-deepmind#release-r1',
      'Google DeepMind · 2026-09-02',
    ),
  ],
  news: [
    hit(
      'news',
      'n1',
      'Introducing Gemini 3.8 Flash',
      'https://blog.example.invalid/gemini',
      'Google',
    ),
  ],
};

const calls: string[] = [];
function mockApi(
  search: (url: URL) => Promise<SearchResults['results']> | SearchResults['results'] = () =>
    RESULTS,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: { signal?: AbortSignal }) => {
      calls.push(input);
      const url = new URL(input, 'http://test.local');
      if (url.pathname === '/api/v1/models') {
        return {
          ok: true,
          json: async () => ({
            data: [{ slug: 'gpt-6-sol', name: 'GPT-6 Sol', providerName: 'OpenAI' }],
          }),
        };
      }
      const results = await search(url);
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return { ok: true, json: async () => ({ data: { q: url.searchParams.get('q'), results } }) };
    }),
  );
}

const optionWith = (text: string) =>
  screen.getAllByRole('option').find((o) => o.textContent?.includes(text))!;

const open = () => {
  const close = vi.fn();
  render(<PaletteBody close={close} />);
  return { close, input: screen.getByRole('combobox', { name: 'Search' }) };
};

beforeEach(() => {
  stubLayout();
  push.mockReset();
  calls.length = 0;
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('command palette: before typing', () => {
  it('offers suggested models and the pages, and no results yet', async () => {
    mockApi();
    open();
    expect(await screen.findByText('GPT-6 Sol')).toBeInTheDocument();
    expect(screen.getByText('Suggested models')).toBeInTheDocument();
    for (const p of ['Home', 'Models', 'Providers', 'Compare', 'Benchmarks', 'Releases', 'News']) {
      expect(screen.getByRole('option', { name: p })).toBeInTheDocument();
    }
    expect(screen.queryByText(/See all results/)).toBeNull();
    expect(calls.some((c) => c.startsWith('/api/v1/search'))).toBe(false);
  });

  it('opens a suggested model and closes', async () => {
    mockApi();
    const { close } = open();
    await userEvent.click(await screen.findByText('GPT-6 Sol'));
    expect(push).toHaveBeenCalledWith('/models/gpt-6-sol');
    expect(close).toHaveBeenCalled();
  });
});

describe('command palette: searching', () => {
  it('searches the real API after a pause and shows results grouped by type with the match highlighted', async () => {
    mockApi();
    const { input } = open();
    await userEvent.type(input, 'gemini');
    await screen.findByText('3 results');
    const searchCall = calls.find((c) => c.startsWith('/api/v1/search'))!;
    expect(new URL(searchCall, 'http://x').searchParams.get('q')).toBe('gemini');
    expect(new URL(searchCall, 'http://x').searchParams.has('types')).toBe(false);
    for (const g of ['Models', 'Releases', 'News']) {
      expect(screen.getAllByText(g).length).toBeGreaterThan(0); // the chip and the group heading
    }
    const model = optionWith('Google DeepMind · Gemini Flash');
    expect(within(model).getByText('Gemini', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 results');
  });

  it('every category chip limits the search to that type and shows its pressed state', async () => {
    mockApi();
    const { input } = open();
    await userEvent.type(input, 'gemini');
    await screen.findByText('3 results');
    await userEvent.click(screen.getByRole('button', { name: 'News' }));
    expect(screen.getByRole('button', { name: 'News' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      const last = new URL(calls.filter((c) => c.startsWith('/api/v1/search')).at(-1)!, 'http://x');
      expect(last.searchParams.get('types')).toBe('news');
    });
  });

  it('opens an internal result and remembers the search', async () => {
    mockApi();
    const { input, close } = open();
    await userEvent.type(input, 'gemini');
    await screen.findByText('3 results');
    await userEvent.click(optionWith('Google DeepMind · Gemini Flash'));
    expect(push).toHaveBeenCalledWith('/models/gemini-3-8-flash');
    expect(close).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('axiom-recent-searches')!)).toEqual(['gemini']);
  });

  it('opens an external result (news) in a new tab without leaking the opener', async () => {
    mockApi();
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { input } = open();
    await userEvent.type(input, 'gemini');
    await screen.findByText('3 results');
    const news = optionWith('Introducing');
    expect(within(news).getByText('opens in a new tab')).toBeInTheDocument();
    await userEvent.click(news);
    expect(openWindow).toHaveBeenCalledWith(
      'https://blog.example.invalid/gemini',
      '_blank',
      'noopener,noreferrer',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('"See all results" opens the full results page for the query and chosen type', async () => {
    mockApi();
    const { input } = open();
    await userEvent.type(input, 'gemini 3');
    await userEvent.click(await screen.findByRole('option', { name: /See all results for/ }));
    expect(push).toHaveBeenCalledWith('/search?q=gemini+3');
  });

  it('keyboard: arrows move the selection and Enter opens it', async () => {
    mockApi();
    const { input } = open();
    await userEvent.type(input, 'gemini');
    await screen.findByText('3 results');
    // The first result (the model) is selected by default; one ArrowDown moves to the release.
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]![0]).toBe('/providers/google-deepmind#release-r1');
  });

  it('says plainly when nothing matches, and still offers the full results page', async () => {
    mockApi(() => empty);
    const { input } = open();
    await userEvent.type(input, 'zzzz');
    expect(await screen.findByText(/No results for “zzzz”/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /See all results for/ })).toBeInTheDocument();
  });

  it('reports a failed search instead of hanging', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input.startsWith('/api/v1/models'))
          return { ok: true, json: async () => ({ data: [] }) };
        return { ok: false, json: async () => ({}) };
      }),
    );
    const { input } = open();
    await userEvent.type(input, 'gemini');
    expect(await screen.findByText(/Search is unavailable right now/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /See all results for/ })).toBeInTheDocument();
  });

  it('never shows an older, slower answer over a newer one', async () => {
    let releaseSlow: (r: SearchResults['results']) => void = () => {};
    const slow = new Promise<SearchResults['results']>((res) => (releaseSlow = res));
    mockApi((url) =>
      url.searchParams.get('q') === 'ge'
        ? slow
        : { ...empty, models: [hit('models', 'new', 'Newest answer', '/models/new')] },
    );
    const { input } = open();
    await userEvent.type(input, 'ge');
    await waitFor(() => expect(calls.some((c) => c.includes('q=ge&'))).toBe(true));
    await userEvent.type(input, 'm');
    expect(await screen.findByText('Newest answer')).toBeInTheDocument();
    releaseSlow({ ...empty, models: [hit('models', 'old', 'Stale answer', '/models/old')] });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Stale answer')).toBeNull();
    expect(screen.getByText('Newest answer')).toBeInTheDocument();
  });

  it('typing exactly a page name selects that page first, ahead of any search result', async () => {
    mockApi(() => ({
      ...empty,
      models: [hit('models', 'm', 'Models of everything', '/models/m')],
    }));
    const { input } = open();
    await userEvent.type(input, 'Benchmarks');
    await screen.findByText('1 result');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Benchmarks');
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/benchmarks');
  });

  it('shows a matching page when the typed text matches one', async () => {
    mockApi(() => empty);
    const { input } = open();
    await userEvent.type(input, 'bench');
    expect(await screen.findByRole('option', { name: 'Benchmarks' })).toBeInTheDocument();
  });
});

describe('command palette: recent searches', () => {
  it('lists earlier searches when the field is empty, and a click refills the field', async () => {
    localStorage.setItem('axiom-recent-searches', JSON.stringify(['claude opus']));
    mockApi();
    // The store reads storage once per page load; a fresh module instance models a new page load.
    vi.resetModules();
    const { PaletteBody: Fresh } = await import('@/components/search/palette-body');
    render(<Fresh close={() => {}} />);
    await userEvent.click(await screen.findByRole('option', { name: 'claude opus' }));
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue('claude opus');
  });
});
