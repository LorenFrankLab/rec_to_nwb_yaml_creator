/**
 * AppLayout wires the beforeunload guard to BOTH a pending write and a save error,
 * so a failed save (where the write never landed) still warns before navigation —
 * even on the saveNow path that sets saveError without re-arming hasPendingWrite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayout } from '../AppLayout';

const mockPersistence = {
  enabled: true,
  lastSaved: null,
  saveError: null,
  hasPendingWrite: false,
  loadNotice: null,
  dismissLoadNotice: vi.fn(),
  saveNow: vi.fn(),
};

vi.mock('../../state/StoreContext', () => ({
  useStoreContext: () => ({ persistence: mockPersistence }),
}));

// Mocked views provide a <main> and don't touch the store, so the guard wiring is
// exercised in isolation.
vi.mock('../../pages/Home', () => ({
  Home: () => <main id="main-content" role="main">Home</main>,
}));
vi.mock('../../pages/AnimalWorkspace', () => ({
  AnimalWorkspace: () => <main id="main-content" role="main">Workspace</main>,
}));
vi.mock('../../pages/DayEditor', () => ({
  DayEditor: () => <main id="main-content" role="main">Day</main>,
}));
vi.mock('../../pages/ValidationSummary', () => ({
  ValidationSummary: () => <main id="main-content" role="main">Validation</main>,
}));
vi.mock('../../pages/LegacyFormView', () => ({
  LegacyFormView: () => <main id="main-content" role="main">Legacy</main>,
}));
vi.mock('../../pages/AnimalEditor', () => ({
  default: () => <main id="main-content" role="main">Animal Editor</main>,
}));

describe('AppLayout unsaved-work guard wiring', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = { hash: '#/' };
    mockPersistence.saveError = null;
    mockPersistence.hasPendingWrite = false;
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('arms the beforeunload guard when only saveError is set (pending write false)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    mockPersistence.saveError = 'Could not save workspace: QuotaExceededError';
    mockPersistence.hasPendingWrite = false;

    render(<AppLayout />);

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('does not arm the guard when there is neither a pending write nor a save error', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    render(<AppLayout />);

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
