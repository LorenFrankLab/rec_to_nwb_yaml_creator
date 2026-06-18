import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayEditorSectionNav from '../DayEditorSectionNav';

describe('DayEditorSectionNav', () => {
  // The nav renders the six focused Day Editor sections grouped under the vertical rail headings.
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
  const makeGroups = ({ active = 'daily', validationStatus = 'incomplete', validationCount } = {}) => [
    {
      label: 'DAY',
      steps: [
        step('daily', 'Daily Setup', 'valid', active === 'daily'),
        step('tasks', 'Tasks & Files', 'incomplete', active === 'tasks'),
      ],
    },
    {
      label: 'RECORDING',
      steps: [
        step('recording', 'Recording Setup', 'valid', active === 'recording'),
        step('channels', 'Failed Channels', 'valid', active === 'channels'),
        step('dio', 'DIO Wiring', 'incomplete', active === 'dio'),
      ],
    },
    {
      label: 'FINISH',
      steps: [
        step('export', 'Fix & Export', validationStatus, active === 'export', validationCount),
      ],
    },
  ];

  it('renders a single navigation landmark labelled for the day editor sections', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: /day editor sections/i });
    expect(nav).toBeInTheDocument();
  });

  it('renders all six sections as buttons (not links)', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows the status glyph from computeStepStatus for each section', () => {
    const { container } = render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    const icons = Array.from(
      container.querySelectorAll('.section-nav-status-icon')
    ).map((el) => el.textContent);
    expect(icons).toEqual(['✓', '⚠', '✓', '✓', '⚠', '⚠']);
  });

  it('marks the active section with aria-current="page"', () => {
    render(<DayEditorSectionNav groups={makeGroups({ active: 'recording' })} onNavigate={vi.fn()} />);
    const recording = screen.getByRole('button', { name: /Recording Setup/i });
    expect(recording).toHaveAttribute('aria-current', 'page');
    expect(recording).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /^Daily Setup/i })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /^Daily Setup/i })).toHaveAttribute('tabindex', '-1');
  });

  it('calls onNavigate for ANY section clicked — including Fix & Export (no gating)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={onNavigate} />);
    const exportButton = screen.getByRole('button', { name: /^Fix & Export/i });
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(exportButton);
    expect(onNavigate).toHaveBeenCalledWith('export');
  });

  it('folds the status into each accessible name', () => {
    render(<DayEditorSectionNav groups={makeGroups()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Daily Setup.*Complete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tasks & Files.*Incomplete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fix & Export.*Incomplete/i })).toBeInTheDocument();
  });

  it('shows the to-fix count on the Validation item when provided', () => {
    render(
      <DayEditorSectionNav groups={makeGroups({ validationCount: 3 })} onNavigate={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /Fix & Export.*3 to fix/i })
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
