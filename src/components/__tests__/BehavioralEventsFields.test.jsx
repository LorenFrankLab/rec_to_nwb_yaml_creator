import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
