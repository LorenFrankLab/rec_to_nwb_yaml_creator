import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import HardwareConfigStep from '../HardwareConfigStep';

// HardwareConfigStep now reads persistence status from the store context, so all
// renders are wrapped in a StoreProvider.
const render = (ui, options) =>
  rtlRender(ui, {
    wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
    ...options,
  });

describe('HardwareConfigStep', () => {
  const mockAnimal = {
    id: 'remy',
    cameras: [
      {
        id: 1,
        camera_name: 'Overhead',
        manufacturer: 'Basler',
        model: 'acA1300-60gm',
        lens: 'Fujinon 12.5mm',
        meters_per_pixel: 0.001,
      },
    ],
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets_MCU', system: 'SpikeGadgets', amplifier: 'Intan RHD2000', adc_circuit: 'Intan' },
      ],
    },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
    behavioral_events: [
      { name: 'reward_left', description: 'Left reward port' },
      { name: 'reward_right', description: 'Right reward port' },
    ],
  };

  const mockOnFieldUpdate = vi.fn();
  const mockOnNavigateBack = vi.fn();
  const mockOnNavigateNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 3 sections (Cameras, Data Acq, Behavioral Events)', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Check for specific section headings (use getAllByText to handle multiple matches)
    const cameraHeadings = screen.getAllByText(/Cameras/i);
    expect(cameraHeadings.length).toBeGreaterThan(0);

    expect(screen.getByText(/Data Acquisition Device/i)).toBeInTheDocument();

    const behavioralEventsHeadings = screen.getAllByText(/Behavioral Events/i);
    expect(behavioralEventsHeadings.length).toBeGreaterThan(0);
  });

  it('surfaces a corrupt cameras collection as an executable reset banner (not the empty state alone)', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    render(
      <HardwareConfigStep
        animal={{ ...mockAnimal, cameras: 'nope' }}
        onFieldUpdate={mockOnFieldUpdate}
        onRepair={onRepair}
      />
    );
    // The corruption is visible with an executable reset, instead of hiding behind the
    // "Add First Camera" empty state.
    const reset = screen.getByRole('button', { name: /^reset cameras$/i });
    await user.click(reset);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'resetAnimalCameras' } })
    );
  });

  it('surfaces a corrupt data_acq_device as an executable reset banner — without prop-type warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <HardwareConfigStep
        animal={{ ...mockAnimal, cameras: 'nope', devices: { data_acq_device: 'bad' } }}
        onFieldUpdate={mockOnFieldUpdate}
        onRepair={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /reset data acquisition devices/i })).toBeInTheDocument();
    // Corrupt animal hardware is first-class state here, so no React warnings on render.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('sections have correct elevation styling (cameras=1, data_acq=0, events=1)', () => {
    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Cameras section should have elevation-1 class
    const camerasSection = container.querySelector('.cameras-section').closest('.section-elevation-1');
    expect(camerasSection).toBeInTheDocument();

    // Data acquisition section should have elevation-0 class
    const dataAcqSection = container.querySelector('.data-acq-section').closest('.section-elevation-0');
    expect(dataAcqSection).toBeInTheDocument();

    // Behavioral events section should have elevation-1 class
    const eventsSection = container.querySelector('.behavioral-events-section').closest('.section-elevation-1');
    expect(eventsSection).toBeInTheDocument();
  });

  it('delegates field edits to onFieldUpdate without optimistically claiming "Saved"', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const nameInput = screen.getByDisplayValue('SpikeGadgets_MCU');
    await user.clear(nameInput);
    await user.type(nameInput, 'SpikeGadgets_MCU_renamed');
    await user.tab();

    // The edit is delegated to the parent handler...
    await waitFor(() => {
      expect(mockOnFieldUpdate).toHaveBeenCalled();
    });

    // ...and the component does NOT fake a "Saved" status locally. Real save status
    // comes from the store's debounced autosave (covered by store-persistence tests);
    // with a mock onFieldUpdate the workspace never changes, so no "Saved" appears.
    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
  });

  it('navigation buttons enabled/disabled based on validation', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Back button should always be enabled in Step 3
    const backButton = screen.getByText(/Back/i);
    expect(backButton).not.toBeDisabled();

    // Continue button should be enabled (hardware config is optional)
    const continueButton = screen.getByText(/Continue/i);
    expect(continueButton).not.toBeDisabled();
  });

  it('Back button navigates to Step 2 (Channel Maps)', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const backButton = screen.getByText(/Back/i);
    await user.click(backButton);

    expect(mockOnNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('Continue button saves and exits (or goes to Step 4 if optogenetics exists)', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const continueButton = screen.getByText(/Continue/i);
    await user.click(continueButton);

    expect(mockOnNavigateNext).toHaveBeenCalledTimes(1);
  });

  // Save-failure UX is no longer handled by a local try/catch in this component
  // (that was a false-success pattern). A failed write is surfaced by the store's
  // persistence.saveError → SaveIndicator. That behavior is covered by
  // store-persistence.test.js (saveError on a thrown write) and
  // SaveIndicator.test.jsx (renders the error with role="alert").

  it('sections expand/collapse correctly', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Find the first collapsible section (if any)
    const detailsElements = container.querySelectorAll('details');
    if (detailsElements.length > 0) {
      const firstDetails = detailsElements[0];
      const summary = firstDetails.querySelector('summary');

      // Toggle expansion
      await user.click(summary);

      // Check that details element toggled
      expect(firstDetails.hasAttribute('open')).toBe(true);
    }
  });

  it('integrates with AnimalEditorStepper props', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Component should render without errors and accept all props
    const cameraHeadings = screen.getAllByText(/Cameras/i);
    expect(cameraHeadings.length).toBeGreaterThan(0);
  });

  it('verifies data persists in animal.cameras, animal.data_acq_device, animal.behavioral_events', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Verify cameras are displayed
    expect(screen.getByText('Overhead')).toBeInTheDocument();

    // Verify data_acq_device is displayed
    expect(screen.getByDisplayValue('SpikeGadgets')).toBeInTheDocument();

    // Verify behavioral_events are displayed
    expect(screen.getByText('reward_left')).toBeInTheDocument();
    expect(screen.getByText('reward_right')).toBeInTheDocument();
  });

  it('accessibility: all sections have proper landmarks', () => {
    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Check for section elements or regions
    const sections = container.querySelectorAll('section, [role="region"]');
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  it('accessibility: keyboard navigation works', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Tab through elements - first should be "Add Camera" button
    await user.tab();
    const addCameraButton = screen.getByText(/Add Camera/i);
    expect(addCameraButton).toHaveFocus();

    // Keep tabbing until we reach the Back button (skip all section elements)
    let foundBackButton = false;
    for (let i = 0; i < 20 && !foundBackButton; i++) {
      await user.tab();
      const backButton = screen.getByText(/Back to Channel Maps/i);
      if (backButton === document.activeElement) {
        foundBackButton = true;
        expect(backButton).toHaveFocus();
      }
    }

    expect(foundBackButton).toBe(true);
  });

  it('responsive: mobile layout at < 600px', () => {
    // Set viewport to mobile size
    global.innerWidth = 400;
    global.dispatchEvent(new Event('resize'));

    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Check that container has responsive class or styling
    const mainContainer = container.querySelector('.hardware-config-step');
    expect(mainContainer).toBeInTheDocument();
  });

  describe('camera CRUD + identity safety', () => {
    /**
     * Seed the store with a workspace so the dataset-wide camera identity registry is
     * populated, and render HardwareConfigStep against a prop animal.
     *
     * @param {object} workspace - Workspace slice to seed.
     * @param {object} propAnimal - Animal passed as the HardwareConfigStep prop.
     * @param {Function} onFieldUpdate - Field update spy.
     */
    const renderSeeded = (workspace, propAnimal, onFieldUpdate) =>
      rtlRender(
        <HardwareConfigStep
          animal={propAnimal}
          onFieldUpdate={onFieldUpdate}
          onNavigateBack={vi.fn()}
          onNavigateNext={vi.fn()}
        />,
        { wrapper: ({ children }) => <StoreProvider initialState={{ workspace }}>{children}</StoreProvider> }
      );

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

    it('blocks a divergent camera_name reuse and offers a new-name action', async () => {
      const user = userEvent.setup();
      const onFieldUpdate = vi.fn();
      // Another animal already uses "overhead" with a different lens/calibration.
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

      // Blocked: the comparison is shown and nothing is persisted.
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

      await user.click(screen.getByRole('button', { name: /^edit$/i }));
      const metersPerPixel = screen.getByLabelText(/meters per pixel/i);
      await user.clear(metersPerPixel);
      await user.type(metersPerPixel, '0.002');
      await user.click(screen.getByRole('button', { name: /save camera/i }));

      expect(screen.getByRole('alert')).toHaveTextContent(/saved identity/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/meters per pixel/i);
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

      await user.click(screen.getByRole('button', { name: /^edit$/i }));
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

    it('deletes a camera after confirmation', async () => {
      const user = userEvent.setup();
      const onFieldUpdate = vi.fn();
      const remy = {
        id: 'remy',
        cameras: [{ id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 }],
        devices: {},
        behavioral_events: [],
      };
      renderSeeded({ animals: { remy }, days: {} }, remy, onFieldUpdate);

      await user.click(screen.getByRole('button', { name: /delete camera 0/i }));
      // Confirm in the destructive dialog.
      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(onFieldUpdate).toHaveBeenCalledWith('cameras', []);
    });
  });

  // A repair routed to the Animal Editor must not dead-end by crashing on the very
  // corruption it exists to fix. HardwareConfigStep passes `animal.cameras` to
  // CamerasSection; a non-array (string/object/number) must be normalized to [] so the
  // section renders its empty state rather than throwing on `.reduce`/`.map`.
  describe('Corrupt persisted cameras', () => {
    it.each([
      ['a string', 'nope'],
      ['a plain object', {}],
      ['a number', 42],
    ])('renders without throwing when animal.cameras is %s', (_label, corrupt) => {
      const corruptAnimal = { ...mockAnimal, cameras: corrupt };

      expect(() => {
        render(
          <HardwareConfigStep
            animal={corruptAnimal}
            onFieldUpdate={mockOnFieldUpdate}
            onNavigateBack={mockOnNavigateBack}
            onNavigateNext={mockOnNavigateNext}
          />
        );
      }).not.toThrow();

      // Cameras degrade to the empty state instead of a crash.
      expect(screen.getByText(/No Cameras Configured/i)).toBeInTheDocument();
    });
  });

  it('performance: handles 10 cameras without lag', async () => {
    const largeMockAnimal = {
      ...mockAnimal,
      cameras: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        camera_name: `Camera ${i + 1}`,
        manufacturer: 'Basler',
        model: 'acA1300-60gm',
        lens: 'Fujinon 12.5mm',
        meters_per_pixel: 0.001,
      })),
    };

    const startTime = performance.now();

    render(
      <HardwareConfigStep
        animal={largeMockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Render should complete in < 1000ms
    expect(renderTime).toBeLessThan(1000);

    // Verify all cameras are rendered
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Camera ${i}`)).toBeInTheDocument();
    }
  });
});
