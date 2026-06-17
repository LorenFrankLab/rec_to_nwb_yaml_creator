/**
 * Accessibility (axe) tests for the create-animal wizard.
 *
 * The stepper is a proper WAI-ARIA tablist (role="tablist" over role="tab" pills, a single
 * role="tabpanel" labelled by the active tab, roving tabindex), and the whole surface is axe-clean.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { StoreProvider } from '../../../state/StoreContext';
import CreateAnimalWizard from '../CreateAnimalWizard';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 * Render the wizard against a fresh, empty store.
 * @returns {object} The render result.
 */
function renderWizard() {
  return render(
    <StoreProvider initialState={{ workspace: { animals: {}, days: {}, settings: {} } }}>
      <CreateAnimalWizard />
    </StoreProvider>
  );
}

describe('CreateAnimalWizard — accessibility', () => {
  it('renders the stepper as a proper tablist with a single labelled tabpanel', () => {
    renderWizard();
    const tablist = screen.getByRole('tablist', { name: /setup steps/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(7);

    // Exactly one tab is selected; its panel is the labelled tabpanel.
    const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute('aria-controls', 'wizard-panel');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'wizard-panel');
    expect(panel).toHaveAttribute('aria-labelledby', selected[0].id);

    // Roving tabindex: only the active tab is in the tab order.
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('has no axe violations on the Identity step', async () => {
    const { container } = renderWizard();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations after advancing to a setup step', async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByRole('textbox', { name: /Subject ID/i }), 'laurent');
    await user.clear(screen.getByLabelText(/Weight/i));
    await user.type(screen.getByLabelText(/Weight/i), '450');
    fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '2025-01-02' } });
    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByRole('tab', { name: /Electrodes/ })).toHaveAttribute('aria-selected', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });
});
