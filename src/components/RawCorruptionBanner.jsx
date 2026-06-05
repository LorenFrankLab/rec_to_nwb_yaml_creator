import PropTypes from 'prop-types';
import { validateRawAnimal, validateRawDay } from '../validation/rawShape';

/**
 * RawCorruptionBanner — the destination-side surface for raw-shape corruption.
 *
 * A repair routed to an editor ("Fix in Animal Editor → Hardware Config" for a corrupt
 * `cameras`) must land on a VISIBLE reset control, not an empty "Add First Camera" state
 * that hides the corruption behind a laundered `[]`. Given the raw `animal`/`day`, this
 * computes the owned raw-shape issues — which already carry executable `repairCommand`s and
 * human `actionLabel`s from the validation layer (see {@link validateRawAnimal} /
 * {@link validateRawDay}) — and renders one executable reset button per issue. The button
 * EXECUTES the command via `onRepair` (the same {@link applyRepairCommand} executor the
 * Validation/Export repair buttons use), so the corruption clears in place.
 *
 * It owns no reset logic of its own: it is a thin, command-driven view over the issues the
 * validators produce, filtered to the fields the host editor is responsible for. With no
 * `onRepair` executor it renders nothing (never a dead control).
 *
 * @param {object} props
 * @param {object} [props.animal] - The raw (possibly corrupt) animal record.
 * @param {object} [props.day] - The raw (possibly corrupt) day record.
 * @param {string[]} props.fields - The raw-field keys this banner instance owns (e.g.
 *   `['cameras', 'data_acq_device', 'configurationHistory']`). Only issues on these fields
 *   are surfaced, so two banners on the same record don't double-render the same control.
 * @param {(issue: object) => void} [props.onRepair] - Executes an issue's `repairCommand`.
 * @returns {JSX.Element|null}
 */
export default function RawCorruptionBanner({ animal, day, fields, onRepair }) {
  if (typeof onRepair !== 'function') return null;

  // Each issue carries its `ownerSurface`, so filtering/keying include it: should an animal
  // and a day raw field ever share a name (the sets are disjoint today, so this is defensive),
  // the banner still treats them as distinct issues rather than collapsing or key-colliding.
  const owned = new Set(fields);
  const issues = [
    ...(animal ? validateRawAnimal(animal) : []),
    ...(day ? validateRawDay(day) : []),
  ].filter((issue) => owned.has(issue.field) && issue.repairCommand);

  if (issues.length === 0) return null;

  return (
    <section className="raw-corruption-banner" role="alert" aria-label="Corrupt saved data">
      <p className="field-help-text">
        Some saved data here is corrupt and blocks export. Reset it to a clean state:
      </p>
      <ul className="raw-corruption-list">
        {issues.map((issue) => (
          <li key={`${issue.ownerSurface}-${issue.code}-${issue.field}`} className="raw-corruption-item">
            <span className="raw-corruption-message">{issue.message}</span>
            <button
              type="button"
              className="repair-action-button repair-action-button-execute"
              data-repair-command={issue.repairCommand.type}
              data-field-path={issue.focusPath || issue.field}
              onClick={() => onRepair(issue)}
            >
              {issue.actionLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

RawCorruptionBanner.propTypes = {
  animal: PropTypes.object,
  day: PropTypes.object,
  fields: PropTypes.arrayOf(PropTypes.string).isRequired,
  onRepair: PropTypes.func,
};

RawCorruptionBanner.defaultProps = {
  animal: null,
  day: null,
  onRepair: undefined,
};
