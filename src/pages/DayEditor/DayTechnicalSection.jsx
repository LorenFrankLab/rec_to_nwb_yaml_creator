import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * DayTechnicalSection - per-day technical parameters editor (Day Editor / Overview).
 *
 * These values live on `day.technical` and are read there by the export:
 * `default_header_file_path` (a path string) and `units` (`{analog, behavioral_events}`).
 * They are per-day (unlike `raw_data_to_volts` / `times_period_multiplier`, which are
 * seeded from the animal's technical defaults), so they are edited here where the day
 * lives — not at the animal level.
 *
 * `units` is written as a whole object, and cleared to `undefined` when both fields are
 * blank so the export omits it (the schema rejects a present-but-empty `units`) rather
 * than emitting invalid empty strings.
 *
 * @param {object} props
 * @param {object} props.technical - The day's `technical` block.
 * @param {(fieldPath: string, value: *) => void} props.onFieldUpdate - Day field updater
 *   (dot-path, e.g. `technical.default_header_file_path`).
 * @returns {JSX.Element}
 */
export default function DayTechnicalSection({ technical, onFieldUpdate }) {
  const [local, setLocal] = useState({
    default_header_file_path: technical?.default_header_file_path || '',
    analog: technical?.units?.analog || '',
    behavioral_events: technical?.units?.behavioral_events || '',
  });

  const change = (key, value) => setLocal((prev) => ({ ...prev, [key]: value }));

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
    onFieldUpdate('technical.units', { analog, behavioral_events: behavioralEvents });
  };

  return (
    <section className="day-editor-section day-technical-section">
      <details>
        <summary>Technical parameters (this day)</summary>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="default-header-file-path">Default header file path</label>
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
      </details>
    </section>
  );
}

DayTechnicalSection.propTypes = {
  technical: PropTypes.shape({
    default_header_file_path: PropTypes.string,
    units: PropTypes.shape({
      analog: PropTypes.string,
      behavioral_events: PropTypes.string,
    }),
  }),
  onFieldUpdate: PropTypes.func.isRequired,
};

DayTechnicalSection.defaultProps = {
  technical: {},
};
