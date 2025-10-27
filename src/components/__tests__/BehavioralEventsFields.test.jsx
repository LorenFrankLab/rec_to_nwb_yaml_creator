import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsFields from '../BehavioralEventsFields';

describe('BehavioralEventsFields', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      formData: {
        behavioral_events: [
          {
            description: '',
            name: '',
          },
        ],
      },
      handleChange: vi.fn(() => vi.fn()),
      onBlur: vi.fn(),
      itemSelected: vi.fn(),
      addArrayItem: vi.fn(),
      removeArrayItem: vi.fn(),
      duplicateArrayItem: vi.fn(),
    };
  });

  it('renders behavioral events section', () => {
    render(<BehavioralEventsFields {...defaultProps} />);
    expect(screen.getByText('Behavioral Events')).toBeInTheDocument();
  });

  it('renders behavioral event fields', () => {
    render(<BehavioralEventsFields {...defaultProps} />);
    expect(screen.getAllByLabelText(/Description/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Name/i)[0]).toBeInTheDocument();
  });

  it('displays values from formData', () => {
    const props = {
      ...defaultProps,
      formData: {
        behavioral_events: [
          {
            description: 'Din01',
            name: 'light1',
          },
        ],
      },
    };
    render(<BehavioralEventsFields {...props} />);
    // Note: SelectInputPairElement uses defaultValue (uncontrolled), not value
    // So we only test DataListElement which does use value
    expect(screen.getByDisplayValue('light1')).toBeInTheDocument();
  });

  it('renders multiple behavioral event items', () => {
    const props = {
      ...defaultProps,
      formData: {
        behavioral_events: [
          {
            description: 'Din01',
            name: 'light1',
          },
          {
            description: 'Din02',
            name: 'light2',
          },
        ],
      },
    };
    render(<BehavioralEventsFields {...props} />);
    // Test names only (description uses uncontrolled SelectInputPairElement)
    expect(screen.getByDisplayValue('light1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('light2')).toBeInTheDocument();
  });

  describe('CRUD Operations', () => {
    it('calls addArrayItem when add button is clicked', async () => {
      const user = userEvent.setup();
      const mockAddArrayItem = vi.fn();
      const props = { ...defaultProps, addArrayItem: mockAddArrayItem };

      render(<BehavioralEventsFields {...props} />);

      const addButton = screen.getByRole('button', { name: '＋' });
      await user.click(addButton);

      expect(mockAddArrayItem).toHaveBeenCalledTimes(1);
      expect(mockAddArrayItem.mock.calls[0][0]).toBe('behavioral_events');
      // In simple mode (allowMultiple=false), second arg is click event object
      expect(mockAddArrayItem.mock.calls[0][1]).toBeTruthy();
    });

    it('calls removeArrayItem when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockRemoveArrayItem = vi.fn();
      const props = { ...defaultProps, removeArrayItem: mockRemoveArrayItem };

      render(<BehavioralEventsFields {...props} />);

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      await user.click(removeButton);

      expect(mockRemoveArrayItem).toHaveBeenCalledWith(0, 'behavioral_events');
    });

    it('calls duplicateArrayItem when duplicate button is clicked', async () => {
      const user = userEvent.setup();
      const mockDuplicateArrayItem = vi.fn();
      const props = { ...defaultProps, duplicateArrayItem: mockDuplicateArrayItem };

      render(<BehavioralEventsFields {...props} />);

      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      await user.click(duplicateButton);

      expect(mockDuplicateArrayItem).toHaveBeenCalledWith(0, 'behavioral_events');
    });
  });
});
