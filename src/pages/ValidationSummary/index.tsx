/**
 * Validation Summary — cross-day overview of every recording day in the workspace.
 *
 * Lists every day across all animals with a per-day status chip derived from the
 * SAME validation the Day Editor uses ({@link buildRows} → `mergeDayMetadata` + `computeStepStatus`),
 * surfaces valid / error / incomplete counts, and offers two batch actions:
 *
 * - **Validate All** recomputes status for every animal's RECORDING day (recovery status `ok`)
 *   and persists the outcome onto `day.state.validated` so reload and other views agree. Recovered/
 *   wrong-owner/dangling rows are intentionally skipped and the result message names how many.
 * - **Export Valid Only** downloads each fully-valid day's YAML through the same byte-for-byte
 *   shadow-export parity gate the single-day Export step uses; a day that fails parity in strict
 *   mode is skipped and reported with its diff, never downloaded.
 *
 * Phase 9c split this file (formerly ~1100 LOC) into focused pieces with no behavior change:
 *   - {@link module:pages/ValidationSummary/validationSummaryRows} — the pure row-building/display helpers;
 *   - {@link module:pages/ValidationSummary/useValidationSummaryActions} — the batch-action state + handlers;
 *   - `ExportReport` / `BatchExportPreflight` / `DayStatusTable` — the presentational pieces.
 * This module owns the page composition.
 *
 * @module pages/ValidationSummary
 */

import { useMemo } from 'react';
import type { ElementType } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import type { Animal, Day } from '../../state/workspaceTypes';
import { buildValidationSummaryViewModel } from '../../viewModels/validationSummaryViewModel';
import { commandHandlers } from '../../viewModels/commands';
import type { CommandActions } from '../../viewModels/commands';
import DayLifecycleLegend from '../../components/DayLifecycleLegend/DayLifecycleLegend';
import { buildRows, buildAnimalRows } from './validationSummaryRows';
import { useValidationSummaryActions } from './useValidationSummaryActions';
import ExportReport from './ExportReport';
import BatchExportPreflight from './BatchExportPreflight';
import DayStatusTable from './DayStatusTable';
import styles from './ValidationSummary.module.css';

// Back-compat: the per-animal AnimalView "Validation & Export" tab and the row tests import these
// from this module. The implementations now live in `./validationSummaryRows` (Phase 9c).
export { buildRows, buildAnimalRows };

/**
 * Validation Summary — workspace-global by default, or scoped to one animal when `animalKey` is
 * given (the per-animal "Validation & Export" tab, Phase 3-5). The scoped mode is a FILTER over the
 * same rows + the same batch actions (validate / export-valid / preflight) — never a forked
 * validation path. When scoped it renders WITHOUT its own `<main id="main-content">` (the embedding
 * AnimalView already owns the page landmark) and swaps the page heading for a scoped header.
 *
 * When `animalKey` is set, shows only this animal's rows in an embeddable section; when omitted,
 * the standalone workspace-global page.
 */
