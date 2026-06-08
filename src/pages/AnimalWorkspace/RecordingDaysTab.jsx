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
 * Landmark-neutral: it renders only the pane content + its confirm dialogs (NOT a `<main>`),
 * so each host owns its single `#main-content`.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { getAnimalDayIds, getConfigHistory, getDaySession } from '../../state/workspaceSelectors';
import { getAnimalSetupChecklist, getDayRowStatus, SETUP_STATE } from '../../domain/workflowStatus';
import { classifyAnimalDays, DAY_STATUS, describeOwner, isPresentRecordStatus } from '../../domain/dayRecovery';
import { validateDay } from '../../domain/validation';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { validateRawAnimal } from '../../validation/rawShape';
import { applyRepairCommand } from '../../state/repairCommands';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import { CalendarDayCreator } from '../../components/CalendarDayCreator/CalendarDayCreator';
import { ConfirmDialog } from '../../components/Modal';

/**
 * Shared "what deletion does NOT touch" caveat for any day/animal that has been validated or
 * exported. The store only holds workspace metadata — it never had the downloaded artifacts —
 * so deleting here cannot and does not remove them. Naming each downstream artifact keeps the
 * user from believing local cleanup also unpublishes data.
 */
const DOWNSTREAM_NOT_DELETED_NOTE =
  ' This removes workspace metadata only — it does not delete any YAML you already downloaded, ' +
  'or any NWB file, DANDI asset, or Spyglass rows produced from it.';

/** User-facing label for each setup-checklist item state. */
const SETUP_STATE_LABEL = {
  [SETUP_STATE.NOT_STARTED]: 'Not started',
  [SETUP_STATE.NEEDS_REVIEW]: 'Needs review',
  [SETUP_STATE.HAS_ERRORS]: 'Has errors',
  [SETUP_STATE.COMPLETE]: 'Complete',
};

/**
 * The Animal Editor route an action targets, deep-linked to the owning step via the field
 * hint (`?field=…`, resolved by `animalEditorStepForFieldPath`). Items with no editor target
 * (subject, days) return null and render as a state row without a button.
 *
 * @param {string} animalId
 * @param {{ fieldHint: (string|null) }} action
 * @returns {string|null}
 */
function setupActionHref(animalId, action) {
  if (!action?.fieldHint) return null;
  return `#/animal/${animalId}/editor?field=${action.fieldHint}`;
}

/**
 * Collect the error-severity issues that drive the setup checklist's per-item `has_errors`:
 * the animal's raw-shape corruption PLUS the setup validation errors surfaced by validating
 * each of its days (electrode geometry, camera/data-acq identity, etc. only manifest through
 * the merged day). `mergeDayMetadata` throws on a corrupt/missing configuration; that day is
 * skipped (the corruption is already surfaced by the review banner / raw issues).
 *
 * @param {object} animal - The selected animal.
 * @param {object} days - The workspace `days` record.
 * @returns {Array} Error-severity validation issues for the animal's setup.
 */
function collectAnimalSetupIssues(animal, days) {
  const issues = [...validateRawAnimal(animal)];
  for (const dayId of getAnimalDayIds(animal)) {
    const dayRecord = days[dayId];
    if (!dayRecord) continue;
    try {
      const merged = mergeDayMetadata(animal, dayRecord);
      for (const issue of validateDay(dayRecord, merged, animal)) {
        if (issue.severity === 'error') issues.push(issue);
      }
    } catch (err) {
      // Corrupt/missing configuration — the blocking issue is already surfaced by the review
      // banner / raw issues, so this aggregation skips the day. Log (debug) so the swallowed
      // reason is still discoverable rather than vanishing entirely.
      // eslint-disable-next-line no-console
      console.debug(`[animal-workspace] skipped setup-issue aggregation for day "${dayId}":`, err);
    }
  }
  return issues;
}

