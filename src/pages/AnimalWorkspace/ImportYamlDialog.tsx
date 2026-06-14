/**
 * ImportYamlDialog — the user-facing YAML-import flow on top of the pure reconcile core.
 *
 * Two phases:
 *   1. PICK — a multi-file `<input>` + a drop zone. On files chosen we read+decode them
 *      ({@link parseImportFiles}), reconcile them against the live workspace
 *      ({@link planImport}), and advance to PREVIEW. Nothing is written yet.
 *   2. PREVIEW/CONFIRM — a summary, one card per planned animal (day + config-version counts,
 *      divergence flags, and — for animals already in the workspace — a per-animal resolution
 *      control), and an un-importable list (`parseFailures` ++ `plan.unimportable`). Confirm writes
 *      via {@link applyImportPlan} and shows a brief result; Cancel writes NOTHING and closes.
 *
 * Rendered as a Modal (shared focus trap / ESC / focus return). The reconcile + write are the only
 * coupling to the store; the rest is presentation.
 *
 * @module pages/AnimalWorkspace/ImportYamlDialog
 */

import { useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent as ReactDragEvent, RefObject } from 'react';
import Modal from '../../components/Modal/Modal';
import { useStoreContext } from '../../state/StoreContext';
import { parseImportFiles } from '../../features/importYaml';
import { planImport } from '../../state/yamlImportPlan';
import type { ImportPlan, ImportPlanAnimal } from '../../state/yamlImportPlan';
import { applyImportPlan } from '../../state/yamlImportApply';
import styles from './ImportYamlDialog.module.css';

/** A file that could not be parsed/imported (parse-failure or plan-unimportable entry). */
interface UnimportableEntry {
  sourceName: string;
  reason: string;
}

interface ImportYamlDialogProps {
  /** Close the dialog (Cancel / done / ESC). Writes nothing itself. */
  onClose: () => void;
}

/**
 * The import dialog.
 */
export default function ImportYamlDialog({ onClose }: ImportYamlDialogProps) {
  const { model, actions } = useStoreContext();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const inputRef = useRef<HTMLInputElement>(null);

  // phase: 'pick' → 'preview' → 'result'. The plan + failures snapshot the pick decode.
  const [phase, setPhase] = useState<'pick' | 'preview' | 'result'>('pick');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parseFailures, setParseFailures] = useState<UnimportableEntry[]>([]);
  // Per-subject resolution overrides for conflict animals (subjectId → 'add'|'skip'|'replace').
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof applyImportPlan> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  /** Read+decode the chosen files, reconcile against the live workspace, and advance to preview. */
  const handleFiles = async (files: File[] | FileList | null | undefined) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const { decodedFiles, parseFailures: failures } = await parseImportFiles(list);
    const nextPlan = planImport(decodedFiles, model.workspace);
    setParseFailures(failures);
    setPlan(nextPlan);
    // Seed resolutions with each conflict animal's default so the control reflects state.
    const seeded: Record<string, string> = {};
    for (const animalPlan of nextPlan.animals) {
      if (animalPlan.conflict === 'exists') {
        seeded[animalPlan.subjectId] = animalPlan.defaultResolution as string;
      }
    }
    setResolutions(seeded);
    setPhase('preview');
  };

  /** File-input change handler; resets the input value so re-picking the same file re-fires. */
  const onInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    // `e.target.files` is a *live* FileList — clearing `e.target.value` (so re-picking the
    // SAME file re-fires onChange) empties it in real browsers. Snapshot into a stable
    // File[] BEFORE clearing, then hand that to handleFiles (which already Array.from()s).
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    await handleFiles(files);
  };

  /** Drop handler for the drop zone. */
  const onDrop = async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer?.files);
  };

  /** Apply the plan with the chosen resolutions, then show the result. */
  const handleConfirm = () => {
    const summary = applyImportPlan(plan!, actions, {
      workspace: model.workspace,
      resolutions: resolutions as Record<string, 'add' | 'skip' | 'replace'>,
    });
    setResult(summary);
    setPhase('result');
  };

  /** Set a conflict animal's resolution ('add'|'skip'|'replace'). */
  const setResolution = (subjectId: string, value: string) => {
    setResolutions((prev) => ({ ...prev, [subjectId]: value }));
  };

  const unimportable = [...parseFailures, ...(plan?.unimportable ?? [])];

  // The action row lives in Modal's sticky footer and changes per phase, so the
  // (potentially long) preview list scrolls while the confirm/cancel stay reachable.
  let footer;
  if (phase === 'pick') {
    footer = (
      <div className={styles.actions}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    );
  } else if (phase === 'preview' && plan) {
    footer = (
      <div className={styles.actions}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleConfirm}
          disabled={plan.animals.length === 0}
        >
          Confirm import
        </button>
      </div>
    );
  } else if (phase === 'result' && result) {
    footer = (
      <div className={styles.actions}>
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Import YAML files"
      titleId={titleId}
      className={styles.dialog}
      closeOnOverlayClick={false}
      footer={footer}
    >
      {phase === 'pick' && (
        <PickPhase
          inputRef={inputRef}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onInputChange={onInputChange}
          onDrop={onDrop}
        />
      )}

      {phase === 'preview' && plan && (
        <PreviewPhase
          plan={plan}
          unimportable={unimportable}
          parseFailureCount={parseFailures.length}
          resolutions={resolutions}
          setResolution={setResolution}
        />
      )}

      {phase === 'result' && result && <ResultPhase result={result} />}
    </Modal>
  );
}

