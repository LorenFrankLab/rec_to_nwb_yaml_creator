import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { rawArray } from '../../components/rawPropTypes';

/**
 * DayRecordingSystem — the per-day recording-system selector for the Day Editor's setup step.
 *
 * The animal owns a CATALOG of acquisition systems (`animal.devices.data_acq_device`); a single .rec
 * session is recorded by ONE of them. This control picks which one this day used:
 *  - 0 systems: a hint to add one in the animal's Recording System tab (nothing to choose).
 *  - 1 system: read-only — there is no choice, the day uses it.
 *  - 2+ systems: a dropdown (defaulting to the first/animal default) writing the chosen system's
 *    `name` as the day reference (`day.data_acq_device_name`); the "Default" option clears it.
 *
 * The reference is by NAME (the Spyglass `DataAcquisitionDevice` identity); the export resolves it
 * live from the catalog, falling back to the first entry when unset/dangling.
 *
 * @param {object} props
 * @param {Array<object>} props.catalog - The animal's `data_acq_device` catalog.
 * @param {string} [props.selectedName] - The day's current reference (`day.data_acq_device_name`).
 * @param {(name: string|undefined) => void} props.onSelect - Called with the chosen system name, or
 *   `undefined` to clear back to the animal default.
 * @returns {JSX.Element}
 */
export default function DayRecordingSystem({ catalog, selectedName, onSelect }) {
  const selectId = useId();
  const systems = Array.isArray(catalog) ? catalog : [];
  const firstName = systems[0]?.name || '';

  if (systems.length === 0) {
    return (
      <section className="day-recording-system" aria-label="Recording system">
        <h3>Recording system</h3>
        <p className="field-help-text">
          No recording system yet — add the one this animal was recorded on in its Recording System
          tab.
        </p>
      </section>
    );
  }

  if (systems.length === 1) {
    return (
      <section className="day-recording-system" aria-label="Recording system">
        <h3>Recording system</h3>
        <p className="field-help-text">
          This session was recorded on <strong>{firstName}</strong>. Add more systems in the animal&apos;s
          Recording System tab to choose a different one per day.
        </p>
      </section>
    );
  }

  return (
    <section className="day-recording-system" aria-label="Recording system">
      <h3>Recording system</h3>
      <label htmlFor={selectId}>Recording system used this day</label>
      <select
        id={selectId}
        value={selectedName || ''}
        onChange={(e) => onSelect(e.target.value === '' ? undefined : e.target.value)}
      >
        <option value="">Default (first: {firstName})</option>
        {systems.map((d, i) => (
          <option key={`${d?.name}-${i}`} value={d?.name || ''}>
            {d?.name || '(unnamed)'}
          </option>
        ))}
      </select>
      <small className="field-help-text">
        A .rec session is recorded by one acquisition system. Leave on Default unless this day used a
        different one.
      </small>
    </section>
  );
}

DayRecordingSystem.propTypes = {
  catalog: rawArray(PropTypes.object),
  selectedName: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

DayRecordingSystem.defaultProps = {
  catalog: [],
  selectedName: undefined,
};
