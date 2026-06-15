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
  getDataAcqDevices,
  getDaySession,
  getMostRecentDayId,
} from '../../state/workspaceSelectors';
import {
  normalizeElectrodeGroupWithDefaults,
  normalizeNtrodeMapWithDefaults,
} from '../../utils/deviceNormalization';
import type { NtrodeMap } from '../../state/workspaceTypes';
import CopyFromAnimalDialog from '../AnimalEditor/CopyFromAnimalDialog';
import type { CopyPayload } from '../AnimalEditor/CopyFromAnimalDialog';
import { dayHasArtifacts } from '../../domain/dayRecovery';
import { DOWNSTREAM_NOT_DELETED_NOTE } from '../../domain/animalDeleteCascade';
import { buildAnimalWorkspaceViewModel } from '../../viewModels/animalWorkspaceViewModel';
import type { RecoveryNoticeViewModel, WorkflowCommand } from '../../viewModels/types';
import { commandHandlers, applyRepair } from '../../viewModels/commands';
import type { CommandActions } from '../../viewModels/commands';
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
  /** The VM's `deleteDay` command — dispatched on confirm (carries the target + caveat). */
  command: WorkflowCommand;
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
  const [pendingDuplicateDay, setPendingDuplicateDay] = useState<{ dayId: string; date?: string; command: WorkflowCommand } | null>(null);
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

  // The per-animal view-model: the day rows, the first-run setup sections, the existing-data review
  // state (corrupt index / recovered / wrong-owner / raw-collection repairs), and the carry-forward
  // affordance — all decided in the builder, so this pane renders rather than re-derives them.
  const vm = useMemo(
    () => buildAnimalWorkspaceViewModel(model.workspace, selectedAnimalId),
    [model.workspace, selectedAnimalId]
  );

  // Day-reference / day-CRUD writes route through the descriptor command layer (one named write
  // surface). Editable field writes (calendar createDay, copy-from-animal updateAnimal) stay local —
  // they are not VM-emitted command descriptors.
  const run = useMemo(
    () => commandHandlers({ actions: actions as unknown as CommandActions }),
    [actions]
  );

  // The raw records stay for the WRITE paths (carry-forward create source, copy-from-animal, repair
  // execution, the delete-confirm descriptor); the display all comes from the view-model above.
  const selectedAnimal = selectedAnimalId ? animals[selectedAnimalId] : null;
  // The animal's latest-dated existing day — the carry-forward source for createDay. null when there
  // is none (so the toggle is hidden and creation falls back to a blank day).
  const mostRecentDayId = getMostRecentDayId(selectedAnimal, days);

  /**
   * Commit the pending recording-day deletion through the store's `deleteDay`.
   */
  function confirmDeleteDay() {
    const target = pendingDeleteDay;
    setPendingDeleteDay(null);
    if (!target) return;
    // Dispatch the VM's own deleteDay command (its target already names the owning animal — the
    // selected animal's OK row — so the store can clean the index even for a record with no
    // `animalId`). The command layer forwards it as `deleteDay(dayId, ownerAnimalId)`.
    run[target.command.id]?.(target.command);
  }

  /**
   * Open the delete confirm for a day's `deleteDay` command, assembling the display descriptor (date /
   * session id / downloaded-artifacts caveat) from the live record. The command (with its target) is
   * stashed for dispatch on confirm — the day list bubbles up the row's own descriptor.
   */
  function openDeleteDay(command: WorkflowCommand) {
    const dayId = command.target?.dayId;
    if (!dayId) return;
    const rec = days[dayId];
    setPendingDeleteDay({
      command,
      dayId,
      date: rec?.date,
      sessionId: getDaySession(rec).session_id as string | undefined,
      hasArtifacts: dayHasArtifacts(rec),
    });
  }

  /**
   * Open the single-date duplicate picker for a source row's `duplicateDay` command (resets any prior
   * chosen date/error). The command is stashed for dispatch on confirm.
   */
  function openDuplicateDay(command: WorkflowCommand) {
    const dayId = command.target?.dayId;
    if (!dayId) return;
    setDuplicateDate('');
    setDuplicateError('');
    setPendingDuplicateDay({ dayId, date: days[dayId]?.date, command });
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
      // Dispatch the source row's own duplicateDay command with the chosen date as transient input.
      run[source.command.id]?.(source.command, { date: duplicateDate });
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
  function handleRepair(notice: RecoveryNoticeViewModel) {
    if (!selectedAnimalId) return;
    // Run the notice's repair descriptor (an animal-collection reset: resetAnimalCameras /
    // resetDataAcqDevice / rebuildConfigurationHistory) through the command layer's repair adapter,
    // which delegates to the SAME `applyRepairCommand` executor as before — no parallel dispatcher.
    applyRepair(
      {
        actions: actions as unknown as CommandActions,
        animalId: selectedAnimalId,
        animal: selectedAnimal ?? undefined,
      },
      notice.repair
    );
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
    // Present-day dates (ok + recovered-unlinked) from the view-model rows so the calendar's
    // duplicate-date guard accounts for recovered records too, not just the index — otherwise a
    // recovered day's date could be re-created as a collision.
    return (vm.selectedAnimal?.dayRows ?? [])
      .filter((row) => row.recovery === 'ok' || row.recovery === 'recovered_unlinked')
      .map((row) => row.date)
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

  // The view-model's selected-animal slice — present whenever the animal record is (same guard).
  // It owns the setup-card presence, the review state (the corrupt-index / recovered / wrong-owner /
  // raw-collection notices), the day rows, the days-corrupt empty-state flag, and the carry-forward
  // display — this pane no longer re-derives any of them.
  const selected = vm.selectedAnimal;
  if (!selected) return null;
  const { dayRows, setupSections, showSetupCard, daysCorrupt, review, carryForward: carryForwardVm } = selected;

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
            {carryForwardVm.available && (
              <label className={styles.carryForwardToggle}>
                <input
                  type="checkbox"
                  checked={carryForward}
                  onChange={(e) => setCarryForward(e.target.checked)}
                />
                Start each new day from the last day ({carryForwardVm.lastDayDate}) — review &amp;
                adjust per day
              </label>
            )}
          </div>
        </header>

        {/* First-run "Set up this animal" card + the (separate) existing-data review state.
            The card is the LOUD onboarding affordance for a new/under-configured animal; the
            review state is a different concern (recovered/imported review). Both read the SAME
            view-model the builder derives. */}
        {showSetupCard && (
          <AnimalSetupCard
            sections={setupSections}
            hasOtherAnimals={hasOtherAnimals}
            onCopyFromAnimal={() => setCopyDialogOpen(true)}
          />
        )}

        {review && <ExistingDataReview review={review} onRepair={handleRepair} />}

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
        {dayRows.length > 0 && <DayLifecycleLegend />}

        <DayList
          rows={dayRows}
          daysCorrupt={daysCorrupt}
          animalId={selectedAnimalId}
          onRepairCommand={(command) => run[command.id]?.(command)}
          onDuplicateDay={openDuplicateDay}
          onDeleteDay={openDeleteDay}
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
