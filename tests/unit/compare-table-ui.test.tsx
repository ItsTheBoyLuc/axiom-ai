import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompareTable } from '@/components/comparison/compare-table';
import { buildCompareTable } from '@/lib/compare/table';
import { buildCompareRows } from '../../server/api/compare-csv';
import { model, price, result } from './compare-fixtures';

const a = model('a', {
  contextWindow: 128_000,
  benchmarks: [result({ benchmarkSlug: 'x', benchmarkName: 'X', evaluationType: 'INDEPENDENT' })],
  documentationUrl: 'https://docs.example.invalid/a',
});
const b = model('b', {
  contextWindow: 1_000_000,
  benchmarks: [result({ benchmarkSlug: 'x', benchmarkName: 'X' })],
});

function renderTable(highlight: boolean, sharedOnly = false, models = [a, b]) {
  return render(
    <CompareTable
      groups={buildCompareTable(models)}
      models={models}
      highlight={highlight}
      sharedOnly={sharedOnly}
    />,
  );
}

describe('CompareTable', () => {
  it('is an accessible, scrollable region with one column per model and row headers', () => {
    renderTable(false);
    const region = screen.getByRole('region', { name: 'Comparison table' });
    expect(region).toHaveAttribute('tabindex', '0');
    // Attribute column + one column per model, each headed by a link to its profile.
    expect(region.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(within(region).getByRole('link', { name: 'A' })).toHaveAttribute('href', '/models/a');
    expect(within(region).getByRole('link', { name: 'B' })).toHaveAttribute('href', '/models/b');
    expect(within(region).getByRole('rowheader', { name: /Context window/ })).toBeInTheDocument();
  });

  it('marks differing rows with a visible "Differs" label only when highlighting is on', () => {
    const { unmount } = renderTable(false);
    expect(screen.queryByText('Differs')).toBeNull();
    unmount();
    renderTable(true);
    const row = screen.getByRole('rowheader', { name: /Context window/ });
    // Never colour alone: the text label is the signal.
    expect(within(row).getByText('Differs')).toBeInTheDocument();
    expect(
      within(screen.getByRole('rowheader', { name: /^Provider/ })).queryByText('Differs'),
    ).toBeNull();
  });

  it('shows the not-comparable warning on a benchmark measured under different conditions', () => {
    renderTable(false);
    expect(
      screen.getByText(/evaluation types differ.*not directly comparable/),
    ).toBeInTheDocument();
  });

  it('opens sources and documentation in a new tab without leaking the opener', () => {
    renderTable(false);
    const links = screen.getAllByRole('link', { name: /Source|Documentation/ });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l).toHaveAttribute('target', '_blank');
      expect(l).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('can limit performance rows to benchmarks at least two models have', () => {
    const only = model('c', {
      benchmarks: [result({ benchmarkSlug: 'solo', benchmarkName: 'Solo' })],
    });
    const { unmount } = renderTable(false, false, [a, only]);
    expect(screen.getByRole('rowheader', { name: /Solo/ })).toBeInTheDocument();
    unmount();
    renderTable(false, true, [a, only]);
    expect(screen.queryByRole('rowheader', { name: /Solo/ })).toBeNull();
    expect(screen.getByText(/No benchmark has a result for two or more/)).toBeInTheDocument();
  });
});

describe('CSV export shares the table values', () => {
  it('exports qualified price units instead of "Not publicly disclosed"', () => {
    const q = model('q', {
      pricing: [
        price({ type: 'INPUT', price: 0.3, unit: 'per 1M tokens (Standard tier, global)' }),
        price({ type: 'OUTPUT', price: 2.5, unit: 'per 1M tokens (Standard tier, global)' }),
      ],
    });
    const rows = buildCompareRows([q]);
    const cell = (label: string) => rows.find((r) => r[0] === label)![1];
    expect(cell('Input price')).toBe('0.3 USD per 1M tokens (Standard tier, global)');
    expect(cell('Output price')).toBe('2.5 USD per 1M tokens (Standard tier, global)');
    expect(cell('Cached input price')).toBe('Not publicly disclosed');
  });

  it('lists every price variant of a tiered model', () => {
    const t = model('t', {
      pricing: [
        price({ price: 2, unit: 'per 1M tokens (up to 200K)' }),
        price({ price: 4, unit: 'per 1M tokens (over 200K)' }),
      ],
    });
    const cell = buildCompareRows([t]).find((r) => r[0] === 'Input price')![1];
    expect(cell).toBe('2 USD per 1M tokens (up to 200K); 4 USD per 1M tokens (over 200K)');
  });
});
