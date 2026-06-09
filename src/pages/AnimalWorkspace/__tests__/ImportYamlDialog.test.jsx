/**
 * Import-YAML UI (validation slice). The pure reconcile core (planImport / applyImportPlan) is
 * tested elsewhere; this drives the USER-FACING two-phase flow (pick → preview/confirm) against a
 * LIVE store and asserts real behavior:
 *   - preview groups files by animal and counts days / config versions,
 *   - divergences are SURFACED (never silent),
 *   - a conflict with an existing animal shows a resolution control whose choice is honored,
 *   - Cancel writes NOTHING,
 *   - a partial failure is listed (with reason) yet the valid files still import,
 *   - the end-to-end happy path lands the animals + days in the store.
 *
 * Input files are GENUINE merge output (encode `mergeDayMetadata(animal, day)`), NOT the legacy
 * golden fixtures — those are not merge fixed points and would not decompose cleanly.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { encodeYaml } from '../../../io/yaml';
import { mergeDayMetadata as merge } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import ImportYamlDialog from '../ImportYamlDialog';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
  vi.restoreAllMocks();
});

/**
 * A File-like object whose `.text()` resolves to the given YAML (models the browser File API the
 * parse helper uses; jsdom's File constructor does not always expose `.text()`).
 * @param {string} name
 * @param {string} text
 * @returns {{ name: string, text: () => Promise<string> }}
 */
function makeFile(name, text) {
  return { name, text: () => Promise.resolve(text) };
}

/**
 * Encode one (animal, day) to its merge-output File with the `{mmddYYYY}_{subject}_metadata.yml`
 * name the import date-derivation expects.
 * @param {object} animal
 * @param {object} day
 * @param {string} [subjectIdOverride] - Override the file's subject id (for cross-animal cases).
 * @returns {{ name: string, text: () => Promise<string> }}
 */
function fileFor(animal, day, subjectIdOverride) {
  const merged = merge(animal, day);
  const yaml = encodeYaml(merged);
  const [y, m, d] = day.date.split('-');
  const subjectId = subjectIdOverride ?? animal.subject.subject_id;
  return makeFile(`${m}${d}${y}_${subjectId}_metadata.yml`, yaml);
}

/**
 * Build a one-day workspace for a named subject from the realistic builder, re-keyed to that id.
 * @param {string} subjectId
 * @param {string} date - ISO date.
 * @param {(animal: object, day: object) => void} [mutate] - Optional in-place tweak.
 * @returns {{ animal: object, day: object }}
 */
function buildFor(subjectId, date, mutate) {
  const { animal: base, day: baseDay } = buildRealisticWorkspace();
  const animal = structuredClone(base);
  animal.id = subjectId;
  animal.subject.subject_id = subjectId;
  const day = structuredClone(baseDay);
  day.id = `${subjectId}-${date}`;
  day.animalId = subjectId;
  day.date = date;
  const [y, m, d] = date.split('-');
  day.experimentDate = `${m}${d}${y}`;
  day.session.session_id = `${subjectId}_${y}${m}${d}`;
  if (mutate) mutate(animal, day);
  return { animal, day };
}

/**
 * A tiny harness that mounts the dialog open and exposes the live store to assertions, plus a
 * `closed` marker so a test can observe the dialog closing.
 * @param {object} props - Harness props.
 * @param {object} [props.initialState] - Store initial state.
 * @returns {JSX.Element}
 */
function Harness({ initialState }) {
  return (
    <StoreProvider initialState={initialState}>
      <Inner />
    </StoreProvider>
  );
}

/**
 * Inner consumer: renders the dialog and a live read-out of the store for assertions.
 * @returns {JSX.Element}
 */
function Inner() {
  const { model } = useStoreContext();
  const [open, setOpen] = useState(true);
  const ws = model.workspace;
  return (
    <>
      <div data-testid="animal-ids">{Object.keys(ws.animals ?? {}).sort().join(',')}</div>
      <div data-testid="day-ids">{Object.keys(ws.days ?? {}).sort().join(',')}</div>
      {open && <ImportYamlDialog onClose={() => setOpen(false)} />}
      {!open && <div data-testid="closed">closed</div>}
    </>
  );
}

/**
 * Drive the pick phase: upload the given files through the dialog's file input and wait for preview.
 * @param {object} user - userEvent session.
 * @param {Array} files - File-like objects.
 */
async function pickFiles(user, files) {
  const input = screen.getByLabelText('Choose YAML files to import');
  await user.upload(input, files);
  await screen.findByRole('button', { name: /^confirm import$|^confirm$/i });
}

