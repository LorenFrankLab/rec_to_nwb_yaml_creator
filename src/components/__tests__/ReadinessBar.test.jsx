import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadinessBar from '../ReadinessBar';

describe('ReadinessBar (issue-driven export readiness)', () => {
  it('is quiet and reads "Ready to export" when there are no errors', () => {
    render(<ReadinessBar issues={[]} onFix={() => {}} />);
    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
    expect(screen.queryByText(/block(s)? export/i)).not.toBeInTheDocument();
  });

  it('warnings alone do not make it loud', () => {
    render(
      <ReadinessBar issues={[{ severity: 'warning', message: 'Weight looks low' }]} onFix={() => {}} />,
    );
    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
    expect(screen.queryByText(/block(s)? export/i)).not.toBeInTheDocument();
  });

  it('lists each blocking error and routes its fix to onFix', async () => {
    const user = userEvent.setup();
    const onFix = vi.fn();
    const issues = [
      { severity: 'error', message: 'Epoch 1 has no video', actionLabel: 'Fix in Epoch 1' },
      { severity: 'error', message: 'Probe 2 location missing', actionLabel: 'Fix in Setup' },
    ];
    render(<ReadinessBar issues={issues} onFix={onFix} />);
    expect(screen.getByText(/2 issues block export/i)).toBeInTheDocument();
    expect(screen.getByText('Epoch 1 has no video')).toBeInTheDocument();
    expect(screen.getByText('Probe 2 location missing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fix in Epoch 1' }));
    expect(onFix).toHaveBeenCalledWith(issues[0]);
  });

  it('uses singular copy for a single blocking issue', () => {
    render(<ReadinessBar issues={[{ severity: 'error', message: 'x' }]} onFix={() => {}} />);
    expect(screen.getByText(/1 issue blocks export/i)).toBeInTheDocument();
  });

  it('defaults the fix action label to "Fix" when an issue carries none', async () => {
    const user = userEvent.setup();
    const onFix = vi.fn();
    const issue = { severity: 'error', message: 'Something blocks export' };
    render(<ReadinessBar issues={[issue]} onFix={onFix} />);
    await user.click(screen.getByRole('button', { name: 'Fix' }));
    expect(onFix).toHaveBeenCalledWith(issue);
  });

  it('renders multiple issues sharing a code without a React duplicate-key warning', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ReadinessBar
        issues={[
          { severity: 'error', code: 'required', path: 'session_description', message: 'A is required' },
          { severity: 'error', code: 'required', path: 'experiment_description', message: 'B is required' },
          { severity: 'error', code: 'required', path: 'subject.species', message: 'C is required' },
        ]}
        onFix={() => {}}
      />,
    );
    // All three rows render…
    expect(screen.getByText('A is required')).toBeInTheDocument();
    expect(screen.getByText('C is required')).toBeInTheDocument();
    // …and no "Encountered two children with the same key" warning was emitted.
    const keyWarnings = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes('same key'),
    );
    expect(keyWarnings).toEqual([]);
    errorSpy.mockRestore();
  });

  it('omits the Fix button (but keeps the message) for an issue the page reports as non-actionable', () => {
    const fixable = { severity: 'error', code: 'fixable', message: 'This one can be fixed' };
    const deadEnd = { severity: 'error', code: 'read_only', message: 'Read-only dead end — no in-app fix' };
    render(
      <ReadinessBar
        issues={[fixable, deadEnd]}
        onFix={() => {}}
        canFix={(issue) => issue.code !== 'read_only'}
      />,
    );
    // Both messages render…
    expect(screen.getByText('This one can be fixed')).toBeInTheDocument();
    expect(screen.getByText('Read-only dead end — no in-app fix')).toBeInTheDocument();
    // …but only the actionable one gets a button (no dead control on the dead-end issue).
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
