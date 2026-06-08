/**
 * Accessibility contract for the tabbed Animal View (Phase 5 Task 5.4 — the a11y + visual pass over
 * the hub that is now the sole home for an animal's days + setup).
 *
 * The interactive widget keyboard behaviour is pinned alongside the widgets themselves —
 * OverflowMenu / AnimalSwitcher (roving focus, Esc-returns-focus, Home/End/arrows), AnimalDeleteDialog
 * (focus trap + return), the unsaved-edit nav guard. This file pins the SHELL-level a11y the doc
 * calls out: exactly one `main` landmark per route, the section-nav as a single navigation landmark,
 * focus moving onto the labelled panel on a tab change (so a SR/keyboard user lands on the new
 * section's content, not stranded at the top of the document), and an Axe structural pass.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';

/**
 * A configured animal whose setup tabs render real content (not the todo-empty states).
 * @returns {object} The remy animal record.
 */
function buildAnimal() {
  return {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
    devices: {
      electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [{ ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }],
      data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
    },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
    cameras: [{ id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, manufacturer: 'AV', model: 'Mako', lens: 'Fuji' }],
    behavioral_events: [{ name: 'Din1', description: 'reward' }],
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: { electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
    days: [],
  };
}

/**
 * Render AnimalView for a tab against a seeded store.
 * @param {string} tab - The active tab.
 * @returns {object} render result
 */
function renderView(tab) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: buildAnimal() }, days: {}, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
    </StoreProvider>
  );
}

beforeEach(() => {
  delete window.location;
  window.location = { hash: '#/animal/remy/days' };
});
afterEach(() => {
  window.location = { hash: '' };
});

describe('AnimalView a11y — landmarks (Task 5.4)', () => {
  it('exposes exactly one main + one #main-content on the animal route', () => {
    const { container } = renderView('days');
    expect(container.querySelectorAll('[role="main"], main')).toHaveLength(1);
    expect(container.querySelectorAll('#main-content')).toHaveLength(1);
  });

  it('renders a single section-nav navigation landmark labelled for the animal', () => {
    renderView('cameras');
    // One navigation landmark within the view (AppLayout's primary nav is a separate host concern).
    const navs = screen.getAllByRole('navigation');
    expect(navs).toHaveLength(1);
    expect(navs[0]).toHaveAccessibleName(/animal sections/i);
  });

  it('labels the active panel with the current tab so assistive tech announces the section', () => {
    renderView('cameras');
    // The panel region is labelled by the tab, so focusing it announces "Cameras".
    expect(screen.getByRole('region', { name: /^cameras$/i })).toBeInTheDocument();
  });
});

describe('AnimalView a11y — focus management on tab change (Task 5.4)', () => {
  it('moves focus onto the (labelled) panel when the tab changes — not stranded at the top', () => {
    const { rerender } = renderView('days');
    // First render does NOT steal focus (AppLayout owns mount focus).
    const panelBefore = screen.getByRole('region', { name: /recording days/i });
    expect(panelBefore).not.toHaveFocus();

    // A tab change moves focus to the new panel (labelled by the new tab).
    rerender(
      <StoreProvider initialState={{ workspace: { animals: { remy: buildAnimal() }, days: {}, settings: {} } }}>
        <AnimalView animalId="remy" tab="cameras" />
      </StoreProvider>
    );
    expect(screen.getByRole('region', { name: /^cameras$/i })).toHaveFocus();
  });

  it('the focused panel is programmatically focusable (tabindex=-1), not a tab stop', () => {
    renderView('electrode-groups');
    const panel = screen.getByRole('region', { name: /electrode groups/i });
    expect(panel).toHaveAttribute('tabindex', '-1');
  });
});

describe('AnimalView a11y — Axe structural pass (Task 5.4)', () => {
  it('has no Axe violations on a day-work tab', async () => {
    const { container } = renderView('days');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no Axe violations on a setup tab', async () => {
    const { container } = renderView('cameras');
    expect(await axe(container)).toHaveNoViolations();
  });
});
