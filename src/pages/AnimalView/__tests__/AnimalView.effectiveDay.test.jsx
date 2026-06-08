/**
 * Tests for the dated config legibility + effective-setup-for-THIS-day review on the per-animal
 * Validation & Export tab (Phase 3-5, Tasks 3.4 + 3.3a — the valid-but-wrong defense).
 *
 * A day pinned to an OLDER configuration version must show, read-only, what THAT day actually used
 * (dated config context + electrode groups from its pinned version) — labelled distinct from the
 * animal's CURRENT setup tabs — so a historical day is never mistaken for one on the latest config.
 * Values come from buildPreflightSummary (the same source the export preflight uses).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { AnimalView } from '../index';

/**
 * A two-version remy: a v2 snapshot with one EXTRA electrode group is the latest; the day is pinned
 * to v1, so its effective setup (v1's group count) differs from the current (v2) setup.
 * @returns {{ workspace: object, dayId: string, v1GroupCount: number }}
 */
function buildTwoVersionWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  const v1 = animal.configurationHistory[0]; // version 1, dated 2023-06-22
  const v1GroupCount = v1.devices.electrode_groups.length; // 8
  const v2 = {
    ...structuredClone(v1),
    version: 2,
    date: '2023-07-10',
    description: 'Added a probe',
    devices: {
      electrode_groups: [
        ...structuredClone(v1.devices.electrode_groups),
        { id: 99, location: 'PFC', device_type: 'tetrode_12.5', targeted_location: 'mPFC', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' },
      ],
      ntrode_electrode_group_channel_map: structuredClone(v1.devices.ntrode_electrode_group_channel_map),
    },
    appliedToDays: [],
  };
  animal.configurationHistory = [v1, v2];
  day.configurationVersion = 1; // pin to v1 (animal latest is now v2)

  return {
    workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} },
    dayId: day.id,
    v1GroupCount,
  };
}

describe('AnimalView export tab — dated config legibility + effective-day review (Phase 3-5)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/export' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('shows dated config context (not a bare "v1") on a historical day row', () => {
    const { workspace, dayId } = buildTwoVersionWorkspace();
    render(
      <StoreProvider initialState={{ workspace }}>
        <AnimalView animalId="remy" tab="export" />
      </StoreProvider>
    );
    const expander = screen.getByTestId(`effective-${dayId}`);
    // v1 is dated 2023-06-22 and is historical (latest is v2).
    expect(within(expander).getByText(/config from 2023-06-22 \(historical — v1\)/i)).toBeInTheDocument();
  });

  it('shows the read-only effective setup the day USED (v1\'s electrode groups), labelled distinct from current', () => {
    const { workspace, dayId, v1GroupCount } = buildTwoVersionWorkspace();
    render(
      <StoreProvider initialState={{ workspace }}>
        <AnimalView animalId="remy" tab="export" />
      </StoreProvider>
    );
    const review = within(screen.getByTestId(`effective-${dayId}`)).getByRole('group', {
      name: /effective setup for this day/i,
    });
    // Labelled as what THIS day used (not the live setup tabs).
    expect(within(review).getByText(/what this day used \(read-only\)/i)).toBeInTheDocument();
    // The pinned v1 group count (8) — NOT the current v2 count (9) — sourced from buildPreflightSummary.
    expect(within(review).getByText(new RegExp(`${v1GroupCount} electrode groups`, 'i'))).toBeInTheDocument();
  });
});
