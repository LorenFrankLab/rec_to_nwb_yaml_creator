import { useId, useMemo, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import {
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getConfigHistory,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
} from '../../state/workspaceSelectors';
import type { Animal, Day } from '../../state/workspaceTypes';
import './ReconfigWizard.scss';

interface ReconfigWizardProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Called (no args) on cancel/ESC/overlay and after a successful fork before navigating. */
  onClose: () => void;
  /** Animal whose latest configuration is forked. */
  animal: Animal;
  /**
   * The resolved store owner key; the snapshot write and the post-fork navigation use it
   * instead of the possibly-stale `day.animalId`/`animal.id`.
   */
  animalKey?: string;
  /** The day being reconfigured (the earliest day to move). */
  day: Day;
  /** The chronologically previous day, or null (for the "stays pinned" note). */
  prevDay?: Day | null;
  /** This day and all chronologically later days (the apply-forward set). */
  candidateDays: Day[];
  /** Store actions: `createConfigurationSnapshotAndApplyForward`. */
  actions: {
    createConfigurationSnapshotAndApplyForward: (
      animalKey: string,
      snapshot: { date: string; description: string; devices: unknown },
      orderedIds: string[]
    ) => number;
  };
}

/**
 * Probe-reconfiguration wizard — fork-before-edit.
 *
 * A recording day's probe geometry is a physical fact fixed at record time, so the
 * app pins each day to a frozen configuration snapshot. Reconfiguration therefore
 * **forks a new version before** the geometry is edited:
 *
 *   1. `createConfigurationSnapshotAndApplyForward` clones the current latest configuration
 *      into a new version AND repoints the affected day range (this day onward) onto it, in
 *      one atomic transition (no version handed across two actions).
 *   2. `animal.devices` already mirrors the new latest (the new version is a clone of
 *      the old latest it mirrored), so editing geometry afterward in the Animal Editor
 *      writes only the new version — earlier days keep their frozen configuration *by
 *      construction*.
 *
 * The wizard is a fork-point + affected-days confirmation: it shows which days move
 * to the new version and that earlier days stay pinned, then forks. There is no
 * live-vs-snapshot diff (geometry is edited afterward, not before).
 */
export default function ReconfigWizard({
  isOpen,
  onClose,
  animal,
  animalKey = undefined,
  day,
  prevDay = null,
  candidateDays,
  actions,
}: ReconfigWizardProps) {
  // The store OWNER KEY the reconfiguration writes/navigates by. Prefer the explicit key from the
  // stepper, then the day's declared owner, then the (possibly stale) `animal.id` record field.
  const ownerKey = animalKey ?? day?.animalId ?? animal?.id;
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const summaryId = `${baseId}-summary`;
  const errorId = `${baseId}-error`;

  // The configuration to fork is the current latest snapshot (which `animal.devices`
  // mirrors). The new version starts identical to it; the user edits geometry after.
  const latestDevices = useMemo(() => {
    const history = getConfigHistory(animal);
    const latest = history[history.length - 1];
    const latestGroups = getProbeElectrodeGroups(latest?.devices);
    const latestMaps = getProbeNtrodeMaps(latest?.devices);
    // Fall back to the animal mirror when the latest snapshot is EMPTY (not merely
    // falsy as before). The two diverge only if a snapshot held `[]` while the mirror
    // was non-empty, which `updateAnimal`'s mirror-into-latest logic prevents for in-app
    // state; an empty latest snapshot correctly falls back to the mirror.
    return {
      electrode_groups: latestGroups.length > 0 ? latestGroups : getAnimalElectrodeGroups(animal),
      ntrode_electrode_group_channel_map:
        latestMaps.length > 0 ? latestMaps : getAnimalNtrodeMaps(animal),
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

  const navigateToAnimalEditor = (newVersion: number) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams({
      context: 'reconfigure',
      version: String(newVersion),
      fromDay: day.id,
      movedDays: String(movingDays.length),
    });
    // Land on the electrode-groups tab — reconfiguration forks the VERSIONED electrode config, and
    // AnimalView reads `?context=reconfigure&…` there (the Phase 3-4 reconfig banner + the dated
    // ConfigVersionContext both live on that tab). The params are preserved verbatim.
    window.location.hash = `#/animal/${encodeURIComponent(ownerKey)}/electrode-groups?${params.toString()}`;
  };

  const handleApply = () => {
    if (latestDevices.electrode_groups.length === 0) {
      setError('Configure probes in Animal Setup before creating a new configuration version.');
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

    // Fork the current configuration into a new version AND move the affected range onto it
    // in ONE atomic transition (no version handed across two actions). Hardware
    // reconfiguration is a physical change, so day X and every later candidate day move
    // together (the contiguous chronological suffix).
    const orderedIds = movingDays.map((d) => d.id);
    // Target the resolved `ownerKey` (the store key — order `animalKey ?? day.animalId ?? animal.id`,
    // defined above) in preference to the possibly-stale `animal.id` record field, so a stale record
    // id can't misroute the write.
    const newVersion = actions.createConfigurationSnapshotAndApplyForward(
      ownerKey,
      {
        date,
        description: description.trim(),
        devices: structuredClone(latestDevices),
      },
      orderedIds
    );

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
      footer={
        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => onClose()}
            aria-label="Cancel and close"
          >
            Cancel
          </button>
          {/* type="button" (not submit): the action row now lives in Modal's footer,
              outside the <form>. Enter in a field still submits via the form's onSubmit,
              which calls the same handleApply. */}
          <button type="button" className="btn-primary" onClick={handleApply}>
            Create version & apply to {movingDays.length} {movingDays.length === 1 ? 'day' : 'days'}
          </button>
        </div>
      }
    >
      <p id={summaryId} className="reconfig-summary">
        This creates a new configuration version starting {day.date}. This day and
        all later listed days move to the new version; earlier days keep their current configuration.
        After confirming, edit the new probe geometry in Animal Setup — only the
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
      </form>
    </Modal>
  );
}

