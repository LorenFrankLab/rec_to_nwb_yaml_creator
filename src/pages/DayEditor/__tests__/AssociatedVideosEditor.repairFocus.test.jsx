/**
 * @vitest-environment jsdom
 *
 * MEDIUM review finding — repair-focus anchors for associated video files.
 *
 * The validation rules emit precise paths for video camera/epoch issues
 * (`associated_video_files[{i}].camera_id`, `associated_video_files[{i}].task_epochs`).
 * For a repair button to land on the offending ROW (not the broad Devices/Tasks
 * step), each row's camera and epoch <select> must carry a matching
 * `data-field-path` anchor — exactly as the associated-FILES editor does.
 *
 * These tests assert the anchors render with the precise path format the rules emit.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AssociatedVideosEditor from '../AssociatedVideosEditor';

const cameras = [
  { id: 1, camera_name: 'overhead' },
  { id: 2, camera_name: 'side' },
];
const tasks = [{ task_name: 'run', task_epochs: [1, 2] }];

describe('AssociatedVideosEditor — repair-focus anchors', () => {
  it('camera select for each row carries data-field-path associated_video_files[{i}].camera_id', () => {
    const videos = [
      { name: 'a.h264', camera_id: 1, task_epochs: 1 },
      { name: 'b.h264', camera_id: 2, task_epochs: 2 },
    ];
    const { container } = render(
      <AssociatedVideosEditor videos={videos} cameras={cameras} tasks={tasks} onChange={() => {}} />
    );

    expect(
      container.querySelector('select[data-field-path="associated_video_files[0].camera_id"]')
    ).not.toBeNull();
    expect(
      container.querySelector('select[data-field-path="associated_video_files[1].camera_id"]')
    ).not.toBeNull();
  });

  it('epoch select for each row carries data-field-path associated_video_files[{i}].task_epochs', () => {
    const videos = [
      { name: 'a.h264', camera_id: 1, task_epochs: 1 },
      { name: 'b.h264', camera_id: 2, task_epochs: 2 },
    ];
    const { container } = render(
      <AssociatedVideosEditor videos={videos} cameras={cameras} tasks={tasks} onChange={() => {}} />
    );

    expect(
      container.querySelector('select[data-field-path="associated_video_files[0].task_epochs"]')
    ).not.toBeNull();
    expect(
      container.querySelector('select[data-field-path="associated_video_files[1].task_epochs"]')
    ).not.toBeNull();
  });

  it('anchors use the row index, so a stale-row repair lands on that specific row', () => {
    const videos = [
      { name: 'a.h264', camera_id: 1, task_epochs: 1 },
      // Stale row at index 1: camera id 99 no longer defined.
      { name: 'b.h264', camera_id: 99, task_epochs: 2 },
    ];
    const { container } = render(
      <AssociatedVideosEditor videos={videos} cameras={cameras} tasks={tasks} onChange={() => {}} />
    );

    const staleCameraSelect = container.querySelector(
      'select[data-field-path="associated_video_files[1].camera_id"]'
    );
    expect(staleCameraSelect).not.toBeNull();
    expect(staleCameraSelect.getAttribute('aria-invalid')).toBe('true');
  });

  // collectValidEpochs iterates each task's task_epochs. A task inside an otherwise
  // valid tasks array can carry a malformed task_epochs (a string, not an array);
  // it must contribute no epochs rather than crash this epoch-repair UI.
  it('does not throw when a task has a non-array task_epochs', () => {
    expect(() =>
      render(
        <AssociatedVideosEditor
          videos={[{ name: 'a.h264', camera_id: 1, task_epochs: '' }]}
          cameras={cameras}
          tasks={[{ task_name: 'run', task_epochs: '1' }]}
          onChange={() => {}}
        />
      )
    ).not.toThrow();
    // The malformed task contributes no valid epochs, so the empty-state note shows.
    expect(screen.getByText(/no task epochs/i)).toBeInTheDocument();
  });
});
