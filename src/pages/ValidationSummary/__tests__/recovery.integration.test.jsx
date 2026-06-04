/**
 * Reload-recovery integration test for the Validation Summary.
 *
 * Exercises the Phase 1 load-on-init persistence path (NOT a rebuilt persistence
 * layer): a versioned workspace blob seeded into localStorage must hydrate the
 * real store on mount, so the summary renders the restored days and counts.
 *
 * Marked *(integration)*: it touches localStorage + a real StoreProvider mount and
 * resets storage between runs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { WORKSPACE_STORAGE_KEY, WORKSPACE_SCHEMA_VERSION } from '../../../state/persistence';
import { makeSummaryWorkspace } from '../../../__tests__/helpers/integration-test-helpers';
import { ValidationSummary } from '../index';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('ValidationSummary reload recovery (integration)', () => {
  it('restores the workspace and summary from persisted localStorage on mount', () => {
    const { workspace } = makeSummaryWorkspace();

    // Seed the Phase 1 blob shape BEFORE mount so the load-on-init path runs.
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace })
    );

    // Mount WITHOUT initialState so hydration (not the test-provided workspace) runs.
    render(
      <StoreProvider>
        <ValidationSummary />
      </StoreProvider>
    );

    // All three restored days are rendered.
    expect(screen.getByTestId('day-row-remy-2023-06-22')).toBeInTheDocument();
    expect(screen.getByTestId('day-row-remy-2023-06-23')).toBeInTheDocument();
    expect(screen.getByTestId('day-row-totoro-2023-06-22')).toBeInTheDocument();

    // Counts reflect the restored workspace.
    const counts = screen.getByTestId('summary-counts');
    expect(counts).toHaveTextContent(/1 valid/i);
    expect(counts).toHaveTextContent(/1 with errors/i);
    expect(counts).toHaveTextContent(/1 incomplete/i);
  });
});
