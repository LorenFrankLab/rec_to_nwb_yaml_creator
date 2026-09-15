import { useState } from 'react';
import ReconfigWizard from './ReconfigWizard';
import { getConfigHistory } from '../../state/workspaceSelectors';
import { configurationChoiceStatus } from '../../domain/configurationSelection';
import type { Animal, Day } from '../../state/workspaceTypes';
import { pluralize } from '../../utils/pluralize';

/** The precomputed configuration-version context the Recording Setup section passes in. */
interface ReconfigContext {
  version: number;
  snapshot?: { description?: string; date?: string } | null;
  appliedCount: number;
  prevDay?: Day | null;
  candidateDays: Day[];
  isLatest: boolean;
}

/** Store actions the reconfiguration write needs (matches ReconfigWizard). */
export interface ReconfigActions {
  createConfigurationSnapshotAndApplyForward: (
    animalKey: string,
    snapshot: { date: string; description: string; devices: unknown },
    orderedIds: string[]
  ) => number;
}

interface ConfigVersionPanelProps {
  /** The precomputed configuration-version context. */
  reconfig: ReconfigContext;
  /** The day record (its `id` keys the wizard; `configurationVersion` gates the pin warning). */
  day: Day;
  /** The animal record (its configuration history + the wizard subject). */
  animal: Animal;
  /** The resolved store owner key (animal-editor links + the reconfig write). */
  ownerKey?: string;
  /** `(fieldPath, value) => void` store writer (the pin write). */
  onFieldUpdate: (fieldPath: string, value: unknown) => void;
  /** Store actions (the reconfiguration write). */
  actions: ReconfigActions;
}

/**
 * Configuration-version indicator + reconfiguration entry point for Recording Setup. Names the
 * version this day is pinned to (latest/historical), how many days it applies to, the unpinned-day
 * repair control (pin to an existing version), and the "Hardware changed starting this day…" wizard.
 * Extracted verbatim from `pages/DayEditor/DevicesStep.jsx` (Phase 9c-3) with no behavior change — it
 * owns the local `wizardOpen` + `pinVersion` UI state; the parent computes `reconfig` and only renders
 * this when the step is wired with store actions + the animal's days.
 */
export default function ConfigVersionPanel({ reconfig, day, animal, ownerKey, onFieldUpdate, actions }: ConfigVersionPanelProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  // Selected version for the unpinned-day repair control (a day with no pin in a multi-version
  // animal). Empty string = nothing chosen yet; pinning writes day.configurationVersion.
  const [pinVersion, setPinVersion] = useState('');
  // Dated-facts check: does the pinned version's effective date cover this recording date?
  const choice = configurationChoiceStatus(animal, day);
  const [rePinVersion, setRePinVersion] = useState('');

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
            Applied to {reconfig.appliedCount} {pluralize(reconfig.appliedCount, 'day')}
          </span>
          {choice.status === 'unconfirmed' && (
            <div className="config-version-warning" role="alert" data-testid="config-choice-unconfirmed">
              <span className="config-version-warning-text">
                {choice.reason === 'unknown-period'
                  ? `Probe setup v${choice.version} was entered on ${choice.effectiveDate ?? 'an unknown date'}; whether it already applied on ${day.date} is not recorded.`
                  : choice.reason === 'superseded'
                    ? `Probe setup v${choice.version} was chosen for this day automatically, but v${choice.supersededBy} is now recorded as effective from ${choice.supersededFrom ?? 'an earlier date'} — before this recording day (${day.date}).`
                    : `Probe setup v${choice.version} became effective ${choice.effectiveDate ?? 'later'} — after this recording day (${day.date}).`}{' '}
                Confirm that this is the setup the day was recorded with, or pin the version that was.
                To make future backfills automatic, set the version&apos;s effective date on the animal&apos;s
                Electrode Groups page.
              </span>
              <div className="config-version-pin">
                <button
                  type="button"
                  className="config-version-pin-button"
                  data-field-path="configurationVersion"
                  onClick={() =>
                    onFieldUpdate('provenance', {
                      ...(day.provenance ?? {}),
                      configuration: { source: 'explicit', confirmed: true },
                    })
                  }
                >
                  Confirm v{choice.version} applies to this day
                </button>
                <label htmlFor="repin-config-version">or pin:</label>
                <select
                  id="repin-config-version"
                  value={rePinVersion}
                  onChange={(e) => setRePinVersion(e.target.value)}
                >
                  <option value="">Choose a version…</option>
                  {getConfigHistory(animal)
                    .filter((snap) => snap.version !== choice.version)
                    .map((snap) => (
                      <option key={snap.version} value={snap.version}>
                        v{snap.version}
                        {snap.description ? ` — ${snap.description}` : ''}
                        {snap.date ? ` (effective ${snap.date})` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="config-version-pin-button"
                  disabled={rePinVersion === ''}
                  onClick={() => {
                    onFieldUpdate('configurationVersion', Number(rePinVersion));
                    onFieldUpdate('provenance', {
                      ...(day.provenance ?? {}),
                      configuration: { source: 'explicit', confirmed: true },
                    });
                  }}
                >
                  Pin version
                </button>
              </div>
            </div>
          )}
          {day.configurationVersion == null && getConfigHistory(animal).length > 1 && (
            <div className="config-version-warning" role="alert">
              <span className="config-version-warning-text">
                This day has no pinned configuration version. It is resolved to the latest
                (v{reconfig.version}); if it recorded an earlier configuration, pin the correct
                version before exporting.
              </span>
              {/* Repairable: assign an existing configuration version to this day. The
                  data-field-path is on the focusable <select> (not the wrapper) so the export
                  gate's "Fix in Recording Setup" repair-focus moves keyboard/SR focus here. */}
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
