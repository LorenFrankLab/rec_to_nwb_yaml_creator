import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayEditorSectionNav from '../DayEditorSectionNav';

describe('DayEditorSectionNav', () => {
  // The nav now renders grouped StepViewModels (the day-editor view-model's step slice). This helper
  // builds the same five-section fixture the prior (stepStatus + currentStep + toFixCount) props
  // produced, so the rendered-output assertions below are unchanged.
  const STATUS_LABEL = {
    valid: 'Complete',
    incomplete: 'Incomplete',
    error: 'Has errors',
    pending: 'Not started',
  };
  const step = (key, label, status, active, issueCount) => ({
    key,
    label,
    status,
    statusLabel: STATUS_LABEL[status],
    active,
    ...(issueCount ? { issueCount } : {}),
  });
  const makeGroups = ({ active = 'overview', validationStatus = 'incomplete', validationCount } = {}) => [
    { label: 'Session', steps: [step('overview', 'Overview', 'valid', active === 'overview')] },
    {
      label: 'Recording',
      steps: [
        step('devices', 'Devices & Failed Channels', 'incomplete', active === 'devices'),
        step('epochs', 'Tasks & Epochs', 'incomplete', active === 'epochs'),
      ],
    },
    {
      label: 'Finish',
      steps: [
        step('validation', 'Validation', validationStatus, active === 'validation', validationCount),
        step('export', 'Export', 'error', active === 'export'),
      ],
    },
  ];

  it('renders a single navigation landmark labelled for the day editor sections', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: /day editor sections/i });
    expect(nav).toBeInTheDocument();
  });

  it('renders all five sections as buttons (not links)', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows the status glyph from computeStepStatus for each section', () => {
    const { container } = render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    const icons = Array.from(
      container.querySelectorAll('.section-nav-status-icon')
    ).map((el) => el.textContent);
    // overview valid ✓, devices/epochs/validation incomplete ⚠, export error ✗.
    expect(icons).toEqual(['✓', '⚠', '⚠', '⚠', '✗']);
  });

  it('marks the active section with aria-current="page"', () => {
    render(<DayEditorSectionNav groups={makeGroups({ active: 'devices' })} onNavigate={vi.fn()} />);
    const devices = screen.getByRole('button', { name: /Devices & Failed Channels/i });
    expect(devices).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /^Overview/i })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate for ANY section clicked — including Export (no gating)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={onNavigate} />);
    // Export is in an error state, yet it remains a freely-clickable tab.
    const exportButton = screen.getByRole('button', { name: /^Export/i });
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(exportButton);
    expect(onNavigate).toHaveBeenCalledWith('export');
  });

  it('folds the status into each accessible name', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Overview.*Complete/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Devices & Failed Channels.*Incomplete/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export.*Has errors/i })).toBeInTheDocument();
  });

  it('shows the to-fix count on the Validation item when provided', () => {
    render(
      <DayEditorSectionNav groups={makeGroups({ validationCount: 3 })} onNavigate={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /Validation.*3 to fix/i })
    ).toBeInTheDocument();
  });

  it('omits the to-fix count when zero', () => {
    render(
      <DayEditorSectionNav
        groups={makeGroups({ validationStatus: 'valid', validationCount: 0 })}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.queryByText(/to fix/i)).not.toBeInTheDocument();
  });
});
