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

import React, { useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { useStoreContext } from '../../state/StoreContext';
import { parseImportFiles } from '../../features/importYaml';
import { planImport } from '../../state/yamlImportPlan';
import { applyImportPlan } from '../../state/yamlImportApply';
import './ImportYamlDialog.css';

/**
 * The import dialog.
 *
 * @param {object} props
 * @param {Function} props.onClose - Close the dialog (Cancel / done / ESC). Writes nothing itself.
 * @returns {JSX.Element}
 */
export default function ImportYamlDialog({ onClose }) {
  const { model, actions } = useStoreContext();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const inputRef = useRef(null);

  // phase: 'pick' → 'preview' → 'result'. The plan + failures snapshot the pick decode.
  const [phase, setPhase] = useState('pick');
  const [plan, setPlan] = useState(null);
  const [parseFailures, setParseFailures] = useState([]);
  // Per-subject resolution overrides for conflict animals (subjectId → 'add'|'skip'|'replace').
  const [resolutions, setResolutions] = useState({});
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Read+decode the chosen files, reconcile against the live workspace, and advance to preview.
   * @param {Array} files - File-like objects.
   */
  const handleFiles = async (files) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const { decodedFiles, parseFailures: failures } = await parseImportFiles(list);
    const nextPlan = planImport(decodedFiles, model.workspace);
    setParseFailures(failures);
    setPlan(nextPlan);
    // Seed resolutions with each conflict animal's default so the control reflects state.
    const seeded = {};
    for (const animalPlan of nextPlan.animals) {
      if (animalPlan.conflict === 'exists') {
        seeded[animalPlan.subjectId] = animalPlan.defaultResolution;
      }
    }
    setResolutions(seeded);
    setPhase('preview');
  };

  /**
   * File-input change handler; resets the input value so re-picking the same file re-fires.
   * @param {object} e - The change event.
   */
  const onInputChange = async (e) => {
    // `e.target.files` is a *live* FileList — clearing `e.target.value` (so re-picking the
    // SAME file re-fires onChange) empties it in real browsers. Snapshot into a stable
    // File[] BEFORE clearing, then hand that to handleFiles (which already Array.from()s).
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    await handleFiles(files);
  };

  /**
   * Drop handler for the drop zone.
   * @param {object} e - The drop event.
   */
  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer?.files);
  };

  /** Apply the plan with the chosen resolutions, then show the result. */
  const handleConfirm = () => {
    const summary = applyImportPlan(plan, actions, {
      workspace: model.workspace,
      resolutions,
    });
    setResult(summary);
    setPhase('result');
  };

  /**
   * Set a conflict animal's resolution.
   * @param {string} subjectId - The conflict animal's subject id.
   * @param {('add'|'skip'|'replace')} value - The chosen resolution.
   */
  const setResolution = (subjectId, value) => {
    setResolutions((prev) => ({ ...prev, [subjectId]: value }));
  };

  const unimportable = [...parseFailures, ...(plan?.unimportable ?? [])];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Import YAML files"
      titleId={titleId}
      className="import-yaml-dialog"
      closeOnOverlayClick={false}
    >
      {phase === 'pick' && (
        <PickPhase
          inputRef={inputRef}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onInputChange={onInputChange}
          onDrop={onDrop}
          onCancel={onClose}
        />
      )}

      {phase === 'preview' && plan && (
        <PreviewPhase
          plan={plan}
          unimportable={unimportable}
          parseFailureCount={parseFailures.length}
          resolutions={resolutions}
          setResolution={setResolution}
          onConfirm={handleConfirm}
          onCancel={onClose}
        />
      )}

      {phase === 'result' && result && (
        <ResultPhase result={result} onClose={onClose} />
      )}
    </Modal>
  );
}

ImportYamlDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
};

