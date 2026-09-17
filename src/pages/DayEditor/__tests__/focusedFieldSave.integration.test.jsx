/**
 * Review finding F3 — the value being typed must be observable to persistence.
 *
 * Renders the real Day Editor over the real store, types into the session description WITHOUT
 * blurring, then (a) reads the save indicator, (b) presses Ctrl+S, and (c) reloads a fresh store
 * from localStorage — the typed text must survive. Before the draft registry, storage held the old
 * description while the UI said "Saved".
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { AppLayout } from '../../../layouts/AppLayout';
import { WORKSPACE_STORAGE_KEY, WORKSPACE_SCHEMA_VERSION, loadWorkspace } from '../../../state/persistence';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { resetDraftRegistryForTests } from '../../../state/draftRegistry';

/**
 * Seed a realistic one-day workspace into localStorage.
 *
 * @returns {{animal: object, day: object}}
 */
function seedWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  const workspace = {
    version: '1.0.0',
    lastModified: '2023-06-22T12:00:00.000Z',
    animals: { [animal.id]: animal },
    days: { [day.id]: day },
    settings: {
      defaultLab: '',
      defaultInstitution: '',
      defaultExperimenters: [],
      autoSaveInterval: 30000,
      shadowExportEnabled: true,
    },
  };
  window.localStorage.setItem(
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace })
  );
  return { animal, day };
}

/**
 * The session description currently in storage for a day.
 *
 * @param {string} dayId
 * @returns {string|undefined}
 */
function storedDescription(dayId) {
  const loaded = loadWorkspace();
  return loaded?.workspace?.days?.[dayId]?.session?.session_description;
}

describe('focused-field save (F3)', () => {
  beforeEach(() => {
    resetDraftRegistryForTests();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.localStorage.clear();
    window.location.hash = '';
  });

  it('Ctrl+S while the textarea is focused writes the typed text; a fresh load reads it back', async () => {
    const { day } = seedWorkspace();
    window.location.hash = `#/day/${day.id}`;
    render(
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    );

    const box = await screen.findByLabelText(/recording notes/i);
    box.focus();
    fireEvent.change(box, { target: { value: 'Typed but not blurred' } });

    // Storage still holds the old value; the indicator must NOT claim "Saved".
    expect(storedDescription(day.id)).not.toBe('Typed but not blurred');
    expect(screen.getByText(/unsaved edits/i)).toBeInTheDocument();

    // Explicit save from inside the focused field.
    await act(async () => {
      fireEvent.keyDown(box, { key: 's', ctrlKey: true });
    });

    expect(storedDescription(day.id)).toBe('Typed but not blurred');
    expect(screen.queryByText(/unsaved edits/i)).not.toBeInTheDocument();

    // A fresh store (a reload) hydrates the typed text.
    cleanup();
    render(
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    );
    const reloaded = await screen.findByLabelText(/recording notes/i);
    expect(reloaded.value).toBe('Typed but not blurred');
  });

  it('pagehide commits and writes the focused draft without an explicit save', async () => {
    const { day } = seedWorkspace();
    window.location.hash = `#/day/${day.id}`;
    render(
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    );
    const box = await screen.findByLabelText(/recording notes/i);
    fireEvent.change(box, { target: { value: 'Closing the tab' } });
    expect(storedDescription(day.id)).not.toBe('Closing the tab');
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(storedDescription(day.id)).toBe('Closing the tab');
  });

  it('the debounce commits the text on its own when typing pauses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { day } = seedWorkspace();
    window.location.hash = `#/day/${day.id}`;
    render(
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    );
    const box = await screen.findByLabelText(/recording notes/i);
    fireEvent.change(box, { target: { value: 'Paused typing' } });
    await act(async () => {
      // draft debounce (400ms)
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(screen.queryByText(/unsaved edits/i)).not.toBeInTheDocument();
    await act(async () => {
      // autosave debounce (500ms)
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(storedDescription(day.id)).toBe('Paused typing');
  });
});
