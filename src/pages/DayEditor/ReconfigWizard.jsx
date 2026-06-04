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
 *   2. `applyConfigurationForward` repoints the selected days (this day onward) to
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
 * @param {Function} props.onClose - Called (no args) on cancel/ESC/overlay and after a successful fork.
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
  const [selectedIds, setSelectedIds] = useState(() => new Set(candidateDays.map((d) => d.id)));
  const [error, setError] = useState('');

  const toggleDay = (id) => {
    if (error) setError('');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    if (selectedIds.size === 0) {
      setError('Select at least one day to move to the new configuration.');
      return;
    }

    // Fork the current configuration into a new version, then move the selected days
    // onto it. The store assigns the version from its authoritative state and returns
    // it, so we apply forward to exactly the snapshot we just created.
    const newVersion = actions.addConfigurationSnapshot(animal.id, {
      date,
      description: description.trim(),
      devices: structuredClone(latestDevices),
    });
    // Apply in chronological (candidate) order, filtered to the selected set.
    const orderedIds = candidateDays.map((d) => d.id).filter((id) => selectedIds.has(id));
    actions.applyConfigurationForward(animal.id, newVersion, orderedIds);

    onClose();
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
        This creates a new configuration version starting {day.date}. The selected
        days move to the new version; earlier days keep their current configuration.
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
            All days from {day.date} onward are selected by default. To move an earlier
            day, open its Day Editor individually.
          </p>
          {candidateDays.map((d) => (
            <label key={d.id} className="reconfig-day-option">
              <input
                type="checkbox"
                checked={selectedIds.has(d.id)}
                onChange={() => toggleDay(d.id)}
              />
              {d.date} ({d.session?.session_id || d.id})
            </label>
          ))}
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
            Create version & apply to {selectedIds.size} {selectedIds.size === 1 ? 'day' : 'days'}
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
