/**
 * ConfigVersionContext — the plain-language configuration timeline on the electrode-groups tab.
 * A pinned-only version (an imported back-fill) is not a point on that timeline: it must not read
 * as "this and later days use vN".
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfigVersionContext from '../ConfigVersionContext';

const snapshot = (version, date, description, extra = {}) => ({
  version,
  date,
  description,
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
  appliedToDays: [],
  ...extra,
});

describe('ConfigVersionContext', () => {
  it('describes each reconfiguration boundary of the timeline', () => {
    render(
      <ConfigVersionContext
        animal={{ configurationHistory: [snapshot(1, '2023-06-01', 'implant'), snapshot(2, '2023-07-01', 'lowered')] }}
      />
    );
    expect(
      screen.getByText(
        'Electrode configuration changed on 2023-07-01 — earlier recording days use v1, this and later days use v2. (lowered)'
      )
    ).toBeInTheDocument();
  });

  it('describes a pinned-only (back-filled) version as used only by its own imported days', () => {
    render(
      <ConfigVersionContext
        animal={{
          configurationHistory: [
            snapshot(1, '2023-06-01', 'implant'),
            snapshot(3, '2023-06-10', 'Imported setup recorded on 2023-06-10', { pinnedOnly: true }),
            snapshot(2, '2023-07-01', 'lowered'),
          ],
        }}
      />
    );
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual([
      'Electrode configuration changed on 2023-07-01 — earlier recording days use v1, this and later days use v2. (lowered)',
      'v3 is used only by the imported recording days pinned to it; other days never get it. (Imported setup recorded on 2023-06-10)',
    ]);
  });

  it('explains a back-filled version even when the timeline itself never changed', () => {
    render(
      <ConfigVersionContext
        animal={{
          configurationHistory: [
            snapshot(2, '2023-06-10', 'Imported setup recorded on 2023-06-10', { pinnedOnly: true }),
            snapshot(1, '2026-10-01', 'Initial configuration'),
          ],
        }}
      />
    );
    expect(screen.queryByText(/Electrode configuration changed on/)).toBeNull();
    expect(screen.getByRole('listitem')).toHaveTextContent(/^v2 is used only by the imported recording days pinned to it/);
  });
});
