/**
 * Day Devices workflow copy (Phase 8.6 Task 4). The Devices step must explain the current
 * day's relationship to shared animal setup: it USES a configuration version, probe geometry
 * is edited in the shared animal setup, failed channels are day-specific, and reconfiguration
 * is "hardware changed starting this day" — distinct from editing shared setup.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DevicesStep from '../DevicesStep';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../../state/workspaceUtils';

/**
 *
 * @param root0
 * @param root0.withReconfig
 */
function renderDevices({ withReconfig = false } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  const merged = mergeDayMetadata(animal, day);
  const extra = withReconfig
    ? { animalDays: [day], actions: { createConfigurationSnapshotAndApplyForward: vi.fn() } }
    : {};
  render(
    <DevicesStep animal={animal} day={day} mergedDay={merged} onFieldUpdate={vi.fn()} {...extra} />
  );
}

describe('Day Devices workflow copy', () => {
  it('labels failed channels as applying to this recording day only', () => {
    renderDevices();
    expect(
      screen.getByText(/mark failed channels for this recording day/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/apply to this day only/i)).toBeInTheDocument();
  });

  it('frames reconfiguration as "hardware changed starting this day", distinct from editing shared setup', () => {
    renderDevices({ withReconfig: true });
    expect(
      screen.getByRole('button', { name: /hardware changed starting this day/i })
    ).toBeInTheDocument();
    // The shared-setup edit link is a separate, distinctly-labeled action.
    expect(
      screen.getByRole('link', { name: /edit shared animal electrode setup/i })
    ).toBeInTheDocument();
  });
});
