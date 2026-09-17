/**
 * Build-time deployment identity.
 *
 * GitHub Pages project paths share one browser origin. A pilot under `/pilot/` therefore shares
 * localStorage, IndexedDB, Web Locks and BroadcastChannel with the production path unless every
 * persistence and coordination name is explicitly separated here.
 */

const PRODUCTION_STORAGE_NAMESPACE = 'rec_to_nwb_workspace_v1';
const PILOT_STORAGE_NAMESPACE = 'rec_to_nwb_workspace_pilot_v1';
const PRODUCTION_BLOB_DATABASE = 'rec_to_nwb_yaml_creator';
const PRODUCTION_APP_URL = 'https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/';
const SOURCE_REPOSITORY_URL = 'https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator';

export interface DeploymentEnvironment {
  VITE_APP_CHANNEL?: string;
  VITE_APP_COMMIT?: string;
  VITE_STORAGE_NAMESPACE?: string;
  VITE_PRODUCTION_APP_URL?: string;
}

export interface DeploymentConfig {
  channel: 'production' | 'pilot';
  isPilot: boolean;
  defaultRoute: 'legacy' | 'workspace';
  commit: string;
  shortCommit: string;
  commitUrl: string | null;
  productionAppUrl: string;
  storageNamespace: string;
  blobDatabaseName: string;
  receiptKeyPrefix: string;
}

function safeStorageNamespace(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  return candidate && /^[A-Za-z0-9_.:-]+$/.test(candidate) ? candidate : fallback;
}

/** Resolve a deployment without reading browser state, so production compatibility is testable. */
export function resolveDeploymentConfig(env: DeploymentEnvironment): DeploymentConfig {
  const isPilot = env.VITE_APP_CHANNEL?.trim().toLowerCase() === 'pilot';
  const channel = isPilot ? 'pilot' : 'production';
  const storageNamespace = isPilot
    ? safeStorageNamespace(env.VITE_STORAGE_NAMESPACE, PILOT_STORAGE_NAMESPACE)
    : PRODUCTION_STORAGE_NAMESPACE;
  const commit = /^[0-9a-f]{7,40}$/i.test(env.VITE_APP_COMMIT?.trim() ?? '')
    ? env.VITE_APP_COMMIT!.trim()
    : 'local';

  return {
    channel,
    isPilot,
    defaultRoute: isPilot ? 'workspace' : 'legacy',
    commit,
    shortCommit: commit === 'local' ? commit : commit.slice(0, 7),
    commitUrl: commit === 'local' ? null : `${SOURCE_REPOSITORY_URL}/commit/${commit}`,
    productionAppUrl: env.VITE_PRODUCTION_APP_URL?.trim() || PRODUCTION_APP_URL,
    storageNamespace,
    // Preserve the existing production database name so current recovery artifacts remain readable.
    blobDatabaseName: isPilot ? `${storageNamespace}_blobs` : PRODUCTION_BLOB_DATABASE,
    // Production receipts historically use `receipt:`. Keep that contract while isolating pilot data.
    receiptKeyPrefix: isPilot ? `${storageNamespace}:receipt:` : 'receipt:',
  };
}

/** The compile-time identity used by the running bundle. */
export const DEPLOYMENT = resolveDeploymentConfig({
  VITE_APP_CHANNEL: import.meta.env.VITE_APP_CHANNEL,
  VITE_APP_COMMIT: import.meta.env.VITE_APP_COMMIT,
  VITE_STORAGE_NAMESPACE: import.meta.env.VITE_STORAGE_NAMESPACE,
  VITE_PRODUCTION_APP_URL: import.meta.env.VITE_PRODUCTION_APP_URL,
});
