/**
 * Tests for CamerasContainer — the extracted camera catalog wiring (Phase 3-1).
 *
 * This container holds the data-integrity camera-identity safety that — before this suite — was
 * pinned ONLY through the legacy HardwareConfigStep test (which composed this same container, and
 * which Phase 5 deletes). The behaviors protect scientific data: a divergent camera_name reuse, a
 * silent recalibration of a SAVED identity, and editing a camera that recording DAYS reference all
 * change what downstream NWB / Spyglass sees. These tests re-home that coverage onto the REAL
 * container + a live store (HardwareConfigStep just rendered `<CamerasContainer animal onFieldUpdate>`
 * — the unit under test is the container), so it survives the stepper's removal.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../../state/StoreContext';
import CamerasContainer from '../CamerasContainer';

/**
 * Render CamerasContainer against a seeded store (so the dataset-wide camera identity registry is
 * populated) with a prop animal + field-update spy — the exact props HardwareConfigStep passed it.
 * @param {object} workspace - Workspace slice to seed.
 * @param {object} propAnimal - Animal passed to the container.
 * @param {Function} onFieldUpdate - Field update spy.
 * @returns {object} render result
 */
const renderSeeded = (workspace, propAnimal, onFieldUpdate) =>
  render(
    <StoreProvider initialState={{ workspace }}>
      <CamerasContainer animal={propAnimal} onFieldUpdate={onFieldUpdate} />
    </StoreProvider>
  );

