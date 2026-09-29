import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CompareToggle } from '@/components/comparison/compare-toggle';
import { ComparisonTray } from '@/components/comparison/comparison-tray';
import { useComparison } from '@/components/comparison/comparison-store';
import { CostEstimator } from '@/components/models/profile/cost-estimator';
import { demoModelDetails } from '../../server/repositories/demo/models';

const pricing = (slug: string) => demoModelDetails.find((m) => m.slug === slug)!.pricing;

describe('CostEstimator', () => {
  // Sample Model 2 current prices: input $2, output $8, cached $0.5 per 1M tokens.
  const setup = (slug = 'sample-model-2') =>
    render(<CostEstimator entries={pricing(slug)} modelName="Sample Model 2" />);

  it('computes the default workload', () => {
    setup();
    // 1,000,000 in * $2 + 250,000 out * $8 = $2 + $2 = $4
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$4.00');
  });

  it('updates as the user types', async () => {
    setup();
    const input = screen.getByLabelText('Input tokens');
    await userEvent.clear(input);
    await userEvent.type(input, '500000');
    const cached = screen.getByLabelText('Cached input tokens');
    await userEvent.clear(cached);
    await userEvent.type(cached, '2000000');
    // 0.5M*2 + 0.25M*8 + 2M*0.5 = 1 + 2 + 1 = 4
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$4.00');
  });

  it('accepts thousands separators and blank fields', async () => {
    setup();
    const input = screen.getByLabelText('Input tokens');
    await userEvent.clear(input);
    await userEvent.type(input, '2,000,000');
    const output = screen.getByLabelText('Output tokens');
    await userEvent.clear(output);
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$4.00');
  });

  it('rejects invalid input with a clear message instead of a wrong number', async () => {
    setup();
    const input = screen.getByLabelText('Input tokens');
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(screen.getByRole('status')).toHaveTextContent(/non-negative token counts/i);
    expect(screen.queryByTestId('estimate-total')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(input);
    await userEvent.type(input, '-5');
    expect(screen.getByRole('status')).toHaveTextContent(/non-negative token counts/i);
  });

  it('flags a partial estimate when a price is not publicly disclosed', () => {
    // Sample Model 5 has an input price but an undisclosed output price.
    setup('sample-model-5');
    expect(screen.getByText(/lower bound/i)).toBeInTheDocument();
    expect(screen.getAllByText('Cannot estimate').length).toBeGreaterThan(0);
  });
});

/** Test harness exposing the store so tests can reset shared state. */
function Reset() {
  const { clear } = useComparison();
  return <button onClick={clear}>reset-store</button>;
}

describe('comparison toggle and tray', () => {
  afterEach(async () => {
    await act(async () => {
      screen.queryByText('reset-store')?.click();
    });
  });

  const models = Array.from({ length: 5 }, (_, i) => ({
    slug: `m-${i + 1}`,
    name: `Model ${i + 1}`,
    providerName: 'P',
  }));

  const setup = () =>
    render(
      <>
        <Reset />
        {models.map((m) => (
          <CompareToggle key={m.slug} {...m} />
        ))}
        <ComparisonTray />
      </>,
    );

  it('adds models to the tray and links to /compare with the selection', async () => {
    setup();
    expect(
      screen.queryByRole('complementary', { name: 'Comparison tray' }),
    ).not.toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /add to comparison/i });
    await userEvent.click(buttons[0]!);
    const tray = await screen.findByRole('complementary', { name: 'Comparison tray' });
    expect(within(tray).getByText('Select 2 or more')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /add to comparison/i })[0]!);
    expect(within(tray).getByRole('link', { name: 'Compare' })).toHaveAttribute(
      'href',
      '/compare?models=m-1,m-2',
    );
  });

  it('caps the selection at four and disables the rest with an explanation', async () => {
    setup();
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getAllByRole('button', { name: /add to comparison/i })[0]!);
    }
    const fifth = screen.getByRole('button', { name: /add to comparison/i });
    expect(fifth).toBeDisabled();
    expect(fifth).toHaveAttribute('title', expect.stringMatching(/up to 4/));
    expect(screen.getAllByRole('button', { name: /in comparison/i })).toHaveLength(4);
  });

  it('removes a model from the tray and clears everything', async () => {
    setup();
    await userEvent.click(screen.getAllByRole('button', { name: /add to comparison/i })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: /add to comparison/i })[0]!);
    const tray = await screen.findByRole('complementary', { name: 'Comparison tray' });
    await userEvent.click(
      within(tray).getByRole('button', { name: 'Remove Model 1 from comparison' }),
    );
    // Chips and the tray animate out, so wait for them to leave the DOM.
    await waitFor(() => expect(within(tray).queryByText('Model 1')).not.toBeInTheDocument());
    await userEvent.click(within(tray).getByRole('button', { name: 'Clear' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Comparison tray' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('persists the selection in localStorage', async () => {
    setup();
    await userEvent.click(screen.getAllByRole('button', { name: /add to comparison/i })[0]!);
    expect(JSON.parse(localStorage.getItem('axiom-compare')!)).toEqual([
      { slug: 'm-1', name: 'Model 1', providerName: 'P' },
    ]);
  });
});
