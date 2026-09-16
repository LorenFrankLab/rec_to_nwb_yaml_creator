import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskTemplateDialog from '../TaskTemplateDialog';

it('maps the W-track sequence to the existing lab task without minting or renaming a definition', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const types = [
    { id: 'sleep', task_name: 'Sleep', task_environment: 'home cage', camera_id: [0] },
    { id: 'alternation', task_name: 'w_alternation', task_environment: 'Room A', camera_id: [1] },
  ];
  render(<TaskTemplateDialog kind="wtrack" types={types} onClose={() => {}} onApply={onApply} />);
  expect(screen.getByRole('button', { name: 'Apply template' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Run task'), 'alternation');
  await user.click(screen.getByRole('button', { name: 'Apply template' }));
  expect(onApply).toHaveBeenCalledWith([
    { taskTypeId: 'sleep', task_epochs: [1, 3] },
    { taskTypeId: 'alternation', task_epochs: [2, 4] },
  ], { sleep: 'sleep', run: 'alternation' });
  expect(types.map((type) => type.task_name)).toEqual(['Sleep', 'w_alternation']);
});

describe('saved template choices', () => {
  it('requires reselection if a previously chosen task no longer exists', () => {
    render(<TaskTemplateDialog kind="sleep" defaults={{ sleep: 'removed' }} types={[]} onClose={() => {}} onApply={() => {}} />);
    expect(screen.getByRole('button', { name: 'Apply template' })).toBeDisabled();
  });
});
