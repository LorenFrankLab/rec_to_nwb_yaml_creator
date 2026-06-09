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
    for (const animal of nextPlan.animals) {
      if (animal.conflict === 'exists') seeded[animal.subjectId] = animal.defaultResolution;
    }
    setResolutions(seeded);
    setPhase('preview');
  };

  /**
   * File-input change handler; resets the input value so re-picking the same file re-fires.
   * @param {object} e - The change event.
   */
  const onInputChange = async (e) => {
    const { files } = e.target;
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
        {plan.animals.map((animal) => (
          <AnimalCard
            key={animal.subjectId}
            animal={animal}
            resolution={resolutions[animal.subjectId]}
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
 * @param {object} props.animal - The planned animal (ImportPlanAnimal).
 * @param {string} [props.resolution] - The chosen resolution for a conflict animal.
 * @param {Function} props.setResolution - Set this animal's resolution.
 * @returns {JSX.Element}
 */
function AnimalCard({ animal, resolution, setResolution }) {
  const dayCount = animal.days.length;
  const versionCount = animal.configVersions.length;
  return (
    <div className="import-animal-card" role="group" aria-label={`Animal ${animal.subjectId}`}>
      <h3 className="import-animal-name">{animal.subjectId}</h3>
      <p className="import-animal-meta">
        {dayCount} recording day{dayCount === 1 ? '' : 's'} ·{' '}
        {versionCount} hardware configuration{versionCount === 1 ? '' : 's'}
      </p>

      {versionCount > 0 && (
        <ul className="import-config-versions">
          {animal.configVersions.map((cv) => (
            <li key={cv.version}>
              Configuration {cv.version} (from {cv.date})
            </li>
          ))}
        </ul>
      )}

      {animal.divergences.length > 0 && (
        <ul className="import-divergences">
          {animal.divergences.map((d, i) => (
            <li key={`${d.field}-${i}`} role="alert">
              <strong>{d.field}:</strong> {d.detail}
            </li>
          ))}
        </ul>
      )}

      {animal.conflict === 'exists' && (
        <fieldset className="import-resolution" role="alert">
          <legend>
            An animal named “{animal.subjectId}” already exists in the workspace. Choose how to
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
                name={`resolution-${animal.subjectId}`}
                value={opt.value}
                checked={(resolution ?? 'add') === opt.value}
                onChange={() => setResolution(animal.subjectId, opt.value)}
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
  animal: PropTypes.object.isRequired,
  resolution: PropTypes.string,
  setResolution: PropTypes.func.isRequired,
};

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
  return (
    <section className="import-result" aria-label="Import result">
      <p>
        Imported {createdAnimals.length} animal{createdAnimals.length === 1 ? '' : 's'} and{' '}
        {createdDays.length} recording day{createdDays.length === 1 ? '' : 's'}.
        {skipped.length > 0 ? ` Skipped ${skipped.length} animal${skipped.length === 1 ? '' : 's'}.` : ''}
      </p>

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
