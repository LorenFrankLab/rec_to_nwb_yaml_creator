import React from 'react';
import PropTypes from 'prop-types';
import {
  optoExcitationModelNames,
  opticalFiberModelNames,
  virusNames,
} from '../../valueList';

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

// These names are EXACT lookup keys into trodes_to_nwb's device metadata (a miss raises
// a ValueError). The bundled catalogs are offered as suggestions (datalist) for
// discoverability, but free entry is preserved because a lab may add a custom device file.
const EXCITATION_FIELDS = [
  { name: 'name', label: 'Setup name', type: 'text' },
  { name: 'model_name', label: 'Hardware model name', type: 'datalist', options: optoExcitationModelNames() },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'wavelength_in_nm', label: 'Wavelength (nm)', type: 'number', placeholder: 'e.g. 473' },
  { name: 'power_in_W', label: 'Source power (W)', type: 'number', placeholder: 'e.g. 10' },
  { name: 'intensity_in_W_per_m2', label: 'Intensity (W/m²)', type: 'number', placeholder: 'e.g. 1.0' },
];

const FIBER_FIELDS = [
  { name: 'name', label: 'Fiber implant name', type: 'text' },
  { name: 'hardware_name', label: 'Fiber hardware model', type: 'datalist', options: opticalFiberModelNames() },
  { name: 'implanted_fiber_description', label: 'Implant description', type: 'text' },
  { name: 'hemisphere', label: 'Hemisphere', type: 'select', options: ['left', 'right'] },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'ap_in_mm', label: 'AP (mm)', type: 'number' },
  { name: 'ml_in_mm', label: 'ML (mm)', type: 'number' },
  { name: 'dv_in_mm', label: 'DV (mm)', type: 'number' },
  { name: 'roll_in_deg', label: 'Roll (deg)', type: 'number' },
  { name: 'pitch_in_deg', label: 'Pitch (deg)', type: 'number' },
  { name: 'yaw_in_deg', label: 'Yaw (deg)', type: 'number' },
  // Coordinate reference — required by trodes_to_nwb (read unconditionally).
  {
    name: 'reference',
    label: 'Coordinate reference',
    type: 'text',
    placeholder: 'e.g. bregma',
    help: 'Stereotaxic reference for the AP/ML/DV coordinates.',
  },
];

const VIRUS_FIELDS = [
  { name: 'name', label: 'Injection name', type: 'text' },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'virus_name', label: 'Virus name', type: 'datalist', options: virusNames() },
  // volume_in_uL is the converter spelling; the export also emits volume_in_ul.
  { name: 'volume_in_uL', label: 'Volume (µL)', type: 'number' },
  { name: 'titer_in_vg_per_ml', label: 'Titer (vg/mL)', type: 'number' },
  { name: 'hemisphere', label: 'Hemisphere', type: 'select', options: ['left', 'right'] },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'ap_in_mm', label: 'AP (mm)', type: 'number' },
  { name: 'ml_in_mm', label: 'ML (mm)', type: 'number' },
  { name: 'dv_in_mm', label: 'DV (mm)', type: 'number' },
  { name: 'roll_in_deg', label: 'Roll (deg)', type: 'number' },
  { name: 'pitch_in_deg', label: 'Pitch (deg)', type: 'number' },
  { name: 'yaw_in_deg', label: 'Yaw (deg)', type: 'number' },
  // Coordinate reference — required by trodes_to_nwb (read unconditionally).
  {
    name: 'reference',
    label: 'Coordinate reference',
    type: 'text',
    placeholder: 'e.g. bregma',
    help: 'Stereotaxic reference for the AP/ML/DV coordinates.',
  },
];

/**
 * Empty item for a section, with every field defaulted to a controllable value.
 * @param fields
 */
function emptyItem(fields) {
  // Every field starts as '' so the input is controlled and the required check fires.
  return Object.fromEntries(fields.map((f) => [f.name, '']));
}

/**
 * True when a value is a non-empty scalar (0 counts as filled; '' / null / undefined do not).
 * @param value
 */
function isFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * True when an array has at least one item with EVERY one of `fields` filled in. Used for
 * the completeness checklist so it reflects export-readiness (all converter/schema-required
 * fields present), not merely that a row was added.
 * @param items
 * @param fields
 */
function hasCompleteItem(items, fields) {
  return Array.isArray(items) && items.some((it) => fields.every((f) => isFilled(it?.[f.name])));
}

