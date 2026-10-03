/**
 * Editing a camera must change that camera and nothing else, also after
 * Duplicate or Remove has moved the rows around.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import { useStoreContext } from '../../state/StoreContext';
import CamerasFields from '../CamerasFields';

/** Renders the cameras in the form state, so a test can assert what an edit changed. */
function StateProbe() {
  const { model } = useStoreContext();
  return <span data-testid="model">{JSON.stringify(model.cameras)}</span>;
}

const cameras = () => JSON.parse(screen.getByTestId('model').textContent);

const camera = (id, cameraName) => ({
  id,
  meters_per_pixel: 0.001,
  manufacturer: 'Allied Vision',
  model: 'Mako',
  lens: 'Theia',
  camera_name: cameraName,
});

const renderCameras = (list) =>
  renderWithProviders(
    <>
      <CamerasFields />
      <StateProbe />
    </>,
    { initialState: { cameras: list } }
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CamerasFields - rows that move', () => {
  it('types into the camera typed into after Remove shifts the rows up', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderCameras([
      camera(0, 'overhead'),
      camera(1, 'sleep box'),
      camera(2, 'run box'),
    ]);

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await user.type(screen.getByDisplayValue('sleep box'), '2');

    expect(cameras().map((c) => [c.id, c.camera_name])).toEqual([
      [1, 'sleep box2'],
      [2, 'run box'],
    ]);
  });

  it('types into the camera typed into after Duplicate inserts a copy before it', async () => {
    const { user } = renderCameras([camera(0, 'overhead'), camera(1, 'sleep box')]);

    await user.click(screen.getAllByRole('button', { name: 'Duplicate' })[0]);
    expect(cameras().map((c) => c.id)).toEqual([0, 2, 1]);

    await user.type(screen.getByDisplayValue('sleep box'), '2');

    expect(cameras().map((c) => [c.id, c.camera_name])).toEqual([
      [0, 'overhead'],
      [2, 'overhead'],
      [1, 'sleep box2'],
    ]);
  });
});
