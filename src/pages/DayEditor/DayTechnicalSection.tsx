import { useRef } from 'react';
import { DraftNumberInput } from '../../components/ui/DraftFields';
import { useDraftField } from '../../hooks/useDraftField';
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
  /** Render without the outer card wrapper when nested inside a disclosure. */
  embedded?: boolean;
}

/**
 * DayTechnicalSection - per-day technical parameters (Day Editor / Recording Setup).
 *
 * Mixes two ownership kinds that both live on `day.technical` (Phase 8.7 Task 4):
 *  - `raw_data_to_volts` / `times_period_multiplier` are recording-system DEFAULTS copied into the
 *    day at creation. They are shown as effective values labelled against the current
 *    recording-system default (`Using recording-system default` vs `Different from current
 *    recording-system default`) with an `Edit in Recording System` link. A separate correction disclosure edits an existing
 *    recording; changing the default never rewrites saved days.
 *  - `default_header_file_path` and `units` are genuine DAY-ONLY facts, edited here.
 *
 * `units` is written as a whole object, and cleared to `undefined` when both fields are
 * blank so the export omits it (the schema rejects a present-but-empty `units`) rather
 * than emitting invalid empty strings.
 */
export default function DayTechnicalSection({
  technical = {},
  onFieldUpdate,
  recordingSystemDefaults = undefined,
  animalKey = undefined,
  embedded = false,
}: DayTechnicalSectionProps) {
  // Draft-tracked (see hooks/useDraftField): the typed text is committed on a debounce / blur /
  // Ctrl+S and is visible to persistence while pending. `units` is committed as a whole object
  // from BOTH drafts, so each field's commit reads the other's current draft.
  const analogRef = useRef(technical?.units?.analog || '');
  const behavioralRef = useRef(technical?.units?.behavioral_events || '');
  const commitUnitsFrom = (analogText: string, behavioralText: string) => {
    const analog = analogText.trim();
    const behavioralEvents = behavioralText.trim();
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
  const header = useDraftField<string>({
    value: technical?.default_header_file_path || '',
    onCommit: (text) => onFieldUpdate('technical.default_header_file_path', text.trim()),
    label: 'technical.default_header_file_path',
  });
  const analog = useDraftField<string>({
    value: technical?.units?.analog || '',
    onCommit: (text) => {
      analogRef.current = text;
      commitUnitsFrom(text, behavioralRef.current);
    },
    label: 'technical.units.analog',
  });
  const behavioral = useDraftField<string>({
    value: technical?.units?.behavioral_events || '',
    onCommit: (text) => {
      behavioralRef.current = text;
      commitUnitsFrom(analogRef.current, text);
    },
    label: 'technical.units.behavioral_events',
  });
  analogRef.current = analog.value;
  behavioralRef.current = behavioral.value;
  const local = {
    default_header_file_path: header.value,
    analog: analog.value,
    behavioral_events: behavioral.value,
  };

  const raw = resolveRigConstant(technical, recordingSystemDefaults, 'raw_data_to_volts');
  const mult = resolveRigConstant(technical, recordingSystemDefaults, 'times_period_multiplier');
  const rigCue = (c: ReturnType<typeof resolveRigConstant>) => {
    if (c.status === 'unset') {
      // Existing recordings need an explicit correction; changing a default does not backfill them.
      return 'Missing on this recording day — required for export. This day has no recording-system value — enter a verified value in the correction section below.';
    }
    return c.status === 'default'
      ? 'Using recording-system default'
      : `Different from current recording-system default (current default: ${c.currentDefault})`;
  };

  const change = (key: keyof typeof local, value: string) => {
    if (key === 'default_header_file_path') header.setValue(value);
    else if (key === 'analog') analog.setValue(value);
    else behavioral.setValue(value);
  };

  // units requires BOTH analog and behavioral_events together (schema). Flag the
  // partial case inline rather than letting it surface only at the export gate.
  const unitsPartial = !!local.analog.trim() !== !!local.behavioral_events.trim();

  const commitHeader = () => header.flush();
  const commitUnits = () => {
    analog.flush();
    behavioral.flush();
  };

  const content = (
    <>
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

      <details open={raw.status === 'unset' || mult.status === 'unset' || raw.display === 0.195 || undefined}>
        <summary>Correct conversion values for this recording</summary>
        <p>These corrections affect this recording only. Verify the voltage units against the
          acquisition settings. The converter uses this voltage value only when the header lacks rawScalingToUv.</p>
        {raw.display === 0.195 && <p role="note">The former app default was 0.195 V/count.
          If the intended scale is 0.195 µV/count, enter 1.95e-7 V/count. Existing data has not been rescaled.</p>}
        <label htmlFor="day-voltage-conversion">Voltage conversion for this recording (V/count)</label>
        <DraftNumberInput id="day-voltage-conversion" name="technical.raw_data_to_volts"
          data-field-path="technical.raw_data_to_volts" step="any" min="0"
          value={technical.raw_data_to_volts}
          onCommit={(value) => onFieldUpdate('technical.raw_data_to_volts', value)} />
        <label htmlFor="day-period-multiplier">Legacy times period multiplier for this recording</label>
        <DraftNumberInput id="day-period-multiplier" name="technical.times_period_multiplier"
          data-field-path="technical.times_period_multiplier" step="any" min="0"
          value={technical.times_period_multiplier}
          onCommit={(value) => onFieldUpdate('technical.times_period_multiplier', value)} />
      </details>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="default-header-file-path">
            Default header file path <span className="ownership-cue">This day only</span>
          </label>
          <input
            id="default-header-file-path"
            type="text"
            data-field-path="technical.default_header_file_path"
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
            data-field-path="technical.units.analog"
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
            data-field-path="technical.units.behavioral_events"
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
    </>
  );

  if (embedded) {
    return <div className="day-technical-section day-technical-section-embedded">{content}</div>;
  }

  return (
    <section className="day-editor-section day-technical-section">
      {content}
    </section>
  );
}