/** A fresh, enabled-but-empty optogenetics block (one excitation source, no fibers/viruses). */
function defaultOptogenetics() {
  return {
    opto_excitation_source: [emptyItem(EXCITATION_FIELDS)],
    optical_fiber: [],
    virus_injection: [],
    optogenetic_stimulation_software: 'fsgui',
  };
}

/**
 * Parse a number-field input value: '' stays '' (so the required check fires), else Number.
 * @param type
 * @param raw
 */
function parseFieldValue(type, raw) {
  if (type !== 'number') return raw;
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

/**
 *
 * @param root0
 * @param root0.animal
 * @param root0.onUpdate
 */
export default function OptogeneticsStep({ animal, onUpdate }) {
  // Treat opto as ENABLED only when it is a real record. A corrupt persisted/imported scalar
  // (e.g. `optogenetics: "x"`) reads as OFF — the safe default — rather than crashing. When
  // enabled, coerce the three nested lists to arrays so a malformed shape (e.g.
  // `{ opto_excitation_source: "x" }`) degrades to an editable form instead of throwing on
  // `.length`/`.map`/spread (which would trip the root ErrorBoundary and blank the whole app).
  // A lone object (a single item written without its array wrapper, hand-edited) is PRESERVED as a
  // one-item list rather than dropped, so real data isn't silently lost; a true scalar becomes `[]`.
  // Editing then commits the repaired array shape. Raw-shape validation does not cover nested opto,
  // so this render guard is the line of defense.
  const asItemList = (value) =>
    Array.isArray(value) ? value : value !== null && typeof value === 'object' ? [value] : [];
  const rawOpto = animal?.optogenetics;
  const enabled = rawOpto !== null && typeof rawOpto === 'object' && !Array.isArray(rawOpto);
  const opto = enabled
    ? {
        ...rawOpto,
        opto_excitation_source: asItemList(rawOpto.opto_excitation_source),
        optical_fiber: asItemList(rawOpto.optical_fiber),
        virus_injection: asItemList(rawOpto.virus_injection),
      }
    : null;

  const commit = (next) => onUpdate({ optogenetics: next });

  const setEnabled = (on) => commit(on ? defaultOptogenetics() : null);

  // Update a scalar field on the (single) excitation source.
  const updateSource = (field, value) => {
    const sources = opto.opto_excitation_source.length > 0
      ? opto.opto_excitation_source
      : [emptyItem(EXCITATION_FIELDS)];
    const updated = [{ ...sources[0], [field.name]: parseFieldValue(field.type, value) }];
    commit({ ...opto, opto_excitation_source: updated });
  };

  // Generic add/remove/update for the multi-item sections (optical_fiber, virus_injection).
  const addItem = (key, fields) =>
    commit({ ...opto, [key]: [...opto[key], emptyItem(fields)] });

  const removeItem = (key, index) =>
    commit({ ...opto, [key]: opto[key].filter((_, i) => i !== index) });

  const updateItem = (key, index, field, value) => {
    const next = opto[key].map((item, i) =>
      i === index ? { ...item, [field.name]: parseFieldValue(field.type, value) } : item
    );
    commit({ ...opto, [key]: next });
  };

  const renderField = (field, value, onChange, idPrefix) => {
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
        <label key={field.name} htmlFor={id} className="opto-field">
          <span>{field.label}</span>
          <input
            id={id}
            type="text"
            list={listId}
            placeholder={field.placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            aria-describedby={helpId}
          />
          <datalist id={listId}>
            {field.options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
          {helpNode}
        </label>
      );
    }
    if (field.type === 'select') {
      return (
        <label key={field.name} htmlFor={id} className="opto-field">
          <span>{field.label}</span>
          <select
            id={id}
            value={value ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            aria-describedby={helpId}
          >
            <option value="">— select —</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {helpNode}
        </label>
      );
    }
    return (
      <label key={field.name} htmlFor={id} className="opto-field">
        <span>{field.label}</span>
        <input
          id={id}
          type={field.type}
          step={field.type === 'number' ? 'any' : undefined}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          aria-describedby={helpId}
        />
        {helpNode}
      </label>
    );
  };

  // Completeness mirrors the converter gate (and the partial_configuration export rule).
  const completeness = enabled
    ? {
        // "Complete" means a fully-filled row (every required field), not just an added /
        // named one — so the checklist doesn't read done while required fields are blank.
        source: hasCompleteItem(opto.opto_excitation_source, EXCITATION_FIELDS),
        fiber: hasCompleteItem(opto.optical_fiber, FIBER_FIELDS),
        virus: hasCompleteItem(opto.virus_injection, VIRUS_FIELDS),
        software:
          typeof opto.optogenetic_stimulation_software === 'string' &&
          opto.optogenetic_stimulation_software.trim() !== '',
      }
    : null;
  const isComplete = completeness && Object.values(completeness).every(Boolean);

  return (
    <section className="opto-step" aria-labelledby="opto-heading">
      <h2 id="opto-heading">Optogenetics Setup</h2>

      {/* Phase 8.7 Task 7: make the set-once-vs-per-day split explicit. This step is the animal's
          IMPLANTED setup (surgery/virus/source/software), edited once for the animal. What was
          actually STIMULATED is recorded per recording day in that day's Epochs step (FsGUI
          protocols), scoped to selected epochs — and is OPTIONAL: an opto-implanted animal can run
          no stimulation on a day, or only during some epochs, and that is a normal, valid state. */}
      <p className="help-text">
        This is the animal&apos;s <strong>implanted opto setup</strong> (excitation source, optical
        fiber, virus injection, stimulation software) — set it once here. What was actually
        stimulated is recorded per recording day in that day&apos;s Epochs step, scoped to the epochs
        it ran; a day or epoch with no stimulation needs nothing here.
      </p>

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
          Optogenetics is off. No optogenetics metadata will be exported. Turn it on only
          if this animal’s recordings include optogenetic stimulation.
        </p>
      )}

      {enabled && (
        <>
          {!isComplete && (
            <p className="opto-incomplete" role="status">
              This app blocks export until every optogenetics section below is complete; still
              missing: {' '}
              {[
                !completeness.source && 'a complete excitation source',
                !completeness.fiber && 'a complete optical fiber',
                !completeness.virus && 'a complete virus injection',
                !completeness.software && 'the stimulation software name',
              ].filter(Boolean).join(', ')}.
              {' '}
              Separately, if a partial file like this were fed straight to the conversion tool, it
              would silently drop the <strong>entire</strong> optogenetics block with no error — which
              is exactly what this export gate prevents.
            </p>
          )}

          {/* Excitation source — exactly one (trodes_to_nwb rejects more than one). */}
          <fieldset className="opto-section">
            <legend>Excitation source</legend>
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
          </fieldset>

          {/* Optical fibers — one or more. */}
          <fieldset className="opto-section">
            <legend>Optical fibers</legend>
            {opto.optical_fiber.map((item, index) => (
              <div key={`fiber-${index}`} className="opto-item">
                <div className="form-container">
                  {FIBER_FIELDS.map((field) =>
                    renderField(
                      field,
                      item[field.name],
                      (f, v) => updateItem('optical_fiber', index, f, v),
                      `opto-fiber-${index}`
                    )
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeItem('optical_fiber', index)}
                  aria-label={`Remove optical fiber ${index + 1}`}
                >
                  Remove fiber
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => addItem('optical_fiber', FIBER_FIELDS)}
            >
              Add optical fiber
            </button>
          </fieldset>

          {/* Virus injections — one or more. */}
          <fieldset className="opto-section">
            <legend>Virus injections</legend>
            {opto.virus_injection.map((item, index) => (
              <div key={`virus-${index}`} className="opto-item">
                <div className="form-container">
                  {VIRUS_FIELDS.map((field) =>
                    renderField(
                      field,
                      item[field.name],
                      (f, v) => updateItem('virus_injection', index, f, v),
                      `opto-virus-${index}`
                    )
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeItem('virus_injection', index)}
                  aria-label={`Remove virus injection ${index + 1}`}
                >
                  Remove injection
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => addItem('virus_injection', VIRUS_FIELDS)}
            >
              Add virus injection
            </button>
          </fieldset>

          {/* Stimulation software (converter gate key). */}
          <fieldset className="opto-section">
            <legend>Stimulation software</legend>
            <label htmlFor="opto-software" className="opto-field">
              <span>Optogenetic stimulation software</span>
              <input
                id="opto-software"
                type="text"
                value={opto.optogenetic_stimulation_software ?? ''}
                onChange={(e) =>
                  commit({ ...opto, optogenetic_stimulation_software: e.target.value })
                }
              />
            </label>
          </fieldset>
        </>
      )}
    </section>
  );
}

OptogeneticsStep.propTypes = {
  animal: PropTypes.shape({
    optogenetics: PropTypes.object,
  }),
  onUpdate: PropTypes.func.isRequired,
};
