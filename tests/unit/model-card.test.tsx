import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelCard } from '@/components/models/model-card';
import { pricingSummary } from '@/lib/models/display';
import { toListItem } from '../../server/repositories/demo/demo-model-repository';
import { demoModelDetails } from '../../server/repositories/demo/models';

const item = (slug: string) => toListItem(demoModelDetails.find((m) => m.slug === slug)!);

describe('ModelCard', () => {
  it('shows identity, verification and a DEMO DATA badge', () => {
    render(<ModelCard model={item('sample-model-1')} />);
    expect(screen.getByRole('heading', { name: 'Sample Model 1' })).toBeInTheDocument();
    expect(screen.getByText(/Demo Provider A/)).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText(/demo data/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'View Sample Model 1' })).toHaveAttribute(
      'href',
      '/models/sample-model-1',
    );
    expect(screen.getByRole('button', { name: /add to comparison/i })).toBeEnabled();
  });

  it('renders "Not publicly disclosed" for a missing context window and price', () => {
    render(<ModelCard model={item('sample-model-14')} />);
    // context window and pricing are both undisclosed for this model
    expect(screen.getAllByText('Not publicly disclosed').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });

  it('formats disclosed values in monospace', () => {
    render(<ModelCard model={item('sample-model-1')} />);
    expect(screen.getByText('128K tokens')).toBeInTheDocument();
    expect(screen.getByText('In $1.00')).toBeInTheDocument();
    expect(screen.getByText('Out $4.00')).toBeInTheDocument();
  });

  it('shows one benchmark (latest result + evaluation type) when sorting by it', () => {
    render(
      <ModelCard
        model={item('sample-model-2')}
        sortBenchmark={{ slug: 'sample-benchmark-1', name: 'Sample Benchmark 1' }}
      />,
    );
    const chip = screen.getByText(/Sample Benchmark 1:/).closest('p')!;
    // Latest result is the independent 74%, not the older provider-reported 78%.
    expect(within(chip).getByText('74%')).toBeInTheDocument();
    expect(chip).toHaveTextContent('independent');
  });

  it('says "No verified data" when the model has no result for the sorted benchmark', () => {
    render(
      <ModelCard
        model={item('sample-model-14')}
        sortBenchmark={{ slug: 'sample-benchmark-1', name: 'Sample Benchmark 1' }}
      />,
    );
    expect(screen.getByText('No verified data')).toBeInTheDocument();
  });
});

describe('pricingSummary', () => {
  it('never presents a missing figure as free', () => {
    const partial = pricingSummary({
      pricingKind: 'free-tier',
      currentPricing: { input: 0.5, output: null, currency: 'USD', unit: 'per 1M tokens' },
    });
    expect(partial.lines).toEqual(['In $0.50', 'Out Not publicly disclosed']);
  });

  it('maps each pricing kind without token prices', () => {
    const s = (pricingKind: Parameters<typeof pricingSummary>[0]['pricingKind']) =>
      pricingSummary({ pricingKind, currentPricing: null }).lines[0];
    expect(s('free')).toBe('Free');
    expect(s('custom')).toBe('Custom pricing');
    expect(s('free-tier')).toBe('Free tier');
    expect(s('paid')).toBe('Paid');
    expect(s('unknown')).toBe('Not publicly disclosed');
  });
});
