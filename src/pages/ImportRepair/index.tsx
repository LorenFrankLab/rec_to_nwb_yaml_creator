/**
 * Import & Repair (`#/import`).
 *
 * A multi-file, teaching-validation workflow on top of the shared repair planner, batch reconciler,
 * and executor. Files are repaired independently, then every ready file is reconciled together so
 * recording days group by animal and configuration changes are inferred across dates. Nothing is
 * written until the user confirms the final batch preview.
 */

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent as ReactDragEvent, ReactNode } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { parseImportFiles } from '../../features/importYaml';
import {
  buildImportRepairPlan,
  applyImportRepairs,
  collectExistingAnimalCatalogAdditions,
  mergeExistingAnimalCatalogAdditions,
  existingAnimalCatalogResolutionBlocker,
} from '../../state/importRepair';
import type {
  ExistingAnimalCatalogAdditions,
  ImportRepairPlan,
  RepairItem,
} from '../../state/importRepair';
import { planImport } from '../../state/yamlImportPlan';
import type { ImportPlan, ImportPlanAnimal } from '../../state/yamlImportPlan';
import { applyImportPlan } from '../../state/yamlImportApply';
import Button from '../../components/ui/Button';
import { pluralize } from '../../utils/pluralize';
import styles from './ImportRepair.module.css';
import PageShell, { pageShellLedeClass } from '../../components/PageShell';

interface DecodedImportFile {
  sourceName: string;
  flatModel: object;
}

interface RepairFile {
  key: string;
  decoded: DecodedImportFile;
  plan: ImportRepairPlan;
  resolutions: Record<string, unknown>;
}

interface FileAssessment {
  file: RepairFile;
  repaired: object;
  importPlan: ImportPlan;
  ready: boolean;
  reason: string | null;
  unresolvedCount: number;
}

interface ExcludedFile {
  sourceName: string;
  reason: string;
}

interface BatchPreview {
  plan: ImportPlan;
  excluded: ExcludedFile[];
  catalogAdditions: Record<string, ExistingAnimalCatalogAdditions>;
}

interface ImportResult {
  mode: 'single' | 'batch';
  kind?: 'new' | 'add';
  animalIds: string[];
  /** Files that never reached the executor (unreadable, unrepaired, or rejected by the planner). */
  excluded: ExcludedFile[];
  summary: ReturnType<typeof applyImportPlan>;
}

type ConflictResolution = 'add' | 'skip' | 'replace';

/** Whether a user-provided value resolves a repair item. */
function isResolvedValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

/** Render a source/suggested value without losing list values. */
function display(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return String(value);
}

/** A stable, unique key for two selected files that happen to share a basename. */
function fileKey(file: DecodedImportFile, index: number): string {
  return `${index}:${file.sourceName}`;
}

/** Assess one repaired file through the exact same importer used at commit time. */
function assessFile(
  file: RepairFile,
  workspace: { animals?: unknown }
): FileAssessment {
  const repaired = applyImportRepairs(file.decoded.flatModel, file.resolutions);
  const importPlan = planImport(
    [{ sourceName: file.decoded.sourceName, flatModel: repaired }],
    workspace
  );
  const unresolvedCount = file.plan.items.filter(
    (item) => !isResolvedValue(file.resolutions[item.path])
  ).length;
  const reason = blockingReason(file, importPlan, unresolvedCount);

  return { file, repaired, importPlan, ready: reason === null, reason, unresolvedCount };
}

/**
 * Why a repaired file cannot be imported yet, in the order the user should act on: an
 * undecidable file first, then source-file edits, then unanswered rows, then the planner's
 * own refusal. `null` once nothing is left to answer.
 */
function blockingReason(
  file: RepairFile,
  importPlan: ImportPlan,
  unresolvedCount: number
): string | null {
  if (file.plan.decision.kind === 'blocked') return file.plan.decision.reason;
  if (file.plan.blockers.length > 0) {
    return `${file.plan.blockers.length} ${pluralize(file.plan.blockers.length, 'field')} still need source-file editing.`;
  }
  if (unresolvedCount > 0) {
    return `${unresolvedCount} flagged ${pluralize(unresolvedCount, 'field')} still need a response.`;
  }
  const catalogBlocker = existingAnimalCatalogResolutionBlocker(file.plan, file.resolutions);
  if (catalogBlocker) return catalogBlocker;
  if (importPlan.animals.length !== 1) {
    return importPlan.unimportable[0]?.reason ?? 'The repaired file cannot be imported yet.';
  }
  return null;
}

