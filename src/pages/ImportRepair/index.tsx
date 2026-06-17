/**
 * Import & Repair screen (`#/import`).
 *
 * A teaching-validation import: pick ONE metadata YAML, see every field that won't validate flagged
 * with a suggested fix drawn from the SAME validator the export gate uses, accept/edit each one, then
 * commit. It owns no import or validation logic of its own — it renders the pure spine
 * ({@link module:state/importRepair}) and commits through the EXISTING import path
 * ({@link module:state/yamlImportPlan} + {@link module:state/yamlImportApply}), so there is exactly
 * one importer and one validator. Nothing is written until the user confirms, and nothing is
 * silently dropped: unmappable values surface as user-input rows, required-but-missing blocks, and
 * the benign (format-only) normalizations the commit applies are listed.
 *
 * @module pages/ImportRepair
 */

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { validate } from '../../validation';
import type { ValidationModel } from '../../validation/issueTypes';
import { parseImportFiles } from '../../features/importYaml';
import {
  buildImportRepairPlan,
  applyImportRepairs,
} from '../../state/importRepair';
import type { ImportRepairPlan, RepairItem } from '../../state/importRepair';
import { planImport } from '../../state/yamlImportPlan';
import { applyImportPlan } from '../../state/yamlImportApply';
import Button from '../../components/ui/Button';
import styles from './ImportRepair.module.css';

/** The committed import outcome shown on the success screen. */
interface ImportResult {
  /** 'new' when a new animal was created; 'add' when a day was added to an existing animal. */
  kind: 'new' | 'add';
  /** The animal id to link to. */
  animalId: string;
  /** A failure reason when the commit could not write (defensive; should not happen post-gate). */
  failure?: string;
}

