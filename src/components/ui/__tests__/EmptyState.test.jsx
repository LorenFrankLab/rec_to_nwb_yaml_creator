/**
 * EmptyState component tests (epoch-editor Phase 8).
 *
 * The shared onboarding zero-state (icon + heading + body + CTA actions) used by the Animals home and
 * the per-animal recording-days pane. These pin its structure: it renders a heading, body copy, and
 * the caller's CTA actions, and the decorative icon is hidden from assistive tech.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders the heading, body, and CTA actions', () => {
    render(
      <EmptyState
        icon="＋"
        title="No animals yet"
        actions={<button type="button">New animal</button>}
      >
        Start by setting up an animal.
      </EmptyState>
    );

    expect(screen.getByRole('heading', { name: 'No animals yet' })).toBeInTheDocument();
    expect(screen.getByText('Start by setting up an animal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New animal' })).toBeInTheDocument();
  });

  it('hides the decorative icon from assistive technology', () => {
    const { container } = render(
      <EmptyState icon="📅" title="No recording days yet">
        Add the first recording day.
      </EmptyState>
    );
    // The icon is decorative — present visually but not announced.
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('📅');
  });

  it('renders without an icon or actions', () => {
    render(<EmptyState title="Nothing here">Body only.</EmptyState>);
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('Body only.')).toBeInTheDocument();
  });
});
