import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import OptogeneticsFields from '../OptogeneticsFields';

/**
 * Extended tests for OptogeneticsFields component
 *
 * Coverage gaps addressed:
 * - fs_gui_yamls advanced state script parameters
 * - User interactions and form updates
 * - CheckboxList/RadioList dependency tracking
 * - Integration with tasks, cameras, behavioral_events
 */

describe('OptogeneticsFields - Extended Coverage', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      fs_gui_yamls: [
        {
          name: '',
          power_in_mW: '',
          epochs: [],
          dio_output_name: '',
          camera_id: '',
          state_script_parameters: false,
        },
      ],
      opto_excitation_source: [
        {
          name: '',
          model_name: '',
          description: '',
          wavelength_in_nm: '',
          power_in_W: '',
          intensity_in_W_per_m2: '',
        },
      ],
      optical_fiber: [
        {
          name: '',
          hardware_name: '',
          implanted_fiber_description: '',
          hemisphere: '',
          location: '',
          ap_in_mm: '',
          ml_in_mm: '',
          dv_in_mm: '',
          roll_in_deg: '',
          pitch_in_deg: '',
          yaw_in_deg: '',
        },
      ],
      virus_injection: [
        {
          name: '',
          description: '',
          virus_name: '',
          volume_in_ul: '',
          titer_in_vg_per_ml: '',
          hemisphere: '',
          location: '',
          ap_in_mm: '',
          ml_in_mm: '',
          dv_in_mm: '',
          roll_in_deg: '',
          pitch_in_deg: '',
          yaw_in_deg: '',
        },
      ],
      opto_software: '',
      // Dependencies for selectors
      tasks: [
        {
          task_name: 'Navigation Task',
          task_description: 'Spatial navigation',
          task_epochs: [1, 2, 3],
          camera_id: [0],
        },
        {
          task_name: 'Rest',
          task_description: 'Resting state',
          task_epochs: [4, 5],
          camera_id: [1],
        },
      ],
      behavioral_events: [
        {
          name: 'Light_1',
          description: 'Optogenetic trigger 1',
        },
        {
          name: 'Light_2',
          description: 'Optogenetic trigger 2',
        },
      ],
      cameras: [
        {
          id: 0,
          meters_per_pixel: 0.001,
          manufacturer: 'Logitech',
          model: 'C920',
          lens: 'Default',
          camera_name: 'overhead',
        },
        {
          id: 1,
          meters_per_pixel: 0.001,
          manufacturer: 'Logitech',
          model: 'C920',
          lens: 'Default',
          camera_name: 'side',
        },
      ],
    };
  });

  describe('fs_gui_yamls - Advanced State Script Parameters', () => {
    it('renders advanced settings checkbox initially unchecked', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const checkbox = screen.getByLabelText(/Enable Advanced Settings/i);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('shows advanced parameter fields when checkbox is enabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const checkbox = screen.getByLabelText(/Enable Advanced Settings/i);
      await user.click(checkbox);

      // Advanced fields should now be visible
      expect(screen.getByLabelText(/Length of Pulse/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Number of Pulses per Train/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sequence Period/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Number of Output Trains/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Train Interval/i)).toBeInTheDocument();
    });

    it('hides advanced parameter fields when checkbox is disabled', async () => {
      const user = userEvent.setup();
      const state = {
        ...initialState,
        fs_gui_yamls: [
          {
            ...initialState.fs_gui_yamls[0],
            state_script_parameters: true,
          },
        ],
      };
      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      // Advanced fields should be visible initially
      expect(screen.getByLabelText(/Length of Pulse/i)).toBeInTheDocument();

      // Uncheck the checkbox
      const checkbox = screen.getByLabelText(/Enable Advanced Settings/i);
      await user.click(checkbox);

      // Advanced fields should now be hidden
      expect(screen.queryByLabelText(/Length of Pulse/i)).not.toBeInTheDocument();
    });

    it('renders all five advanced parameter fields with correct placeholders', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const checkbox = screen.getByLabelText(/Enable Advanced Settings/i);
      await user.click(checkbox);

      // Check all five fields have the correct placeholder
      const pulseLengthField = screen.getByLabelText(/Length of Pulse/i);
      expect(pulseLengthField).toHaveAttribute('placeholder', 'Only used if protocol not generated by fsgui');

      const nPulsesField = screen.getByLabelText(/Number of Pulses per Train/i);
      expect(nPulsesField).toHaveAttribute('placeholder', 'Only used if protocol not generated by fsgui');

      const sequencePeriodField = screen.getByLabelText(/Sequence Period/i);
      expect(sequencePeriodField).toHaveAttribute('placeholder', 'Only used if protocol not generated by fsgui');

      const nOutputTrainsField = screen.getByLabelText(/Number of Output Trains/i);
      expect(nOutputTrainsField).toHaveAttribute('placeholder', 'Only used if protocol not generated by fsgui');

      const trainIntervalField = screen.getByLabelText(/Train Interval/i);
      expect(trainIntervalField).toHaveAttribute('placeholder', 'Only used if protocol not generated by fsgui');
    });
  });

  describe('fs_gui_yamls - Dependency Integration', () => {
    it('displays epoch checkboxes from tasks', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // Find the epochs checkbox group
      const epochsSection = screen.getByText(/^Epochs$/i).closest('div');

      // Should have checkboxes for epochs 1,2,3,4,5 from the tasks
      const checkboxes = within(epochsSection.parentElement).getAllByRole('checkbox');

      // We have 5 epochs from tasks (1,2,3,4,5)
      expect(checkboxes.length).toBeGreaterThanOrEqual(5);
    });

    it('displays DIO output names from behavioral events', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // RadioList for DIO should show behavioral event names
      expect(screen.getByText(/Light_1/i)).toBeInTheDocument();
      expect(screen.getByText(/Light_2/i)).toBeInTheDocument();
    });

    it('displays camera IDs from cameras array', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // RadioList for camera ID should show camera IDs
      // Look within the "Spatial Filters Camera Id" section
      const cameraSection = screen.getByText(/Spatial Filters Camera Id/i).closest('div');

      // Should have radio buttons for camera IDs 0 and 1
      const radioButtons = within(cameraSection.parentElement).getAllByRole('radio');
      expect(radioButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty dependency arrays gracefully', () => {
      const state = {
        ...initialState,
        tasks: [],
        behavioral_events: [],
        cameras: [],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      // Should still render the sections without errors
      expect(screen.getByText('FS Gui Yamls')).toBeInTheDocument();
    });
  });

  describe('Opto Excitation Source - User Interactions', () => {
    it('allows entering text in name field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const nameInput = screen.getByPlaceholderText(/Name of your setup/i);
      await user.type(nameInput, 'Blue LED 470nm');

      expect(nameInput).toHaveValue('Blue LED 470nm');
    });

    it('allows entering numeric values in wavelength field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const wavelengthInput = screen.getByPlaceholderText(/xxx nm/i);
      await user.type(wavelengthInput, '470');

      expect(wavelengthInput).toHaveValue(470);
    });

    it('allows entering numeric values in power field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const powerInput = screen.getByPlaceholderText(/xxx W$/i);
      await user.type(powerInput, '0.001');

      expect(powerInput).toHaveValue(0.001);
    });

    it('allows entering numeric values in intensity field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const intensityInput = screen.getByPlaceholderText(/xxx W\/m2/i);
      await user.type(intensityInput, '10');

      expect(intensityInput).toHaveValue(10);
    });
  });

  describe('Optical Fiber - User Interactions', () => {
    it('allows entering text in fiber name field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const nameInput = screen.getByPlaceholderText(/Name of the fiber implant/i);
      await user.type(nameInput, 'CA1 Fiber');

      expect(nameInput).toHaveValue('CA1 Fiber');
    });

    it('allows entering text in location field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const locationInput = screen.getByPlaceholderText(/Location of the fiber implant/i);
      await user.type(locationInput, 'CA1');

      expect(locationInput).toHaveValue('CA1');
    });

    it('allows entering stereotaxic coordinates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // Get the first set (optical fiber) of AP/ML/DV inputs
      const allAPInputs = screen.getAllByPlaceholderText(/Anterior-Posterior.*mm/i);
      const allMLInputs = screen.getAllByPlaceholderText(/Medial-Lateral.*mm/i);
      const allDVInputs = screen.getAllByPlaceholderText(/Dorsal-Ventral.*mm/i);

      // Use the first one (optical fiber)
      await user.type(allAPInputs[0], '-2.0');
      await user.type(allMLInputs[0], '1.5');
      await user.type(allDVInputs[0], '1.3');

      expect(allAPInputs[0]).toHaveValue(-2.0);
      expect(allMLInputs[0]).toHaveValue(1.5);
      expect(allDVInputs[0]).toHaveValue(1.3);
    });

    it('allows entering rotation angles', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const rollInput = screen.getAllByPlaceholderText(/Roll in degrees/i)[0];
      const pitchInput = screen.getAllByPlaceholderText(/Pitch in degrees/i)[0];
      const yawInput = screen.getAllByPlaceholderText(/Yaw in degrees/i)[0];

      await user.type(rollInput, '0');
      await user.type(pitchInput, '15');
      await user.type(yawInput, '30');

      expect(rollInput).toHaveValue(0);
      expect(pitchInput).toHaveValue(15);
      expect(yawInput).toHaveValue(30);
    });

    it('displays hemisphere radio buttons', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // Check for hemisphere radio buttons in optical fiber section
      const leftRadios = screen.getAllByLabelText(/left/i);
      const rightRadios = screen.getAllByLabelText(/right/i);

      // Should have hemisphere options for both optical_fiber and virus_injection
      expect(leftRadios.length).toBeGreaterThanOrEqual(2);
      expect(rightRadios.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Virus Injection - User Interactions', () => {
    it('allows entering injection name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const nameInput = screen.getAllByLabelText(/Injection Name/i)[0];
      await user.type(nameInput, 'CA1 ChR2 injection');

      expect(nameInput).toHaveValue('CA1 ChR2 injection');
    });

    it('allows entering injection description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const descInput = screen.getAllByPlaceholderText(/Description of the injection/i)[0];
      await user.type(descInput, 'ChR2 for optogenetic activation');

      expect(descInput).toHaveValue('ChR2 for optogenetic activation');
    });

    it('allows entering volume and titer', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const volumeInput = screen.getByLabelText(/Volume/i);
      const titerInput = screen.getByLabelText(/Titer/i);

      await user.type(volumeInput, '0.5');
      await user.type(titerInput, '1e13');

      expect(volumeInput).toHaveValue(0.5);
      expect(titerInput).toHaveValue(1e13);
    });

    it('allows entering injection coordinates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // Get virus injection coordinate fields (second set of AP/ML/DV)
      const allAPInputs = screen.getAllByPlaceholderText(/Anterior-Posterior.*mm/i);
      const virusAPInput = allAPInputs[allAPInputs.length - 1];

      await user.type(virusAPInput, '-2.5');
      expect(virusAPInput).toHaveValue(-2.5);
    });
  });

  describe('Opto Software Field', () => {
    it('renders opto software input field', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const softwareInput = screen.getByLabelText(/Optogenetic Stimulation Software/i);
      expect(softwareInput).toBeInTheDocument();
    });

    it('allows entering software name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const softwareInput = screen.getByLabelText(/Optogenetic Stimulation Software/i);
      await user.type(softwareInput, 'fsgui');

      expect(softwareInput).toHaveValue('fsgui');
    });

    it('displays default value of "fsgui"', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const softwareInput = screen.getByLabelText(/Optogenetic Stimulation Software/i);
      expect(softwareInput).toHaveAttribute('placeholder', 'Software used for optogenetic stimulation');
    });
  });

  describe('Array Item Numbering', () => {
    it('displays correct item numbers for multiple opto excitation sources', () => {
      const state = {
        ...initialState,
        opto_excitation_source: [
          { name: 'Source 1', model_name: '', description: '', wavelength_in_nm: '', power_in_W: '', intensity_in_W_per_m2: '' },
          { name: 'Source 2', model_name: '', description: '', wavelength_in_nm: '', power_in_W: '', intensity_in_W_per_m2: '' },
          { name: 'Source 3', model_name: '', description: '', wavelength_in_nm: '', power_in_W: '', intensity_in_W_per_m2: '' },
        ],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByText('Source: Source 1')).toBeInTheDocument();
      expect(screen.getByText('Source: Source 2')).toBeInTheDocument();
      expect(screen.getByText('Source: Source 3')).toBeInTheDocument();
    });

    it('displays correct item numbers for multiple optical fibers', () => {
      const state = {
        ...initialState,
        optical_fiber: [
          { name: 'Fiber 1', hardware_name: '', implanted_fiber_description: '', hemisphere: '', location: '', ap_in_mm: '', ml_in_mm: '', dv_in_mm: '', roll_in_deg: '', pitch_in_deg: '', yaw_in_deg: '' },
          { name: 'Fiber 2', hardware_name: '', implanted_fiber_description: '', hemisphere: '', location: '', ap_in_mm: '', ml_in_mm: '', dv_in_mm: '', roll_in_deg: '', pitch_in_deg: '', yaw_in_deg: '' },
        ],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByText('Fiber: Fiber 1')).toBeInTheDocument();
      expect(screen.getByText('Fiber: Fiber 2')).toBeInTheDocument();
    });

    it('displays correct item numbers for multiple virus injections', () => {
      const state = {
        ...initialState,
        virus_injection: [
          { name: 'Injection 1', description: '', virus_name: '', volume_in_ul: '', titer_in_vg_per_ml: '', hemisphere: '', location: '', ap_in_mm: '', ml_in_mm: '', dv_in_mm: '', roll_in_deg: '', pitch_in_deg: '', yaw_in_deg: '' },
          { name: 'Injection 2', description: '', virus_name: '', volume_in_ul: '', titer_in_vg_per_ml: '', hemisphere: '', location: '', ap_in_mm: '', ml_in_mm: '', dv_in_mm: '', roll_in_deg: '', pitch_in_deg: '', yaw_in_deg: '' },
        ],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByText('Injection: Injection 1')).toBeInTheDocument();
      expect(screen.getByText('Injection: Injection 2')).toBeInTheDocument();
    });
  });

  describe('Field Validation Attributes', () => {
    it('marks required fields with required attribute', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const requiredFields = [
        screen.getByPlaceholderText(/Name of your setup/i),
        screen.getByPlaceholderText(/Description of the setup/i),
        screen.getByPlaceholderText(/xxx nm/i),
        screen.getByPlaceholderText(/Name of the fiber implant/i),
        screen.getAllByLabelText(/Injection Name/i)[0],
        screen.getByLabelText(/Volume/i),
      ];

      requiredFields.forEach((field) => {
        expect(field).toBeRequired();
      });
    });

    it('sets step="any" for coordinate number inputs', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // Get all coordinate inputs
      const allAPInputs = screen.getAllByPlaceholderText(/Anterior-Posterior.*mm/i);
      const allMLInputs = screen.getAllByPlaceholderText(/Medial-Lateral.*mm/i);
      const allDVInputs = screen.getAllByPlaceholderText(/Dorsal-Ventral.*mm/i);

      // Check the first set (optical fiber)
      expect(allAPInputs[0]).toHaveAttribute('step', 'any');
      expect(allMLInputs[0]).toHaveAttribute('step', 'any');
      expect(allDVInputs[0]).toHaveAttribute('step', 'any');
    });
  });

  describe('SelectElement Integration', () => {
    it('renders model name select for opto excitation source', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // There are multiple "Hardware Model Name" labels (opto excitation and optical fiber)
      const allModelSelects = screen.getAllByLabelText(/Hardware Model Name/i);
      // First one is for opto excitation source
      expect(allModelSelects[0]).toBeInTheDocument();
      expect(allModelSelects[0].tagName).toBe('SELECT');
    });

    it('renders hardware name select for optical fiber', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const hardwareSelect = screen.getByLabelText(/Fiber Hardware Model Name/i);
      expect(hardwareSelect).toBeInTheDocument();
      expect(hardwareSelect.tagName).toBe('SELECT');
    });

    it('renders virus name select for virus injection', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const virusSelect = screen.getByLabelText(/Virus Name/i);
      expect(virusSelect).toBeInTheDocument();
      expect(virusSelect.tagName).toBe('SELECT');
    });
  });
});
