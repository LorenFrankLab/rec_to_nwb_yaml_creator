import { useState } from 'react';
import PropTypes from 'prop-types';
import ReconfigWizard from './ReconfigWizard';
import { getConfigHistory } from '../../state/workspaceSelectors';

/**
 * Configuration-version indicator + reconfiguration entry point for the Devices step. Names the
 * version this day is pinned to (latest/historical), how many days it applies to, the unpinned-day
 * repair control (pin to an existing version), and the "Hardware changed starting this day…" wizard.
 * Extracted verbatim from `pages/DayEditor/DevicesStep.jsx` (Phase 9c-3) with no behavior change — it
 * owns the local `wizardOpen` + `pinVersion` UI state; the parent computes `reconfig` and only renders
 * this when the step is wired with store actions + the animal's days.
 *
 * @param {object} props
 * @param {{version, snapshot, appliedCount, prevDay, candidateDays, isLatest}} props.reconfig - The
 *   precomputed configuration-version context.
 * @param {object} props.day - The day record (its `id` keys the wizard; `configurationVersion` gates the pin warning).
 * @param {object} props.animal - The animal record (its configuration history + the wizard subject).
 * @param {string} props.ownerKey - The resolved store owner key (animal-editor links + the reconfig write).
 * @param {Function} props.onFieldUpdate - `(fieldPath, value) => void` store writer (the pin write).
 * @param {object} [props.actions] - Store actions (the reconfiguration write).
 * @returns {JSX.Element}
 */
export default function ConfigVersionPanel({ reconfig, day, animal, ownerKey, onFieldUpdate, actions }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  // Selected version for the unpinned-day repair control (a day with no pin in a multi-version
  // animal). Empty string = nothing chosen yet; pinning writes day.configurationVersion.
  const [pinVersion, setPinVersion] = useState('');

  return (
    <>
      <div className="config-version-bar">
        <div className="config-version-info">
          <span className="config-version-label">
            Configuration version {reconfig.version}
            {reconfig.snapshot
              ? `: ${reconfig.snapshot.description || 'No description'} (${reconfig.snapshot.date || 'date unknown'})`
              : ''}
            <span
              className={`config-version-tag config-version-tag-${reconfig.isLatest ? 'latest' : 'historical'}`}
            >
              {reconfig.isLatest ? 'latest' : 'historical'}
            </span>
          </span>
          <span className="config-version-applied">
            {reconfig.isLatest
              ? 'Mark failed channels for this recording day. Probe geometry is shared animal setup — edit it in Animal Setup.'
              : 'This is a historical configuration. Mark failed channels for this recording day against this pinned snapshot; editing the latest animal setup will not change this day unless you reconfigure.'}
          </span>
          <span className="config-version-applied">
            Applied to {reconfig.appliedCount} {reconfig.appliedCount === 1 ? 'day' : 'days'}
          </span>
          {day.configurationVersion == null && getConfigHistory(animal).length > 1 && (
            <div className="config-version-warning" role="alert">
              <span className="config-version-warning-text">
                This day has no pinned configuration version. It is resolved to the latest
                (v{reconfig.version}); if it recorded an earlier configuration, pin the correct
                version before exporting.
              </span>
              {/* Repairable: assign an existing configuration version to this day. The
                  data-field-path is on the focusable <select> (not the wrapper) so the export
                  gate's "Fix in Devices" repair-focus actually moves keyboard/SR focus here. */}
              <div className="config-version-pin">
                <label htmlFor="pin-config-version">Pin this day to:</label>
                <select
                  id="pin-config-version"
                  data-field-path="configurationVersion"
                  value={pinVersion}
                  onChange={(e) => setPinVersion(e.target.value)}
                >
                  <option value="">Choose a version…</option>
                  {getConfigHistory(animal).map((snap) => (
                    <option key={snap.version} value={snap.version}>
                      v{snap.version}
                      {snap.description ? ` — ${snap.description}` : ''}
                      {snap.date ? ` (${snap.date})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="config-version-pin-button"
                  disabled={pinVersion === ''}
                  onClick={() => onFieldUpdate('configurationVersion', Number(pinVersion))}
                >
                  Pin version
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="config-reconfig-button"
          aria-haspopup="dialog"
          aria-expanded={wizardOpen}
          onClick={() => setWizardOpen(true)}
        >
          Hardware changed starting this day…
        </button>
      </div>
      <ReconfigWizard
        // Remount per day/version so reopening shows fresh form state.
        key={`${day.id}-${reconfig.version}`}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        animal={animal}
        animalKey={ownerKey}
        day={day}
        prevDay={reconfig.prevDay}
        candidateDays={reconfig.candidateDays}
        actions={actions}
      />
    </>
  );
}

ConfigVersionPanel.propTypes = {
  reconfig: PropTypes.shape({
    version: PropTypes.number,
    snapshot: PropTypes.object,
    appliedCount: PropTypes.number,
    prevDay: PropTypes.object,
    candidateDays: PropTypes.array,
    isLatest: PropTypes.bool,
  }).isRequired,
  day: PropTypes.object.isRequired,
  animal: PropTypes.object.isRequired,
  ownerKey: PropTypes.string,
  onFieldUpdate: PropTypes.func.isRequired,
  actions: PropTypes.object,
};

ConfigVersionPanel.defaultProps = {
  ownerKey: undefined,
  actions: undefined,
};