export function ValidationSummary({ animalKey }: { animalKey?: string } = {}) {
  const { model, actions } = useStoreContext();
  const workspace = model.workspace;
  const scoped = animalKey != null;

  // Recomputed from the workspace on every render — chips/counts are always current. Scoped mode is
  // a pure filter (buildAnimalRows) so its chips are identical to the global summary's.
  const rows = useMemo(
    () => (scoped ? buildAnimalRows(workspace, animalKey as string) : buildRows(workspace)),
    [workspace, scoped, animalKey]
  );

  // The page view-model: the valid/error/incomplete counts, the per-day rows (status, label,
  // recovery, scan cells), the batch-action affordances + their disabled reasons, and the empty /
  // re-link notes — all decided in the builder, so this page renders them rather than re-deriving.
  const vm = useMemo(
    () => buildValidationSummaryViewModel(workspace, scoped ? (animalKey as string) : undefined),
    [workspace, scoped, animalKey]
  );

  // Raw { animal, day } records for the scoped EffectiveDayReview expander (it does its own merge);
  // every other rendered value comes from the view-model. Keyed by day id.
  const effectiveRecords = useMemo(() => {
    const map: Record<string, { animal: Animal; day: Day }> = {};
    for (const row of rows) {
      const id = (row.day as { id?: string }).id;
      if (typeof id === 'string') {
        map[id] = { animal: row.animal as unknown as Animal, day: row.day as unknown as Day };
      }
    }
    return map;
  }, [rows]);

  // The batch-action controller: the Validate All / Export Valid Only handlers + their per-run
  // feedback state (status message, the five per-day reports, the preflight, the warning ack).
  const {
    actionMessage,
    skippedReport,
    overriddenReport,
    failedReport,
    staleReport,
    validateErrorReport,
    pendingExport,
    warningsAcknowledged,
    setWarningsAcknowledged,
    handleValidateAll,
    handleExportValidOnly,
    cancelExport,
    runExport,
  } = useValidationSummaryActions({ rows, workspace, actions });

  // The day-reference repairs route through the descriptor command layer (one named write surface)
  // rather than calling the store actions directly. The row's (animalId, dayId) is the descriptor
  // target the builder would carry.
  const run = useMemo(() => commandHandlers({ actions: actions as unknown as CommandActions }), [actions]);

  const hasDays = vm.days.length > 0;

  // When nothing is exportable (no valid days) BUT there are days with errors, "Export Valid
  // Only" would be inert — one click reports "Exported 0 files" with no fix path. The builder
  // disables it with an accessible reason instead, so the affordance doesn't mislead. (With 0 valid
  // and only INCOMPLETE days — no errors — the button stays enabled: clicking gives the "complete the
  // required fields" guidance, which is the right next step there.)
  const exportValidDisabledReason = vm.batchExport.exportValid.disabledReason;
  const exportValidDisabled = exportValidDisabledReason != null;

  // Scoped (embedded in AnimalView) renders a section + a scoped header — NOT a second
  // `<main id="main-content">` (AnimalView owns the page landmark) and NOT the page-level h1.
  const Wrapper: ElementType = scoped ? 'section' : 'main';
  const wrapperProps = scoped
    ? { className: `validation-summary ${styles.scoped}`, 'aria-label': 'Validation and export for this animal' }
    : { id: 'main-content', tabIndex: -1, role: 'main', 'aria-labelledby': 'validation-heading' };

  return (
    <Wrapper {...wrapperProps}>
      {scoped ? (
        <header className={styles.scopedHeader}>
          <h2>This animal — readiness &amp; export</h2>
          <p className={styles.scopedSubhead} data-testid="validation-scope">
            {vm.scope.subhead}
          </p>
          {/* This tab handles ONE animal; the cross-animal batch preflight + export lives at the
              chrome-level Validation & Export screen (Task 4.4) — link up to it so the relationship
              is explicit, not hidden. */}
          <p className={styles.scopedUplink}>
            <a href="#/validation">Validate &amp; export all animals →</a>
          </p>
        </header>
      ) : (
        <h1 id="validation-heading">Validation Summary</h1>
      )}

      {!hasDays ? (
        <p className={styles.empty}>
          {vm.empty?.message}
          {/* The workspace link is navigation chrome shown only on the global page (the scoped tab
              already lives inside an animal). */}
          {!scoped && (
            <>
              {' '}
              <a href="#/workspace">Go to Workspace</a>.
            </>
          )}
        </p>
      ) : (
        <>
          <p data-testid="summary-counts" className={styles.counts}>
            <span className={`${styles.count} ${styles.countValid}`}>{vm.counts.valid} valid</span>
            {' / '}
            <span className={`${styles.count} ${styles.countError}`}>{vm.counts.error} with errors</span>
            {' / '}
            <span className={`${styles.count} ${styles.countIncomplete}`}>{vm.counts.incomplete} incomplete</span>
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleValidateAll}
              title="Save the current validation status for each recording day so it persists across reloads and other views. Recovered and wrong-owner days are skipped (they aren't this animal's recording days)."
            >
              Validate All
            </button>
            <button
              type="button"
              onClick={handleExportValidOnly}
              disabled={exportValidDisabled}
              aria-describedby={exportValidDisabled ? 'export-valid-disabled-reason' : undefined}
              title={
                exportValidDisabled
                  ? exportValidDisabledReason
                  : "Download YAML for every valid day that is part of an animal's day list. Days with errors or incomplete fields are not exported; recovered days not in the list must be re-linked first."
              }
            >
              Export Valid Only
            </button>
            {exportValidDisabled && (
              // Accessible disabled reason: a disabled control is not announced on hover by SRs, so
              // pair it with a visible, programmatically-associated explanation (aria-describedby).
              <p
                id="export-valid-disabled-reason"
                className={`${styles.hint} validation-summary-disabled-reason`}
              >
                {exportValidDisabledReason}
              </p>
            )}
          </div>

          {/* Details on demand (Phase 8A-3): the full export rules are reference material, not
              needed to take the action, so they live behind a collapsed disclosure — the actions
              and counts above stay visually dominant. The task-critical disabled reason stays
              inline (shown only when Export is blocked). */}
          <details className={`${styles.hint} ${styles.exportHelp}`}>
            <summary>What gets exported?</summary>
            <p>
              <strong>Export Valid Only</strong> downloads one YAML file per day that passes every
              check (status <em>Ready to export</em>, <em>Validated</em>, or <em>Exported</em>) and
              is part of an animal&apos;s day list. Days with errors or incomplete fields are not
              exported; a recovered day marked <em>not in day list</em> must be re-linked
              (&quot;Add to day list&quot;) before it can be exported.
            </p>
          </details>

          {/* The re-link rule is reference material in the disclosure above EXCEPT when a recovered
              day is actually present (the builder sets relinkNote) — then it is task-critical
              (Export Valid Only silently skips it), so surface it inline rather than behind the
              disclosure. */}
          {vm.relinkNote && (
            <p className={`${styles.hint} validation-summary-relink-note`} role="note">
              Some recovered days are <em>not in a day list</em> — re-link them
              (&quot;Add to day list&quot;) before they can be exported.
            </p>
          )}

          {pendingExport && (
            <BatchExportPreflight
              pendingExport={pendingExport}
              warningsAcknowledged={warningsAcknowledged}
              onAcknowledgeChange={setWarningsAcknowledged}
              onConfirm={runExport}
              onCancel={cancelExport}
            />
          )}

          {/* Polite live region for batch-action completion announcements. */}
          <div
            role="status"
            aria-atomic="true"
            className={styles.status}
          >
            {actionMessage}
          </div>

          <ExportReport
            className="validation-summary-validate-errors"
            detailLabel="Validation error"
            message={
              validateErrorReport.length === 1
                ? '1 day could not be validated and was left unchanged — repair it, then run Validate All again:'
                : `${validateErrorReport.length} days could not be validated and were left unchanged — repair them, then run Validate All again:`
            }
            items={validateErrorReport}
          />

          <ExportReport
            className={styles.skipped}
            detailLabel="Export parity diff"
            message={
              skippedReport.length === 1
                ? '1 day was skipped — its export parity check failed, so it was not downloaded:'
                : `${skippedReport.length} days were skipped — their export parity checks failed, so they were not downloaded:`
            }
            items={skippedReport}
          />

          <ExportReport
            className={styles.overridden}
            detailLabel="Export parity diff"
            message={
              overriddenReport.length === 1
                ? '1 file was downloaded despite a parity mismatch (strict mode off):'
                : `${overriddenReport.length} files were downloaded despite parity mismatches (strict mode off):`
            }
            items={overriddenReport}
          />

          <ExportReport
            className={styles.failed}
            detailLabel="Export error"
            message={
              failedReport.length === 1
                ? '1 day could not be exported (an error occurred) and was not downloaded:'
                : `${failedReport.length} days could not be exported (errors occurred) and were not downloaded:`
            }
            items={failedReport}
          />

          <ExportReport
            className="validation-summary-stale"
            detailLabel="Reason"
            message={
              staleReport.length === 1
                ? '1 day changed after the preflight and was not exported:'
                : `${staleReport.length} days changed after the preflight and were not exported:`
            }
            items={staleReport}
          />

          {/* One shared legend defining the lifecycle status words (Ready to export / Validated /
              Exported / …) — collapsed by default so it explains the chips on demand without
              crowding the table. The same component sits on Animal Days, so the vocabulary is
              defined once. */}
          <DayLifecycleLegend />

          <DayStatusTable
            rows={vm.days}
            scoped={scoped}
            effectiveRecords={effectiveRecords}
            onRemoveDayReference={(animalId, dayId) =>
              run.removeDayReference({ id: 'removeDayReference', target: { animalId, dayId } })
            }
            onUnlinkDayReference={(animalId, dayId) =>
              run.unlinkDayReference({ id: 'unlinkDayReference', target: { animalId, dayId } })
            }
            onRelinkDayReference={(animalId, dayId) =>
              run.relinkDayReference({ id: 'relinkDayReference', target: { animalId, dayId } })
            }
          />
        </>
      )}
    </Wrapper>
  );
}

export default ValidationSummary;
