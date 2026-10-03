import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BenchmarkIndex } from '@/components/benchmarks/benchmark-index';
import { CategoryTabs } from '@/components/benchmarks/category-tabs';
import { OverviewStats } from '@/components/benchmarks/overview-stats';
import { ResultsTable } from '@/components/benchmarks/results-table';
import { DistributionChart } from '@/components/charts/distribution-chart';
import { ProviderDotChart } from '@/components/charts/dot-chart';
import { TimeChart } from '@/components/charts/line-chart';
import { row, summary } from './benchmarks-fixtures';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe('CategoryTabs', () => {
  const all = [
    summary({ slug: 'a', category: 'coding' }),
    summary({ slug: 'b', category: 'coding' }),
    summary({ slug: 'c', category: 'mathematics' }),
  ];

  it('lists "All" and each category with its count, as links', () => {
    render(<CategoryTabs summaries={all} active={null} />);
    const nav = screen.getByRole('navigation', { name: 'Benchmark categories' });
    expect(within(nav).getByRole('link', { name: /All categories/ })).toHaveAttribute(
      'href',
      '/benchmarks',
    );
    const coding = within(nav).getByRole('link', { name: /Coding/ });
    expect(coding).toHaveAttribute('href', '/benchmarks?category=coding');
    expect(coding).toHaveTextContent('2');
    expect(within(nav).queryByRole('link', { name: /Long context/ })).toBeNull(); // empty categories are not offered
  });

  it('marks the active category', () => {
    render(<CategoryTabs summaries={all} active="mathematics" />);
    expect(screen.getByRole('link', { name: /Mathematics/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: /All categories/ })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('BenchmarkIndex', () => {
  const all = [
    summary({ slug: 'swe', name: 'SWE Bench', category: 'coding' }),
    summary({
      slug: 'aime',
      name: 'AIME',
      category: 'mathematics',
      byType: { INDEPENDENT: 2, PROVIDER_REPORTED: 1, COMMUNITY: 0 },
      units: ['%'],
    }),
    summary({
      slug: 'empty',
      name: 'Empty Bench',
      category: 'coding',
      resultCount: 0,
      modelCount: 0,
      latestDate: null,
      byType: { INDEPENDENT: 0, PROVIDER_REPORTED: 0, COMMUNITY: 0 },
      units: [],
    }),
  ];

  it('groups benchmarks under category headings and links each card to its detail view', () => {
    render(<BenchmarkIndex summaries={all} category={null} />);
    expect(screen.getByRole('heading', { name: 'Coding' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mathematics' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /SWE Bench/ })).toHaveAttribute(
      'href',
      '/benchmarks?benchmark=swe',
    );
  });

  it('keeps the chosen category in a card link and lists only that category', () => {
    render(<BenchmarkIndex summaries={all} category="coding" />);
    expect(screen.queryByRole('link', { name: /AIME/ })).toBeNull();
    expect(screen.getByRole('link', { name: /SWE Bench/ })).toHaveAttribute(
      'href',
      '/benchmarks?category=coding&benchmark=swe',
    );
  });

  it('shows the evaluation-type mix with counts, and says when a benchmark has no results', () => {
    render(<BenchmarkIndex summaries={all} category={null} />);
    const aime = screen.getByRole('link', { name: /AIME/ });
    expect(within(aime).getByText('Independently evaluated')).toBeInTheDocument();
    expect(within(aime).getByText('Provider reported')).toBeInTheDocument();
    expect(screen.getByText('No results yet')).toBeInTheDocument();
  });

  it('says so when a category has no benchmarks', () => {
    render(<BenchmarkIndex summaries={all} category="science" />);
    expect(screen.getByText('No benchmarks in this category yet.')).toBeInTheDocument();
  });
});

describe('OverviewStats', () => {
  it('totals the catalogue and states plainly when nothing is independently evaluated', () => {
    render(<OverviewStats summaries={[summary(), summary({ slug: 'b' })]} />);
    expect(screen.getByText('Independently evaluated').nextSibling).toHaveTextContent('0');
    expect(screen.getByText('Provider reported').nextSibling).toHaveTextContent('6');
    expect(
      screen.getByText(/None of these results has been independently evaluated yet/),
    ).toBeInTheDocument();
  });

  it('drops that notice once an independent result exists', () => {
    render(
      <OverviewStats
        summaries={[summary({ byType: { INDEPENDENT: 1, PROVIDER_REPORTED: 2, COMMUNITY: 0 } })]}
      />,
    );
    expect(screen.queryByText(/None of these results/)).toBeNull();
  });
});

describe('ResultsTable', () => {
  const data = [
    row({ score: 40, evaluationDate: '2026-06-01', model: { slug: 'a', name: 'Alpha' } }),
    row({
      score: 90,
      evaluationDate: '2026-09-01',
      model: { slug: 'b', name: 'Beta' },
      evaluationType: 'INDEPENDENT',
      sourceUrl: null,
      methodologyNotes: null,
      benchmarkVersion: null,
    }),
    row({ score: 65, evaluationDate: '2026-08-01', model: { slug: 'c', name: 'Gamma' } }),
  ];
  const order = () =>
    within(screen.getByRole('region', { name: 'Benchmark results table' }))
      .getAllByRole('rowheader')
      .map((th) => th.textContent?.replace(/Provider A$/, ''));

  it('shows every column a score needs and links model and source', () => {
    render(<ResultsTable rows={data} />);
    for (const h of [
      'Model',
      'Score',
      'Evaluation',
      'Evaluated',
      'Model version',
      'Benchmark version',
      'Methodology',
      'Source',
    ]) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/models/a');
    const source = screen.getAllByRole('link', { name: /Source/ })[0]!;
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    expect(source).toHaveAttribute('target', '_blank');
  });

  it('writes missing methodology and benchmark version as "Not publicly disclosed"', () => {
    render(<ResultsTable rows={[data[1]!]} />);
    expect(screen.getAllByText('Not publicly disclosed')).toHaveLength(2);
    expect(screen.getByText('No source (demo)')).toBeInTheDocument();
  });

  it('labels the evaluation type with a badge (provider reported vs independent)', () => {
    render(<ResultsTable rows={data} />);
    expect(screen.getAllByText('Provider reported')).toHaveLength(2);
    expect(screen.getByText('Independently evaluated')).toBeInTheDocument();
  });

  it('sorts newest first by default and can sort by score and name', () => {
    render(<ResultsTable rows={data} />);
    expect(order()).toEqual(['Beta', 'Gamma', 'Alpha']);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'score-asc' } });
    expect(order()).toEqual(['Alpha', 'Gamma', 'Beta']);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'model' } });
    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('reports the result count', () => {
    render(<ResultsTable rows={data} />);
    expect(screen.getByRole('status')).toHaveTextContent('3 results');
  });
});

describe('new chart wrappers', () => {
  it('TimeChart: spoken summary, legend, table view with every point', () => {
    render(
      <TimeChart
        title="Scores over time"
        unit="%"
        footnote="note"
        series={[
          {
            name: 'Fam A',
            points: [
              {
                t: Date.UTC(2026, 5, 1),
                value: 40,
                date: '2026-06-01',
                label: 'A1 · Provider reported',
              },
              {
                t: Date.UTC(2026, 8, 1),
                value: 60,
                date: '2026-09-01',
                label: 'A2 · Provider reported',
              },
            ],
          },
          {
            name: 'Fam B',
            points: [
              { t: Date.UTC(2026, 7, 1), value: 55, date: '2026-08-01', label: 'B1 · Independent' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /Fam A: 40% on 2026-06-01 \(A1 · Provider reported\)/,
    );
    expect(
      within(screen.getByRole('list', { name: 'Legend' })).getByText('Fam B'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4); // header + 3 points
  });

  it('DistributionChart: bins in the table with the models in them, counts add up', () => {
    render(
      <DistributionChart
        title="Score distribution"
        unit="%"
        footnote="n"
        bins={[
          { from: 10, to: 20, count: 2, models: ['M0', 'M1'] },
          { from: 20, to: 30, count: 1, models: ['M2'] },
        ]}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(/10 to 20: 2 models; 20 to 30: 1 model/);
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(screen.getByText('M0, M1')).toBeInTheDocument();
  });

  it('ProviderDotChart: one table row per model with provider and evaluation type', () => {
    render(
      <ProviderDotChart
        title="Provider comparison"
        unit="%"
        footnote="n"
        providers={['Alpha', 'Beta']}
        dots={[
          {
            y: 0,
            provider: 'Alpha',
            model: 'A1',
            score: 50,
            type: 'PROVIDER_REPORTED',
            date: '2026-09-01',
          },
          {
            y: 1,
            provider: 'Beta',
            model: 'B1',
            score: 70,
            type: 'INDEPENDENT',
            date: '2026-08-01',
          },
        ]}
      />,
    );
    // The legend lists only the evaluation types present, so shape is never the only cue.
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Provider reported')).toBeInTheDocument();
    expect(within(legend).getByText('Independent')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    const table = screen.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Beta' })).toBeInTheDocument();
    expect(within(table).getByText('Independent')).toBeInTheDocument();
  });

  it('every new chart offers a CSV download', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(
      <DistributionChart
        title="D"
        unit="%"
        footnote="n"
        bins={[{ from: 1, to: 2, count: 1, models: ['M'] }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    expect(click).toHaveBeenCalledTimes(1);
  });
});
