/**
 * Backup / restore (finding F8): incomplete days, configuration history and provenance travel in
 * the backup; a restore shows a replacement preview and only replaces on confirmation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import WorkspaceBackupPanel from '../WorkspaceBackupPanel';
import { downloadYamlFile } from '../../io/yaml';
import { WORKSPACE_STORAGE_KEY, loadWorkspace, resetPersistenceForTests } from '../../state/persistence';
import { resetBlobStoreForTests } from '../../state/blobStore';
import { resetWriterLockForTests } from '../../state/writerLock';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { summarizeWorkspace, diffWorkspaceReplacement } from '../../domain/workspaceBackup';

vi.mock('../../io/yaml', async () => {
  const actual = await vi.importActual('../../io/yaml');
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * A one-animal / one-day workspace slice.
 *
 * @param {object} [opts]
 * @param {string} [opts.animalId]
 * @param {string} [opts.dayDate]
 * @param {boolean} [opts.draft]
 * @returns {object}
 */
function makeWorkspace({ animalId = 'remy', dayDate = '2023-06-22', draft = true } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  const dayId = `${animalId}-${dayDate}`;
  const a = { ...animal, id: animalId, subject: { ...animal.subject, subject_id: animalId }, days: [dayId] };
  const d = { ...day, id: dayId, animalId, date: dayDate, state: { ...day.state, draft, exported: !draft } };
  return {
    version: '1.0.0',
    lastModified: '2023-06-22T12:00:00.000Z',
    animals: { [animalId]: a },
    days: { [dayId]: d },
    settings: { defaultLab: '', defaultInstitution: '', defaultExperimenters: [], autoSaveInterval: 30000, shadowExportEnabled: true },
  };
}

describe('workspaceBackup domain', () => {
  it('summarizes incomplete and exported days and the date range', () => {
    const ws = makeWorkspace();
    ws.days['remy-2023-06-23'] = { ...ws.days['remy-2023-06-22'], id: 'remy-2023-06-23', date: '2023-06-23', state: { draft: false, validated: true, exported: true } };
    const s = summarizeWorkspace(ws);
    expect(s).toMatchObject({ animals: 1, days: 2, incompleteDays: 1, exportedDays: 1, firstDate: '2023-06-22', lastDate: '2023-06-23' });
  });

  it('reports what a replacement would drop, add and change', () => {
    const current = makeWorkspace();
    current.days['remy-2023-06-30'] = { ...current.days['remy-2023-06-22'], id: 'remy-2023-06-30', date: '2023-06-30' };
    const incoming = makeWorkspace({ animalId: 'bean' });
    incoming.days['remy-2023-06-22'] = { ...current.days['remy-2023-06-22'], session: { ...current.days['remy-2023-06-22'].session, weight: 999 } };
    const diff = diffWorkspaceReplacement(current, incoming);
    expect(diff.animalsDropped).toEqual(['remy']);
    expect(diff.animalsAdded).toEqual(['bean']);
    expect(diff.daysDropped).toEqual(['remy-2023-06-30']);
    expect(diff.daysAdded).toEqual(['bean-2023-06-22']);
    expect(diff.daysChanged).toEqual(['remy-2023-06-22']);
    expect(diff.currentIsEmpty).toBe(false);
  });
});

describe('WorkspaceBackupPanel', () => {
  beforeEach(() => {
    resetPersistenceForTests();
    resetBlobStoreForTests();
    resetWriterLockForTests();
    window.localStorage.clear();
    vi.mocked(downloadYamlFile).mockClear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('downloads a backup envelope carrying the incomplete day verbatim', async () => {
    const ws = makeWorkspace();
    render(
      <StoreProvider initialState={{ workspace: ws }}>
        <WorkspaceBackupPanel />
      </StoreProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /download workspace backup/i }));
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    const [filename, text] = vi.mocked(downloadYamlFile).mock.calls[0];
    expect(filename).toMatch(/^rec_to_nwb_workspace_\d{8}-\d{4}\.json$/);
    const envelope = JSON.parse(text);
    expect(envelope.format).toBe('rec_to_nwb_workspace_backup');
    expect(envelope.workspace.days['remy-2023-06-22'].state.draft).toBe(true);
    expect(envelope.workspace.animals.remy.configurationHistory).toHaveLength(1);
  });

  it('restoring from a file shows a replacement preview and replaces + writes only on confirm', async () => {
    const current = makeWorkspace();
    const incoming = makeWorkspace({ animalId: 'bean', dayDate: '2024-01-05' });
    const file = new File(
      [JSON.stringify({ format: 'rec_to_nwb_workspace_backup', schemaVersion: 3, workspace: incoming })],
      'backup.json',
      { type: 'application/json' }
    );
    file.text = () => Promise.resolve(JSON.stringify({ format: 'rec_to_nwb_workspace_backup', schemaVersion: 3, workspace: incoming }));

    render(
      <StoreProvider initialState={{ workspace: current }}>
        <WorkspaceBackupPanel />
      </StoreProvider>
    );
    // The lease is acquired asynchronously after mount; wait for the writer role so restore is allowed.
    await waitFor(() => expect(screen.getByRole('button', { name: /restore from backup/i })).toBeEnabled());

    const input = screen.getByLabelText(/choose a workspace backup file/i);
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/1 animal, 1 recording day \(2024-01-05 – 2024-01-05\)/);
    expect(dialog).toHaveTextContent(/drop.*1 animal\(s\) \(remy\)/);
    expect(dialog).toHaveTextContent(/add.*1 animal\(s\)/);
    // Nothing replaced yet.
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /replace workspace/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/workspace restored/i));
    const stored = loadWorkspace();
    expect(Object.keys(stored.workspace.animals)).toEqual(['bean']);
    expect(stored.workspace.days['bean-2024-01-05'].state.draft).toBe(true);
  });

  it('rejects an unreadable file with a message and no replacement', async () => {
    render(
      <StoreProvider initialState={{ workspace: makeWorkspace() }}>
        <WorkspaceBackupPanel />
      </StoreProvider>
    );
    const file = new File(['garbage'], 'bad.json');
    file.text = () => Promise.resolve('garbage');
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/choose a workspace backup file/i), { target: { files: [file] } });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a readable workspace backup/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
