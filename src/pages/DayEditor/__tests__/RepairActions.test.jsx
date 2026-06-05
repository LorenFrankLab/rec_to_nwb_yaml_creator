import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepairActions from '../RepairActions';

describe('RepairActions', () => {
  it('renders a "Fix in <step>" button for a repairable issue and routes to its step', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[{ path: 'subject.weight', code: 'required', message: 'weight is required' }]}
        onNavigate={onNavigate}
      />
    );

    const button = screen.getByRole('button', { name: /fix in overview/i });
    await user.click(button);
    expect(onNavigate).toHaveBeenCalledWith('overview', 'subject.weight');
  });

  it('does NOT render a fix button for non-repairable identity issues (slash ids)', () => {
    render(
      <RepairActions
        issues={[
          { path: 'subject.subject_id', code: 'subject_id_slash', message: 'Subject ID … recreate the animal …' },
          { path: 'session_id', code: 'session_id_slash', message: 'Session ID … fix the Subject ID …' },
        ]}
        onNavigate={vi.fn()}
      />
    );

    // The explanatory messages show…
    expect(screen.getByText(/recreate the animal/i)).toBeInTheDocument();
    expect(screen.getByText(/fix the Subject ID/i)).toBeInTheDocument();
    // …but there is no misleading "Fix in …" button that would dead-end on a read-only field.
    expect(screen.queryByRole('button', { name: /fix in/i })).not.toBeInTheDocument();
  });
});