/**
 * Derive a short, human-readable remediation hint ("what to fix") from an un-importable file's
 * raw `reason` string. PRESENTATION-ONLY and data-driven: it reads ONLY the single reason string
 * the plan/parse layer already exposes (it adds no requirements of its own), and falls back to a
 * generic instruction when the shape is unrecognized. The raw reason is still shown alongside the
 * hint by the caller, so nothing is hidden.
 *
 * Mapping (honest, derived from the AJV-style messages the validator emits):
 *  - `must have required property 'X'` (one or more) → "Add the missing field: `X`." listing all
 *    reported missing props.
 *  - a value failure that carries a path (`<path> <message>`, e.g. AJV's
 *    `/subject/species must match pattern ...`) → "Fix the value at `<path>`: `<message>`."
 *  - anything else → a generic "Open this file and correct the reported problem before
 *    re-importing." (the raw reason is shown separately by the caller).
 *
 * @param {string} [reason] - The un-importable entry's raw reason string.
 * @returns {string} A plain-language remediation hint (never empty).
 */
export function remediationHint(reason) {
  const raw = typeof reason === 'string' ? reason : '';

  // Collect every `must have required property 'X'` occurrence (a file may report several).
  const requiredProps = [];
  const requiredRe = /must have required property '([^']+)'/g;
  let match;
  while ((match = requiredRe.exec(raw)) !== null) {
    if (!requiredProps.includes(match[1])) requiredProps.push(match[1]);
  }
  if (requiredProps.length > 0) {
    const fields = requiredProps.map((p) => `\`${p}\``).join(', ');
    return `Add the missing field${requiredProps.length === 1 ? '' : 's'}: ${fields}.`;
  }

  // A value failure AJV reports as `<instancePath> <message>` (e.g. a pattern/type/enum miss).
  // The plan wraps it as `Validation failed: <instancePath> <message>`. Pull the path + message
  // back out so we can point the user at the exact field without inventing requirements.
  const valueMatch = raw.match(
    /Validation failed:\s*(\/\S+)\s+(must (?:match pattern|be|have).+)$/
  );
  if (valueMatch) {
    return `Fix the value at \`${valueMatch[1]}\`: ${valueMatch[2]}`;
  }

  return 'Open this file and correct the reported problem before re-importing.';
}

/**
 * PICK phase: the multi-file input + drop zone.
 *
 * @param {object} props - Component props.
 * @param {object} props.inputRef - Ref to the hidden file input (clicked by the drop zone).
 * @param {boolean} props.isDragging - Whether a drag is currently over the drop zone.
 * @param {Function} props.setIsDragging - Set the dragging flag.
 * @param {Function} props.onInputChange - File-input change handler.
 * @param {Function} props.onDrop - Drop handler.
 * @param {Function} props.onCancel - Cancel / close handler.
 * @returns {JSX.Element}
 */
