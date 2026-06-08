import PropTypes from 'prop-types';
import { getConfigHistory } from '../state/workspaceSelectors';
import './ReconfigurationContextBanner.css';

/**
 * ReconfigurationContextBanner — the transient "you're editing for a reconfiguration" notice.
 *
 * Rendered when a `ReconfigWizard` deep-link carries `?context=reconfigure` (read via
 * {@link useReconfigContext}). It tells the user WHICH configuration version they're editing and
 * whether it's the latest: editing the latest applies forward, while reviewing an older version is
 * flagged with a warning style (its changes won't propagate to days on a newer version). One
 * implementation shared by the legacy Animal Editor stepper and the tabbed Animal View, so the copy
 * can't drift. Self-hides unless the context is a reconfiguration.
 *
 * @param {object} props
 * @param {object} props.animal - The animal record (its `configurationHistory` supplies versions).
 * @param {object} props.routeContext - Parsed route context from {@link useReconfigContext}.
 * @param {object} [props.days] - The workspace day map (resolves `fromDay` to its date).
 * @returns {JSX.Element|null}
 */
export default function ReconfigurationContextBanner({ animal, routeContext, days }) {
  if (routeContext?.context !== 'reconfigure') return null;

  // Read history through the canonical selector: a non-array `configurationHistory` degrades to no
  // history instead of throwing (this surface can be reached for a corrupt animal).
  const configurationHistory = getConfigHistory(animal);
  const latestSnapshot = configurationHistory[configurationHistory.length - 1] || null;
  const latestConfigurationVersion = latestSnapshot?.version ?? null;
  const routeVersionExists = routeContext.version != null &&
    configurationHistory.some((snapshot) => snapshot.version === routeContext.version);
  const contextVersion = routeVersionExists ? routeContext.version : latestConfigurationVersion;
  const contextIsLatest = contextVersion != null && contextVersion === latestConfigurationVersion;
  const sourceDay = routeContext.fromDayId ? days?.[routeContext.fromDayId] : null;
  const sourceContextText = sourceDay
    ? ` for reconfiguration starting ${sourceDay.date}.`
    : ' after reconfiguration fork.';
  const movedDaysText = routeContext.movedDays != null
    ? ` Moved ${routeContext.movedDays} ${routeContext.movedDays === 1 ? 'day' : 'days'} to this version.`
    : '';

  return (
    <div
      className={`configuration-edit-context ${contextIsLatest ? '' : 'configuration-edit-context-warning'}`}
      role="status"
    >
      {contextIsLatest
        ? `Editing latest configuration v${contextVersion}`
        : `Review configuration v${contextVersion ?? 'unknown'}; current latest is v${latestConfigurationVersion ?? 'unknown'}`}
      {sourceContextText}
      {movedDaysText}
    </div>
  );
}

ReconfigurationContextBanner.propTypes = {
  animal: PropTypes.object,
  routeContext: PropTypes.shape({
    context: PropTypes.string,
    version: PropTypes.number,
    fromDayId: PropTypes.string,
    movedDays: PropTypes.number,
  }),
  days: PropTypes.object,
};

ReconfigurationContextBanner.defaultProps = {
  animal: null,
  routeContext: null,
  days: null,
};
