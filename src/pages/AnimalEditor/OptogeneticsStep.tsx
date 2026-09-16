import { EXCITATION_FIELDS, FIBER_FIELDS, VIRUS_FIELDS, optoSetupCompleteness } from '../../domain/optoEditorFields';
import type { OptoFieldDef } from '../../domain/optoEditorFields';
import Button from '../../components/ui/Button';
import { useState } from 'react';
import type { ReactNode } from 'react';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';

/** Completed records can be folded away; typing never closes the record automatically. */
function OptoRecord({ label, complete, children }: { label: string; complete: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(!complete);
  return <details className="opto-record" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>{label} <span>{complete ? 'Complete' : 'To finish'}</span></summary>
    <div className="opto-record-fields">{children}</div>
  </details>;
}

/**
 * The (enabled) optogenetics block as this editor works with it: the three repeatable sections are
 * coerced to arrays of records, plus a tolerant index signature for any other spread-through fields.
 */
interface OptoBlock {
  opto_excitation_source: Array<Record<string, unknown>>;
  optical_fiber: Array<Record<string, unknown>>;
  virus_injection: Array<Record<string, unknown>>;
  optogenetic_stimulation_software?: unknown;
  [key: string]: unknown;
}

/**
 * Workspace optogenetics editor (Animal Editor step).
 *
 * Optogenetics is a recording manipulation with an explicit ENABLED/OFF state, not
 * hidden optional metadata. When off, no opto metadata is expected and the export emits
 * none. When on, the four converter-required animal-level sections are revealed and
 * required; trodes_to_nwb silently drops ALL optogenetics unless every section is
 * present, so an incomplete opto session is surfaced here and blocked at export by the
 * `partial_configuration` rule.
 *
 * The day-level FsGUI protocol files (`fs_gui_yamls`) are edited in the Day Editor (they
 * carry per-day epoch + camera references); this step owns the animal-level sections:
 * a single excitation source (trodes_to_nwb rejects more than one), optical fibers,
 * virus injections, and the stimulation software name.
 *
 * State source of truth is `animal.optogenetics`; edits commit immediately through
 * `onUpdate({ optogenetics })`, mirroring the other Animal Editor sections.
 */

/** Empty item for a section, with every field defaulted to a controllable value. */
function emptyItem(fields: OptoFieldDef[]): Record<string, unknown> {
  // Every field starts as '' so the input is controlled and the required check fires.
  return Object.fromEntries(fields.map((f): [string, string] => [f.name, '']));
}

/** A fresh, enabled-but-empty optogenetics block (one excitation source, no fibers/viruses). */
function defaultOptogenetics(): Record<string, unknown> {
  return {
    opto_excitation_source: [emptyItem(EXCITATION_FIELDS)],
    optical_fiber: [],
    virus_injection: [],
    optogenetic_stimulation_software: 'fsgui',
  };
}

/** Parse a number-field input value: '' stays '' (so the required check fires), else Number. */
function parseFieldValue(type: string, raw: string): string | number {
  if (type !== 'number') return raw;
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

interface OptogeneticsStepProps {
  /** The owning animal; `optogenetics` and its disabled draft are read (tolerant of corrupt/absent shapes). */
  animal?: { optogenetics?: unknown; optogeneticsDraft?: unknown } | null;
  /** Commit callback — receives `{ optogenetics }` (a block, or null when disabled). */
  onUpdate: (update: { optogenetics: unknown; optogeneticsDraft?: unknown }) => void;
}

/**
 * Workspace optogenetics editor — see the module header for the enabled/off contract.
 */
export default function OptogeneticsStep({ animal, onUpdate }: OptogeneticsStepProps) {
  const [pendingRemoval, setPendingRemoval] = useState<{ key: 'optical_fiber' | 'virus_injection'; index: number } | null>(null);
  // Treat opto as ENABLED only when it is a real record. A corrupt persisted/imported scalar
  // (e.g. `optogenetics: "x"`) reads as OFF — the safe default — rather than crashing. When
  // enabled, coerce the three nested lists to arrays so a malformed shape (e.g.
  // `{ opto_excitation_source: "x" }`) degrades to an editable form instead of throwing on
  // `.length`/`.map`/spread (which would trip the root ErrorBoundary and blank the whole app).
  // A lone object (a single item written without its array wrapper, hand-edited) is PRESERVED as a
  // one-item list rather than dropped, so real data isn't silently lost; a true scalar becomes `[]`.
  // Editing then commits the repaired array shape. Raw-shape validation does not cover nested opto,
  // so this render guard is the line of defense.
  const asItemList = (value: unknown): Array<Record<string, unknown>> =>
    Array.isArray(value) ? value : value !== null && typeof value === 'object' ? [value as Record<string, unknown>] : [];
  const rawOpto = animal?.optogenetics;
  const enabled = rawOpto !== null && typeof rawOpto === 'object' && !Array.isArray(rawOpto);
  // Narrow the tolerant raw value to a record for the (enabled) builder; null when disabled.
  const optoRecord = enabled ? (rawOpto as Record<string, unknown>) : null;
  const opto: OptoBlock | null = optoRecord
    ? {
        ...optoRecord,
        opto_excitation_source: asItemList(optoRecord.opto_excitation_source),
        optical_fiber: asItemList(optoRecord.optical_fiber),
        virus_injection: asItemList(optoRecord.virus_injection),
      }
    : null;

  const commit = (next: Record<string, unknown> | null) => onUpdate({ optogenetics: next });

  const saved = animal?.optogeneticsDraft;
  const savedSetup = saved && typeof saved === 'object' && !Array.isArray(saved)
    ? saved as Record<string, unknown> : null;
  const setEnabled = (on: boolean) => onUpdate(on
    ? { optogenetics: savedSetup ?? defaultOptogenetics(), optogeneticsDraft: null }
    : { optogenetics: null, optogeneticsDraft: optoRecord });

  // Update a scalar field on the (single) excitation source.
  const updateSource = (field: OptoFieldDef, value: string) => {
    if (!opto) return;
    const sources = opto.opto_excitation_source.length > 0
      ? opto.opto_excitation_source
      : [emptyItem(EXCITATION_FIELDS)];
    const updated = [{ ...sources[0], [field.name]: parseFieldValue(field.type, value) }];
    commit({ ...opto, opto_excitation_source: updated });
  };

  // Generic add/remove/update for the multi-item sections (optical_fiber, virus_injection).
  const addItem = (key: 'optical_fiber' | 'virus_injection', fields: OptoFieldDef[]) => {
    if (!opto) return;
    commit({ ...opto, [key]: [...opto[key], emptyItem(fields)] });
  };

  const removeItem = (key: 'optical_fiber' | 'virus_injection', index: number) => {
    if (!opto) return;
    if (Object.values(opto[key][index] ?? {}).some((value) => value != null && String(value).trim() !== '')) {
      setPendingRemoval({ key, index });
    } else {
      commit({ ...opto, [key]: opto[key].filter((_, i) => i !== index) });
    }
  };

  const updateItem = (key: 'optical_fiber' | 'virus_injection', index: number, field: OptoFieldDef, value: string) => {
    if (!opto) return;
    const next = opto[key].map((item, i) =>
      i === index ? { ...item, [field.name]: parseFieldValue(field.type, value) } : item
    );
    commit({ ...opto, [key]: next });
  };

  const renderField = (field: OptoFieldDef, value: unknown, onChange: (field: OptoFieldDef, value: string) => void, idPrefix: string) => {
    const id = `${idPrefix}-${field.name}`;
    const helpId = field.help ? `${id}-help` : undefined;
    const helpNode = field.help ? (
      <small id={helpId} className="opto-field-help help-text">
        {field.help}
      </small>
    ) : null;
    if (field.type === 'datalist') {
      const listId = `${id}-list`;
      return (
        <label key={field.name} htmlFor={id} className="opto-field form-field-label">
          <span>{field.label} <span className="required-marker" aria-hidden="true">*</span></span>
          <input
            id={id}
            type="text"
            list={listId}
            placeholder={field.placeholder}
            value={(value as string | number | undefined) ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            aria-describedby={helpId}
            aria-required="true"
          />
          <datalist id={listId}>
            {field.options!.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
          {helpNode}
        </label>
      );
    }
    if (field.type === 'select') {
      return (
        <label key={field.name} htmlFor={id} className="opto-field form-field-label">
          <span>{field.label} <span className="required-marker" aria-hidden="true">*</span></span>
          <select
            id={id}
            value={(value as string | number | undefined) ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            aria-describedby={helpId}
            aria-required="true"
          >
            <option value="">— select —</option>
            {field.options!.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {helpNode}
        </label>
      );
    }
    return (
      <label key={field.name} htmlFor={id} className="opto-field form-field-label">
        <span>{field.label} <span className="required-marker" aria-hidden="true">*</span></span>
        <input
          id={id}
          type={field.type}
          step={field.type === 'number' ? 'any' : undefined}
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          aria-describedby={helpId}
            aria-required="true"
        />
        {helpNode}
      </label>
    );
  };

  // Completeness mirrors the converter gate (and the partial_configuration export rule).
  const sectionReadiness = optoSetupCompleteness(opto);
  const completeness = opto ? {
    source: sectionReadiness.opto_excitation_source,
    fiber: sectionReadiness.optical_fiber,
    virus: sectionReadiness.virus_injection,
    software: sectionReadiness.optogenetic_stimulation_software,
  } : null;
  const isComplete = completeness && Object.values(completeness).every(Boolean);

  return (
    <section className="opto-step" aria-labelledby="opto-heading">
      <h2 id="opto-heading">Optogenetics Setup</h2>

      {/* Phase 8.7 Task 7: make the set-once-vs-per-day split explicit. This step is the animal's
          IMPLANTED setup (surgery/virus/source/software), edited once for the animal. What was
          actually STIMULATED is recorded per recording day in that day's Epochs step (FsGUI
          protocols), scoped to selected epochs — and is OPTIONAL: an opto-implanted animal can run
          no stimulation on a day, or only during some epochs, and that is a normal, valid state. */}
      {enabled && <p className="help-text">
        Animal default. Existing recordings keep their saved setup. Enter the implanted source, fibers, virus injections and stimulation software; starred fields are required before export.
      </p>}

      <label className="opto-enable" htmlFor="opto-enabled">
        <input
          id="opto-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>This animal has optogenetics</span>
      </label>

      {!enabled && (
        <p className="help-text">
          {savedSetup ? 'Saved setup retained; enable to restore it.' : 'No stimulation setup.'} Existing recordings keep their saved setup.
        </p>
      )}

      {opto && (
        <>
          {completeness && !isComplete && (
            <p className="opto-incomplete" role="status">
              Complete before export: {' '}
              {[
                !completeness.source && 'a complete excitation source',
                !completeness.fiber && 'a complete optical fiber',
                !completeness.virus && 'a complete virus injection',
                !completeness.software && 'the stimulation software name',
              ].filter(Boolean).join(', ')}.

            </p>
          )}

          {/* Excitation source — exactly one (trodes_to_nwb rejects more than one). */}
          <fieldset className="opto-section form-field-group">
            <legend>Excitation source</legend>
            <OptoRecord label={String(opto.opto_excitation_source[0]?.name || 'Source details')} complete={sectionReadiness.opto_excitation_source}>
            <div className="form-container">
              {EXCITATION_FIELDS.map((field) =>
                renderField(
                  field,
                  opto.opto_excitation_source[0]?.[field.name],
                  updateSource,
                  'opto-source'
                )
              )}
            </div>
            </OptoRecord>
          </fieldset>

          {/* Optical fibers — one or more. */}
          <fieldset className="opto-section form-field-group">
            <legend>Optical fibers</legend>
            {opto.optical_fiber.map((item, index) => (
              <div key={`fiber-${index}`} className="opto-item">
                <OptoRecord label={String(item.name || `Fiber ${index + 1}`)} complete={optoSetupCompleteness({ optical_fiber: [item] }).optical_fiber}>
                {['Identity & location', 'Coordinates & angles'].map((group, groupIndex) => <fieldset key={group} className="form-field-group">
                  <legend>{group}</legend>
                  <div className="form-container">
                    {FIBER_FIELDS.filter((field) => /_in_mm$|_in_deg$|^reference$/.test(field.name) === (groupIndex === 1)).map((field) =>
                      renderField(field, item[field.name], (f, v) => updateItem('optical_fiber', index, f, v), `opto-fiber-${index}`)
                    )}
                  </div>
                </fieldset>)}
                <Button
                  variant="secondary"
                  onClick={() => removeItem('optical_fiber', index)}
                  aria-label={`Remove optical fiber ${index + 1}`}
                >
                  Remove fiber
                </Button>
                </OptoRecord>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => addItem('optical_fiber', FIBER_FIELDS)}
            >
              Add optical fiber
            </Button>
          </fieldset>

          {/* Virus injections — one or more. */}
          <fieldset className="opto-section form-field-group">
            <legend>Virus injections</legend>
            {opto.virus_injection.map((item, index) => (
              <div key={`virus-${index}`} className="opto-item">
                <OptoRecord label={String(item.name || `Injection ${index + 1}`)} complete={optoSetupCompleteness({ virus_injection: [item] }).virus_injection}>
                {['Identity & location', 'Coordinates & angles'].map((group, groupIndex) => <fieldset key={group} className="form-field-group">
                  <legend>{group}</legend>
                  <div className="form-container">
                    {VIRUS_FIELDS.filter((field) => /_in_mm$|_in_deg$|^reference$/.test(field.name) === (groupIndex === 1)).map((field) =>
                      renderField(field, item[field.name], (f, v) => updateItem('virus_injection', index, f, v), `opto-virus-${index}`)
                    )}
                  </div>
                </fieldset>)}
                <Button
                  variant="secondary"
                  onClick={() => removeItem('virus_injection', index)}
                  aria-label={`Remove virus injection ${index + 1}`}
                >
                  Remove injection
                </Button>
                </OptoRecord>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => addItem('virus_injection', VIRUS_FIELDS)}
            >
              Add virus injection
            </Button>
          </fieldset>

          {/* Stimulation software (converter gate key). */}
          <fieldset className="opto-section form-field-group">
            <legend>Stimulation software</legend>
            <label htmlFor="opto-software" className="opto-field form-field-label">
              <span>Optogenetic stimulation software <span className="required-marker" aria-hidden="true">*</span></span>
              <input
                id="opto-software"
                type="text"
                aria-required="true"
                value={(opto.optogenetic_stimulation_software as string | undefined) ?? ''}
                onChange={(e) =>
                  commit({ ...opto, optogenetic_stimulation_software: e.target.value })
                }
              />
            </label>
          </fieldset>
        </>
      )}
      <ConfirmDialog
        isOpen={pendingRemoval !== null}
        title={pendingRemoval?.key === 'optical_fiber' ? 'Remove this optical fiber?' : 'Remove this virus injection?'}
        message="This removes the entered record from the animal’s setup. Existing recording days keep their own setup."
        confirmLabel="Remove record"
        cancelLabel="Keep record"
        destructive
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (opto && pendingRemoval) commit({ ...opto, [pendingRemoval.key]: opto[pendingRemoval.key].filter((_, i) => i !== pendingRemoval.index) });
          setPendingRemoval(null);
        }}
      />
    </section>
  );
}
