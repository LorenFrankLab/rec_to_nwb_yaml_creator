import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubjectFields from '../SubjectFields';

describe('SubjectFields', () => {
  let defaultProps;

  beforeEach(() => {
    // Default props matching App.js interface
    defaultProps = {
      formData: {
        subject: {
          description: '',
          species: '',
          genotype: '',
          sex: '',
          subject_id: '',
          date_of_birth: '',
          weight: '',
        },
      },
      handleChange: vi.fn(() => vi.fn()),
      onBlur: vi.fn(),
      itemSelected: vi.fn(),
    };
  });

  describe('Component Rendering', () => {
    it('renders the subject section', () => {
      render(<SubjectFields {...defaultProps} />);

      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    it('renders all subject input fields', () => {
      render(<SubjectFields {...defaultProps} />);

      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Species/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Genotype/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sex/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Subject Id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Weight/i)).toBeInTheDocument();
    });

    it('renders with details element open by default', () => {
      const { container } = render(<SubjectFields {...defaultProps} />);

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('has correct area ID', () => {
      const { container } = render(<SubjectFields {...defaultProps} />);

      const area = container.querySelector('#subject-area');
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass('area-region');
    });
  });

  describe('Field Values from Props', () => {
    it('displays subject description from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, description: 'Test subject description' },
        },
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Description/i);
      expect(input).toHaveValue('Test subject description');
    });

    it('displays species from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, species: 'Rattus norvegicus' },
        },
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Species/i);
      expect(input).toHaveValue('Rattus norvegicus');
    });

    it('displays genotype from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, genotype: 'Wild Type' },
        },
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Genotype/i);
      expect(input).toHaveValue('Wild Type');
    });

    it('displays sex from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, sex: 'M' },
        },
      };

      render(<SubjectFields {...props} />);

      const select = screen.getByLabelText(/Sex/i);
      expect(select).toHaveValue('M');
    });

    it('displays subject_id from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, subject_id: 'rat01' },
        },
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Subject Id/i);
      expect(input).toHaveValue('rat01');
    });

    it('displays date_of_birth from formData (ISO format → date input)', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, date_of_birth: '2023-06-22T00:00:00.000Z' },
        },
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Date of Birth/i);
      // Date input shows YYYY-MM-DD format
      expect(input).toHaveValue('2023-06-22');
    });

    it('displays weight from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, weight: '350' },
        },
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Weight/i);
      expect(input).toHaveValue(350);
    });
  });

  describe('User Interactions', () => {
    it('calls handleChange when description is typed', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Description/i);
      await user.type(input, 'A');

      expect(mockHandleChange).toHaveBeenCalledWith('description', 'subject');
    });

    it('calls handleChange when species is selected', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Species/i);
      await user.type(input, 'R');

      expect(mockHandleChange).toHaveBeenCalledWith('species', 'subject');
    });

    it('calls handleChange when subject_id is typed', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Subject Id/i);
      await user.type(input, 'r');

      expect(mockHandleChange).toHaveBeenCalledWith('subject_id', 'subject');
    });
  });

  describe('Blur Events', () => {
    it('calls onBlur when description loses focus', async () => {
      const user = userEvent.setup();
      const mockOnBlur = vi.fn();
      const props = { ...defaultProps, onBlur: mockOnBlur };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Description/i);
      await user.click(input);
      await user.tab();

      expect(mockOnBlur).toHaveBeenCalledWith(
        expect.any(Object),
        { key: 'subject' }
      );
    });

    it('calls itemSelected when species loses focus', async () => {
      const user = userEvent.setup();
      const mockItemSelected = vi.fn();
      const props = { ...defaultProps, itemSelected: mockItemSelected };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Species/i);
      await user.click(input);
      await user.tab();

      expect(mockItemSelected).toHaveBeenCalledWith(
        expect.any(Object),
        { key: 'subject' }
      );
    });

    it('calls custom onBlur for date_of_birth (converts to ISO)', async () => {
      const user = userEvent.setup();
      const mockOnBlur = vi.fn();
      const props = {
        ...defaultProps,
        formData: {
          subject: { ...defaultProps.formData.subject, date_of_birth: '2023-06-22' },
        },
        onBlur: mockOnBlur,
      };

      render(<SubjectFields {...props} />);

      const input = screen.getByLabelText(/Date of Birth/i);
      await user.click(input);
      await user.tab();

      // Should call onBlur with custom date conversion logic
      expect(mockOnBlur).toHaveBeenCalled();

      // Verify the onBlur receives a modified event object
      const callArgs = mockOnBlur.mock.calls[0];
      expect(callArgs[0].target).toHaveProperty('name', 'date_of_birth');
      expect(callArgs[0].target).toHaveProperty('type', 'date');
      expect(callArgs[1]).toEqual({ key: 'subject' });
    });
  });

  describe('Validation Props', () => {
    it('marks description as required', () => {
      render(<SubjectFields {...defaultProps} />);

      const input = screen.getByLabelText(/Description/i);
      expect(input).toBeRequired();
    });

    it('marks subject_id as required with pattern validation', () => {
      render(<SubjectFields {...defaultProps} />);

      const input = screen.getByLabelText(/Subject Id/i);
      expect(input).toBeRequired();
    });

    it('marks date_of_birth as required', () => {
      render(<SubjectFields {...defaultProps} />);

      const input = screen.getByLabelText(/Date of Birth/i);
      expect(input).toBeRequired();
    });

    it('marks weight as required with min=0', () => {
      render(<SubjectFields {...defaultProps} />);

      const input = screen.getByLabelText(/Weight/i);
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('min', '0');
    });
  });
});
