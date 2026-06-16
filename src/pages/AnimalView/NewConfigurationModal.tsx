/**
 * NewConfigurationModal — the animal-page re-implant flow.
 *
 * The single re-implant lifecycle op surfaced on the animal page (the ConfigurationCard's "New
 * configuration…" action). It captures an effective start date, whether to copy the current probes
 * into the new version, and confirms that bad-channel marks reset for the new version — then commits
 * through the SAME `createConfigurationSnapshotAndApplyForward` action the Day-Editor reconfiguration
 * uses (no parallel snapshot logic). Days from the effective date forward stamp the new version;
 * earlier days keep theirs (the ConfigVersionContext timeline renders the result).
 */
import { useId, useMemo, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import {
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getConfigHistory,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
} from '../../state/workspaceSelectors';
import { nextConfigurationVersion } from '../../state/workspaceTransitions';
import { classifyAnimalDays, DAY_STATUS } from '../../domain/dayRecovery';
import type { Animal, Day } from '../../state/workspaceTypes';
import styles from './NewConfigurationModal.module.css';

interface NewConfigurationModalProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Called on cancel / ESC / overlay and after a successful commit. */
  onClose: () => void;
  /** The animal whose latest configuration is forked. */
  animal: Animal;
  /** The store owner key (drives the write — never the possibly-stale record id). */
  animalKey: string;
  /** The workspace days map (to derive which present days move to the new version). */
  days: Record<string, Day>;
  /** Store action: the single reconfiguration entry point. */
  actions: {
    createConfigurationSnapshotAndApplyForward: (
      animalKey: string,
      snapshot: { date: string; description: string; devices: unknown },
      orderedIds: string[]
    ) => number | undefined;
  };
}

/**
 * NewConfigurationModal component.
 */
export default function NewConfigurationModal({
  isOpen,
  onClose,
  animal,
  animalKey,
  days,
  actions,
}: NewConfigurationModalProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const summaryId = `${baseId}-summary`;
  const errorId = `${baseId}-error`;

  const [effectiveDate, setEffectiveDate] = useState('');
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // The version this commit will create — the SAME deriver the action uses (max(version) + 1), so the
  // displayed label can't disagree with the committed version on a non-monotonic/corrupt history.
  const nextVersion = useMemo(() => nextConfigurationVersion(getConfigHistory(animal)), [animal]);

  // The current latest devices to clone when "copy from current" is on — mirrors the Day-Editor
  // reconfiguration: prefer the latest snapshot's geometry, fall back to the editable mirror when
  // the snapshot is empty.
  const latestDevices = useMemo(() => {
    const history = getConfigHistory(animal);
    const latest = history[history.length - 1];
    const latestGroups = getProbeElectrodeGroups(latest?.devices);
    const latestMaps = getProbeNtrodeMaps(latest?.devices);
    return {
      electrode_groups: latestGroups.length > 0 ? latestGroups : getAnimalElectrodeGroups(animal),
      ntrode_electrode_group_channel_map:
        latestMaps.length > 0 ? latestMaps : getAnimalNtrodeMaps(animal),
    };
  }, [animal]);

  // The present (in-place) recording days, date-sorted — the candidates the effective date filters.
  const presentDays = useMemo(
    () =>
      classifyAnimalDays(animalKey, animal, days)
        .filter((d) => d.status === DAY_STATUS.OK && d.record)
        .map((d) => d.record as unknown as Day)
        .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''))),
    [animalKey, animal, days]
  );

  // Days on/after the effective date — the apply-forward set (empty until a valid date is chosen).
  const movingDays = useMemo(
    () => (effectiveDate ? presentDays.filter((d) => String(d.date ?? '') >= effectiveDate) : []),
    [presentDays, effectiveDate]
  );

  const handleApply = () => {
    if (!effectiveDate) {
      setError('Choose the date the new configuration takes effect.');
      return;
    }
    const devices = copyFromCurrent
      ? structuredClone(latestDevices)
      : { electrode_groups: [], ntrode_electrode_group_channel_map: [] };
    actions.createConfigurationSnapshotAndApplyForward(
      animalKey,
      {
        date: effectiveDate,
        description: description.trim() || `Configuration v${nextVersion}`,
        devices,
      },
      movingDays.map((d) => d.id as string)
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New configuration (re-implant)?"
      titleId={titleId}
      // A consequential action — it forks a new configuration version across a day range.
      role="alertdialog"
      describedById={summaryId}
      footer={
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button-primary" onClick={handleApply}>
            Start configuration v{nextVersion}
          </button>
        </div>
      }
    >
      <p id={summaryId}>
        Use this when the implant physically changes — new probes, repositioning, or a re-surgery. It
        creates <strong>configuration v{nextVersion}</strong>; existing days keep the version they were
        recorded under.
      </p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          handleApply();
        }}
      >
        <label className={styles.field}>
          <span>Effective start date</span>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => {
              if (error) setError('');
              setEffectiveDate(e.target.value);
            }}
            aria-describedby={error ? errorId : undefined}
          />
        </label>

        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={copyFromCurrent}
            onChange={(e) => setCopyFromCurrent(e.target.checked)}
          />
          Copy current probes into the new configuration (then adjust geometry)
        </label>

        <label className={styles.field}>
          <span>Change description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Re-implant — replaced CA1 tetrodes"
          />
        </label>

        <ul className={styles.consequences}>
          <li>
            Recording days from {effectiveDate || 'the effective date'} forward use v{nextVersion}
            {effectiveDate ? ` (${movingDays.length} ${movingDays.length === 1 ? 'day' : 'days'})` : ''}.
          </li>
          <li>
            <strong>Bad-channel marks reset</strong> for v{nextVersion} — v
            {nextVersion - 1} failures don&apos;t carry across configurations.
          </li>
        </ul>

        {error && (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
