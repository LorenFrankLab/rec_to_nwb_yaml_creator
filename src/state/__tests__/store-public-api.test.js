/**
 * Public-API contract for useStore.
 *
 * Pins the exact key set of `actions` and `selectors`, the top-level return shape,
 * the persistence shape, and that `model` is `{ ...formData, workspace }`. This is the
 * regression net for the store decomposition: splitting the monolith into focused
 * hooks must add or remove NO public key and must not change the return shape.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStore } from '../store';
import { defaultYMLValues } from '../../valueList';

describe('useStore public API contract', () => {
  it('exposes exactly the expected top-level keys', () => {
    const { result } = renderHook(() => useStore());
    expect(Object.keys(result.current).sort()).toEqual([
      'actions',
      'model',
      'persistence',
      'selectors',
    ]);
  });

  it('exposes exactly the expected action keys', () => {
    const { result } = renderHook(() => useStore());
    expect(Object.keys(result.current.actions).sort()).toEqual([
      'addArrayItem',
      'createAnimal',
      'createConfigurationSnapshotAndApplyForward',
      'createDay',
      'deleteAnimal',
      'deleteDay',
      'duplicateArrayItem',
      'duplicateElectrodeGroupItem',
      'handleChange',
      'itemSelected',
      'nTrodeMapSelected',
      'onBlur',
      'onMapInput',
      'rebuildConfigurationHistory',
      'relinkDayReference',
      'removeArrayItem',
      'removeDayReference',
      'removeElectrodeGroupItem',
      'setFormData',
      'updateAnimal',
      'updateDay',
      'updateFormArray',
      'updateFormData',
      'updateWorkspaceSettings',
    ]);
  });

  it('exposes exactly the expected selector keys', () => {
    const { result } = renderHook(() => useStore());
    expect(Object.keys(result.current.selectors).sort()).toEqual([
      'getAnimalDays',
      'getCameraIds',
      'getDioEvents',
      'getTaskEpochs',
    ]);
  });

  it('exposes exactly the expected persistence keys', () => {
    const { result } = renderHook(() => useStore());
    expect(Object.keys(result.current.persistence).sort()).toEqual([
      'dismissLoadNotice',
      'enabled',
      'hasPendingWrite',
      'lastSaved',
      'loadNotice',
      'saveError',
      'saveNow',
    ]);
  });

  it('model is { ...formData, workspace } — legacy fields plus the workspace slice', () => {
    const { result } = renderHook(() => useStore());
    const { model } = result.current;

    expect(model).toHaveProperty('workspace');
    // Every legacy formData key is present on the model.
    for (const key of Object.keys(defaultYMLValues)) {
      expect(model).toHaveProperty(key);
    }
    // The model's own key set is exactly the legacy keys plus `workspace`.
    expect(Object.keys(model).sort()).toEqual(
      [...Object.keys(defaultYMLValues), 'workspace'].sort()
    );
  });
});
