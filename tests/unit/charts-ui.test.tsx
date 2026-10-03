import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BarChart } from '@/components/charts/bar-chart';
import { chartCsv, csvFilename } from '@/components/charts/download';
import { RadarChart } from '@/components/charts/radar-chart';

// Recharts measures its container; jsdom has no layout, so give it a ResizeObserver stub.
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

const series = [
  { name: 'Model A', values: [70, 60, 50] },
  { name: 'Model B', values: [65.5, 80, 40] },
];
const axes = ['Bench 1', 'Bench 2', 'Bench 3'];

describe('RadarChart', () => {
  it('has a text summary, a legend with every series, and the source note', () => {
    render(
      <RadarChart
        title="Benchmark profile"
        unit="%"
        axes={axes}
        series={series}
        footnote="Source note"
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAccessibleName(/Benchmark profile\. Model A: Bench 1 70%, Bench 2 60%/);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Model A')).toBeInTheDocument();
    expect(within(legend).getByText('Model B')).toBeInTheDocument();
    expect(screen.getByText('Source note')).toBeInTheDocument();
  });

  it('offers the same numbers as a table, and goes back to the chart', () => {
    render(<RadarChart title="Profile" unit="%" axes={axes} series={series} footnote="n" />);
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Model B' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Bench 2' })).toBeInTheDocument();
    expect(within(table).getByText('65.5%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chart view' }));
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('downloads a CSV with one row per benchmark', () => {
    let saved = '';
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: string[]) {
          saved = parts.join('');
        }
      },
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<RadarChart title="Profile" unit="%" axes={axes} series={series} footnote="n" />);
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    expect(saved.split('\n')).toEqual([
      '"Benchmark","Model A (%)","Model B (%)"',
      '"Bench 1",70,65.5',
      '"Bench 2",60,80',
      '"Bench 3",50,40',
    ]);
  });
});

describe('BarChart', () => {
  it('summarises values with units for screen readers and flips to a table', () => {
    render(
      <BarChart
        title="Input price"
        unit="USD per 1M tokens"
        data={[
          { label: 'A\nStandard tier', value: 0.3 },
          { label: 'B', value: 1 },
        ]}
        footnote="n"
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Input price. A · Standard tier: 0.3 USD per 1M tokens; B: 1 USD per 1M tokens.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(screen.getByRole('rowheader', { name: 'A · Standard tier' })).toBeInTheDocument();
  });
});

describe('chart download helpers', () => {
  it('quotes text cells, leaves numbers bare and escapes quotes', () => {
    expect(chartCsv([['a "b"', 1.5]])).toBe('"a ""b""",1.5');
  });
  it('builds a safe filename from the title', () => {
    expect(csvFilename('Context window (tokens)')).toBe('context-window-tokens-.csv');
  });
});
