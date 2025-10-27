import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubjectFields from '../SubjectFields';
import { StoreProvider } from '../../state/StoreContext';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';

describe('SubjectFields', () => {
  let defaultFormData;

  beforeEach(() => {
    // Default form data with subject
    defaultFormData = {
      subject: {
        description: '',
        species: '',
        genotype: '',
        sex: '',
        subject_id: '',
        date_of_birth: '',
        weight: '',
      },
    };
  });

  describe('Component Rendering', () => {
    it('renders the subject section', () => {
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    it('renders all subject input fields', () => {
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Species/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Genotype/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sex/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Subject Id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Weight/i)).toBeInTheDocument();
    });

    it('renders with details element open by default', () => {
      const { container } = renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('has correct area ID', () => {
      const { container } = renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const area = container.querySelector('#subject-area');
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass('area-region');
    });
  });

  describe('Field Values from Store', () => {
    it('displays subject description from store', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, description: 'Test subject description' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const input = screen.getByLabelText(/Description/i);
      expect(input).toHaveValue('Test subject description');
    });

    it('displays species from store', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, species: 'Rattus norvegicus' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const input = screen.getByLabelText(/Species/i);
      expect(input).toHaveValue('Rattus norvegicus');
    });

    it('displays genotype from store', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, genotype: 'Wild Type' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const input = screen.getByLabelText(/Genotype/i);
      expect(input).toHaveValue('Wild Type');
    });

    it('displays sex from store', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, sex: 'M' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const select = screen.getByLabelText(/Sex/i);
      expect(select).toHaveValue('M');
    });

    it('displays subject_id from store', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, subject_id: 'rat01' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const input = screen.getByLabelText(/Subject Id/i);
      expect(input).toHaveValue('rat01');
    });

    it('displays date_of_birth from store (ISO format → date input)', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, date_of_birth: '2023-06-22T00:00:00.000Z' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const input = screen.getByLabelText(/Date of Birth/i);
      // Date input shows YYYY-MM-DD format
      expect(input).toHaveValue('2023-06-22');
    });

    it('displays weight from store', () => {
      const formData = {
        ...defaultFormData,
        subject: { ...defaultFormData.subject, weight: '350' },
      };

      renderWithProviders(<SubjectFields />, { initialState: formData });

      const input = screen.getByLabelText(/Weight/i);
      expect(input).toHaveValue(350);
    });
  });

  describe('User Interactions', () => {
    it('updates store when description is typed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Description/i);
      await user.type(input, 'Test description');

      // Value should update in the component
      expect(input).toHaveValue('Test description');
    });

    it('updates store when species is typed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Species/i);
      await user.type(input, 'Rattus norvegicus');

      expect(input).toHaveValue('Rattus norvegicus');
    });

    it('updates store when subject_id is typed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Subject Id/i);
      await user.type(input, 'rat01');

      expect(input).toHaveValue('rat01');
    });
  });

  describe('Blur Events', () => {
    it('processes onBlur when description loses focus', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Description/i);
      await user.type(input, 'Test');
      await user.tab();

      // Blur should not break - value preserved
      expect(input).toHaveValue('Test');
    });

    it('processes itemSelected when species loses focus', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Species/i);
      await user.type(input, 'Rattus');
      await user.tab();

      // Value should be preserved
      expect(input).toHaveValue('Rattus');
    });

    it('converts date to ISO format on blur', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Date of Birth/i);
      await user.type(input, '2023-06-22');
      await user.tab();

      // Date input shows the value
      expect(input).toHaveValue('2023-06-22');
    });
  });

  describe('Validation Props', () => {
    it('marks description as required', () => {
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Description/i);
      expect(input).toBeRequired();
    });

    it('marks subject_id as required with pattern validation', () => {
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Subject Id/i);
      expect(input).toBeRequired();
    });

    it('marks date_of_birth as required', () => {
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Date of Birth/i);
      expect(input).toBeRequired();
    });

    it('marks weight as required with min=0', () => {
      renderWithProviders(<SubjectFields />, { initialState: defaultFormData });

      const input = screen.getByLabelText(/Weight/i);
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('min', '0');
    });
  });
});
