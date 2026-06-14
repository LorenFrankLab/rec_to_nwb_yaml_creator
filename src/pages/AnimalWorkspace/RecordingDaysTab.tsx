/**
 * RecordingDaysTab — the per-animal recording-days pane.
 *
 * Extracted verbatim from {@link AnimalWorkspace}'s selected-animal branch (Phase 1 —
 * tabbed-workspace-ia) so BOTH the legacy Workspace (passing its `selectedAnimalId`) and the
 * new tabbed `AnimalView` (passing the route `animalId`) render ONE implementation — no fork.
 * Every Phase 8.7 behavior (setup checklist, existing-data review, the 3-field corruption
 * banner, recovered/wrong-owner/dangling day rows, calendar create, per-row + animal delete
 * confirms with the downloaded-artifacts caveat) is preserved byte-for-byte.
 *
 * Phase 9c-2 split the pane's view pieces into focused sibling components with no behavior change —
 * `AnimalSetupCard`, `ExistingDataReview`, `DayList`, `DuplicateDayModal`; this module owns the
 * pane's state + the create/duplicate/delete/copy/repair handlers and composes the pieces.
 *
 * Landmark-neutral: it renders only the pane content + its confirm dialogs (NOT a `<main>`),
 * so each host owns its single `#main-content`.
 */

