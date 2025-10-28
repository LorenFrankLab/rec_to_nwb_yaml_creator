/**
 * Tests for task epoch cleanup behavior
 *
 * Critical data integrity requirement:
 * When tasks are deleted, any task_epochs references in associated_files
 * and associated_video_files must be automatically cleared to prevent
 * orphaned references that corrupt YAML exports.
 *
 * This behavior was originally implemented in App.js (lines 274-315)
 * and must be maintained in the store.js implementation.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { defaultYMLValues } from '../../valueList';

describe('Store - Task Epoch Cleanup', () => {
  describe('Cleanup when tasks are removed', () => {
    it('should clear orphaned task_epochs from associated_files when task is removed', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [
          { id: 1, task_name: 'Task1', task_epochs: 'epoch1' },
          { id: 2, task_name: 'Task2', task_epochs: 'epoch2' },
        ],
        associated_files: [
          { name: 'file1.dat', task_epochs: 'epoch1', description: 'File 1' },
          { name: 'file2.dat', task_epochs: 'epoch2', description: 'File 2' },
        ],
        associated_video_files: [],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', [{ id: 1, task_name: 'Task1', task_epochs: 'epoch1' }]);
      });

      const currentState = result.current.model;
      expect(currentState.associated_files[1].task_epochs).toBe('');
      expect(currentState.associated_files[0].task_epochs).toBe('epoch1');
    });

    it('should clear orphaned task_epochs from associated_video_files when task is removed', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [
          { id: 1, task_name: 'Task1', task_epochs: 'epoch1' },
          { id: 2, task_name: 'Task2', task_epochs: 'epoch2' },
        ],
        associated_files: [],
        associated_video_files: [
          { camera_id: 'cam1', task_epochs: 'epoch1', name: 'video1.mp4' },
          { camera_id: 'cam2', task_epochs: 'epoch2', name: 'video2.mp4' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', [{ id: 2, task_name: 'Task2', task_epochs: 'epoch2' }]);
      });

      const currentState = result.current.model;
      expect(currentState.associated_video_files[0].task_epochs).toBe('');
      expect(currentState.associated_video_files[1].task_epochs).toBe('epoch2');
    });

    it('should clear orphaned epochs from both associated files types simultaneously', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [
          { id: 1, task_name: 'Task1', task_epochs: 'epoch1' },
          { id: 2, task_name: 'Task2', task_epochs: 'epoch2' },
          { id: 3, task_name: 'Task3', task_epochs: 'epoch3' },
        ],
        associated_files: [
          { name: 'file1.dat', task_epochs: 'epoch1', description: 'File 1' },
          { name: 'file2.dat', task_epochs: 'epoch2', description: 'File 2' },
        ],
        associated_video_files: [
          { camera_id: 'cam1', task_epochs: 'epoch2', name: 'video1.mp4' },
          { camera_id: 'cam2', task_epochs: 'epoch3', name: 'video2.mp4' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', [{ id: 1, task_name: 'Task1', task_epochs: 'epoch1' }]);
      });

      const currentState = result.current.model;
      expect(currentState.associated_files[0].task_epochs).toBe('epoch1');
      expect(currentState.associated_files[1].task_epochs).toBe('');
      expect(currentState.associated_video_files[0].task_epochs).toBe('');
      expect(currentState.associated_video_files[1].task_epochs).toBe('');
    });
  });

  describe('Cleanup when all tasks are removed', () => {
    it('should clear all task_epochs when tasks array becomes empty', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [
          { id: 1, task_name: 'Task1', task_epochs: 'epoch1' },
        ],
        associated_files: [
          { name: 'file1.dat', task_epochs: 'epoch1', description: 'File 1' },
        ],
        associated_video_files: [
          { camera_id: 'cam1', task_epochs: 'epoch1', name: 'video1.mp4' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', []);
      });

      const currentState = result.current.model;
      expect(currentState.associated_files[0].task_epochs).toBe('');
      expect(currentState.associated_video_files[0].task_epochs).toBe('');
    });
  });

  describe('No cleanup when epochs still valid', () => {
    it('should NOT clear task_epochs when task still exists', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [
          { id: 1, task_name: 'Task1', task_epochs: 'epoch1' },
          { id: 2, task_name: 'Task2', task_epochs: 'epoch2' },
        ],
        associated_files: [
          { name: 'file1.dat', task_epochs: 'epoch1', description: 'File 1' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', [
          { id: 1, task_name: 'Task1 Renamed', task_epochs: 'epoch1' },
          { id: 2, task_name: 'Task2', task_epochs: 'epoch2' },
        ]);
      });

      const currentState = result.current.model;
      expect(currentState.associated_files[0].task_epochs).toBe('epoch1');
    });
  });

  describe('Edge cases', () => {
    it('should handle missing associated_files gracefully', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [{ id: 1, task_name: 'Task1', task_epochs: 'epoch1' }],
        associated_video_files: [
          { camera_id: 'cam1', task_epochs: 'epoch1', name: 'video1.mp4' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', []);
      });

      const currentState = result.current.model;
      expect(currentState.associated_video_files[0].task_epochs).toBe('');
    });

    it('should handle missing associated_video_files gracefully', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [{ id: 1, task_name: 'Task1', task_epochs: 'epoch1' }],
        associated_files: [
          { name: 'file1.dat', task_epochs: 'epoch1', description: 'File 1' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', []);
      });

      const currentState = result.current.model;
      expect(currentState.associated_files[0].task_epochs).toBe('');
    });

    it('should handle empty task_epochs field', async () => {
      const { result } = renderHook(() => useStore());

      const initialState = {
        ...defaultYMLValues,
        tasks: [{ id: 1, task_name: 'Task1', task_epochs: 'epoch1' }],
        associated_files: [
          { name: 'file1.dat', task_epochs: '', description: 'File 1' },
          { name: 'file2.dat', task_epochs: 'epoch1', description: 'File 2' },
        ],
      };

      await act(async () => {
        result.current.actions.setFormData(initialState);
      });

      await act(async () => {
        result.current.actions.updateFormData('tasks', []);
      });

      const currentState = result.current.model;
      expect(currentState.associated_files[0].task_epochs).toBe('');
      expect(currentState.associated_files[1].task_epochs).toBe('');
    });
  });
});