function PickPhase({ inputRef, isDragging, setIsDragging, onInputChange, onDrop, onCancel }) {
  return (
    <div className="import-pick">
      <p id="import-pick-help">
        Bring existing <code>{'{mmddYYYY}_{subject}_metadata.yml'}</code> files into the workspace.
        Each file becomes a recording day; days are grouped into animals by subject id, and config
        differences across dates become hardware-configuration versions. Nothing is written until
        you confirm the preview.
      </p>

      <div
        className={`import-drop-zone${isDragging ? ' is-dragging' : ''}`}
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
        <p className="import-drop-or">or</p>
        <label className="import-file-label" htmlFor="import-file-input">
          Choose YAML files
        </label>
        <input
          id="import-file-input"
          ref={inputRef}
          className="import-file-input"
          type="file"
          multiple
          accept=".yml,.yaml"
          aria-label="Choose YAML files to import"
          onChange={onInputChange}
        />
      </div>

      <div className="import-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

PickPhase.propTypes = {
  inputRef: PropTypes.object.isRequired,
  isDragging: PropTypes.bool.isRequired,
  setIsDragging: PropTypes.func.isRequired,
  onInputChange: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

/**
 * PREVIEW phase: summary, per-animal cards, un-importable list, Confirm/Cancel.
 *
 * @param {object} props - Component props.
 * @param {object} props.plan - The import plan from planImport.
 * @param {Array} props.unimportable - parseFailures ++ plan.unimportable.
 * @param {number} props.parseFailureCount - Count of files that failed to parse (for the total).
 * @param {object} props.resolutions - subjectId → resolution override.
 * @param {Function} props.setResolution - Set a conflict animal's resolution.
 * @param {Function} props.onConfirm - Apply the plan.
 * @param {Function} props.onCancel - Cancel / close.
 * @returns {JSX.Element}
 */
function PreviewPhase({
  plan,
  unimportable,
  parseFailureCount,
  resolutions,
  setResolution,
  onConfirm,
  onCancel,
}) {
  const { summary } = plan;
  const unimportableCount = unimportable.length;
  // plan.summary.fileCount counts the files that decoded (including those that became
  // plan.unimportable); parse failures are NOT among them — so total picked = fileCount + parseFailures.
  const totalFiles = summary.fileCount + parseFailureCount;
  return (
    <section className="import-preview" aria-label="Import preview">
      <p className="import-summary">
        {totalFiles} file
        {totalFiles === 1 ? '' : 's'} → {summary.animalCount} animal
        {summary.animalCount === 1 ? '' : 's'}, {summary.dayCount} recording day
        {summary.dayCount === 1 ? '' : 's'}
        {unimportableCount > 0
          ? ` (${unimportableCount} file${unimportableCount === 1 ? '' : 's'} could not be imported)`
          : ''}
        .
      </p>

      <div className="import-animal-cards">
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
        <section className="import-unimportable" aria-label="Files that could not be imported">
          <h3>Files that could not be imported</h3>
          <ul>
            {unimportable.map((entry, i) => (
              <li key={`${entry.sourceName}-${i}`}>
                <span className="import-unimportable-name">{entry.sourceName}</span>
                <span className="import-unimportable-reason">{entry.reason}</span>
                {/* Presentation-only "what to fix", derived from the raw reason string above. */}
                <span className="import-unimportable-hint">{remediationHint(entry.reason)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="import-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={plan.animals.length === 0}
        >
          Confirm import
        </button>
      </div>
    </section>
  );
}

PreviewPhase.propTypes = {
  plan: PropTypes.object.isRequired,
  unimportable: PropTypes.array.isRequired,
  parseFailureCount: PropTypes.number.isRequired,
  resolutions: PropTypes.object.isRequired,
  setResolution: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

/**
 * One planned animal: id, day count, config-version summary, divergence flags, and (for a conflict)
 * the per-animal resolution control.
 *
 * @param {object} props - Component props.
 * @param {object} props.animalPlan - The planned animal (an ImportPlanAnimal, NOT a workspace
 *   animal record — its `days` is the plan's day list, not a workspace day-id array).
 * @param {string} [props.resolution] - The chosen resolution for a conflict animal.
 * @param {Function} props.setResolution - Set this animal's resolution.
 * @returns {JSX.Element}
 */
function AnimalCard({ animalPlan, resolution, setResolution }) {
  const dayCount = animalPlan.days.length;
  const versionCount = animalPlan.configVersions.length;
  return (
    <div className="import-animal-card" role="group" aria-label={`Animal ${animalPlan.subjectId}`}>
      <h3 className="import-animal-name">{animalPlan.subjectId}</h3>
      <p className="import-animal-meta">
        {dayCount} recording day{dayCount === 1 ? '' : 's'} ·{' '}
        {versionCount} hardware configuration{versionCount === 1 ? '' : 's'}
      </p>

      {versionCount > 0 && (
        <ul className="import-config-versions">
          {animalPlan.configVersions.map((cv) => (
            <li key={cv.version}>
              Configuration {cv.version} (from {cv.date})
            </li>
          ))}
        </ul>
      )}

      {animalPlan.divergences.length > 0 && (
        <ul className="import-divergences">
          {animalPlan.divergences.map((d, i) => (
            <li key={`${d.field}-${i}`} role="alert">
              <strong>{d.field}:</strong> {d.detail}
            </li>
          ))}
        </ul>
      )}

      {animalPlan.conflict === 'exists' && (
        <fieldset className="import-resolution" role="alert">
          <legend>
            An animal named “{animalPlan.subjectId}” already exists in the workspace. Choose how to
            import these files:
          </legend>
          {[
            { value: 'add', label: 'Add days to existing animal' },
            { value: 'skip', label: 'Skip (import nothing for this animal)' },
            { value: 'replace', label: 'Replace existing animal' },
          ].map((opt) => (
            <label key={opt.value} className="import-resolution-option">
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

AnimalCard.propTypes = {
  animalPlan: PropTypes.object.isRequired,
  resolution: PropTypes.string,
  setResolution: PropTypes.func.isRequired,
};

/**
 * Group the result's created day ids under their created animal, for naming WHICH animals/days
 * landed (not just counts). PRESENTATION-ONLY — reads only the result fields the executor already
 * exposes (`createdAnimals`, `createdDays`). A created day id is `generateDayId`'s
 * `<animalId>-<ISO date>`; the animal id may itself contain hyphens, so we split on the LAST
 * `-<YYYY-MM-DD>` to recover the date, and attribute each day to the longest created-animal id that
 * prefixes it (handles ids that share a prefix). Days whose animal id isn't in `createdAnimals`
 * (e.g. a conflict→'add' onto an existing animal) get their own entry so no created day is unnamed.
 *
 * @param {string[]} createdAnimals - Created animal subject ids.
 * @param {string[]} createdDays - Created day ids (`<animalId>-<ISO date>`).
 * @returns {Array<{ animalId: string, dates: string[] }>} Per-animal entries in stable order.
 */
function groupCreatedDaysByAnimal(createdAnimals = [], createdDays = []) {
  const order = [];
  const byAnimal = new Map();
  const ensure = (animalId) => {
    if (!byAnimal.has(animalId)) {
      byAnimal.set(animalId, []);
      order.push(animalId);
    }
    return byAnimal.get(animalId);
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

  return order.map((animalId) => ({ animalId, dates: byAnimal.get(animalId) }));
}

/**
 * RESULT phase: a brief summary of what was written, plus any failures.
 *
 * @param {object} props - Component props.
 * @param {object} props.result - The applyImportPlan summary.
 * @param {Function} props.onClose - Close the dialog.
 * @returns {JSX.Element}
 */
function ResultPhase({ result, onClose }) {
  const { createdAnimals, createdDays, skipped, failed } = result;
  // What the result object EXPOSES: `createdAnimals` is the list of created animal subject ids,
  // and `createdDays` is the list of created day ids, each formatted by `generateDayId` as
  // `<animalId>-<ISO date>` (e.g. `remy-2023-06-22`). It carries no separate per-animal day list,
  // so we group the day ids back under each created animal by their `<animalId>-` prefix and show
  // the trailing date. (A conflict→'add' import writes days but no new animal — those day ids are
  // still in `createdDays`; we surface any such animal id too so no created day is unnamed.)
  const createdByAnimal = groupCreatedDaysByAnimal(createdAnimals, createdDays);
  return (
    <section className="import-result" aria-label="Import result">
      <p>
        Imported {createdAnimals.length} animal{createdAnimals.length === 1 ? '' : 's'} and{' '}
        {createdDays.length} recording day{createdDays.length === 1 ? '' : 's'}.
        {skipped.length > 0 ? ` Skipped ${skipped.length} animal${skipped.length === 1 ? '' : 's'}.` : ''}
      </p>

      {createdByAnimal.length > 0 && (
        <ul className="import-result-created">
          {createdByAnimal.map(({ animalId, dates }) => (
            <li key={animalId}>
              <span className="import-result-animal">{animalId}</span>
              {dates.length > 0 && (
                <>
                  {' — '}
                  <span className="import-result-dates">{dates.join(', ')}</span>
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

      <div className="import-actions">
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  );
}

ResultPhase.propTypes = {
  result: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};
