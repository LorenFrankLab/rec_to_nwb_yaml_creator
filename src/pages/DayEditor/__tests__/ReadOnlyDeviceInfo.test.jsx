import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReadOnlyDeviceInfo from '../ReadOnlyDeviceInfo';

describe('ReadOnlyDeviceInfo', () => {
  const mockGroup = {
    id: 0,
    location: 'CA1',
    device_type: 'tetrode_12.5',
    description: 'Dorsal CA1 tetrode array',
    targeted_location: 'CA1',
    targeted_x: 2.6,
    targeted_y: -3.8,
    targeted_z: 1.5,
    units: 'mm',
  };

  it('renders device type', () => {
    render(<ReadOnlyDeviceInfo group={mockGroup} />);

    expect(screen.getByText(/device type/i)).toBeInTheDocument();
    expect(screen.getByText('tetrode_12.5')).toBeInTheDocument();
  });

  it('renders location (actual and targeted)', () => {
    render(<ReadOnlyDeviceInfo group={mockGroup} />);

    const locationLabels = screen.getAllByText(/location/i);
    expect(locationLabels.length).toBeGreaterThanOrEqual(2); // "Location" and "Targeted Location"
    const ca1Texts = screen.getAllByText('CA1');
    expect(ca1Texts.length).toBeGreaterThanOrEqual(1); // Appears in both location and targeted_location
  });

  it('renders stereotaxic coordinates with units', () => {
    render(<ReadOnlyDeviceInfo group={mockGroup} />);

    // Should display coordinates in format: "(2.6, -3.8, 1.5) mm"
    expect(screen.getByText(/2\.6/)).toBeInTheDocument();
    expect(screen.getByText(/-3\.8/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5/)).toBeInTheDocument();
    expect(screen.getByText(/mm/)).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ReadOnlyDeviceInfo group={mockGroup} />);

    expect(screen.getByText('Dorsal CA1 tetrode array')).toBeInTheDocument();
  });

  it('formats coordinates correctly with parentheses and units', () => {
    render(<ReadOnlyDeviceInfo group={mockGroup} />);

    // Look for the exact formatted string
    expect(screen.getByText(/\(2\.6, -3\.8, 1\.5\) mm/)).toBeInTheDocument();
  });
});