/**
 * Merge the catalog additions of every file the batch plan actually kept.
 *
 * `planImport` can reject an otherwise-ready file (most commonly a duplicate animal/date), so only
 * the files whose day the plan retained contribute — matched by each file's own key, never by
 * basename: two selected files can share one, and matching on it once let an excluded duplicate
 * consume the slot of the retained file that followed it. The identity rule for the rows themselves
 * lives with the executor that enforces it.
 */
function collectBatchCatalogAdditions(
  assessments: FileAssessment[],
  includedSourceKeys: Set<string>
): BatchPreview['catalogAdditions'] {
  return mergeExistingAnimalCatalogAdditions(
    assessments
      .filter((assessment) => assessment.ready && includedSourceKeys.has(assessment.file.key))
      .map((assessment) =>
        collectExistingAnimalCatalogAdditions(assessment.file.plan, assessment.file.resolutions)
      )
  );
}

/** Suggestions in a file the user has neither accepted nor overridden. */
function unansweredSuggestions(file: RepairFile): RepairItem[] {
  return file.plan.items.filter(
    (item) => item.kind === 'suggestion' && !(item.path in file.resolutions)
  );
}

/** Human status shown in the batch file selector. */
function assessmentLabel(assessment: FileAssessment): string {
  if (assessment.ready) return 'Ready';
  if (assessment.file.plan.blockers.length > 0) return 'Source edit needed';
  return 'Needs repair';
}