/**
 * Derive a short, human-readable remediation hint ("what to fix") from an un-importable file's
 * raw `reason` string. PRESENTATION-ONLY and data-driven: it reads ONLY the single reason string
 * the plan/parse layer already exposes (it adds no requirements of its own), and falls back to a
 * generic instruction when the shape is unrecognized. The raw reason is still shown alongside the
 * hint by the caller, so nothing is hidden.
 *
 * Mapping (honest, derived from the messages the plan/validator actually emit). The plan builds a
 * value-failure reason as `Validation failed: <message>`, where `<message>` is the validator's
 * already-sanitized AJV message (e.g. `must match pattern "..."`) WITHOUT a leading instancePath —
 * so we only recognize the two shapes that genuinely appear:
 *  - `must have required property 'X'` (one or more) → "Add the missing field: `X`." listing all
 *    reported missing props.
 *  - anything else → a generic "Open this file and correct the reported problem before
 *    re-importing." (the raw reason is still shown separately by the caller, so nothing is hidden).
 *
 * @param reason - The un-importable entry's raw reason string.
 * @returns A plain-language remediation hint (never empty).
 */
export function remediationHint(reason?: string): string {
  const raw = typeof reason === 'string' ? reason : '';

  // Collect every `must have required property 'X'` occurrence (a file may report several).
  const requiredProps: string[] = [];
  const requiredRe = /must have required property '([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = requiredRe.exec(raw)) !== null) {
    if (!requiredProps.includes(match[1])) requiredProps.push(match[1]);
  }
  if (requiredProps.length > 0) {
    const fields = requiredProps.map((p) => `\`${p}\``).join(', ');
    return `Add the missing field${requiredProps.length === 1 ? '' : 's'}: ${fields}.`;
  }

  return 'Open this file and correct the reported problem before re-importing.';
}

interface PickPhaseProps {
  /** Ref to the hidden file input (clicked by the drop zone). */
  inputRef: RefObject<HTMLInputElement>;
  /** Whether a drag is currently over the drop zone. */
  isDragging: boolean;
  /** Set the dragging flag. */
  setIsDragging: (next: boolean) => void;
  /** File-input change handler. */
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Drop handler. */
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
}

/**
 * PICK phase: the multi-file input + drop zone.
 */
