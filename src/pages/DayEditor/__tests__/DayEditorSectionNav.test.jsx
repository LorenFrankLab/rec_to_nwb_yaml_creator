import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayEditorSectionNav from '../DayEditorSectionNav';

describe('DayEditorSectionNav', () => {
  // The nav renders the five Phase 15 sections grouped under the vertical rail headings.
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
    {
      label: 'SESSION',
      steps: [
        step('overview', 'Overview', 'valid', active === 'overview'),
        step('files', 'Files & Weight', 'valid', active === 'files'),
      ],
    },
    {
      label: 'RECORDING',
      steps: [
        step('devices', 'Devices & Failed Channels', 'incomplete', active === 'devices'),
        step('epochs', 'Tasks & Epochs', 'incomplete', active === 'epochs'),
      ],
    },
    {
      label: 'FINISH',
      steps: [
        step('finish', 'Validation & Export', validationStatus, active === 'finish', validationCount),
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
    expect(icons).toEqual(['✓', '✓', '⚠', '⚠', '⚠']);
  });

  it('marks the active section with aria-current="page"', () => {
    render(<DayEditorSectionNav groups={makeGroups({ active: 'devices' })} onNavigate={vi.fn()} />);
    const devices = screen.getByRole('button', { name: /Devices & Failed Channels/i });
    expect(devices).toHaveAttribute('aria-current', 'page');
    expect(devices).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /^Overview/i })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /^Overview/i })).toHaveAttribute('tabindex', '-1');
  });

  it('calls onNavigate for ANY section clicked — including Validation & Export (no gating)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={onNavigate} />);
    const exportButton = screen.getByRole('button', { name: /^Validation & Export/i });
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(exportButton);
    expect(onNavigate).toHaveBeenCalledWith('finish');
  });

  it('folds the status into each accessible name', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Overview.*Complete/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Devices & Failed Channels.*Incomplete/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validation & Export.*Incomplete/i })).toBeInTheDocument();
  });

  it('shows the to-fix count on the Validation item when provided', () => {
    render(
      <DayEditorSectionNav groups={makeGroups({ validationCount: 3 })} onNavigate={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /Validation & Export.*3 to fix/i })
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
