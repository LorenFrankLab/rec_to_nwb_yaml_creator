import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import OptogeneticsFields from '../OptogeneticsFields';

describe('OptogeneticsFields', () => {
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
          power_in_w: '',
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
      tasks: [],
      behavioral_events: [],
      cameras: [],
    };
  });

  describe('Rendering', () => {
    it('renders all five optogenetics sections', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      expect(screen.getByText('FS Gui Yamls')).toBeInTheDocument();
      expect(screen.getByText('Opto Excitation Source')).toBeInTheDocument();
      expect(screen.getByText('Optical Fiber')).toBeInTheDocument();
      expect(screen.getByText('Virus Injection')).toBeInTheDocument();
      expect(screen.getByLabelText(/Optogenetic Stimulation Software/i)).toBeInTheDocument();
    });

    it('renders opto excitation source fields', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      // Check fields by placeholder since labels may not be unique
      expect(screen.getByPlaceholderText(/Name of your setup/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Description of the setup/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/xxx nm/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/xxx W$/i)).toBeInTheDocument();
    });

    it('renders optical fiber fields', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      expect(screen.getByPlaceholderText(/Name of the fiber implant/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Description of the fiber implant/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Location of the fiber implant/i)).toBeInTheDocument();
    });

    it('renders virus injection fields', () => {
      renderWithProviders(<OptogeneticsFields />, { initialState });

      expect(screen.getAllByLabelText(/Injection Name/i)[0]).toBeInTheDocument();
      expect(screen.getByLabelText(/Virus Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Volume/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Titer/i)).toBeInTheDocument();
    });
  });

  describe('CRUD Operations - Opto Excitation Source', () => {
    it('has add button for opto excitation source', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const addButtons = screen.getAllByRole('button', { name: '＋' });
      expect(addButtons[0]).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(addButtons[0]);
    });

    it('has remove button for opto excitation source', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      expect(removeButtons[0]).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(removeButtons[0]);
    });

    it('has duplicate button for opto excitation source', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OptogeneticsFields />, { initialState });

      const duplicateButtons = screen.getAllByRole('button', { name: /Duplicate/i });
      expect(duplicateButtons[0]).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(duplicateButtons[0]);
    });
  });

  describe('Field Values', () => {
    it('displays opto excitation source values', () => {
      const state = {
        ...initialState,
        opto_excitation_source: [
          {
            name: 'Blue LED',
            model_name: 'ThorLabs M470L3',
            description: 'Primary excitation',
            wavelength_in_nm: 470,
            power_in_w: 0.001,
            intensity_in_W_per_m2: 10,
          },
        ],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByDisplayValue('Blue LED')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Primary excitation')).toBeInTheDocument();
      expect(screen.getByDisplayValue('470')).toBeInTheDocument();
    });

    it('displays optical fiber values', () => {
      const state = {
        ...initialState,
        optical_fiber: [
          {
            name: 'Fiber 1',
            hardware_name: 'Doric MFC_200/230-0.22_5mm_ZF1.25',
            implanted_fiber_description: 'CA1 fiber',
            hemisphere: 'left',
            location: 'CA1',
            ap_in_mm: -2.0,
            ml_in_mm: 1.5,
            dv_in_mm: 1.3,
            roll_in_deg: 0,
            pitch_in_deg: 0,
            yaw_in_deg: 0,
          },
        ],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByDisplayValue('Fiber 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CA1 fiber')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
    });

    it('displays virus injection values', () => {
      const state = {
        ...initialState,
        virus_injection: [
          {
            name: 'CA1 injection',
            description: 'ChR2 injection',
            virus_name: 'AAV5-CaMKIIa-hChR2(H134R)-EYFP',
            volume_in_ul: 0.5,
            titer_in_vg_per_ml: 1e13,
            hemisphere: 'left',
            location: 'CA1',
            ap_in_mm: -2.0,
            ml_in_mm: 1.5,
            dv_in_mm: 1.3,
            roll_in_deg: 0,
            pitch_in_deg: 0,
            yaw_in_deg: 0,
          },
        ],
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByDisplayValue('CA1 injection')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ChR2 injection')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty arrays', () => {
      const state = {
        ...initialState,
        fs_gui_yamls: [],
        opto_excitation_source: [],
        optical_fiber: [],
        virus_injection: [],
        opto_software: '',
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      // Should still render section headers
      expect(screen.getByText('FS Gui Yamls')).toBeInTheDocument();
      expect(screen.getByText('Opto Excitation Source')).toBeInTheDocument();
      expect(screen.getByText('Optical Fiber')).toBeInTheDocument();
      expect(screen.getByText('Virus Injection')).toBeInTheDocument();
    });

    it('handles multiple items in arrays', () => {
      const state = {
        ...initialState,
        fs_gui_yamls: [],
        opto_excitation_source: [
          { name: 'Source 1', model_name: '', description: '', wavelength_in_nm: '', power_in_w: '', intensity_in_W_per_m2: '' },
          { name: 'Source 2', model_name: '', description: '', wavelength_in_nm: '', power_in_w: '', intensity_in_W_per_m2: '' },
        ],
        optical_fiber: [
          { name: 'Fiber 1', hardware_name: '', implanted_fiber_description: '', hemisphere: '', location: '', ap_in_mm: '', ml_in_mm: '', dv_in_mm: '', roll_in_deg: '', pitch_in_deg: '', yaw_in_deg: '' },
        ],
        virus_injection: [],
        opto_software: '',
      };

      renderWithProviders(<OptogeneticsFields />, { initialState: state });

      expect(screen.getByText('Source #1')).toBeInTheDocument();
      expect(screen.getByText('Source #2')).toBeInTheDocument();
      expect(screen.getByText('Fiber Implant #1')).toBeInTheDocument();
    });
  });
});
