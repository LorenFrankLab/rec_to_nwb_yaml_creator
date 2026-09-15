/**
 * Review finding 7 (increments 1/2): a portable backup carries the exact exported YAML artifacts
 * the receipts refer to, and a restore in an INDEPENDENT store gets them back — verified by hash —
 * while never claiming bytes it does not have.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetBlobStoreForTests, putBlob, getBlob } from '../blobStore';
import {
  buildWorkspaceBackup,
  parseWorkspaceBackup,
  restoreBackupArtifacts,
  resetPersistenceForTests,
} from '../persistence';
import { receiptHash, RECEIPT_YAML_KEY_PREFIX } from '../../domain/exportReceipt';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';

// jsdom has no IndexedDB: `putBlob` reports memory-only (false). `durable.value = true` stands in
// for a store that ACKNOWLEDGES the write, so the two outcomes can be tested separately.
const { durable } = vi.hoisted(() => ({ durable: { value: false } }));
vi.mock('../blobStore', async () => {
  const actual = await vi.importActual('../blobStore');
  return {
    ...actual,
    putBlob: async (key, value) => {
      const stored = await actual.putBlob(key, value);
      return durable.value || stored;
    },
  };
});

const DAY = 'remy_20230622';
const YAML = 'experimenter_name:\n  - Doe, Jane\n';
const FILENAME = '20230622_remy_metadata.yml';

/** A workspace whose only day was downloaded and whose bytes are in the side store. */
async function downloadedWorkspace() {
  const ws = makeTestWorkspace();
  ws.days[DAY].exportReceipt = {
    filename: FILENAME,
    exportedAt: '2023-06-22T20:00:00.000Z',
    contentHash: receiptHash(FILENAME, YAML),
    appVersion: 'test',
    schemaVersion: 4,
    yamlStored: true,
  };
  await putBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`, { filename: FILENAME, yaml: YAML, exportedAt: '2023-06-22T20:00:00.000Z' });
  return ws;
}

beforeEach(() => {
  durable.value = false;
  resetPersistenceForTests();
  resetBlobStoreForTests();
  window.localStorage.clear();
});

describe('backup artifacts', () => {
  it('the backup carries the receipt YAML, and a DURABLE restore in a fresh store gets it back', async () => {
    const text = await buildWorkspaceBackup(await downloadedWorkspace(), 'test');
    expect(JSON.parse(text).artifacts[DAY].yaml).toBe(YAML);

    resetBlobStoreForTests(); // an independent browser: nothing in its side store
    durable.value = true;
    const parsed = parseWorkspaceBackup(text);
    const restored = await restoreBackupArtifacts(parsed.workspace, parsed.artifacts);
    expect(restored.days[DAY].exportReceipt.yamlStored).toBe(true);
    expect(await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`)).toMatchObject({ filename: FILENAME, yaml: YAML });
  });

  it('a restore whose store did NOT durably accept the bytes (no IndexedDB) leaves yamlStored false — a fresh document has no bytes', async () => {
    const text = await buildWorkspaceBackup(await downloadedWorkspace(), 'test');
    resetBlobStoreForTests();
    const parsed = parseWorkspaceBackup(text);
    const restored = await restoreBackupArtifacts(parsed.workspace, parsed.artifacts); // memory-only
    expect(restored.days[DAY].exportReceipt.yamlStored).toBe(false);
    resetBlobStoreForTests(); // "new document": the memory fallback is gone
    expect(await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`)).toBeUndefined();
  });

  it('a receipt whose bytes are missing is restored with yamlStored false (never a claim without the bytes)', async () => {
    const ws = await downloadedWorkspace();
    resetBlobStoreForTests(); // the bytes were lost before the backup was taken
    const text = await buildWorkspaceBackup(ws, 'test');
    expect(JSON.parse(text).artifacts).toEqual({});
    const parsed = parseWorkspaceBackup(text);
    const restored = await restoreBackupArtifacts(parsed.workspace, parsed.artifacts);
    expect(restored.days[DAY].exportReceipt.yamlStored).toBe(false);
    expect(restored.days[DAY].exportReceipt.contentHash).toBe(receiptHash(FILENAME, YAML));
  });

  it('an artifact that does not match its receipt hash is rejected, and stale bytes under the same day id are cleared', async () => {
    const text = await buildWorkspaceBackup(await downloadedWorkspace(), 'test');
    const tampered = JSON.parse(text);
    tampered.artifacts[DAY].yaml = 'something else\n';
    // The receiving browser already holds unrelated bytes under this day id.
    resetBlobStoreForTests();
    await putBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`, { filename: 'old.yml', yaml: 'old bytes\n', exportedAt: 'x' });
    const parsed = parseWorkspaceBackup(JSON.stringify(tampered));
    const restored = await restoreBackupArtifacts(parsed.workspace, parsed.artifacts);
    expect(restored.days[DAY].exportReceipt.yamlStored).toBe(false);
    expect(await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`)).toBeUndefined();
  });
});
