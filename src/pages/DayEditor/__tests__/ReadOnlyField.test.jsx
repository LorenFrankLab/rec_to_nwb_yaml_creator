import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReadOnlyField from '../ReadOnlyField';

describe('ReadOnlyField', () => {
  it('renders label and value', () => {
    render(<ReadOnlyField label="Subject ID" value="remy" />);

    expect(screen.getByText('Subject ID')).toBeInTheDocument();
    expect(screen.getByDisplayValue('remy')).toBeInTheDocument();
  });

  it('creates valid HTML id from label', () => {
    render(<ReadOnlyField label="Subject ID" value="remy" />);

    const input = screen.getByDisplayValue('remy');
    expect(input).toHaveAttribute('id', 'readonly-subject-id');
  });

  it('marks input as read-only', () => {
    render(<ReadOnlyField label="Test Field" value="test value" />);

    const input = screen.getByDisplayValue('test value');
    expect(input).toHaveAttribute('readonly');
  });

  it('marks input as disabled', () => {
    render(<ReadOnlyField label="Test Field" value="test value" />);

    const input = screen.getByDisplayValue('test value');
    expect(input).toBeDisabled();
  });

  it('has CSS class for styling', () => {
    render(<ReadOnlyField label="Test Field" value="test value" />);

    const input = screen.getByDisplayValue('test value');
    expect(input).toHaveClass('read-only-field');
  });

  it('includes accessible label', () => {
    render(<ReadOnlyField label="Subject ID" value="remy" />);

    const input = screen.getByDisplayValue('remy');
    expect(input).toHaveAccessibleName(/Subject ID.*inherited.*read-only/i);
  });

  it('handles empty values', () => {
    render(<ReadOnlyField label="Empty Field" value="" />);

    const input = screen.getByLabelText(/Empty Field/i);
    expect(input).toHaveValue('');
  });

  it('handles special characters in label', () => {
    render(<ReadOnlyField label="Date of Birth" value="2023-01-01" />);

    const input = screen.getByDisplayValue('2023-01-01');
    expect(input).toHaveAttribute('id', 'readonly-date-of-birth');
  });
});