describe('CamerasContainer — add + persist', () => {
  it('adds a camera (with required lens) and persists it via onFieldUpdate(cameras)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    const animal = { id: 'remy', cameras: [], devices: {}, behavioral_events: [] };
    renderSeeded({ animals: { remy: animal }, days: {} }, animal, onFieldUpdate);

    await user.click(screen.getByRole('button', { name: /add (first )?camera/i }));
    await user.type(screen.getByLabelText(/^camera name$/i), 'overhead');
    await user.type(screen.getByLabelText(/manufacturer/i), 'Allied');
    await user.type(screen.getByLabelText(/model/i), 'Mako');
    await user.type(screen.getByLabelText(/lens/i), '8mm');
    await user.type(screen.getByLabelText(/meters per pixel/i), '0.001');
    await user.click(screen.getByRole('button', { name: /save camera/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('cameras', [
      { id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 },
    ]);
  });
});

describe('CamerasContainer — identity safety', () => {
  it('blocks a divergent camera_name reuse (another animal uses the name with different hardware)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    const jaq = { id: 'jaq', cameras: [{ id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '6mm', meters_per_pixel: 0.0012 }], devices: {} };
    const remy = { id: 'remy', cameras: [], devices: {}, behavioral_events: [] };
    renderSeeded({ animals: { remy, jaq }, days: {} }, remy, onFieldUpdate);

    await user.click(screen.getByRole('button', { name: /add (first )?camera/i }));
    await user.type(screen.getByLabelText(/^camera name$/i), 'overhead');
    await user.type(screen.getByLabelText(/manufacturer/i), 'Allied');
    await user.type(screen.getByLabelText(/model/i), 'Mako');
    await user.type(screen.getByLabelText(/lens/i), '8mm'); // diverges from jaq's 6mm
    await user.type(screen.getByLabelText(/meters per pixel/i), '0.001');
    await user.click(screen.getByRole('button', { name: /save camera/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/already used by jaq camera 0/i);
    expect(onFieldUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /use a new camera name/i })).toBeInTheDocument();
  });

  it('blocks changing a saved camera calibration under the same camera_name', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    const remy = {
      id: 'remy',
      cameras: [{ id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 }],
      devices: {},
      behavioral_events: [],
    };
    renderSeeded({ animals: { remy }, days: {} }, remy, onFieldUpdate);

    await user.click(screen.getByRole('button', { name: /^edit camera/i }));
    const metersPerPixel = screen.getByLabelText(/meters per pixel/i);
    await user.clear(metersPerPixel);
    await user.type(metersPerPixel, '0.002');
    await user.click(screen.getByRole('button', { name: /save camera/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/saved identity/i);
    expect(onFieldUpdate).not.toHaveBeenCalled();
  });

  it('allows changed camera hardware when the edit uses a new camera_name', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    const remy = {
      id: 'remy',
      cameras: [{ id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 }],
      devices: {},
      behavioral_events: [],
    };
    renderSeeded({ animals: { remy }, days: {} }, remy, onFieldUpdate);

    await user.click(screen.getByRole('button', { name: /^edit camera/i }));
    const name = screen.getByLabelText(/^camera name$/i);
    await user.clear(name);
    await user.type(name, 'overhead_zoomed');
    const metersPerPixel = screen.getByLabelText(/meters per pixel/i);
    await user.clear(metersPerPixel);
    await user.type(metersPerPixel, '0.002');
    await user.click(screen.getByRole('button', { name: /save camera/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onFieldUpdate).toHaveBeenCalledWith('cameras', [
      { id: 0, camera_name: 'overhead_zoomed', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.002 },
    ]);
  });
});

describe('CamerasContainer — immutable-once-referenced cameras', () => {
  const referencedAnimal = {
    id: 'remy',
    cameras: [{ id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 }],
    devices: {},
    behavioral_events: [],
    days: ['remy-d1'],
  };
  const referencingDays = {
    'remy-d1': { id: 'remy-d1', animalId: 'remy', date: '2023-06-22', tasks: [{ camera_id: [0] }] },
  };

  /**
   * Open edit, rename (to clear the same-name identity block), recalibrate, save.
   * @param {object} user - userEvent session.
   */
  async function editReferencedCamera(user) {
    await user.click(screen.getByRole('button', { name: /^edit camera/i }));
    const name = screen.getByLabelText(/^camera name$/i);
    await user.clear(name);
    await user.type(name, 'overhead_zoomed');
    const mpp = screen.getByLabelText(/meters per pixel/i);
    await user.clear(mpp);
    await user.type(mpp, '0.002');
    await user.click(screen.getByRole('button', { name: /save camera/i }));
  }

  it('intercepts the identity edit with a decision that names the affected day (no write yet)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    renderSeeded({ animals: { remy: referencedAnimal }, days: referencingDays }, referencedAnimal, onFieldUpdate);

    await editReferencedCamera(user);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/used by 1 recording day/i);
    expect(dialog).toHaveTextContent('2023-06-22');
    expect(onFieldUpdate).not.toHaveBeenCalled();
  });

  it('"Create a new camera" appends a new camera (new id), leaving the original (affected days unchanged)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    renderSeeded({ animals: { remy: referencedAnimal }, days: referencingDays }, referencedAnimal, onFieldUpdate);

    await editReferencedCamera(user);
    await user.click(screen.getByRole('button', { name: /create a new camera/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('cameras', [
      { id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 },
      { id: 1, camera_name: 'overhead_zoomed', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.002 },
    ]);
  });

  it('"Correct this camera" overwrites in place (explicitly updates the affected day)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    renderSeeded({ animals: { remy: referencedAnimal }, days: referencingDays }, referencedAnimal, onFieldUpdate);

    await editReferencedCamera(user);
    await user.click(screen.getByRole('button', { name: /correct this camera/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('cameras', [
      { id: 0, camera_name: 'overhead_zoomed', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.002 },
    ]);
  });

  it('does NOT intercept when no day references the camera (saves directly)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    renderSeeded({ animals: { remy: { ...referencedAnimal, days: [] } }, days: {} }, { ...referencedAnimal, days: [] }, onFieldUpdate);

    await editReferencedCamera(user);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onFieldUpdate).toHaveBeenCalledWith('cameras', [
      { id: 0, camera_name: 'overhead_zoomed', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.002 },
    ]);
  });
});
