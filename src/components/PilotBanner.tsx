import { DEPLOYMENT } from '../config/deployment';
import type { DeploymentConfig } from '../config/deployment';
import styles from './PilotBanner.module.css';

interface PilotBannerProps {
  deployment?: DeploymentConfig;
}

/** Identifies a test build and gives scientists a clear route back to the current app. */
export function PilotBanner({ deployment = DEPLOYMENT }: PilotBannerProps) {
  if (!deployment.isPilot) return null;

  const buildLabel = `build ${deployment.shortCommit}`;
  return (
    <aside className={styles.banner} aria-label="Pilot build information">
      <strong className={styles.badge}>Pilot</strong>
      <span>
        Modern app ·{' '}
        {deployment.commitUrl ? (
          <a href={deployment.commitUrl}>{buildLabel}</a>
        ) : (
          buildLabel
        )}
        {' '}· Work is saved in this browser. Download a workspace backup before moving devices.
      </span>
      <a className={styles.currentApp} href={deployment.productionAppUrl}>
        Open current app
      </a>
    </aside>
  );
}