/**
 * Whether a day record has been validated or exported — i.e. it may have produced a downloaded
 * YAML / downstream NWB. Drives whether a delete confirmation shows the "downloaded artifacts are
 * not deleted" caveat. Tolerates a malformed (non-object) `state` on a recovered record.
 *
 * @param {object} record - A day record.
 * @returns {boolean} True if the day is validated or exported.
 */
function dayHasArtifacts(record) {
  const state = record?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  return !!state.validated || !!state.exported;
}

/**
 * RecordingDaysTab Component
 *
 * Renders one animal's recording-days management surface. The owning host decides which animal
 * is shown (legacy Workspace selection vs. the `#/animal/:id/days` route) and passes its id.
 *
 * @param {object} props
 * @param {string} props.animalId - The animal whose recording days to manage.
 * @returns {React.Element|null}
 */
export function RecordingDaysTab({ animalId }) {
  const { model, actions } = useStoreContext();
  // Alias the prop to the original local-state name so the extracted pane body transfers
  // verbatim from AnimalWorkspace (lowest-risk extraction; the 34 workspace tests pin it).
  const selectedAnimalId = animalId;
  const [showCalendar, setShowCalendar] = useState(false);
  // Pending destructive confirms (null when closed). Animal: the id to delete. Day: a small
  // descriptor of the row (so the confirm can name it even after the store row changes).
  const [pendingDeleteAnimalId, setPendingDeleteAnimalId] = useState(null);
  const [pendingDeleteDay, setPendingDeleteDay] = useState(null);

  const { animals = {}, days = {} } = model.workspace;

  const selectedAnimal = selectedAnimalId ? animals[selectedAnimalId] : null;
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
  const selectedDayClassification = selectedAnimal
    ? classifyAnimalDays(selectedAnimalId, selectedAnimal, days)
    : [];
  const selectedOrphanDayIds = selectedDayClassification
    .filter((d) => d.status === DAY_STATUS.RECOVERED_UNLINKED)
    .map((d) => d.dayId);
  // Days indexed by THIS animal whose record belongs to a different animal (wrong owner). Surfaced
  // with a repair so the user can unlink them, not silently shown as ordinary recording days.
  const selectedWrongOwnerDayIds = selectedDayClassification
    .filter((d) => d.status === DAY_STATUS.WRONG_OWNER)
    .map((d) => d.dayId);

  // Cascade preview for "Delete animal". The store's guarded `deleteAnimal` walks ONLY the
  // animal's day INDEX (`getAnimalDayIds`), so it removes exactly the OK days (index-resident,
  // record present, owned). It does NOT touch wrong-owner records (preserved — they belong to
  // another animal) NOR recovered-unlinked records (those are not in the index, so they survive
  // as orphans). The count must therefore be OK-only — counting recovered-unlinked here would
  // promise a deletion the store does not perform. The surviving recovered records get their own
  // honest note below.
  const selectedDeletableDays = selectedDayClassification.filter(
    (d) => d.status === DAY_STATUS.OK
  );
  const selectedOwnedDayCount = selectedDeletableDays.length;
  const selectedOwnedHasArtifacts = selectedDeletableDays.some((d) => dayHasArtifacts(d.record));

  /**
   * Commit the pending animal deletion through the store's guarded `deleteAnimal` (which
   * preserves wrong-owner records). The host owns selection, so there is nothing to clear here.
   */
  function confirmDeleteAnimal() {
    const id = pendingDeleteAnimalId;
    setPendingDeleteAnimalId(null);
    if (!id) return;
    actions.deleteAnimal(id);
  }

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
   * Execute a raw-shape corruption repair in place (same executor the editor banners use),
   * so recovered/imported corruption can be cleared from the review state without leaving the
   * workspace.
   *
   * @param {object} issue - A raw-shape issue carrying a `repairCommand`.
   */
  function handleRepair(issue) {
    if (!issue?.repairCommand || !selectedAnimalId) return;
    applyRepairCommand(issue.repairCommand, {
      actions,
      animalId: selectedAnimalId,
      animal: selectedAnimal,
    });
  }

  /**
   * Handle creating multiple recording days from calendar
   * @param {string[]} dates - Array of ISO date strings (YYYY-MM-DD)
   */
  async function handleCreateDays(dates) {
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
        actions.createDay(selectedAnimalId, date, {
          session_id: sessionId,
          session_description: `Recording session for ${selectedAnimalId} on ${date}`,
        });
        existingIds.add(dayId);
      } catch (error) {
        console.error(`Failed to create day ${date}:`, error);
        throw new Error(`Failed to create day ${date}: ${error.message}`);
      }
    }
  }

  /**
   * Toggle calendar visibility
   */
  function handleToggleCalendar() {
    setShowCalendar(!showCalendar);
  }

  /**
   * Get existing days for selected animal
   * @returns {string[]} Array of ISO date strings
   */
  function getExistingDays() {
    if (!selectedAnimal) return [];
    // Use the recovery classifier so the calendar's duplicate-date guard accounts for recovered
    // records too (ok + recovered-unlinked), not just the index — otherwise a recovered day's
    // date could be re-created as a collision. Tolerates a malformed/missing index.
    return selectedDayClassification
      .filter(
        (d) => isPresentRecordStatus(d.status)
      )
      .map((d) => d.record?.date)
      .filter(Boolean);
  }

  // The host renders this only for a present animal; guard defensively so a stale/cold id
  // resolves to nothing rather than crashing on `selectedAnimal.id`.
  if (!selectedAnimal) return null;

  return (
    <>
      {/* Selected Animal: Day List */}
      <div>
        <header className="day-list-header">
          <h2 id="day-list-heading">
            Recording Days for {selectedAnimal.id}
          </h2>
          <div className="day-actions">
            <button
              className="btn-primary"
              onClick={handleToggleCalendar}
              aria-label={showCalendar ? 'Hide calendar' : 'Show calendar'}
              aria-expanded={showCalendar}
            >
              {showCalendar ? 'Hide Calendar' : 'Add Recording Days'}
            </button>
          </div>
        </header>

        {/* Setup checklist — shared animal hardware, the operational home for setup.
            Electrode setup is a first-class action here so it is discoverable without
            opening the Animal Editor or a recording day. */}
        {(() => {
          // Raw-shape corruption drives the existing-data review state below; the full
          // setup-issue set (raw corruption + per-day setup validation errors) drives
          // the checklist's per-item has_errors so a real setup error (empty location,
          // divergent camera/data-acq identity, …) badges its owning item, not just
          // structural corruption.
          const rawIssues = validateRawAnimal(selectedAnimal);
          const setupIssues = collectAnimalSetupIssues(selectedAnimal, days);
          // Count the recording-day RECORDS actually present (indexed + recovered), not
          // just the index length — otherwise a missing/corrupt index would say "Found 0
          // recording days" while recovered records render below. The checklist's
          // "Recording days" item consumes the SAME count so the two never disagree.
          const dayCount = selectedDayClassification.filter(
            (d) => isPresentRecordStatus(d.status)
          ).length;
          const checklist = getAnimalSetupChecklist(selectedAnimal, {
            issues: setupIssues,
            recordingDayCount: dayCount,
          });
          const electrodes = checklist.find((i) => i.key === 'electrodes');
          const needsElectrodeSetup = electrodes?.state === SETUP_STATE.NOT_STARTED;
          const configCount = getConfigHistory(selectedAnimal).length;
          // Existing data needs an explicit review state: recovered/imported setup must
          // not look silently trusted. Show it once there ARE recording days to export,
          // or whenever raw-shape corruption OR a corrupt days reference is present.
          const hasCorruption =
            rawIssues.length > 0 ||
            selectedDaysCorrupt ||
            selectedOrphanDayIds.length > 0 ||
            selectedWrongOwnerDayIds.length > 0;
          const showReview = dayCount > 0 || hasCorruption;
          return (
            <>
              <section className="setup-checklist" aria-label="Animal setup">
                <h3 className="setup-checklist-heading">Animal setup</h3>
                <p className="setup-checklist-intro">
                  {needsElectrodeSetup
                    ? 'Set up shared hardware before creating or exporting recording days. ' +
                      "Electrodes/probes are configured once for the animal and shared across all of its days."
                    : 'Shared hardware for this animal. Review recovered or imported setup before exporting.'}
                </p>
                <ul className="setup-checklist-list">
                  {checklist.map((item) => {
                    const href = setupActionHref(selectedAnimalId, item.action);
                    const isPrimary =
                      item.key === 'electrodes' && item.state === SETUP_STATE.NOT_STARTED;
                    return (
                      <li key={item.key} className={`setup-item setup-item-${item.state}`}>
                        <span className="setup-item-label">{item.label}</span>
                        <span className={`setup-state-badge setup-state-${item.state}`}>
                          {SETUP_STATE_LABEL[item.state]}
                        </span>
                        <span className="setup-item-summary">{item.summary}</span>
                        {href && (
                          <a
                            href={href}
                            className={`setup-item-action ${isPrimary ? 'setup-item-action-primary' : ''}`}
                          >
                            {item.action.label}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {showReview && (
                <section
                  className={`existing-data-review ${hasCorruption ? 'existing-data-review-corrupt' : ''}`}
                  aria-label="Existing data review"
                >
                  <h3 className="existing-data-review-heading">Review existing data</h3>
                  <p className="existing-data-review-intro">
                    Found {dayCount} recording {dayCount === 1 ? 'day' : 'days'} and{' '}
                    {configCount} hardware {configCount === 1 ? 'configuration' : 'configurations'} for{' '}
                    {selectedAnimal.id}.{' '}
                    {hasCorruption
                      ? 'Some saved data is corrupt — resolve it before exporting.'
                      : 'Review electrodes and cameras before exporting to confirm they match this animal.'}
                  </p>
                  {/* Corrupt recording-day reference: the list isn't an array, so the days
                      can't be shown. Not folded into the day export gate (the day RECORDS
                      are fine; only the animal's index is corrupt) — surfaced here for
                      re-import/recreation. */}
                  {selectedDaysCorrupt && (
                    <p className="existing-data-review-corrupt-note" role="alert">
                      This animal&apos;s recording-day list is corrupt (expected a list), so
                      its index can&apos;t be read.{' '}
                      {selectedOrphanDayIds.length > 0
                        ? 'The recovered day records below are shown from the day store directly.'
                        : 'Re-import or recreate this animal’s data.'}
                    </p>
                  )}
                  {selectedOrphanDayIds.length > 0 && (
                    <p className="existing-data-review-corrupt-note" role="alert">
                      {selectedOrphanDayIds.length} recovered recording{' '}
                      {selectedOrphanDayIds.length === 1 ? 'day is' : 'days are'} not listed in
                      this animal&apos;s day index (shown below as &quot;not in day list&quot;).{' '}
                      <a href="#/validation">Open the validation summary</a> to re-link{' '}
                      {selectedOrphanDayIds.length === 1 ? 'it' : 'them'}.
                    </p>
                  )}
                  {selectedWrongOwnerDayIds.length > 0 && (
                    <p className="existing-data-review-corrupt-note" role="alert">
                      {selectedWrongOwnerDayIds.length} day{' '}
                      {selectedWrongOwnerDayIds.length === 1 ? 'is' : 'are'} listed here but
                      belong to a different animal (shown below as &quot;belongs to …&quot;).
                      They are not exported with this animal — remove them from this
                      animal&apos;s list.
                    </p>
                  )}
                  {/* Reuse the shipped recovery surface: executable resets for corrupt
                      animal-owned collections. Self-hides when there is no corruption. */}
                  <RawCorruptionBanner
                    animal={selectedAnimal}
                    fields={['cameras', 'data_acq_device', 'configurationHistory']}
                    onRepair={handleRepair}
                  />
                  <a className="existing-data-review-link" href="#/validation">
                    Open validation summary
                  </a>
                </section>
              )}
            </>
          );
        })()}

        {/* Calendar for creating multiple days */}
        {showCalendar && (
          <div className="calendar-container">
            <CalendarDayCreator
              animalId={selectedAnimalId}
              existingDays={getExistingDays()}
              onCreateDays={handleCreateDays}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        )}

        {(() => {
          // Render straight from the domain classification (ok / dangling_reference /
          // recovered_unlinked), so the list shows recovered records (never hidden behind
          // "No recording days yet") and every row's kind is the single domain truth.
          if (selectedDayClassification.length === 0) {
            return selectedDaysCorrupt ? (
              /* Corrupt index AND no recoverable records — see the review state above. */
              <div className="empty-state">
                <p>This animal&apos;s recording-day list is corrupt and can&apos;t be shown.</p>
                <p>See &quot;Review existing data&quot; above to resolve it.</p>
              </div>
            ) : (
              /* Empty State: No Days */
              <div className="empty-state">
                <p>No recording days yet.</p>
                <p>Add your first recording day to get started.</p>
              </div>
            );
          }
          return (
          /* Day List */
          <ul className="day-list" role="list">
            {selectedDayClassification.map(({ dayId, record, status }) => {
              // A dangling reference (no record) is surfaced, not dropped — otherwise a
              // recovered day disappears. Consistent with the cross-day Validation summary.
              if (status === DAY_STATUS.DANGLING_REFERENCE) {
                return (
                  <li key={dayId} className="day-item day-item-missing">
                    <div className="day-link day-link-missing" role="alert">
                      <div className="day-info">
                        <span className="day-date">{dayId}</span>
                        <span className="day-session-id">
                          Saved record missing or corrupt —{' '}
                          <a href="#/validation">review in the validation summary</a>.
                        </span>
                      </div>
                      <div className="day-status">
                        <span className="status-chip error">Missing record</span>
                      </div>
                    </div>
                  </li>
                );
              }

              // Wrong owner: indexed here but the record belongs to another animal. Don't
              // render it as an ordinary recording day (that implies it's this animal's and
              // exportable). Surface a warning + an in-place unlink repair.
              if (status === DAY_STATUS.WRONG_OWNER) {
                return (
                  <li key={dayId} className="day-item day-item-missing">
                    <div className="day-link day-link-missing" role="alert">
                      <div className="day-info">
                        <span className="day-date">{record.date || dayId}</span>
                        <span className="day-session-id">
                          Belongs to {describeOwner(record.animalId)} — listed here by mistake; not
                          exported with this animal.
                        </span>
                      </div>
                      <div className="day-status">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => actions.unlinkDayReference(selectedAnimalId, dayId)}
                          aria-label={`Remove ${record.date || dayId} from ${selectedAnimalId} (belongs to ${describeOwner(record.animalId)})`}
                        >
                          Remove from this animal
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }

              const isOrphan = status === DAY_STATUS.RECOVERED_UNLINKED;
              // Guard session: a recovered day can carry a malformed (scalar/array) session,
              // which a raw `.session_description` read would crash on (getDaySession → {}).
              const date = record.date;
              const session = getDaySession(record);
              // Decision 12: the row is triage. session description rides under the date ONLY
              // when present (a recognition aid, never a hole when absent), truncated by CSS.
              const sessionDescription =
                typeof session.session_description === 'string'
                  ? session.session_description.trim()
                  : '';
              // ONE plain-language status, read-only over the SAME export gate the day editor
              // uses (per row), so a day that went stale (validated/exported before a referenced
              // camera broke) reads the honest "Needs fixing", not a stale flag. mergeDayMetadata
              // throws on a corrupt/missing configuration — caught here and surfaced as a
              // needs-fixing row by getDayRowStatus(…, null), never a crash.
              let mergedDay = null;
              try {
                mergedDay = mergeDayMetadata(selectedAnimal, record);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.debug(`[recording-days] could not merge day "${dayId}" for status:`, err);
              }
              const rowStatus = getDayRowStatus(selectedAnimal, record, mergedDay);

              return (
                <li key={dayId} className={`day-item ${isOrphan ? 'day-item-orphan' : ''}`}>
                  <a href={`#/day/${dayId}`} className="day-link">
                    <div className="day-info">
                      <span className="day-date">
                        {date}
                        {isOrphan && (
                          <span className="day-orphan-note"> ⚠ not in day list</span>
                        )}
                      </span>
                      {sessionDescription && (
                        <span className="day-session-desc" title={sessionDescription}>
                          {sessionDescription}
                        </span>
                      )}
                    </div>
                    <div className="day-status">
                      <span className={`day-row-status day-row-status-${rowStatus.variant}`}>
                        {rowStatus.label}
                      </span>
                    </div>
                  </a>
                  {/* Lifecycle cleanup (Task 8): a secondary/destructive delete, OUTSIDE
                      the navigation link (not nested in the <a>) so it can't be hit while
                      opening the day. Only on ordinary (OK) rows — recovered/wrong-owner
                      rows have their own repair paths above. */}
                  {status === DAY_STATUS.OK && (
                    <div className="day-item-actions">
                      <button
                        type="button"
                        className="btn-danger-text"
                        onClick={() =>
                          setPendingDeleteDay({
                            dayId,
                            date,
                            sessionId: session.session_id,
                            hasArtifacts: dayHasArtifacts(record),
                          })
                        }
                        aria-label={`Delete recording day ${date || dayId}…`}
                      >
                        Delete day…
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          );
        })()}

        {/* Lifecycle cleanup (Task 8): a secondary/destructive animal delete, set apart
            in its own zone at the foot of the section — discoverable in the animal's
            management area, never adjacent to the primary setup/export actions. */}
        <footer className="workspace-danger-zone">
          {/* Accessible name is "Delete this animal" (no id): the button lives under this
              animal's "Recording Days for X" heading, and the destructive confirm names the
              specific animal + cascade. Embedding the id here would also collide with the
              sidebar animal-card's name for assistive tech / tests. */}
          <button
            type="button"
            className="btn-danger-text"
            onClick={() => setPendingDeleteAnimalId(selectedAnimalId)}
            aria-label="Delete this animal…"
          >
            Delete animal…
          </button>
        </footer>
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteAnimalId != null}
        title="Delete animal?"
        message={
          pendingDeleteAnimalId != null ? (
            <>
              Delete <strong>{pendingDeleteAnimalId}</strong> and its {selectedOwnedDayCount}{' '}
              {selectedOwnedDayCount === 1 ? 'recording day' : 'recording days'}? This removes the
              animal and the recording days it owns from this workspace and from export lists.
              {selectedWrongOwnerDayIds.length > 0 &&
                ` ${selectedWrongOwnerDayIds.length} day ${
                  selectedWrongOwnerDayIds.length === 1 ? 'record' : 'records'
                } listed here by mistake (belonging to another animal) will be preserved.`}
              {selectedOrphanDayIds.length > 0 &&
                ` ${selectedOrphanDayIds.length} recovered day ${
                  selectedOrphanDayIds.length === 1 ? 'record' : 'records'
                } not in this animal's day list will remain in the workspace (resolve them from the validation summary).`}
              {selectedOwnedHasArtifacts && DOWNSTREAM_NOT_DELETED_NOTE} This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete animal"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDeleteAnimal}
        onCancel={() => setPendingDeleteAnimalId(null)}
      />

      <ConfirmDialog
        isOpen={pendingDeleteDay != null}
        title="Delete recording day?"
        message={
          pendingDeleteDay != null ? (
            <>
              Delete recording day <strong>{pendingDeleteDay.date || pendingDeleteDay.dayId}</strong>
              {pendingDeleteDay.sessionId ? ` (${pendingDeleteDay.sessionId})` : ''}? This removes it
              from this workspace and from export lists.
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
    </>
  );
}

RecordingDaysTab.propTypes = {
  animalId: PropTypes.string.isRequired,
};

export default RecordingDaysTab;
