import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill, { EpochStatusPill } from '../StatusPill';
import { DAY_LIFECYCLE, DAY_LIFECYCLE_LABEL } from '../../../domain/dayLifecycle';

describe('StatusPill (day-lifecycle vocabulary wrapper)', () => {
  it('renders the canonical label for every lifecycle variant', () => {
    for (const variant of Object.values(DAY_LIFECYCLE)) {
      const { unmount } = render(<StatusPill variant={variant} />);
      expect(screen.getByText(DAY_LIFECYCLE_LABEL[variant])).toBeInTheDocument();
      unmount();
    }
  });

  it('honors a short label override without changing the variant', () => {
    render(<StatusPill variant={DAY_LIFECYCLE.READY} label="Ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    // The full canonical label ("Ready to export") is overridden by the short label.
    expect(screen.queryByText(DAY_LIFECYCLE_LABEL.ready)).not.toBeInTheDocument();
  });

  it('applies a distinct token-driven class per variant (no shared color across states)', () => {
    const classFor = (variant) => {
      const { container, unmount } = render(<StatusPill variant={variant} />);
      const cls = container.firstChild.className;
      unmount();
      return cls;
    };
    const classes = [
      classFor(DAY_LIFECYCLE.DRAFT),
      classFor(DAY_LIFECYCLE.READY),
      classFor(DAY_LIFECYCLE.VALIDATED),
      classFor(DAY_LIFECYCLE.EXPORTED),
      classFor(DAY_LIFECYCLE.NEEDS_FIXING),
    ];
    expect(new Set(classes).size).toBe(5);
  });
});

describe('EpochStatusPill (epoch-row scope — its own vocabulary)', () => {
  it('renders all three epoch states', () => {
    const { rerender } = render(<EpochStatusPill status="complete" />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    rerender(<EpochStatusPill status="incomplete" />);
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
    rerender(<EpochStatusPill status="needs_video" />);
    expect(screen.getByText('Needs video')).toBeInTheDocument();
  });

  it('never renders a day-lifecycle word (scopes do not share vocabulary)', () => {
    for (const status of ['complete', 'incomplete', 'needs_video']) {
      const { unmount } = render(<EpochStatusPill status={status} />);
      for (const label of Object.values(DAY_LIFECYCLE_LABEL)) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
      unmount();
    }
  });
});
