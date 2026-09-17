import { describe, expect, it } from 'vitest';
import { resolveDeploymentConfig } from './deployment';

describe('deployment configuration', () => {
  it('keeps the existing production storage identities and legacy landing route', () => {
    const deployment = resolveDeploymentConfig({});

    expect(deployment).toMatchObject({
      channel: 'production',
      isPilot: false,
      defaultRoute: 'legacy',
      storageNamespace: 'rec_to_nwb_workspace_v1',
      blobDatabaseName: 'rec_to_nwb_yaml_creator',
      receiptKeyPrefix: 'receipt:',
    });
  });

  it('isolates every browser storage and coordination identity for a pilot build', () => {
    const deployment = resolveDeploymentConfig({
      VITE_APP_CHANNEL: 'pilot',
      VITE_APP_COMMIT: '0123456789abcdef',
      VITE_STORAGE_NAMESPACE: 'rec_to_nwb_workspace_pilot_v1',
    });

    expect(deployment).toMatchObject({
      channel: 'pilot',
      isPilot: true,
      defaultRoute: 'workspace',
      commit: '0123456789abcdef',
      shortCommit: '0123456',
      storageNamespace: 'rec_to_nwb_workspace_pilot_v1',
      blobDatabaseName: 'rec_to_nwb_workspace_pilot_v1_blobs',
      receiptKeyPrefix: 'rec_to_nwb_workspace_pilot_v1:receipt:',
    });
    expect(deployment.storageNamespace).not.toBe(
      resolveDeploymentConfig({}).storageNamespace
    );
  });

  it('falls back to the fixed pilot namespace when an unsafe override is supplied', () => {
    const deployment = resolveDeploymentConfig({
      VITE_APP_CHANNEL: 'pilot',
      VITE_STORAGE_NAMESPACE: 'pilot key with spaces',
    });

    expect(deployment.storageNamespace).toBe('rec_to_nwb_workspace_pilot_v1');
  });
});
