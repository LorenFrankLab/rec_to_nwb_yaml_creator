import { useState } from 'react';
import { resolveRigConstant } from '../../domain/rigConstants';
import type { TechnicalParameters, TechnicalDefaults } from '../../state/workspaceTypes';

interface DayTechnicalSectionProps {
  /** The day's `technical` block. */
  technical?: Partial<TechnicalParameters>;
  /** Day field updater (dot-path, e.g. `technical.default_header_file_path`). */
  onFieldUpdate: (fieldPath: string, value: unknown) => void;
  /**
   * The animal's `technicalDefaults`, for the effective-value comparison.
   * Falls back to the standard rig values when absent.
   */
  recordingSystemDefaults?: Partial<TechnicalDefaults>;
  /**
   * The owning animal's store key, for the `Edit in Recording System` deep-link.
   * The link is omitted when absent.
   */
  animalKey?: string;
}

/**
 * DayTechnicalSection - per-day technical parameters (Day Editor / Overview).
 *
 * Mixes two ownership kinds that both live on `day.technical` (Phase 8.7 Task 4):
 *  - `raw_data_to_volts` / `times_period_multiplier` are recording-system DEFAULTS copied into the
 *    day at creation. They are shown as effective, READ-ONLY values labelled against the current
 *    recording-system default (`Using recording-system default` vs `Different from current
 *    recording-system default`) with an `Edit in Recording System` link — they are not routine day
 *    edits, and a day keeps what it recorded (no silent retroactive change).
 *  - `default_header_file_path` and `units` are genuine DAY-ONLY facts, edited here.
 *
 * `units` is written as a whole object, and cleared to `undefined` when both fields are
 * blank so the export omits it (the schema rejects a present-but-empty `units`) rather
 * than emitting invalid empty strings.
 */
export default function DayTechnicalSection({ technical = {}, onFieldUpdate, recordingSystemDefaults = undefined, animalKey = undefined }: DayTechnicalSectionProps) {
  const [local, setLocal] = useState({
    default_header_file_path: technical?.default_header_file_path || '',
    analog: technical?.units?.analog || '',
    behavioral_events: technical?.units?.behavioral_events || '',
  });

  const raw = resolveRigConstant(technical, recordingSystemDefaults, 'raw_data_to_volts');
  const mult = resolveRigConstant(technical, recordingSystemDefaults, 'times_period_multiplier');
  const rigCue = (c: ReturnType<typeof resolveRigConstant>) => {
    if (c.status === 'unset') {
      // Honest, no misleading remedy: these are read-only here and editing the animal default does
      // NOT backfill an existing day (days keep their copied value), so don't steer there. The
      // export gate (schema-required) blocks it; the user repairs/re-imports the corrupt day.
      return 'Missing on this recording day — required for export. This day has no recording-system value (likely a corrupt/partial import).';
    }
    return c.status === 'default'
      ? 'Using recording-system default'
      : `Different from current recording-system default (current default: ${c.currentDefault})`;
  };

  const change = (key: keyof typeof local, value: string) => setLocal((prev) => ({ ...prev, [key]: value }));

  // units requires BOTH analog and behavioral_events together (schema). Flag the
  // partial case inline rather than letting it surface only at the export gate.
  const unitsPartial = !!local.analog.trim() !== !!local.behavioral_events.trim();

  const commitHeader = () => {
    onFieldUpdate('technical.default_header_file_path', local.default_header_file_path.trim());
  };

  const commitUnits = () => {
    const analog = local.analog.trim();
    const behavioralEvents = local.behavioral_events.trim();
    // Omit units entirely when both are blank; the schema rejects present-but-empty
    // units, and the export drops an absent `units`.
    if (!analog && !behavioralEvents) {
      onFieldUpdate('technical.units', undefined);
      return;
    }
    if (!analog || !behavioralEvents) {
      return;
    }
    onFieldUpdate('technical.units', { analog, behavioral_events: behavioralEvents });
  };

  return (
    <section className="day-editor-section day-technical-section">
      <h3>Technical parameters</h3>

      {/* Recording-system rig constants — effective, READ-ONLY values for this day (copied
          from the recording-system defaults at creation). Not routine day edits; edit the
          default in Recording System (it affects future days). A day keeps the value it
          recorded, so a default changed later reads as "different", never silently inherited. */}
      <div className="form-grid rig-constants" aria-label="Recording-system values (effective for this day)">
        <div className="form-field readonly-field">
          <span className="field-label">Raw data to volts</span>
          <span className="readonly-value">{raw.display}</span>
          <span className="field-help-text">{rigCue(raw)}</span>
        </div>
        <div className="form-field readonly-field">
          <span className="field-label">Times period multiplier</span>
          <span className="readonly-value">{mult.display}</span>
          <span className="field-help-text">{rigCue(mult)}</span>
        </div>
        {animalKey && (
          <p className="rig-constants-edit-link field-help-text">
            These are recording-system constants —{' '}
            <a href={`#/animal/${animalKey}/recording-system?field=data_acq_device`}>Edit in Recording System</a>.
          </p>
        )}
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="default-header-file-path">
            Default header file path <span className="ownership-cue">This day only</span>
          </label>
          <input
            id="default-header-file-path"
            type="text"
            value={local.default_header_file_path}
            onChange={(e) => change('default_header_file_path', e.target.value)}
            onBlur={commitHeader}
            placeholder="/path/to/config.trodesconf"
          />
          <span className="field-help-text">
            Optional. Path to the .trodesconf configuration file for this day. If blank, the default
            header from the .rec file is used.
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="units-analog">Analog units</label>
          <input
            id="units-analog"
            type="text"
            value={local.analog}
            onChange={(e) => change('analog', e.target.value)}
            onBlur={commitUnits}
            placeholder="e.g. unspecified"
          />
        </div>

        <div className="form-field">
          <label htmlFor="units-behavioral-events">Behavioral-event units</label>
          <input
            id="units-behavioral-events"
            type="text"
            value={local.behavioral_events}
            onChange={(e) => change('behavioral_events', e.target.value)}
            onBlur={commitUnits}
            placeholder="e.g. unspecified"
          />
          <span className="field-help-text">
            Analog and behavioral-event units are required together when either is set.
          </span>
          {unitsPartial && (
            <span className="validation-error" role="alert">
              Enter both analog and behavioral-event units, or clear both.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
