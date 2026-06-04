import { useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import './ReconfigWizard.scss';

/**
 * Probe-reconfiguration wizard — fork-before-edit.
 *
 * A recording day's probe geometry is a physical fact fixed at record time, so the
 * app pins each day to a frozen configuration snapshot. Reconfiguration therefore
 * **forks a new version before** the geometry is edited:
 *
 *   1. `addConfigurationSnapshot` clones the current latest configuration into a new
 *      version (returns its assigned number, which is applied forward verbatim).
 *   2. `applyConfigurationForward` repoints the affected day range (this day onward) to
 *      that new version.
 *   3. `animal.devices` already mirrors the new latest (the new version is a clone of
 *      the old latest it mirrored), so editing geometry afterward in the Animal Editor
 *      writes only the new version — earlier days keep their frozen configuration *by
 *      construction*.
 *
 * The wizard is a fork-point + affected-days confirmation: it shows which days move
 * to the new version and that earlier days stay pinned, then forks. There is no
 * live-vs-snapshot diff (geometry is edited afterward, not before).
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is shown.
 * @param {Function} props.onClose - Called (no args) on cancel/ESC/overlay and after a successful fork before navigating to the Animal Editor.
 * @param {object} props.animal - Animal whose latest configuration is forked.
 * @param {object} props.day - The day being reconfigured (the earliest day to move).
 * @param {object|null} [props.prevDay] - The chronologically previous day, or null (for the "stays pinned" note).
 * @param {object[]} props.candidateDays - This day and all chronologically later days (the apply-forward set).
 * @param {object} props.actions - Store actions: `addConfigurationSnapshot`, `applyConfigurationForward`.
 * @returns {JSX.Element|null}
 */
export default function ReconfigWizard({
  isOpen,
  onClose,
  animal,
  day,
  prevDay = null,
  candidateDays,
  actions,
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const summaryId = `${baseId}-summary`;
  const errorId = `${baseId}-error`;

  // The configuration to fork is the current latest snapshot (which `animal.devices`
  // mirrors). The new version starts identical to it; the user edits geometry after.
  const latestDevices = useMemo(() => {
    const history = animal.configurationHistory || [];
    const latest = history[history.length - 1];
    return {
      electrode_groups:
        latest?.devices?.electrode_groups || animal.devices?.electrode_groups || [],
      ntrode_electrode_group_channel_map:
        latest?.devices?.ntrode_electrode_group_channel_map ||
        animal.devices?.ntrode_electrode_group_channel_map ||
        [],
    };
  }, [animal]);

  const [description, setDescription] = useState('');
  const [date, setDate] = useState(day.date);
  const [error, setError] = useState('');

  const movingDays = useMemo(() => {
    const sortedDays = [...candidateDays].sort((a, b) => (
      (a.date || '').localeCompare(b.date || '') ||
      (a.id || '').localeCompare(b.id || '')
    ));
    const startIndex = sortedDays.findIndex((d) => d.id === day.id);
    if (startIndex >= 0) return sortedDays.slice(startIndex);
    if (day.date) return sortedDays.filter((d) => (d.date || '') >= day.date);
    return sortedDays;
  }, [candidateDays, day.date, day.id]);

  const navigateToAnimalEditor = (newVersion) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams({
      context: 'reconfigure',
      version: String(newVersion),
      fromDay: day.id,
      movedDays: String(movingDays.length),
    });
    window.location.hash = `#/animal/${encodeURIComponent(animal.id)}/editor?${params.toString()}`;
  };

  const handleApply = () => {
    if (latestDevices.electrode_groups.length === 0) {
      setError('Configure probes in the Animal Editor before creating a new configuration version.');
      return;
    }
    if (!description.trim()) {
      setError('Enter a short description of what changed.');
      return;
    }
    if (movingDays.length === 0) {
      setError('No recording days are available to move to the new configuration.');
      return;
    }

    // Fork the current configuration into a new version, then move the affected range
    // onto it. The store assigns the version from its authoritative state and returns
    // it, so we apply forward to exactly the snapshot we just created.
    const newVersion = actions.addConfigurationSnapshot(animal.id, {
      date,
      description: description.trim(),
      devices: structuredClone(latestDevices),
    });
    // Apply the contiguous chronological suffix. Hardware reconfiguration is a
    // physical change, so day X and every later candidate day move together.
    const orderedIds = movingDays.map((d) => d.id);
    actions.applyConfigurationForward(animal.id, newVersion, orderedIds);

    onClose();
    navigateToAnimalEditor(newVersion);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reconfigure devices"
      titleId={titleId}
      // A consequential action (forks a new configuration across many recording days).
      role="alertdialog"
      describedById={summaryId}
      className="reconfig-wizard"
    >
      <p id={summaryId} className="reconfig-summary">
        This creates a new configuration version starting {day.date}. This day and
        all later listed days move to the new version; earlier days keep their current configuration.
        After confirming, edit the new probe geometry in the Animal Editor — only the
        new version (and the days on it) changes.
      </p>

      <p className="reconfig-pinned-note">
        {prevDay
          ? `Days through ${prevDay.date} stay pinned to their current configuration and are not affected.`
          : 'There are no earlier days; this is the first recording day.'}
      </p>

      <form
        className="reconfig-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleApply();
        }}
      >
        <label className="reconfig-field">
          <span>Change description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              if (error) setError('');
              setDescription(e.target.value);
            }}
            placeholder="e.g. Lowered CA1 tetrodes by 40 µm"
            aria-describedby={error ? errorId : undefined}
          />
        </label>

        <label className="reconfig-field">
          <span>Effective date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <fieldset className="reconfig-days">
          <legend>Days moving to the new configuration</legend>
          <p className="reconfig-days-hint">
            Hardware changes apply as a contiguous range from {day.date} onward.
            To start at a different day, open that day’s Day Editor.
          </p>
          <ol className="reconfig-day-list">
            {movingDays.map((d) => (
              <li key={d.id} className="reconfig-day-option">
                {d.date} ({d.session?.session_id || d.id})
              </li>
            ))}
          </ol>
        </fieldset>

        {error && (
          <p id={errorId} className="reconfig-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => onClose()}
            aria-label="Cancel and close"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Create version & apply to {movingDays.length} {movingDays.length === 1 ? 'day' : 'days'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

ReconfigWizard.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
  prevDay: PropTypes.object,
  candidateDays: PropTypes.arrayOf(PropTypes.object).isRequired,
  actions: PropTypes.shape({
    addConfigurationSnapshot: PropTypes.func.isRequired,
    applyConfigurationForward: PropTypes.func.isRequired,
  }).isRequired,
};