/** The Import & Repair screen. */
export default function ImportRepair() {
  const { model, actions } = useStoreContext();

  const [phase, setPhase] = useState<'pick' | 'repair' | 'preview' | 'result'>('pick');
  const [files, setFiles] = useState<RepairFile[]>([]);
  const [parseFailures, setParseFailures] = useState<ExcludedFile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickError, setPickError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<
    Record<string, ConflictResolution>
  >({});
  const [result, setResult] = useState<ImportResult | null>(null);

  // Assessing one file runs the full importer (repair → decompose → schema + rule validation), so
  // it is far too expensive to redo for EVERY selected file on every keystroke in one file's repair
  // row. `setResolution`/`acceptSuggestions` return the same object for files they did not touch, so
  // object identity is a sound cache key; the cache is dropped whenever the workspace it was
  // assessed against changes.
  const assessmentCache = useRef({
    workspace: model.workspace,
    entries: new WeakMap<RepairFile, FileAssessment>(),
  });
  const assessments = useMemo(() => {
    if (assessmentCache.current.workspace !== model.workspace) {
      assessmentCache.current = { workspace: model.workspace, entries: new WeakMap() };
    }
    const cache = assessmentCache.current.entries;
    return files.map((file) => {
      const cached = cache.get(file);
      if (cached) return cached;
      const assessment = assessFile(file, model.workspace);
      cache.set(file, assessment);
      return assessment;
    });
  }, [files, model.workspace]);
  const activeAssessment = assessments[activeIndex] ?? null;
  const readyAssessments = assessments.filter((assessment) => assessment.ready);

  /** Decode all selected files and build an independent repair plan for each one. */
  const handleFiles = async (
    selected: File[] | FileList | Array<{ name: string; text: () => Promise<string> }> | null
  ) => {
    const list = Array.from(selected ?? []);
    if (list.length === 0) return;
    setPickError(null);
    const parsed = await parseImportFiles(list as File[]);
    const nextFiles = parsed.decodedFiles.map((decoded, index) => ({
      key: fileKey(decoded, index),
      decoded,
      plan: buildImportRepairPlan(decoded.flatModel, decoded.sourceName, model.workspace),
      resolutions: {},
    }));
    setParseFailures(parsed.parseFailures);
    if (nextFiles.length === 0) {
      setPickError(
        parsed.parseFailures.length === 1
          ? parsed.parseFailures[0].reason
          : `None of the ${list.length} selected files could be read.`
      );
      return;
    }
    setFiles(nextFiles);
    const firstNeedingWork = nextFiles.findIndex(
      (file) => file.plan.items.length > 0 || file.plan.blockers.length > 0
    );
    setActiveIndex(firstNeedingWork >= 0 ? firstNeedingWork : 0);
    setPreview(null);
    setConflictResolutions({});
    setResult(null);
    setPhase('repair');
  };

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    await handleFiles(selected);
  };

  const onDrop = async (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    await handleFiles(event.dataTransfer.files);
  };

  const reset = () => {
    setPhase('pick');
    setFiles([]);
    setParseFailures([]);
    setActiveIndex(0);
    setPickError(null);
    setPreview(null);
    setConflictResolutions({});
    setResult(null);
  };

  const setResolution = (path: string, value: unknown) => {
    const key = activeAssessment?.file.key;
    if (!key) return;
    setFiles((current) =>
      current.map((file) =>
        file.key === key
          ? { ...file, resolutions: { ...file.resolutions, [path]: value } }
          : file
      )
    );
  };

  const acceptSuggestions = (scope: 'active' | 'all') => {
    const activeKey = activeAssessment?.file.key;
    setFiles((current) =>
      current.map((file) => {
        if (scope === 'active' && file.key !== activeKey) return file;
        const suggestions = file.plan.items.filter((item) => item.kind === 'suggestion');
        // Return the SAME object when there is nothing to apply: identity is what keeps this
        // file's (expensive) assessment cached.
        if (suggestions.length === 0) return file;
        return {
          ...file,
          resolutions: {
            ...file.resolutions,
            ...Object.fromEntries(suggestions.map((item) => [item.path, item.suggested])),
          },
        };
      })
    );
  };

  /** Preserve the fast one-file flow while still committing through the shared executor. */
  const handleSingleImport = () => {
    const assessment = assessments[0];
    if (!assessment?.ready) return;
    const repairPlan = assessment.file.plan;
    const existing = repairPlan.decision.kind === 'existing' ? repairPlan.decision : null;
    const subjectId =
      repairPlan.decision.kind === 'blocked' ? '' : repairPlan.decision.subjectId;
    const summary = applyImportPlan(assessment.importPlan, actions, {
      workspace: model.workspace,
      resolutions: existing ? { [subjectId]: 'add' } : {},
      catalogAdditions: collectExistingAnimalCatalogAdditions(
        repairPlan,
        assessment.file.resolutions
      ),
    });
    // `failed` means the executor pre-flight rejected the animal and wrote nothing, so there is
    // no animal to link to — `subjectId` would point at a page that may not exist.
    const animalId =
      summary.failed.length > 0
        ? ''
        : existing
          ? existing.existingAnimalId
          : summary.createdAnimals[0] ?? subjectId;
    setResult({
      mode: 'single',
      kind: existing ? 'add' : 'new',
      animalIds: animalId ? [animalId] : [],
      // Only one file decoded, so everything else the user picked was unreadable.
      excluded: parseFailures,
      summary,
    });
    setPhase('result');
  };

  /** Freeze a final batch plan from every currently-ready file. */
  const openBatchPreview = () => {
    const ready = assessments.filter((assessment) => assessment.ready);
    if (ready.length === 0) return;
    const batchPlan = planImport(
      ready.map((assessment) => ({
        sourceName: assessment.file.decoded.sourceName,
        // The file's own identity, so a planned day can be matched back to it by more than a
        // basename (two selected files may share one).
        sourceKey: assessment.file.key,
        flatModel: assessment.repaired,
      })),
      model.workspace
    );
    const excluded: ExcludedFile[] = [
      ...parseFailures,
      ...assessments
        .filter((assessment) => !assessment.ready)
        .map((assessment) => ({
          sourceName: assessment.file.decoded.sourceName,
          reason: assessment.reason ?? 'This file is not ready.',
        })),
      ...batchPlan.unimportable,
    ];
    setPreview({
      plan: batchPlan,
      excluded,
      catalogAdditions: collectBatchCatalogAdditions(
        ready,
        new Set(batchPlan.animals.flatMap(({ days }) => days.map((day) => day.sourceKey)))
      ),
    });
    setConflictResolutions({});
    setPhase('preview');
  };

  const confirmBatch = () => {
    if (!preview || preview.plan.animals.length === 0) return;
    const summary = applyImportPlan(preview.plan, actions, {
      workspace: model.workspace,
      resolutions: conflictResolutions,
      catalogAdditions: preview.catalogAdditions,
    });
    const failedIds = new Set(summary.failed.map((failure) => failure.subjectId));
    const animalIds = preview.plan.animals
      .filter((animal) => conflictResolutions[animal.subjectId] !== 'skip')
      .filter((animal) => !failedIds.has(animal.subjectId))
      .map((animal) =>
        // `replace` deletes `existingAnimalId` and recreates the animal under `subjectId`, so a
        // case-variant match (`Remy` vs `remy`) leaves the existing id pointing at nothing.
        conflictResolutions[animal.subjectId] === 'replace'
          ? animal.subjectId
          : animal.existingAnimalId ?? animal.subjectId
      );
    setResult({ mode: 'batch', animalIds, excluded: preview.excluded, summary });
    setPhase('result');
  };

  if (phase === 'pick') {
    return (
      <PageFrame heading="Import metadata YAML">
        <p className={pageShellLedeClass}>
          Select one recording day or a whole history. Files are grouped by animal and date so
          configuration changes can be reconstructed before anything is written.
        </p>
        {pickError && <p className={styles.parseError} role="alert">{pickError}</p>}
        <div
          className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <p className={styles.dropTitle}>Drop metadata YAML files here</p>
          <p className={styles.dropHelp}>or choose one or more files from your computer</p>
          <label className={styles.fileLabel} htmlFor="import-repair-file">
            Choose metadata YAML files
          </label>
          <input
            id="import-repair-file"
            className="visually-hidden"
            type="file"
            multiple
            accept=".yml,.yaml"
            aria-label="Choose a metadata YAML file or files"
            onChange={onInputChange}
          />
        </div>
      </PageFrame>
    );
  }

  if (phase === 'result' && result) {
    const failure = result.summary.failed[0]?.reason;
    const singleHeading = failure
      ? 'Import failed'
      : result.kind === 'new'
        ? 'New animal created'
        : 'Recording day added';
    return (
      <PageFrame heading={result.mode === 'single' ? singleHeading : 'Import complete'} result>
        {failure && result.mode === 'single' ? (
          <p className={styles.parseError} role="alert">{failure}</p>
        ) : (
          <p className={pageShellLedeClass}>
            Imported {result.summary.createdDays.length}{' '}
            {pluralize(result.summary.createdDays.length, 'recording day')} across{' '}
            {result.animalIds.length} {pluralize(result.animalIds.length, 'animal')}.
          </p>
        )}
        {result.animalIds.length > 0 && (
          <ul className={styles.resultList} aria-label="Imported animals">
            {result.animalIds.map((animalId) => (
              <li key={animalId}>
                <a className={styles.resultLink} href={`#/animal/${animalId}/days`}>
                  {animalId}
                </a>
              </li>
            ))}
          </ul>
        )}
        {result.summary.failed.length > 0 && result.mode === 'batch' && (
          <IssueList
            label="Import failures"
            heading="Could not import"
            entries={result.summary.failed.map((item) => ({
              subject: item.subjectId,
              reason: item.reason,
            }))}
          />
        )}
        {result.excluded.length > 0 && (
          <IssueList
            label="Files not imported"
            heading={`Not imported (${result.excluded.length} ${pluralize(result.excluded.length, 'file')})`}
            entries={result.excluded.map((entry) => ({
              subject: entry.sourceName,
              reason: entry.reason,
            }))}
          />
        )}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={reset}>Import more files</Button>
        </div>
      </PageFrame>
    );
  }

  if (phase === 'preview' && preview) {
    return (
      <PageFrame heading="Review batch import">
        <section className={styles.batchSummary} aria-label="Batch import summary">
          <strong>
            {preview.plan.summary.dayCount}{' '}
            {pluralize(preview.plan.summary.dayCount, 'recording day')} →{' '}
            {preview.plan.summary.animalCount}{' '}
            {pluralize(preview.plan.summary.animalCount, 'animal')}
          </strong>
          <span>
            {preview.excluded.length === 0
              ? 'Every selected file is included.'
              : `${preview.excluded.length} ${pluralize(preview.excluded.length, 'file')} will not be imported.`}
          </span>
        </section>

        <div className={styles.animalCards}>
          {preview.plan.animals.map((animal) => (
            <AnimalPreviewCard
              key={animal.subjectId}
              animal={animal}
              resolution={conflictResolutions[animal.subjectId]}
              onResolution={(resolution) =>
                setConflictResolutions((current) => ({
                  ...current,
                  [animal.subjectId]: resolution,
                }))
              }
            />
          ))}
        </div>

        {preview.excluded.length > 0 && (
          <details className={styles.excludedFiles}>
            <summary>Files not included ({preview.excluded.length})</summary>
            <ul>
              {preview.excluded.map((entry, index) => (
                <li key={`${entry.sourceName}-${index}`}>
                  <strong>{entry.sourceName}</strong>
                  <span>{entry.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setPhase('repair')}>Back to repairs</Button>
          <Button disabled={preview.plan.animals.length === 0} onClick={confirmBatch}>
            Confirm import
          </Button>
          <span className={styles.spacer} />
          <a className={styles.cancelLink} href="#/workspace">Cancel</a>
        </div>
      </PageFrame>
    );
  }

  if (!activeAssessment) return null;
  const current = activeAssessment.file;
  const plan = current.plan;
  const attention = plan.items.filter((item) => item.group === 'attention');
  const required = plan.items.filter((item) => item.group === 'required');
  const subjectId = plan.decision.kind === 'blocked' ? '' : plan.decision.subjectId;
  const singleImportLabel =
    plan.decision.kind === 'existing' ? 'Add recording day' : 'Import as new animal';
  const activeSuggestionCount = unansweredSuggestions(current).length;
  const allSuggestionCount = files.reduce(
    (count, file) => count + unansweredSuggestions(file).length,
    0
  );
  const outstandingCount = assessments.filter((assessment) => !assessment.ready).length;

  return (
    <PageFrame heading="Import metadata YAML">
      {parseFailures.length > 0 && (
        <IssueList
          label="Files that could not be read"
          heading={`${parseFailures.length} ${pluralize(parseFailures.length, 'file')} could not be read`}
          entries={parseFailures.map((entry) => ({
            subject: entry.sourceName,
            reason: entry.reason,
          }))}
        />
      )}
      {files.length > 1 && (
        <section className={styles.batchToolbar} aria-label="Import batch status">
          <div className={styles.batchCounts}>
            <strong>{files.length + parseFailures.length} selected</strong>
            <span className={styles.readyCount}>{readyAssessments.length} ready</span>
            <span>{outstandingCount} need repair</span>
            {parseFailures.length > 0 && <span>{parseFailures.length} unreadable</span>}
          </div>
          <div className={styles.batchControls}>
            <label htmlFor="import-file-review">Review file</label>
            <select
              id="import-file-review"
              value={activeIndex}
              onChange={(event) => setActiveIndex(Number(event.target.value))}
            >
              {assessments.map((assessment, index) => (
                <option key={assessment.file.key} value={index}>
                  {assessmentLabel(assessment)} — {assessment.file.decoded.sourceName}
                </option>
              ))}
            </select>
            {allSuggestionCount > 0 && (
              <Button size="small" variant="secondary" onClick={() => acceptSuggestions('all')}>
                Apply all safe suggestions ({allSuggestionCount})
              </Button>
            )}
          </div>
        </section>
      )}

      <div className={styles.card}>
        <div className={styles.fileRow}>
          <span className={styles.fileName}>{current.decoded.sourceName}</span>
          <span className={`${styles.fileStatus} ${activeAssessment.ready ? styles.fileReady : ''}`}>
            {assessmentLabel(activeAssessment)}
          </span>
          <button type="button" className={styles.changeFile} onClick={reset}>
            Choose different files
          </button>
        </div>
        <p className={styles.decision} role="status">
          {plan.decision.kind === 'existing'
            ? `Animal “${subjectId}” already exists. Ready files for it will be reconciled together before its recording days are added.`
            : plan.decision.kind === 'new'
              ? files.length === 1
                ? `This file will create a new animal: “${subjectId}”.`
                : `This file belongs to animal “${subjectId}”. Other selected dates for the same animal will be grouped with it.`
              : plan.decision.reason}
        </p>
      </div>

      {activeAssessment.ready && plan.items.length === 0 && (
        <p className={styles.readyNotice} role="status">No repairs needed. This file is ready.</p>
      )}

      {attention.length > 0 && (
        <section className={styles.section} aria-label="Needs attention">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionHeading}>Needs attention</h2>
            {activeSuggestionCount > 0 && (
              <Button size="small" variant="secondary" onClick={() => acceptSuggestions('active')}>
                Apply safe suggestions ({activeSuggestionCount})
              </Button>
            )}
          </div>
          {attention.map((item) => (
            <RepairRow
              key={item.path}
              item={item}
              value={current.resolutions[item.path]}
              accepted={item.path in current.resolutions}
              onAccept={() => setResolution(item.path, item.suggested)}
              onInput={(value) => setResolution(item.path, value)}
            />
          ))}
        </section>
      )}

      {required.length > 0 && (
        <section className={styles.section} aria-label="Required, but missing">
          <h2 className={styles.sectionHeading}>Required, but missing</h2>
          {required.map((item) => (
            <RepairRow
              key={item.path}
              item={item}
              value={current.resolutions[item.path]}
              accepted={false}
              onAccept={() => undefined}
              onInput={(value) => setResolution(item.path, value)}
            />
          ))}
        </section>
      )}

      {plan.blockers.length > 0 && (
        <section className={styles.section} aria-label="Needs source-file editing">
          <h2 className={styles.sectionHeading}>Needs source-file editing</h2>
          <p className={styles.sectionIntro}>
            These structures cannot be changed safely with a single value. This file stays out of
            the batch; other ready files can still be imported.
          </p>
          <ul className={styles.blockerList}>
            {plan.blockers.map((blocker) => (
              <li key={`${blocker.path}-${blocker.code}`} role="alert">
                <strong>
                  {blocker.context ? `${blocker.context}: ` : ''}{blocker.label}
                </strong>{' '}
                {blocker.why}
                <details className={styles.technicalPath}>
                  <summary>Technical field path</summary>
                  <code>{blocker.path}</code>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.benign.length > 0 && (
        <details className={styles.benign}>
          <summary>
            Auto-normalized on import ({plan.benign.length}{' '}
            {pluralize(plan.benign.length, 'format-only change')})
          </summary>
          <ul>
            {plan.benign.map((item) => (
              <li key={`${item.path}-${item.label}`}>{item.detail}</li>
            ))}
          </ul>
          <p className={styles.benignNote}>
            No values are silently dropped; anything unmappable remains flagged above.
          </p>
        </details>
      )}

      <div className={styles.actions}>
        {files.length === 1 ? (
          <>
            <Button disabled={!activeAssessment.ready} onClick={handleSingleImport}>
              {singleImportLabel}
            </Button>
            {!activeAssessment.ready && activeAssessment.reason && (
              <span className={styles.blockerHint} role="status">
                {activeAssessment.reason}
              </span>
            )}
          </>
        ) : (
          <>
            <Button disabled={readyAssessments.length === 0} onClick={openBatchPreview}>
              Review {readyAssessments.length} ready {pluralize(readyAssessments.length, 'file')}
            </Button>
            {outstandingCount + parseFailures.length > 0 && (
              <span className={styles.blockerHint} role="status">
                {outstandingCount + parseFailures.length}{' '}
                {pluralize(outstandingCount + parseFailures.length, 'file')} will stay out until repaired.
              </span>
            )}
          </>
        )}
        <span className={styles.spacer} />
        <a className={styles.cancelLink} href="#/workspace">Cancel</a>
      </div>
    </PageFrame>
  );
}

interface PageFrameProps {
  heading: string;
  result?: boolean;
  children: ReactNode;
}

/** Shared page shell for every phase. */
function PageFrame({ heading, result = false, children }: PageFrameProps) {
  return (
    <PageShell
      headingId={result ? 'import-result-heading' : 'import-heading'}
      heading={heading}
      crumb={result ? undefined : 'Import'}
      regionLabel={result ? 'Import complete' : undefined}
      maxWidth={960}
    >
      {children}
    </PageShell>
  );
}

interface IssueListProps {
  label: string;
  heading: ReactNode;
  entries: Array<{ subject: string; reason: string }>;
}

/** A labelled list of things that could not be imported, one row per subject. */
function IssueList({ label, heading, entries }: IssueListProps) {
  return (
    <section className={styles.section} aria-label={label}>
      <h2 className={styles.sectionHeading}>{heading}</h2>
      <ul className={styles.blockerList}>
        {entries.map((entry, index) => (
          <li key={`${entry.subject}-${index}`} role="alert">
            <strong>{entry.subject}:</strong> {entry.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RepairRowProps {
  item: RepairItem;
  value: unknown;
  accepted: boolean;
  onAccept: () => void;
  onInput: (value: unknown) => void;
}

/** One suggestion/choice/input row, labelled with its containing record context. */
function RepairRow({ item, value, accepted, onAccept, onInput }: RepairRowProps) {
  const dateValue = item.inputType === 'date' ? String(value ?? '').slice(0, 10) : '';
  const suggestionAccepted = accepted && value === item.suggested;
  // An untouched row renders EMPTY, never seeded with `item.was`: `was` is the value the validator
  // rejected, and pre-filling it makes an unanswered row look answered while the export gate still
  // counts it unresolved (and a non-numeric `was` in a number input renders blank anyway).
  const inputValue =
    value === undefined || value === null || (item.kind === 'choice' && value === item.suggested)
      ? ''
      : String(value);
  const accessibleLabel = [
    item.context,
    item.label,
    item.mapInputLabel && item.mapInputLabel !== item.label
      ? item.mapInputLabel
      : undefined,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div className={styles.row}>
      <div className={styles.rowBody}>
        {item.context && <div className={styles.rowContext}>{item.context}</div>}
        <div className={styles.rowLabel}>{item.label}</div>
        {item.kind === 'suggestion' || item.kind === 'choice' ? (
          <div className={styles.rowDetail}>
            <span className={styles.was}>{display(item.was)}</span>
            <span aria-hidden="true"> → </span>
            <span className={styles.now}>{display(item.suggested)}</span>
          </div>
        ) : item.was !== undefined && item.was !== null && item.was !== '' ? (
          <div className={styles.rowDetail}>
            <span className={styles.was}>{display(item.was)}</span>
          </div>
        ) : null}
        <div className={styles.rowWhy}>{item.why}</div>
      </div>
      <div className={styles.rowAction}>
        {(item.kind === 'suggestion' || item.kind === 'choice') && (
          <Button
            variant={suggestionAccepted ? 'secondary' : 'primary'}
            size="small"
            aria-label={`Accept ${accessibleLabel}`}
            aria-pressed={suggestionAccepted}
            onClick={onAccept}
          >
            {suggestionAccepted ? 'Accepted ✓' : 'Accept'}
          </Button>
        )}
        {(item.kind === 'input' || item.kind === 'choice' || accepted) &&
          item.inputType === 'date' && (
            <input
              type="date"
              aria-label={accessibleLabel}
              value={dateValue}
              onChange={(event) =>
                onInput(event.target.value ? `${event.target.value}T00:00:00` : '')
              }
            />
          )}
        {(item.kind === 'input' || item.kind === 'choice') && item.inputType !== 'date' && (
          <input
            type={item.inputType === 'number' ? 'number' : 'text'}
            aria-label={accessibleLabel}
            value={inputValue}
            onChange={(event) =>
              onInput(
                item.inputType === 'number' && event.target.value !== ''
                  ? Number(event.target.value)
                  : event.target.value
              )
            }
          />
        )}
      </div>
    </div>
  );
}

interface AnimalPreviewCardProps {
  animal: ImportPlanAnimal;
  resolution?: ConflictResolution;
  onResolution: (resolution: ConflictResolution) => void;
}

/** One animal in the final, read-only batch preview. */
function AnimalPreviewCard({ animal, resolution, onResolution }: AnimalPreviewCardProps) {
  return (
    <section className={styles.animalCard} aria-labelledby={`preview-animal-${animal.subjectId}`}>
      <h2 id={`preview-animal-${animal.subjectId}`}>{animal.subjectId}</h2>
      <p>
        {animal.days.length} {pluralize(animal.days.length, 'recording day')} ·{' '}
        {animal.configVersions.length}{' '}
        {pluralize(animal.configVersions.length, 'hardware configuration')}
      </p>
      {animal.configVersions.length > 0 && (
        <ul className={styles.configList}>
          {animal.configVersions.map((configuration) => (
            <li key={configuration.version}>
              Configuration {configuration.version}, from {configuration.date} —{' '}
              {configuration.dayDates.length} {pluralize(configuration.dayDates.length, 'day')}
            </li>
          ))}
        </ul>
      )}
      {animal.divergences.length > 0 && (
        <div className={styles.divergences} role="status">
          <strong>Differences to review</strong>
          <ul>
            {animal.divergences.map((divergence, index) => (
              <li key={`${divergence.field}-${index}`}>{divergence.detail}</li>
            ))}
          </ul>
        </div>
      )}
      {animal.conflict === 'exists' && (
        <fieldset className={styles.resolution}>
          <legend>“{animal.subjectId}” already exists. What should happen?</legend>
          {[
            ['add', 'Add these days to the existing animal'],
            ['skip', 'Skip this animal'],
            ['replace', 'Replace the existing animal and its days'],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name={`resolution-${animal.subjectId}`}
                checked={(resolution ?? 'add') === value}
                onChange={() => onResolution(value as ConflictResolution)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
