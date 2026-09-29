import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemoBadge, VerificationBadge } from '@/components/ui/badges';
import { VERIFICATION_STATUSES, verificationLabel } from '@/lib/verification';

describe('VerificationBadge', () => {
  it.each(VERIFICATION_STATUSES)('shows a text label and an icon for %s', (status) => {
    const { container } = render(<VerificationBadge status={status} />);
    expect(screen.getByText(verificationLabel[status])).toBeInTheDocument();
    // Meaning is never color-only: an icon accompanies the label.
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('DemoBadge', () => {
  it('renders a visible DEMO DATA label', () => {
    render(<DemoBadge />);
    expect(screen.getByText(/demo data/i)).toBeVisible();
  });
});