import { useMemo, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import {
  getAnimalCameras,
  getAnimalDevices,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getAnimalSubject,
  getConfigHistory,
  getDataAcqDevices,
  getMostRecentDayId,
} from '../../state/workspaceSelectors';
import {
  normalizeElectrodeGroupWithDefaults,
  normalizeNtrodeMapWithDefaults,
} from '../../utils/deviceNormalization';
import type { NtrodeMap } from '../../state/workspaceTypes';
import CopyFromAnimalDialog from '../AnimalEditor/CopyFromAnimalDialog';
import type { CopyPayload } from '../AnimalEditor/CopyFromAnimalDialog';
import {
  classifyAnimalDays,
  DAY_STATUS,
  isPresentRecordStatus,
} from '../../domain/dayRecovery';
import { DOWNSTREAM_NOT_DELETED_NOTE } from '../../domain/animalDeleteCascade';
import { validateRawAnimal } from '../../validation/rawShape';
import { applyRepairCommand } from '../../state/repairCommands';
import type { RepairCommand } from '../../state/repairCommands';
import { CalendarDayCreator } from '../../components/CalendarDayCreator/CalendarDayCreator';
import DayLifecycleLegend from '../../components/DayLifecycleLegend/DayLifecycleLegend';
import { ConfirmDialog } from '../../components/Modal';
import AnimalSetupCard from './AnimalSetupCard';
import ExistingDataReview from './ExistingDataReview';
import DayList from './DayList';
import DuplicateDayModal from './DuplicateDayModal';
import styles from './AnimalWorkspace.module.css';

/** A pending per-day delete descriptor (named even after the store row changes). */
interface PendingDeleteDay {
  dayId: string;
  date?: string;
  sessionId?: string;
  hasArtifacts: boolean;
}

interface RecordingDaysTabProps {
  /** The animal whose recording days to manage. */
  animalId: string;
}

/**
 * RecordingDaysTab Component
 *
 * Renders one animal's recording-days management surface. The owning host decides which animal
 * is shown (legacy Workspace selection vs. the `#/animal/:id/days` route) and passes its id.
 */
export function RecordingDaysTab({ animalId }: RecordingDaysTabProps) {
  const { model, actions } = useStoreContext();
  // Alias the prop to the original local-state name so the extracted pane body transfers
  // verbatim from AnimalWorkspace (lowest-risk extraction; the 34 workspace tests pin it).
  const selectedAnimalId = animalId;
  const [showCalendar, setShowCalendar] = useState(false);
  // Pending per-day delete confirm (null when closed): a small descriptor of the row (so the
  // confirm can name it even after the store row changes). Animal delete moved to the AnimalView
  // header ⋮ in Phase 4 (the shared type-to-confirm AnimalDeleteDialog), so it no longer lives here.
  const [pendingDeleteDay, setPendingDeleteDay] = useState<PendingDeleteDay | null>(null);
  // Pending per-day DUPLICATE (null when closed): the source row descriptor (dayId/date). The
  // single-date picker writes its chosen date into `duplicateDate`; `duplicateError` surfaces a
  // collision or a store throw inside the dialog (mirroring how create errors are surfaced).
  const [pendingDuplicateDay, setPendingDuplicateDay] = useState<{ dayId: string; date?: string } | null>(null);
  const [duplicateDate, setDuplicateDate] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  // Carry-forward day creation: default ON. When on, a new day seeds its day-owned content
  // (tasks, behavioral events, keywords, technical params, experiment description, weight) from
  // the animal's most recent existing day — reviewable per day. Opt out to start blank.
  const [carryForward, setCarryForward] = useState(true);
  // Whether the "Copy from another animal…" dialog is open. The shared hardware (electrode groups,
  // cameras, recording system) a lab uses is the same across animals, so a new/under-configured
  // animal can seed its catalogs from another animal here.
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const { animals = {}, days = {} } = model.workspace;

  const selectedAnimal = selectedAnimalId ? animals[selectedAnimalId] : null;
  // The animal's latest-dated existing day — the carry-forward source. null when there is none
  // (so the toggle is hidden and creation falls back to a blank day).
  const mostRecentDayId = getMostRecentDayId(selectedAnimal, days);
  // A recovered/imported animal can carry a malformed (non-array) `days`. `getAnimalDayIds`
  // safely reads it as [], so without this explicit flag the workspace would launder it to
  // "No recording days yet" and hide the problem. Surface it as a corrupt-reference state.
  const selectedDaysCorrupt =
    !!selectedAnimal && selectedAnimal.days != null && !Array.isArray(selectedAnimal.days);
  // The single domain classifier decides each day's recovery status (ok / dangling_reference /
  // recovered_unlinked), so the day list, the counts, and the review state all read ONE truth
  // instead of each re-deriving "what kind of day is this?". Recovered-unlinked records are
  // surfaced (never laundered into "No recording days yet") and re-linked from the Validation
  // summary; they are NOT exported until re-linked (see dayRecovery's policy).
  const selectedDayClassification = useMemo(
    () => (selectedAnimal ? classifyAnimalDays(selectedAnimalId, selectedAnimal, days) : []),
    [selectedAnimalId, selectedAnimal, days]
  );
  // The animal's exportable day RECORDS (OK status), sorted by date — the cross-day context the
  // bad-channel monotonicity export gate needs to know which channels were marked bad on an
  // earlier same-config day. Mirrors the `getAnimalDays` selector's OK-only, date-sorted view so
  // a row's "Needs fixing — …un-failed…" status matches the Day Editor's gate.
  //
  // Memoized so it is a STABLE array built once per data change, not rebuilt for every row in the
  // list render below. The per-row `getDayRowStatus(...)` call still reduces this array to compute
  // each day's prior same-config bad-channel union (`priorBadChannels`), so the bad-channel
  // monotonicity status is O(days) per row → O(days²) for the whole list. That is acceptable for
  // realistic day counts; for very long chronic studies (CLAUDE.md notes 200+ days) a future pass
  // could precompute one cumulative per-version prior-bad map and hand each row only its own slice.
  // Memoizing the inputs (here) avoids the redundant rebuild without changing monotonicity SEMANTICS.
  const selectedAnimalDays = useMemo(
    () =>
      selectedDayClassification
        .filter((d) => d.status === DAY_STATUS.OK && d.record)
        .map((d) => d.record!)
        .sort((a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? ''))),
    [selectedDayClassification]
  );
  const selectedOrphanDayIds = selectedDayClassification
    .filter((d) => d.status === DAY_STATUS.RECOVERED_UNLINKED)
    .map((d) => d.dayId);
  // Days indexed by THIS animal whose record belongs to a different animal (wrong owner). Surfaced
  // with a repair so the user can unlink them, not silently shown as ordinary recording days.
  const selectedWrongOwnerDayIds = selectedDayClassification
    .filter((d) => d.status === DAY_STATUS.WRONG_OWNER)
    .map((d) => d.dayId);

  /**
   * Commit the pending recording-day deletion through the store's `deleteDay`.
   */
  function confirmDeleteDay() {
    const target = pendingDeleteDay;
    setPendingDeleteDay(null);
    if (!target?.dayId) return;
    // Pass the owning animal explicitly: the delete button only renders on this selected animal's
    // OK rows, and an OK row can have a record with no `animalId` (corrupt import) — the store
    // would otherwise fail to clean the index. The UI knows the owner, so name it.
    actions.deleteDay(target.dayId, selectedAnimalId);
  }

  /**
   * Open the single-date duplicate picker for a source row (resets any prior chosen date/error).
   */
  function openDuplicateDay(source: { dayId: string; date?: string }) {
    setDuplicateDate('');
    setDuplicateError('');
    setPendingDuplicateDay(source);
  }

  /** Close the duplicate picker without duplicating. */
  function cancelDuplicateDay() {
    setPendingDuplicateDay(null);
    setDuplicateDate('');
    setDuplicateError('');
  }

  /**
   * Commit the pending duplication through the store's `duplicateDay`. Validates the chosen date
   * against the animal's existing days (collision guard) before delegating; the store's own
   * throws are caught and surfaced in the dialog rather than swallowed (mirrors create errors).
   */
  function confirmDuplicateDay() {
    const source = pendingDuplicateDay;
    if (!source?.dayId) return;
    if (!duplicateDate) {
      setDuplicateError('Choose a date for the new day.');
      return;
    }
    // Collision guard: the chosen date must not already be a present day for this animal.
    if (getExistingDays().includes(duplicateDate)) {
      setDuplicateError(`This animal already has a day on ${duplicateDate}.`);
      return;
    }
    try {
      actions.duplicateDay(source.dayId, duplicateDate);
      cancelDuplicateDay();
    } catch (error) {
      setDuplicateError((error as Error).message);
    }
  }

  /**
   * Execute a raw-shape corruption repair in place (same executor the editor banners use),
   * so recovered/imported corruption can be cleared from the review state without leaving the
   * workspace.
   */
  function handleRepair(issue: { repairCommand?: unknown } | null | undefined) {
    if (!issue?.repairCommand || !selectedAnimalId) return;
    applyRepairCommand(issue.repairCommand as RepairCommand, {
      actions,
      animalId: selectedAnimalId,
      animal: selectedAnimal ?? undefined,
    });
  }

  /**
   * Handle creating multiple recording days from calendar.
   */
  async function handleCreateDays(dates: string[]) {
    if (!selectedAnimalId || !dates || dates.length === 0) return;

    // Snapshot existing ids once, then accumulate locally. The `days` prop is the
    // render-time snapshot and does not reflect ids created earlier in this same
    // batch, so re-reading it per iteration would let a batch collide with its own
    // just-created days (e.g. a duplicate date in the input).
    const existingIds = new Set(Object.keys(days));

    for (const date of dates) {
      const sessionId = `${selectedAnimalId}_${date.replace(/-/g, '')}`;
      const dayId = `${selectedAnimalId}-${date}`;

      // Skip if the day already exists or was already created in this batch.
      if (existingIds.has(dayId)) {
        continue;
      }

      try {
        actions.createDay(
          selectedAnimalId,
          date,
          {
            session_id: sessionId,
            session_description: `Recording session for ${selectedAnimalId} on ${date}`,
          },
          { carryForwardFromDayId: carryForward && mostRecentDayId ? mostRecentDayId : undefined }
        );
        existingIds.add(dayId);
      } catch (error) {
        console.error(`Failed to create day ${date}:`, error);
        throw new Error(`Failed to create day ${date}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Toggle calendar visibility
   */
  function handleToggleCalendar() {
    setShowCalendar(!showCalendar);
  }

  /** Get existing days (ISO date strings) for selected animal. */
  function getExistingDays(): string[] {
    if (!selectedAnimal) return [];
    // Use the recovery classifier so the calendar's duplicate-date guard accounts for recovered
    // records too (ok + recovered-unlinked), not just the index — otherwise a recovered day's
    // date could be re-created as a collision. Tolerates a malformed/missing index.
    return selectedDayClassification
      .filter(
        (d) => isPresentRecordStatus(d.status)
      )
      .map((d) => d.record?.date)
      .filter((x): x is string => Boolean(x));
  }

  /**
   * Apply a copy-from-animal payload to the selected animal in ONE store update. The payload (from
   * {@link CopyFromAnimalDialog}) carries only the checked sections. Electrode groups/maps are
   * appended to the animal's existing catalogs and re-normalized exactly like the Electrode Groups
   * tab does; the recording-system catalog is appended; cameras are appended. The common case is a
   * fresh/under-configured target with empty catalogs, where appending equals replacing.
   *
   * The payload carries only the checked sections.
   */
  function handleCopyConfirm(payload: CopyPayload) {
    const update: Record<string, unknown> = {};

    const hasDeviceSection =
      Array.isArray(payload.electrode_groups) ||
      Array.isArray(payload.ntrode_electrode_group_channel_map) ||
      Array.isArray(payload.data_acq_device);

    if (hasDeviceSection) {
      const devices = { ...getAnimalDevices(selectedAnimal) };

      if (Array.isArray(payload.electrode_groups)) {
        devices.electrode_groups = [
          ...getAnimalElectrodeGroups(selectedAnimal),
          ...payload.electrode_groups,
        ].map(normalizeElectrodeGroupWithDefaults);
      }
      if (Array.isArray(payload.ntrode_electrode_group_channel_map)) {
        devices.ntrode_electrode_group_channel_map = [
          ...getAnimalNtrodeMaps(selectedAnimal),
          ...payload.ntrode_electrode_group_channel_map,
          // Point-free to preserve the original .jsx call exactly (Array#map passes (el, index,
          // array); the 3rd arg lands in the IGNORED `fallback*` param) — a behavior-preserving
          // cast, NOT a 2-arg rewrite, to keep this migration runtime-identical.
        ].map(normalizeNtrodeMapWithDefaults as unknown as (value: NtrodeMap, index: number, array: NtrodeMap[]) => NtrodeMap);
      }
      if (Array.isArray(payload.data_acq_device)) {
        devices.data_acq_device = [
          ...getDataAcqDevices(selectedAnimal),
          ...payload.data_acq_device,
        ];
      }

      update.devices = devices;
    }

    if (Array.isArray(payload.cameras)) {
      update.cameras = [...getAnimalCameras(selectedAnimal), ...payload.cameras];
    }

    actions.updateAnimal(selectedAnimalId, update);
    setCopyDialogOpen(false);
  }

  // The host renders this only for a present animal; guard defensively so a stale/cold id
  // resolves to nothing rather than crashing on `selectedAnimal.id`.
  if (!selectedAnimal) return null;

  // Whether there is at least one OTHER animal whose shared hardware could be copied here.
  const hasOtherAnimals =
    Object.keys(animals).filter((id) => id !== selectedAnimalId).length > 0;

  // Raw-shape corruption drives the existing-data review state below.
  const rawIssues = validateRawAnimal(selectedAnimal);
  // Count the recording-day RECORDS actually present (indexed + recovered), not just the index
  // length — otherwise a missing/corrupt index would say "Found 0 recording days" while recovered
  // records render below.
  const dayCount = selectedDayClassification.filter((d) => isPresentRecordStatus(d.status)).length;
  const configCount = getConfigHistory(selectedAnimal).length;
  // The setup card is the first-run onboarding affordance: show it until the animal is ESTABLISHED
  // — a subject is set AND it has at least one recording day. Behavior-only days are valid, so
  // "established" does NOT require any particular hardware section.
  const subjectPresent = Boolean(getAnimalSubject(selectedAnimal).subject_id);
  const showSetupCard = !(subjectPresent && dayCount > 0);
  // Existing data needs an explicit review state ONLY when there is something to review: raw-shape
  // corruption, a corrupt days reference, or recovered/wrong-owner day records. A clean, established
  // animal (days present, nothing corrupt) does NOT show this banner — it would otherwise compete
  // with "Add Recording Days" forever after the first day.
  const hasCorruption =
    rawIssues.length > 0 ||
    selectedDaysCorrupt ||
    selectedOrphanDayIds.length > 0 ||
    selectedWrongOwnerDayIds.length > 0;
  const showReview = hasCorruption;

  return (
    <>
      {/* Selected Animal: Day List */}
      <div>
        <header className={styles.dayListHeader}>
          <h2 id="day-list-heading">
            Recording Days for {selectedAnimal.id}
          </h2>
          <div className={styles.dayActions}>
            {/* No aria-label: the visible text IS the accessible name (label parity), so voice
                control / screen readers find the control by what it says. `aria-expanded` conveys
                the open/closed state; the visible text already flips Add Recording Days ↔ Hide
                Calendar for sighted users. */}
            <button
              className="btn-primary"
              onClick={handleToggleCalendar}
              aria-expanded={showCalendar}
            >
              {showCalendar ? 'Hide Calendar' : 'Add Recording Days'}
            </button>
            {mostRecentDayId && (
              <label className={styles.carryForwardToggle}>
                <input
                  type="checkbox"
                  checked={carryForward}
                  onChange={(e) => setCarryForward(e.target.checked)}
                />
                Start each new day from the last day ({days[mostRecentDayId]?.date}) — review &amp;
                adjust per day
              </label>
            )}
          </div>
        </header>

        {/* First-run "Set up this animal" card + the (separate) existing-data review state.
            The card is the LOUD onboarding affordance for a new/under-configured animal; the
            review state is a different concern (recovered/imported review). Both read the SAME
            per-section / classification truth the component derives above. */}
        {showSetupCard && (
          <AnimalSetupCard
            animalId={selectedAnimalId}
            animal={selectedAnimal}
            days={days}
            hasOtherAnimals={hasOtherAnimals}
            onCopyFromAnimal={() => setCopyDialogOpen(true)}
          />
        )}

        {showReview && (
          <ExistingDataReview
            animalId={selectedAnimalId}
            animal={selectedAnimal}
            dayCount={dayCount}
            configCount={configCount}
            hasCorruption={hasCorruption}
            daysCorrupt={selectedDaysCorrupt}
            orphanDayIds={selectedOrphanDayIds}
            wrongOwnerDayIds={selectedWrongOwnerDayIds}
            onRepair={handleRepair}
          />
        )}

        {/* Calendar for creating multiple days */}
        {showCalendar && (
          <div className={styles.calendarContainer}>
            <CalendarDayCreator
              animalId={selectedAnimalId}
              existingDays={getExistingDays()}
              onCreateDays={handleCreateDays}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        )}

        {/* One shared legend for the day-row status words, reused from the Validation Summary so
            the lifecycle vocabulary is defined once. Shown only when there are day rows to triage;
            collapsed by default so it never crowds the list. */}
        {selectedDayClassification.length > 0 && <DayLifecycleLegend />}

        <DayList
          classification={selectedDayClassification}
          daysCorrupt={selectedDaysCorrupt}
          animalId={selectedAnimalId}
          animal={selectedAnimal}
          animalDays={selectedAnimalDays}
          onUnlinkDayReference={actions.unlinkDayReference}
          onDuplicateDay={openDuplicateDay}
          onDeleteDay={setPendingDeleteDay}
        />
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteDay != null}
        title="Delete recording day?"
        message={
          pendingDeleteDay != null ? (
            <>
              Delete recording day <strong>{pendingDeleteDay.date || pendingDeleteDay.dayId}</strong>
              {pendingDeleteDay.sessionId ? ` (${pendingDeleteDay.sessionId})` : ''}? This removes the
              day and its session metadata, tasks, and failed-channel marks from this workspace and
              from export lists.
              {pendingDeleteDay.hasArtifacts && DOWNSTREAM_NOT_DELETED_NOTE} This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete day"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDeleteDay}
        onCancel={() => setPendingDeleteDay(null)}
      />

      <DuplicateDayModal
        isOpen={pendingDuplicateDay != null}
        source={pendingDuplicateDay}
        date={duplicateDate}
        error={duplicateError}
        onClose={cancelDuplicateDay}
        onSubmit={confirmDuplicateDay}
        onDateChange={(value) => {
          setDuplicateDate(value);
          setDuplicateError('');
        }}
      />

      <CopyFromAnimalDialog
        open={copyDialogOpen}
        currentAnimalId={selectedAnimalId}
        animals={animals}
        onCopy={handleCopyConfirm}
        onCancel={() => setCopyDialogOpen(false)}
      />
    </>
  );
}

export default RecordingDaysTab;
