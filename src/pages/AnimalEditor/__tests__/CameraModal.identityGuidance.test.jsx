/**
 * @vitest-environment jsdom
 */
/**
 * Camera identity teaching copy (Phase 8.6 Task 3). The camera modal must PROACTIVELY teach
 * the Spyglass identity rule (a camera with different zoom/calibration/lens/model/id needs a
 * different name), not only show the reactive divergence alert after a conflicting save.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CameraModal from '../CameraModal';

describe('CameraModal identity guidance', () => {
  it('teaches that a different zoom/calibration/lens/model/id needs a different camera name', () => {
    render(
      <CameraModal isOpen mode="add" existingCameras={[]} onSave={() => {}} onCancel={() => {}} />
    );
    const guidance = screen.getByText(
      /a different zoom, calibration, lens, model, or id is a different camera/i
    );
    expect(guidance).toBeInTheDocument();
    // Associated with the Camera Name field for assistive tech.
    expect(screen.getByLabelText(/^camera name$/i)).toHaveAttribute(
      'aria-describedby',
      'camera_name_help'
    );
  });
});
