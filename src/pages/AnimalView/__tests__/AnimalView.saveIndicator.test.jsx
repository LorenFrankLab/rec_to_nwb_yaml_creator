/**
 * The Animal View renders the shared SaveIndicator in its header band, so animal-level setup
 * edits (cameras / electrode groups / channel maps / recording system / DIO / optogenetics) get
 * the SAME save-confidence cue the Day Editor already shows. The indicator reads the SAME
 * workspace persistence state (`useStoreContext().persistence`) the Day Editor wires — it is NOT
 * an optimistic local timestamp — so "Saving…", "Saved", and a save error are all reflected
 * truthfully from one source of truth.
 *
 * This is a DISPLAY-ONLY confidence cue (edits already autosave; the unsaved-work guard already
 * protects tab close). It touches no export bytes and no validation rule.
 *
 * The store is mocked here (mirroring AppLayout.unsavedGuard.test.jsx) because the live persistence
 * state (lastSaved / saveError / hasPendingWrite) is only produced by the REAL debounced (500ms,
 * async) autosave and cannot be deterministically seeded through the real StoreProvider in jsdom.
 * To still close the "AnimalView hardcodes an empty/constant persistence" seam, each test below
 * asserts a DISTINCT state (pending → "Saving…", lastSaved → "Saved", saveError → the error alert):
 * a hardcoded `persistence={{}}` (or any constant) could satisfy at most one of these, so the set
 * proves AnimalView forwards the ACTUAL context persistence object, not a constant.
 *
 * An unknown tab renders the lightweight placeholder panel, keeping the heavy setup containers out
 * of the way so the header wiring is exercised in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AnimalView } from '../index';

// Controlled persistence the SaveIndicator reads. Reassigned per test to drive each state.
const mockPersistence = {
  enabled: true,
  lastSaved: null,
  saveError: null,
  hasPendingWrite: false,
  loadNotice: null,
  loadOutcome: null,
  dismissLoadNotice: vi.fn(),
  saveNow: vi.fn(),
};

const remy = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: [],
};

const mockModel = { workspace: { animals: { remy }, days: {}, settings: {} } };

vi.mock('../../../state/StoreContext', () => ({
  useStoreContext: () => ({
    model: mockModel,
    actions: { updateAnimal: vi.fn(), deleteAnimal: vi.fn() },
    selectors: {},
    persistence: mockPersistence,
  }),
}));

/**
 * Render AnimalView on a lightweight (unknown) tab so only the header + placeholder panel mount.
 * @param {string} [tab] - The active tab.
 * @returns {object} render result
 */
function renderView(tab = 'placeholder-tab') {
  return render(<AnimalView animalId="remy" tab={tab} />);
}

describe('AnimalView — save indicator in the header', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = { hash: '#/animal/remy/cameras' };
    mockPersistence.enabled = true;
    mockPersistence.lastSaved = null;
    mockPersistence.saveError = null;
    mockPersistence.hasPendingWrite = false;
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('shows "Saving…" in the header while a debounced write is in flight', () => {
    mockPersistence.hasPendingWrite = true;
    renderView();
    const header = document.querySelector('[data-testid="animal-view-header"]');
    expect(header).not.toBeNull();
    expect(within(header).getByText(/saving…/i)).toBeInTheDocument();
  });

  it('shows the confirmed "Saved" cue in the header after a write lands', () => {
    mockPersistence.lastSaved = new Date().toISOString();
    renderView();
    const header = document.querySelector('[data-testid="animal-view-header"]');
    expect(within(header).getByText(/saved/i)).toBeInTheDocument();
  });

  it('surfaces a save error in the header (alert) from the same persistence source', () => {
    mockPersistence.saveError = 'Could not save workspace: QuotaExceededError';
    renderView();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save workspace/i);
  });

  it('renders the indicator in the header band regardless of which tab is active', () => {
    mockPersistence.hasPendingWrite = true;
    renderView('another-tab');
    const header = document.querySelector('[data-testid="animal-view-header"]');
    expect(within(header).getByText(/saving…/i)).toBeInTheDocument();
  });
});
