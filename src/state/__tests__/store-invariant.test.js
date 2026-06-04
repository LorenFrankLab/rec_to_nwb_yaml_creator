/**
 * Loud-failure invariant: `useStore` must throw (not silently fall back to defaults)
 * when the legacy form state is undefined — a state that can only arise from a real
 * bug. Replaces the former silent `console.warn` + defaultYMLValues fallback.
 */
import { describe, it, expect, vi } from 'vitest';

import { renderHook } from '@testing-library/react';
import { useStore } from '../store';

// Force the legacy form slice to report an undefined formData.
vi.mock('../useLegacyForm', () => ({
  useLegacyForm: () => ({
    formData: undefined,
    setFormData: () => {},
    legacyActions: {},
    legacySelectors: {},
  }),
}));

describe('useStore formData invariant', () => {
  it('throws loudly when formData is undefined instead of masking it with defaults', () => {
    // The model build throws during render; silence React's expected error logging.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useStore())).toThrow('useStore: formData is undefined');
    errorSpy.mockRestore();
  });
});
