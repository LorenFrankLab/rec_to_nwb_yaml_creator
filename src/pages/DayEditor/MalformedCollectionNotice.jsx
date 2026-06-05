import PropTypes from 'prop-types';

/**
 * MalformedCollectionNotice — repair surface for Boundary 1 (raw-shape) corruption.
 *
 * A day-owned array field that loaded as a non-array (e.g. `tasks: {}` from a corrupt
 * import) is laundered to `[]` by the merge, so it has no editor row — yet it blocks
 * export (`malformed_day_collection`). This renders a focusable reset control for each
 * such field the owning step is responsible for, carrying `data-field-path={key}` (the
 * issue's `focusPath`) so the stepper's repair-focus lands here. Resetting writes `[]`,
 * clearing the raw-shape issue.
 *
 * @param {object} props
 * @param {object} props.day - The persisted day (may be corrupt; read defensively).
 * @param {Array<{key: string, label: string}>} props.fields - The collections this step owns.
 * @param {(key: string) => void} props.onReset - Reset a field to an empty array.
 * @returns {JSX.Element|null}
 */
export default function MalformedCollectionNotice({ day, fields, onReset }) {
  const isRecord = day !== null && typeof day === 'object' && !Array.isArray(day);
  const malformed = isRecord
    ? fields.filter((f) => day[f.key] != null && !Array.isArray(day[f.key]))
    : [];

  if (malformed.length === 0) return null;

  return (
    <section className="malformed-collection-notice" aria-label="Corrupt day data">
      <p className="field-help-text">
        Some saved data on this day is corrupt (not a list) and blocks export. trodes_to_nwb
        would receive empty data, silently dropping it. Reset the corrupt fields:
      </p>
      {malformed.map((f) => (
        <button
          key={f.key}
          type="button"
          className="malformed-collection-reset"
          data-field-path={f.key}
          onClick={() => onReset(f.key)}
        >
          Reset corrupt {f.label}
        </button>
      ))}
    </section>
  );
}

MalformedCollectionNotice.propTypes = {
  day: PropTypes.object,
  fields: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired })
  ).isRequired,
  onReset: PropTypes.func.isRequired,
};

MalformedCollectionNotice.defaultProps = {
  day: null,
};