function PickPhase({ inputRef, isDragging, setIsDragging, onInputChange, onDrop }: PickPhaseProps) {
  return (
    <div className={styles.pick}>
      <p id="import-pick-help">
        Bring existing <code>{'{mmddYYYY}_{subject}_metadata.yml'}</code> files into the workspace.
        Each file becomes a recording day; days are grouped into animals by subject id, and config
        differences across dates become hardware-configuration versions. Nothing is written until
        you confirm the preview.
      </p>

      <div
        className={`${styles.dropZone}${isDragging ? ` ${styles.isDragging}` : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Drop YAML files here, or use the file picker below"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <p>Drag and drop YAML files here</p>
        <p className={styles.dropOr}>or</p>
        <label className={styles.fileLabel} htmlFor="import-file-input">
          Choose YAML files
        </label>
        <input
          id="import-file-input"
          ref={inputRef}
          className={styles.fileInput}
          type="file"
          multiple
          accept=".yml,.yaml"
          aria-label="Choose YAML files to import"
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}

interface PreviewPhaseProps {
  /** The import plan from planImport. */
  plan: ImportPlan;
  /** parseFailures ++ plan.unimportable. */
  unimportable: UnimportableEntry[];
  /** Count of files that failed to parse (for the total). */
  parseFailureCount: number;
  /** subjectId → resolution override. */
  resolutions: Record<string, string>;
  /** Set a conflict animal's resolution. */
  setResolution: (subjectId: string, value: string) => void;
}

/**
 * PREVIEW phase: summary, per-animal cards, un-importable list. The Confirm/Cancel
 * action row is rendered by the parent into Modal's sticky footer.
 */
function PreviewPhase({
  plan,
  unimportable,
  parseFailureCount,
  resolutions,
  setResolution,
}: PreviewPhaseProps) {
  const { summary } = plan;
  const unimportableCount = unimportable.length;
  // plan.summary.fileCount counts the files that decoded (including those that became
  // plan.unimportable); parse failures are NOT among them — so total picked = fileCount + parseFailures.
  const totalFiles = summary.fileCount + parseFailureCount;
  return (
    <section aria-label="Import preview">
      <p className={styles.summary}>
        {totalFiles} file
        {totalFiles === 1 ? '' : 's'} → {summary.animalCount} animal
        {summary.animalCount === 1 ? '' : 's'}, {summary.dayCount} recording day
        {summary.dayCount === 1 ? '' : 's'}
        {unimportableCount > 0
          ? ` (${unimportableCount} file${unimportableCount === 1 ? '' : 's'} could not be imported)`
          : ''}
        .
      </p>

      <div className={styles.animalCards}>
        {plan.animals.map((animalPlan) => (
          <AnimalCard
            key={animalPlan.subjectId}
            animalPlan={animalPlan}
            resolution={resolutions[animalPlan.subjectId]}
            setResolution={setResolution}
          />
        ))}
      </div>

      {unimportable.length > 0 && (
        <section className={styles.unimportable} aria-label="Files that could not be imported">
          <h3>Files that could not be imported</h3>
          <ul>
            {unimportable.map((entry, i) => (
              <li key={`${entry.sourceName}-${i}`}>
                <span className={styles.unimportableName}>{entry.sourceName}</span>
                <span className={styles.unimportableReason}>{entry.reason}</span>
                {/* Presentation-only "what to fix", derived from the raw reason string above. */}
                <span className={styles.unimportableHint}>{remediationHint(entry.reason)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

interface AnimalCardProps {
  /** The planned animal (an ImportPlanAnimal, NOT a workspace animal record). */
  animalPlan: ImportPlanAnimal;
  /** The chosen resolution for a conflict animal. */
  resolution?: string;
  /** Set this animal's resolution. */
  setResolution: (subjectId: string, value: string) => void;
}

/**
 * One planned animal: id, day count, config-version summary, divergence flags, and (for a conflict)
 * the per-animal resolution control.
 */
function AnimalCard({ animalPlan, resolution, setResolution }: AnimalCardProps) {
  const dayCount = animalPlan.days.length;
  const versionCount = animalPlan.configVersions.length;
  return (
    <div className={styles.animalCard} role="group" aria-label={`Animal ${animalPlan.subjectId}`}>
      <h3 className={styles.animalName}>{animalPlan.subjectId}</h3>
      <p className={styles.animalMeta}>
        {dayCount} recording day{dayCount === 1 ? '' : 's'} ·{' '}
        {versionCount} hardware configuration{versionCount === 1 ? '' : 's'}
      </p>

      {versionCount > 0 && (
        <ul className={styles.configVersions}>
          {animalPlan.configVersions.map((cv) => (
            <li key={cv.version}>
              Configuration {cv.version} (from {cv.date})
            </li>
          ))}
        </ul>
      )}

      {animalPlan.divergences.length > 0 && (
        <ul className={styles.divergences}>
          {animalPlan.divergences.map((d, i) => (
            <li key={`${d.field}-${i}`} role="alert">
              <strong>{d.field}:</strong> {d.detail}
            </li>
          ))}
        </ul>
      )}

      {animalPlan.conflict === 'exists' && (
        <fieldset className={styles.resolution} role="alert">
          <legend>
            An animal named “{animalPlan.subjectId}” already exists in the workspace. Choose how to
            import these files:
          </legend>
          {[
            { value: 'add', label: 'Add days to existing animal' },
            { value: 'skip', label: 'Skip (import nothing for this animal)' },
            { value: 'replace', label: 'Replace existing animal' },
          ].map((opt) => (
            <label key={opt.value} className={styles.resolutionOption}>
              <input
                type="radio"
                name={`resolution-${animalPlan.subjectId}`}
                value={opt.value}
                checked={(resolution ?? 'add') === opt.value}
                onChange={() => setResolution(animalPlan.subjectId, opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/**
 * Group the result's created day ids under their created animal, for naming WHICH animals/days
 * landed (not just counts). PRESENTATION-ONLY — reads only the result fields the executor already
 * exposes (`createdAnimals`, `createdDays`). A created day id is `generateDayId`'s
 * `<animalId>-<ISO date>`; the animal id may itself contain hyphens, so we split on the LAST
 * `-<YYYY-MM-DD>` to recover the date, and attribute each day to the longest created-animal id that
 * prefixes it (handles ids that share a prefix). Days whose animal id isn't in `createdAnimals`
 * (e.g. a conflict→'add' onto an existing animal) get their own entry so no created day is unnamed.
 *
 * @param createdAnimals - Created animal subject ids.
 * @param createdDays - Created day ids (`<animalId>-<ISO date>`).
 * @returns Per-animal entries in stable order.
 */
export function groupCreatedDaysByAnimal(createdAnimals: string[] = [], createdDays: string[] = []): Array<{ animalId: string; dates: string[] }> {
  const order: string[] = [];
  const byAnimal = new Map<string, string[]>();
  const ensure = (animalId: string): string[] => {
    if (!byAnimal.has(animalId)) {
      byAnimal.set(animalId, []);
      order.push(animalId);
    }
    return byAnimal.get(animalId)!;
  };

  // Seed in created order so an animal with zero matched days (shouldn't happen, but be honest)
  // is still named.
  for (const animalId of createdAnimals) ensure(animalId);

  // Candidate animal ids: the created animals, longest first so a more specific prefix wins.
  const candidates = [...createdAnimals].sort((a, b) => b.length - a.length);

  for (const dayId of createdDays) {
    // Recover the trailing ISO date (`-YYYY-MM-DD`); the rest is the animal id.
    const m = dayId.match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
    const datePart = m ? m[2] : '';
    let animalId = m ? m[1] : dayId;
    // Prefer an exact created-animal match (handles animal ids that themselves end in a date).
    const exact = candidates.find((c) => c === animalId);
    if (!exact) {
      const prefix = candidates.find((c) => dayId.startsWith(`${c}-`));
      if (prefix) animalId = prefix;
    }
    const dates = ensure(animalId);
    if (datePart && !dates.includes(datePart)) dates.push(datePart);
  }

  return order.map((animalId) => ({ animalId, dates: byAnimal.get(animalId)! }));
}

interface ResultPhaseProps {
  /** The applyImportPlan summary. */
  result: ReturnType<typeof applyImportPlan>;
}

/**
 * RESULT phase: a brief summary of what was written, plus any failures. The Done
 * action is rendered by the parent into Modal's sticky footer.
 */
function ResultPhase({ result }: ResultPhaseProps) {
  const { createdAnimals, createdDays, skipped, failed } = result;
  // What the result object EXPOSES: `createdAnimals` is the list of created animal subject ids,
  // and `createdDays` is the list of created day ids, each formatted by `generateDayId` as
  // `<animalId>-<ISO date>` (e.g. `remy-2023-06-22`). It carries no separate per-animal day list,
  // so we group the day ids back under each created animal by their `<animalId>-` prefix and show
  // the trailing date. (A conflict→'add' import writes days but no new animal — those day ids are
  // still in `createdDays`; we surface any such animal id too so no created day is unnamed.)
  const createdByAnimal = groupCreatedDaysByAnimal(createdAnimals, createdDays);
  return (
    <section aria-label="Import result">
      <p>
        Imported {createdAnimals.length} animal{createdAnimals.length === 1 ? '' : 's'} and{' '}
        {createdDays.length} recording day{createdDays.length === 1 ? '' : 's'}.
        {skipped.length > 0 ? ` Skipped ${skipped.length} animal${skipped.length === 1 ? '' : 's'}.` : ''}
      </p>

      {createdByAnimal.length > 0 && (
        <ul className={styles.resultCreated}>
          {createdByAnimal.map(({ animalId, dates }) => (
            <li key={animalId}>
              <span className={styles.resultAnimal}>{animalId}</span>
              {dates.length > 0 && (
                <>
                  {' — '}
                  <span className={styles.resultDates}>{dates.join(', ')}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {failed.length > 0 && (
        <section aria-label="Import failures">
          <h3>Could not import</h3>
          <ul>
            {failed.map((f, i) => (
              <li key={`${f.subjectId}-${i}`} role="alert">
                <strong>{f.subjectId}:</strong> {f.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