/** Render a value for the "was → suggested" display (arrays join, others stringify). */
function display(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

/**
 * The Import & Repair screen.
 */
export default function ImportRepair() {
  const { model, actions } = useStoreContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'pick' | 'repair' | 'result'>('pick');
  const [decoded, setDecoded] = useState<{ sourceName: string; flatModel: object } | null>(null);
  const [plan, setPlan] = useState<ImportRepairPlan | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  // Accepted suggestions + user-entered inputs, keyed by repair-item path.
  const [resolutions, setResolutions] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  /** Read + decode the chosen file, build the repair plan, and advance to the repair view. */
  const handleFile = async (file: File | { name: string; text: () => Promise<string> } | undefined) => {
    if (!file) return;
    setParseError(null);
    const { decodedFiles, parseFailures } = await parseImportFiles([file as File]);
    if (parseFailures.length > 0 || decodedFiles.length === 0) {
      setParseError(parseFailures[0]?.reason ?? 'The file could not be read.');
      return;
    }
    const entry = decodedFiles[0];
    setDecoded(entry);
    setPlan(buildImportRepairPlan(entry.flatModel, entry.sourceName, model.workspace));
    setResolutions({});
    setPhase('repair');
  };

  /** File-input change handler; clears the value so re-picking the same file re-fires. */
  const onInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await handleFile(file);
  };

  /** Reset to the picker (choose a different file). Writes nothing. */
  const reset = () => {
    setPhase('pick');
    setDecoded(null);
    setPlan(null);
    setResolutions({});
    setResult(null);
  };

  /** Set the resolution for a path (date inputs are normalized to an ISO datetime). */
  const setResolution = (path: string, value: unknown) => {
    setResolutions((prev) => ({ ...prev, [path]: value }));
  };

  // The TRUE import gate: a clean file OR every fix applied so the REPAIRED model validates with zero
  // errors. (A non-empty check alone is fail-open — e.g. a text value typed for a field the schema
  // needs as an array would "enable" import, then fail at commit; this re-runs the SAME validator
  // the commit will, so the button only enables when the import will actually succeed.)
  const repaired = useMemo(
    () => (decoded ? applyImportRepairs(decoded.flatModel, resolutions) : null),
    [decoded, resolutions]
  );
  const remainingErrors = useMemo(
    () => (repaired ? validate(repaired as ValidationModel).filter((i) => i.severity === 'error') : []),
    [repaired]
  );
  const canImport = !!plan && plan.decision.kind !== 'blocked' && remainingErrors.length === 0;

  /** Apply the accepted fixes, commit through the existing import path, and show the result. */
  const handleImport = () => {
    if (!plan || !decoded || !canImport || !repaired) return;
    const importPlan = planImport(
      [{ sourceName: decoded.sourceName, flatModel: repaired }],
      model.workspace
    );
    if (importPlan.animals.length === 0) {
      // Defensive: the gate should prevent this; surface the reason rather than fail silently.
      setResult({
        kind: 'new',
        animalId: '',
        failure: importPlan.unimportable[0]?.reason ?? 'The repaired file could not be imported.',
      });
      setPhase('result');
      return;
    }
    const isExisting = plan.decision.kind === 'existing';
    const subjectId = plan.decision.kind === 'blocked' ? '' : plan.decision.subjectId;
    const summary = applyImportPlan(importPlan, actions, {
      workspace: model.workspace,
      resolutions: isExisting ? { [subjectId]: 'add' } : {},
    });
    const failure = summary.failed[0]?.reason;
    const animalId = isExisting
      ? (plan.decision.kind === 'existing' ? plan.decision.existingAnimalId : '')
      : summary.createdAnimals[0] ?? subjectId;
    setResult({ kind: isExisting ? 'add' : 'new', animalId, failure });
    setPhase('result');
  };

  if (phase === 'pick') {
    return (
      <main id="main-content" tabIndex={-1} role="main" aria-labelledby="import-heading">
        <div className={styles.screen}>
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <a href="#/workspace">Animals</a> › Import
          </nav>
          <h1 id="import-heading" className={styles.heading}>Import metadata YAML</h1>
          <p className={styles.lede}>
            We read the file, map its fields, and flag anything that won&apos;t validate — with a
            suggested fix. Nothing is changed until you import; you accept or edit each one.
          </p>
          {parseError && (
            <p className={styles.parseError} role="alert">{parseError}</p>
          )}
          <div className={styles.card}>
            <label className={styles.fileLabel} htmlFor="import-repair-file">
              Choose a metadata YAML file
            </label>
            <input
              id="import-repair-file"
              ref={inputRef}
              className={styles.fileInput}
              type="file"
              accept=".yml,.yaml"
              aria-label="Choose a metadata YAML file"
              onChange={onInputChange}
            />
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'result' && result) {
    const link = result.animalId ? `#/animal/${result.animalId}/days` : null;
    return (
      <main id="main-content" tabIndex={-1} role="main" aria-labelledby="import-result-heading">
        <section className={styles.screen} aria-label="Import complete">
          <h1 id="import-result-heading" className={styles.heading}>
            {result.failure ? 'Import failed' : result.kind === 'new' ? 'New animal created' : 'Recording day added'}
          </h1>
          {result.failure ? (
            <p className={styles.parseError} role="alert">{result.failure}</p>
          ) : (
            <p className={styles.lede}>
              {result.kind === 'new'
                ? 'The animal and its first recording day were created.'
                : 'The recording day was added to the existing animal.'}{' '}
              {link && (
                <a className={styles.resultLink} href={link}>
                  {result.animalId}
                </a>
              )}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        </section>
      </main>
    );
  }

  // phase === 'repair'
  if (!plan || !decoded) return null;
  const attention = plan.items.filter((i) => i.group === 'attention');
  const required = plan.items.filter((i) => i.group === 'required');
  const subjectId = plan.decision.kind === 'blocked' ? '' : plan.decision.subjectId;
  const importLabel = plan.decision.kind === 'existing' ? 'Add recording day' : 'Import as new animal';

  return (
    <main id="main-content" tabIndex={-1} role="main" aria-labelledby="import-heading">
      <div className={styles.screen}>
        <nav className={styles.crumb} aria-label="Breadcrumb">
          <a href="#/workspace">Animals</a> › Import
        </nav>
        <h1 id="import-heading" className={styles.heading}>Import metadata YAML</h1>

        <div className={styles.card}>
          <div className={styles.fileRow}>
            <span className={styles.fileName}>{decoded.sourceName}</span>
            <button type="button" className={styles.changeFile} onClick={reset}>
              Choose a different file
            </button>
          </div>
          <p className={styles.decision} role="status">
            {plan.decision.kind === 'existing'
              ? `An animal named “${subjectId}” already exists — these records will be added to it as a recording day.`
              : plan.decision.kind === 'new'
                ? `This file will create a new animal: “${subjectId}”.`
                : plan.decision.reason}
          </p>
        </div>

        {attention.length > 0 && (
          <section className={styles.section} aria-label="Needs attention">
            <h2 className={styles.sectionHeading}>Needs attention</h2>
            {attention.map((item) => (
              <RepairRow
                key={item.path}
                item={item}
                value={resolutions[item.path]}
                accepted={item.path in resolutions}
                onAccept={() => setResolution(item.path, item.suggested)}
                onInput={(v) => setResolution(item.path, v)}
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
                value={resolutions[item.path]}
                accepted={false}
                onAccept={() => undefined}
                onInput={(v) => setResolution(item.path, v)}
              />
            ))}
          </section>
        )}

        {plan.blockers.length > 0 && (
          <section className={styles.section} aria-label="Fix in the file">
            <h2 className={styles.sectionHeading}>Fix in the file, then re-import</h2>
            <ul className={styles.blockerList}>
              {plan.blockers.map((b) => (
                <li key={`${b.path}-${b.code}`} role="alert">
                  <strong>{b.path}:</strong> {b.why}
                </li>
              ))}
            </ul>
          </section>
        )}

        {plan.benign.length > 0 && (
          <section className={styles.benign} aria-label="Auto-normalized on import">
            <p className={styles.benignTitle}>Auto-normalized on import (format only, no data change):</p>
            <ul>
              {plan.benign.map((b) => (
                <li key={`${b.path}-${b.label}`}>{b.detail}</li>
              ))}
            </ul>
            <p className={styles.benignNote}>
              Nothing that can&apos;t be mapped is silently dropped — anything unmappable stays
              flagged above.
            </p>
          </section>
        )}

        <div className={styles.actions}>
          <Button disabled={!canImport} onClick={handleImport}>
            {importLabel}
          </Button>
          {!canImport && (
            <span className={styles.blockerHint} role="status">
              {plan.decision.kind === 'blocked'
                ? plan.decision.reason
                : `Accept or fill every flagged field to import (${remainingErrors.length} still blocking).`}
            </span>
          )}
          <span className={styles.spacer} />
          <a className={styles.cancelLink} href="#/workspace">Cancel</a>
        </div>
      </div>
    </main>
  );
}

/** Props for a single repair row. */
interface RepairRowProps {
  /** The repair item. */
  item: RepairItem;
  /** The current resolution value for this item. */
  value: unknown;
  /** Whether a suggestion has been accepted (or any value set). */
  accepted: boolean;
  /** Accept the suggested value. */
  onAccept: () => void;
  /** Set a user-entered value. */
  onInput: (value: unknown) => void;
}

/**
 * One repair row: a suggestion (was → suggested, with Accept) or a user-input field.
 *
 * @param props - The row props.
 * @param props.item - The repair item.
 * @param props.value - The current resolution value.
 * @param props.accepted - Whether a value has been set for this item.
 * @param props.onAccept - Accept the suggested value.
 * @param props.onInput - Set a user-entered value.
 * @returns The rendered row.
 */
function RepairRow({ item, value, accepted, onAccept, onInput }: RepairRowProps) {
  const dateValue = item.inputType === 'date' ? String(value ?? '').slice(0, 10) : '';

  return (
    <div className={styles.row}>
      <div className={styles.rowBody}>
        <div className={styles.rowLabel}>{item.label}</div>
        {item.kind === 'suggestion' ? (
          <div className={styles.rowDetail}>
            <span className={styles.was}>{display(item.was)}</span>
            <span aria-hidden="true"> → </span>
            <span className={styles.now}>{display(item.suggested)}</span>
          </div>
        ) : null}
        <div className={styles.rowWhy}>{item.why}</div>
      </div>
      <div className={styles.rowAction}>
        {item.kind === 'suggestion' && (
          <Button
            variant={accepted ? 'secondary' : 'primary'}
            size="small"
            aria-label={`Accept ${item.label}`}
            aria-pressed={accepted}
            onClick={onAccept}
          >
            {accepted ? 'Accepted ✓' : 'Accept'}
          </Button>
        )}
        {(item.kind === 'input' || accepted) && item.inputType === 'date' && (
          <input
            type="date"
            aria-label={item.label}
            value={dateValue}
            onChange={(e) => onInput(e.target.value ? `${e.target.value}T00:00:00` : '')}
          />
        )}
        {item.kind === 'input' && item.inputType !== 'date' && (
          <input
            type={item.inputType === 'number' ? 'number' : 'text'}
            aria-label={item.label}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) =>
              onInput(
                item.inputType === 'number' && e.target.value !== ''
                  ? Number(e.target.value)
                  : e.target.value
              )
            }
          />
        )}
      </div>
    </div>
  );
}
