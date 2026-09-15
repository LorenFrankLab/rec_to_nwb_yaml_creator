/**
 * Fix-response review finding 1: the asynchronous "receipt bytes stored" acknowledgement must not
 * make an intervening edit look downloaded, and must not replace a newer receipt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { exportDayFile } from '../../domain/exportDay';
import { exportFreshnessStatus } from '../../domain/exportReceipt';
import { buildCatalogWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

const { deferred } = vi.hoisted(() => ({ deferred: [] }));
vi.mock('../blobStore', async () => {
  const actual = await vi.importActual('../blobStore');
  return {
    ...actual,
    putBlob: vi.fn(
      () =>
        new Promise((resolve) => {
          deferred.push(resolve);
        })
    ),
  };
});
vi.mock('../../io/yaml', async () => {
  const actual = await vi.importActual('../../io/yaml');
  return { ...actual, downloadYamlFile: vi.fn() };
});


/**
 * One-day, one-configuration workspace with a measured (485 g) June 22 day.
 *
 * @returns {{workspace: object}}
 */
function seed() {
  const { animal, day } = buildCatalogWorkspace();
  const june22 = {
    ...day,
    id: 'remy-2023-06-22',
    date: '2023-06-22',
    session: { ...day.session, session_id: 'remy_20230622', weight: 485 },
    experimenters: { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' },
    optogenetics: null,
    configurationVersion: 1,
    state: { draft: false, validated: true, exported: false, videolessEpochs: [1, 3, 5] },
  };
  return {
    workspace: {
      version: '1.0.0',
      lastModified: 'x',
      animals: { remy: { ...animal, configurationHistory: [{ ...animal.configurationHistory[0], version: 1, date: '2023-06-01' }], days: [june22.id] } },
      days: { [june22.id]: june22 },
      settings: { defaultLab: '', defaultInstitution: '', defaultExperimenters: [], autoSaveInterval: 30000, shadowExportEnabled: true },
    },
  };
}

const exportDay = (result) => {
  const ws = result.current.model.workspace;
  expect(exportDayFile(ws.animals.remy, ws.days['remy-2023-06-22'], { actions: result.current.actions, strict: true }).kind).toBe('exported');
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  deferred.length = 0;
});

describe('receipt storage acknowledgement', () => {
  it('an edit made while the acknowledgement is pending still reads "Changed since download" after it arrives', async () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => exportDay(result));
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', { session: { weight: 499 } });
    });
    let ws = result.current.model.workspace;
    expect(exportFreshnessStatus(ws.animals.remy, ws.days['remy-2023-06-22'])).toBe('changed');
    const stampsBefore = { ...ws.days['remy-2023-06-22'].exportReceipt };

    await act(async () => {
      deferred[0](true); // the store acknowledges the bytes
      await flush();
    });
    ws = result.current.model.workspace;
    const receipt = ws.days['remy-2023-06-22'].exportReceipt;
    expect(receipt.yamlStored).toBe(true);
    expect(receipt.dayLastModified).toBe(stampsBefore.dayLastModified);
    expect(exportFreshnessStatus(ws.animals.remy, ws.days['remy-2023-06-22'])).toBe('changed');
  });

  it('a late acknowledgement of an OLDER download never replaces the newer receipt', async () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => exportDay(result));
    const first = result.current.model.workspace.days['remy-2023-06-22'].exportReceipt;
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', { session: { weight: 499 } });
    });
    act(() => exportDay(result));
    const second = result.current.model.workspace.days['remy-2023-06-22'].exportReceipt;
    expect(second.contentHash).not.toBe(first.contentHash);

    await act(async () => {
      deferred[0](true); // the FIRST download's bytes
      await flush();
    });
    const receipt = result.current.model.workspace.days['remy-2023-06-22'].exportReceipt;
    expect(receipt.contentHash).toBe(second.contentHash);
    expect(receipt.yamlStored).toBe(false); // the second's bytes are still pending

    await act(async () => {
      deferred[1](true);
      await flush();
    });
    expect(result.current.model.workspace.days['remy-2023-06-22'].exportReceipt).toMatchObject({ contentHash: second.contentHash, yamlStored: true });
  });
});

describe('modification stamps', () => {
  it('two consecutive stamps never collide, so an edit in the same millisecond as a download is not "current"', async () => {
    const { getCurrentTimestamp } = await import('../workspaceUtils');
    const a = getCurrentTimestamp();
    const b = getCurrentTimestamp();
    expect(b > a).toBe(true);
  });
});
