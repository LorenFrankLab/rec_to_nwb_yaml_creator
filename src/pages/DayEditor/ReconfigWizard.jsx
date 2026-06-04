import { useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { resolveDayConfig } from '../../state/workspaceUtils';
import { diffProbeConfigs } from '../../state/configDiff';
import './ReconfigWizard.scss';

/**
 * Probe-reconfiguration wizard.
 *
 * Shows a structured diff between the configuration in effect for the previous day
 * (`prevDay`, or this day's own resolved config when there is no previous day) and
 * the current live animal device configuration, then versions that change as a new
 * {@link import('../../state/workspaceTypes').ConfigurationSnapshot} and applies it
 * forward to the chosen days.
 *
 * It only **diffs and versions** existing configuration; electrode geometry and
 * channel maps are edited in the Animal Editor. Creation and assignment are two
 * store actions: `addConfigurationSnapshot` then `applyConfigurationForward`.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is shown.
 * @param {Function} props.onClose - Called on cancel/ESC/overlay and after a successful apply.
 * @param {object} props.animal - Animal whose live `devices` form the "next" config.
 * @param {object} props.day - The day being reconfigured (the default earliest applied day).
 * @param {object|null} props.prevDay - The chronologically previous day, or null.
 * @param {object[]} props.candidateDays - This day and all chronologically later days (apply-forward set).
 * @param {object} props.actions - Store actions: `addConfigurationSnapshot`, `applyConfigurationForward`.
 * @returns {JSX.Element|null}
 */
export default function ReconfigWizard({ isOpen, onClose, animal, day, prevDay, candidateDays, actions }) {
  const baseId = useId();
  const titleId = `${baseId}-title`;

  const nextConfig = useMemo(
    () => ({
      electrode_groups: animal.devices?.electrode_groups || [],
      ntrode_electrode_group_channel_map: animal.devices?.ntrode_electrode_group_channel_map || [],
    }),
    [animal.devices]
  );

  const diff = useMemo(
    () => diffProbeConfigs(resolveDayConfig(animal, prevDay || day), nextConfig),
    [animal, prevDay, day, nextConfig]
  );

  const [description, setDescription] = useState('');
  const [date, setDate] = useState(day.date);
  const [selectedIds, setSelectedIds] = useState(() => new Set(candidateDays.map((d) => d.id)));
  const [error, setError] = useState('');

  const toggleDay = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    if (!diff.hasChanges) return;
    if (!description.trim()) {
      setError('Enter a short description of what changed.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Select at least one day to apply this configuration to.');
      return;
    }

    // Version the change, then assign it forward. The new snapshot takes the next
    // sequential version (matching addConfigurationSnapshot's own numbering).
    const newVersion = (animal.configurationHistory?.length || 0) + 1;
    actions.addConfigurationSnapshot(animal.id, {
      date,
      description: description.trim(),
      devices: structuredClone(nextConfig),
    });
    // Apply in the candidate (chronological) order, filtered to the selected set.
    const orderedIds = candidateDays.map((d) => d.id).filter((id) => selectedIds.has(id));
    actions.applyConfigurationForward(animal.id, newVersion, orderedIds);

    onClose({ applied: true, version: newVersion, dayIds: orderedIds });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reconfigure devices" titleId={titleId} className="reconfig-wizard">
      {!diff.hasChanges ? (
        <p className="reconfig-no-change" data-testid="reconfig-no-change">
          No configuration change detected between{' '}
          {prevDay ? `${prevDay.date}` : 'the baseline'} and the current animal
          configuration. Edit the electrode groups in the Animal Editor first, then
          reopen this wizard to version the change.
        </p>
      ) : (
        <div className="reconfig-diff">
          <ConfigDiffView diff={diff} />
        </div>
      )}

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
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Lowered CA1 tetrodes by 40 µm"
            disabled={!diff.hasChanges}
          />
        </label>

        <label className="reconfig-field">
          <span>Effective date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!diff.hasChanges}
          />
        </label>

        <fieldset className="reconfig-days" disabled={!diff.hasChanges}>
          <legend>Apply to days</legend>
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
          <p className="reconfig-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!diff.hasChanges}>
            Apply forward
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

ReconfigWizard.defaultProps = {
  prevDay: null,
};

/**
 * Read-only rendering of a {@link diffProbeConfigs} result.
 *
 * @param {object} props
 * @param {object} props.diff - The structured diff.
 * @returns {JSX.Element}
 */
function ConfigDiffView({ diff }) {
  const { electrodeGroups, channelMaps } = diff;
  return (
    <div className="config-diff">
      <section aria-label="Electrode group changes">
        <h3>Electrode groups</h3>
        {electrodeGroups.added.length === 0 &&
          electrodeGroups.removed.length === 0 &&
          electrodeGroups.changed.length === 0 && <p className="diff-none">No electrode group changes.</p>}
        {electrodeGroups.added.map((g) => (
          <p key={`a-${g.id}`} className="diff-added">
            + Added group {g.id} ({g.location}, {g.device_type})
          </p>
        ))}
        {electrodeGroups.removed.map((g) => (
          <p key={`r-${g.id}`} className="diff-removed">
            − Removed group {g.id} ({g.location})
          </p>
        ))}
        {electrodeGroups.changed.map((c) => (
          <p key={`c-${c.id}`} className="diff-changed">
            ~ Group {c.id} changed: {c.fields.join(', ')}
          </p>
        ))}
      </section>

      <section aria-label="Channel map changes">
        <h3>Channel maps</h3>
        {channelMaps.added.length === 0 &&
          channelMaps.removed.length === 0 &&
          channelMaps.changed.length === 0 && <p className="diff-none">No channel map changes.</p>}
        {channelMaps.added.map((n) => (
          <p key={`a-${n.ntrode_id}`} className="diff-added">
            + Added ntrode {n.ntrode_id} (group {n.electrode_group_id})
          </p>
        ))}
        {channelMaps.removed.map((n) => (
          <p key={`r-${n.ntrode_id}`} className="diff-removed">
            − Removed ntrode {n.ntrode_id}
          </p>
        ))}
        {channelMaps.changed.map((c) => (
          <p key={`c-${c.ntrode_id}`} className="diff-changed">
            ~ Ntrode {c.ntrode_id} changed:{' '}
            {[c.mapChanged && 'channel map', c.badChannelsChanged && 'bad channels']
              .filter(Boolean)
              .join(', ')}
          </p>
        ))}
      </section>
    </div>
  );
}

ConfigDiffView.propTypes = {
  diff: PropTypes.object.isRequired,
};
