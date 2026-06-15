import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportStep from '../ExportStep';
import * as yaml from '../../../io/yaml';
import { restoreFlags } from '../../../featureFlags';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { buildDayEditorViewModel } from '../../../viewModels/dayEditorViewModel';

/**
 * A two-day, same-`configurationVersion` animal where day 2's effective bad-channel set is a
 * strict subset of day 1's: channel 2 on ntrode 1 was marked bad on the earlier day but is
 * silently un-failed on the later day, with no acknowledgement. Bad channels are monotonic
 * (hardware does not heal), so the later day must be export-BLOCKED.
 *
 * The whole regression lives in the cross-day relationship — neither day is wrong in isolation —
 * so the block only surfaces when the export gate is fed the animal's other days (`animalDays`).
 *
 * @returns {{ animal: object, day1: object, day2: object, animalDays: object[] }}
 */
function buildRegressingTwoDayAnimal() {
  const { animal, day: day1 } = buildRealisticWorkspace();
  day1.id = 'remy-2023-06-22';
  day1.date = '2023-06-22';
  day1.experimentDate = '06222023';
  // Earlier day: ntrode 1 (electrode group 0) has channel 2 marked bad (day-owned override).
  day1.deviceOverrides = { bad_channels: { 1: [2] } };

  const day2 = structuredClone(day1);
  day2.id = 'remy-2023-06-23';
  day2.date = '2023-06-23';
  day2.experimentDate = '06232023';
  // Later day silently DROPS channel 2 from ntrode 1 — an unacknowledged monotonicity regression.
  day2.deviceOverrides = { bad_channels: { 1: [] } };

  animal.days = [day1.id, day2.id];
  const animalDays = [day1, day2];
  return { animal, day1, day2, animalDays };
}

afterEach(() => {
  vi.restoreAllMocks();
  restoreFlags();
});

describe('ExportStep — bad-channel monotonicity export gate', () => {
  it('BLOCKS download for a day that silently un-fails an earlier same-config bad channel (animalDays threaded)', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day1, day2, animalDays } = buildRegressingTwoDayAnimal();
    // The blocked repair list renders the view-model's classified issues (Phase 3-f); build the
    // view-model over the full animal index so the cross-day monotonicity issue is present.
    const vm = buildDayEditorViewModel(
      { animals: { [animal.id]: animal }, days: { [day1.id]: day1, [day2.id]: day2 } },
      day2.id
    );

    render(
      <ExportStep
        animal={animal}
        day={day2}
        animalDays={animalDays}
        issues={vm.issues}
        exportGate={vm.export}
        onNavigate={vi.fn()}
      />
    );

    const downloadButton = screen.getByRole('button', { name: /download yaml/i });
    expect(downloadButton).toBeDisabled();
    // The blocking reason names the monotonicity issue (un-marked bad channel).
    expect(screen.getByText(/marked bad on an earlier recording day/i)).toBeInTheDocument();

    // Defense in depth: forcing a click still produces no file.
    downloadButton.removeAttribute('disabled');
    await user.click(downloadButton);
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('does NOT block the same day when animalDays is omitted (single-day caller back-compat)', () => {
    // Without the cross-day context the rule is a no-op — this is exactly the pre-fix gap; we
    // pin it so the `= []` default keeps isolated single-day callers unaffected.
    const { animal, day2 } = buildRegressingTwoDayAnimal();

    render(<ExportStep animal={animal} day={day2} onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: /download yaml/i })).toBeEnabled();
    expect(screen.queryByText(/marked bad on an earlier recording day/i)).not.toBeInTheDocument();
  });

  it('UNBLOCKS the day once the bad-channel removal is acknowledged', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day2, animalDays } = buildRegressingTwoDayAnimal();
    // Acknowledge the removal off-export (day.state.badChannelRemovalAcks) — the documented
    // clear path that records the deliberate un-mark without restoring the channel.
    day2.state = { ...day2.state, badChannelRemovalAcks: { 1: [2] } };

    render(
      <ExportStep animal={animal} day={day2} animalDays={animalDays} onNavigate={vi.fn()} />
    );

    const downloadButton = screen.getByRole('button', { name: /download yaml/i });
    expect(downloadButton).toBeEnabled();
    expect(screen.queryByText(/marked bad on an earlier recording day/i)).not.toBeInTheDocument();

    await user.click(downloadButton);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT block a non-regressing later day (effective bad set is a superset)', () => {
    // Day 2 keeps channel 2 AND adds channel 1 — monotonic, so no false block.
    const { animal, day2, animalDays } = buildRegressingTwoDayAnimal();
    day2.deviceOverrides = { bad_channels: { 1: [1, 2] } };

    render(
      <ExportStep animal={animal} day={day2} animalDays={animalDays} onNavigate={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /download yaml/i })).toBeEnabled();
    expect(screen.queryByText(/marked bad on an earlier recording day/i)).not.toBeInTheDocument();
  });
});
