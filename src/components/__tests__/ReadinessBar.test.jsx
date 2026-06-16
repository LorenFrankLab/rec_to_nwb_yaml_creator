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
});
