import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlastRadiusChip from '../BlastRadiusChip';

describe('BlastRadiusChip (shared-edit blast radius)', () => {
  it('renders the N-days copy and the re-export tooltip', () => {
    render(<BlastRadiusChip dayCount={5} />);
    const chip = screen.getByText(/affects all 5 days/i);
    expect(chip).toBeInTheDocument();
    // The warning explanation rides on the title attribute (hover tooltip).
    expect(chip).toHaveAttribute(
      'title',
      expect.stringMatching(/already-exported days will need re-export/i),
    );
  });

  it('lets the caller override the tooltip text', () => {
    render(<BlastRadiusChip dayCount={2} title="Custom warning" />);
    expect(screen.getByText(/affects all 2 days/i)).toHaveAttribute('title', 'Custom warning');
  });

  it('uses singular grammar for a single day', () => {
    render(<BlastRadiusChip dayCount={1} />);
    expect(screen.getByText(/affects all 1 day$/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 days/i)).not.toBeInTheDocument();
  });
});