describe('ImportYamlDialog — preview/confirm flow', () => {
  it('preview groups files by animal and counts days + config versions', async () => {
    const user = userEvent.setup();
    const r1 = buildFor('remy', '2023-06-22');
    const r2 = buildFor('remy', '2023-06-25');
    const r3 = buildFor('remy', '2023-06-28');
    const t1 = buildFor('totoro', '2023-07-01');

    render(<Harness initialState={{ workspace: { animals: {}, days: {}, settings: {} } }} />);
    const files = [
      fileFor(r1.animal, r1.day),
      fileFor(r2.animal, r2.day),
      fileFor(r3.animal, r3.day),
      fileFor(t1.animal, t1.day),
    ];
    await pickFiles(user, files);

    // Two animal cards.
    expect(screen.getByRole('region', { name: /import preview/i })).toBeInTheDocument();
    expect(screen.getByText(/4 recording days/i)).toBeInTheDocument();
    expect(screen.getByText('remy')).toBeInTheDocument();
    expect(screen.getByText('totoro')).toBeInTheDocument();

    // remy: 3 days, all the same config → 1 hardware configuration.
    const remyCard = screen.getByRole('group', { name: /animal remy/i });
    expect(within(remyCard).getByText(/3 recording days/i)).toBeInTheDocument();
    expect(within(remyCard).getByText(/1 hardware configuration/i)).toBeInTheDocument();
  });

  it('surfaces a cameras divergence (not silently)', async () => {
    const user = userEvent.setup();
    const a = buildFor('remy', '2023-06-22');
    const b = buildFor('remy', '2023-06-25', (animal) => {
      // Same camera name, different dependent field → an identity divergence the import must
      // surface (both files stay valid: no day references are broken).
      animal.cameras = animal.cameras.map((c) =>
        c.camera_name === 'overhead_camera' ? { ...c, meters_per_pixel: 0.99 } : c
      );
    });

    render(<Harness initialState={{ workspace: { animals: {}, days: {}, settings: {} } }} />);
    await pickFiles(user, [fileFor(a.animal, a.day), fileFor(b.animal, b.day)]);

    const remyCard = screen.getByRole('group', { name: /animal remy/i });
    const alerts = within(remyCard).getAllByRole('alert');
    expect(alerts.some((el) => /camera/i.test(el.textContent))).toBe(true);
  });

  it('shows a conflict + resolution control; Skip then Confirm writes nothing for that animal', async () => {
    const user = userEvent.setup();
    const existing = buildFor('remy', '2023-06-22').animal;
    // Pre-seed remy into the store (no days) so the import conflicts.
    const initialState = {
      workspace: { animals: { remy: existing }, days: {}, settings: {} },
    };
    const imp = buildFor('remy', '2023-06-25');

    render(<Harness initialState={initialState} />);
    await pickFiles(user, [fileFor(imp.animal, imp.day)]);

    const remyCard = screen.getByRole('group', { name: /animal remy/i });
    // Conflict is surfaced.
    expect(within(remyCard).getByText(/already (exists|in the workspace)/i)).toBeInTheDocument();
    // Choose "Skip".
    await user.click(within(remyCard).getByRole('radio', { name: /skip/i }));
    await user.click(screen.getByRole('button', { name: /^confirm import$|^confirm$/i }));

    // No new day was written for remy.
    await waitFor(() => expect(screen.getByTestId('day-ids').textContent).toBe(''));
  });

  it('conflict → Add writes the imported day onto the existing animal', async () => {
    const user = userEvent.setup();
    const existing = buildFor('remy', '2023-06-22').animal;
    const initialState = { workspace: { animals: { remy: existing }, days: {}, settings: {} } };
    const imp = buildFor('remy', '2023-06-25');

    render(<Harness initialState={initialState} />);
    await pickFiles(user, [fileFor(imp.animal, imp.day)]);

    const remyCard = screen.getByRole('group', { name: /animal remy/i });
    // 'Add' is the default; click it explicitly to be sure.
    await user.click(within(remyCard).getByRole('radio', { name: /add/i }));
    await user.click(screen.getByRole('button', { name: /^confirm import$|^confirm$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('day-ids').textContent).toContain('remy-2023-06-25')
    );
  });

  it('Cancel writes nothing', async () => {
    const user = userEvent.setup();
    const a = buildFor('remy', '2023-06-22');

    render(<Harness initialState={{ workspace: { animals: {}, days: {}, settings: {} } }} />);
    await pickFiles(user, [fileFor(a.animal, a.day)]);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await screen.findByTestId('closed');
    expect(screen.getByTestId('animal-ids').textContent).toBe('');
    expect(screen.getByTestId('day-ids').textContent).toBe('');
  });

  it('lists a partial failure with a reason yet still imports the valid files on Confirm', async () => {
    const user = userEvent.setup();
    const good = buildFor('remy', '2023-06-22');
    const bad = makeFile('broken.yml', ': : :\n  nope');

    render(<Harness initialState={{ workspace: { animals: {}, days: {}, settings: {} } }} />);
    await pickFiles(user, [fileFor(good.animal, good.day), bad]);

    // The summary counts BOTH picked files (1 valid + 1 failed), and flags the failure.
    expect(screen.getByText(/2 files →/i)).toBeInTheDocument();
    expect(screen.getByText(/1 file could not be imported/i)).toBeInTheDocument();

    // The bad file is listed in the un-importable section with its name + a reason.
    const unimportable = screen.getByRole('region', { name: /could not be imported|un-?importable/i });
    expect(within(unimportable).getByText(/broken\.yml/)).toBeInTheDocument();

    // The valid file still imports.
    await user.click(screen.getByRole('button', { name: /^confirm import$|^confirm$/i }));
    await waitFor(() =>
      expect(screen.getByTestId('animal-ids').textContent).toBe('remy')
    );
  });

  it('end-to-end happy path: pick valid files → Confirm → animals + days exist', async () => {
    const user = userEvent.setup();
    const r = buildFor('remy', '2023-06-22');
    const t = buildFor('totoro', '2023-07-01');

    render(<Harness initialState={{ workspace: { animals: {}, days: {}, settings: {} } }} />);
    await pickFiles(user, [fileFor(r.animal, r.day), fileFor(t.animal, t.day)]);

    await user.click(screen.getByRole('button', { name: /^confirm import$|^confirm$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('animal-ids').textContent).toBe('remy,totoro')
    );
    expect(screen.getByTestId('day-ids').textContent).toContain('remy-2023-06-22');
    expect(screen.getByTestId('day-ids').textContent).toContain('totoro-2023-07-01');
  });
});
