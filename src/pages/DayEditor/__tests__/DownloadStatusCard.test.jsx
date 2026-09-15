/**
 * The "Changed since download" comparison must only show bytes that ARE the receipt's download:
 * bytes under the day's key that do not hash to the receipt (leftovers of a failed restore, a
 * different day's file) are reported as unavailable, never diffed as the previous download.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DownloadStatusCard from '../DownloadStatusCard';
import { receiptHash, RECEIPT_YAML_KEY_PREFIX } from '../../../domain/exportReceipt';
import { putBlob, resetBlobStoreForTests } from '../../../state/blobStore';

const animal = { id: 'remy', lastModified: 'a1', subject: { subject_id: 'remy' } };
const previousYaml = 'weight: 485\n';
const day = {
  id: 'remy-2023-06-22',
  date: '2023-06-22',
  lastModified: 'd2',
  exportReceipt: {
    filename: '20230622_remy_metadata.yml',
    exportedAt: '2023-06-22T20:00:00.000Z',
    contentHash: receiptHash('20230622_remy_metadata.yml', previousYaml),
    appVersion: 'a',
    schemaVersion: 4,
    yamlStored: true,
    dayLastModified: 'd1',
    animalLastModified: 'a1',
  },
};
const artifact = { filename: '20230622_remy_metadata.yml', yaml: 'weight: 499\n', hash: 'other' };

beforeEach(() => resetBlobStoreForTests());

describe('DownloadStatusCard — previous-download bytes', () => {
  it('diffs bytes that hash to the receipt', async () => {
    await putBlob(`${RECEIPT_YAML_KEY_PREFIX}${day.id}`, { filename: day.exportReceipt.filename, yaml: previousYaml, exportedAt: 'x' });
    render(<DownloadStatusCard animal={animal} day={day} artifact={artifact} />);
    expect(await screen.findByText(/Show what changed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Changes since the last download')).toHaveTextContent('weight: 485');
  });

  it('refuses bytes that do NOT hash to the receipt (a failed restore’s leftovers) and says the download is unavailable', async () => {
    await putBlob(`${RECEIPT_YAML_KEY_PREFIX}${day.id}`, { filename: day.exportReceipt.filename, yaml: 'weight: 480\n', exportedAt: 'x' });
    render(<DownloadStatusCard animal={animal} day={day} artifact={artifact} />);
    expect(await screen.findByText(/not available in this browser/)).toBeInTheDocument();
    expect(screen.queryByText(/Show what changed/)).not.toBeInTheDocument();
  });
});
