/**
 * @fileoverview The PURE spine of the Import & Repair screen.
 *
 * Given a decoded flat NWB YAML model, this turns the EXISTING validator's findings into a list of
 * per-field repair items — each with a suggested fix derived from the SAME predicate that flagged
 * it — plus the new-animal vs existing-day decision and the benign (format-only) normalizations the
 * commit applies. It owns NO second validator: it calls {@link module:validation.validate} (the
 * export gate's own schema + rules) and {@link module:validation/dandiSubject.isValidSpecies}, and
 * every SUGGESTED value is gated by the predicate that flagged the original (a species suggestion
 * must pass `isValidSpecies`, a sex suggestion must be in the schema enum). Nothing is silently
 * dropped: each flagged item carries the original value verbatim, unmappable values surface as
 * user-input rows (never auto-erased), and any error this screen can't repair in place becomes a
 * `blocker` (fix-in-file) rather than a misleading editable row.
 *
 * The screen SUGGESTS; the user accepts/edits. {@link applyImportRepairs} then produces a repaired
 * model (deep-cloned, input never mutated) that the commit path ({@link module:state/yamlImportPlan}
 * + {@link module:state/yamlImportApply}) consumes unchanged — so there is exactly one importer.
 *
 * @module state/importRepair
 */

import { validate } from '../validation';
import { isValidSpecies } from '../validation/dandiSubject';
import { findExistingAnimalId } from './yamlImportPlan';
import type { ValidationModel } from '../validation/issueTypes';

/** The schema enum for `subject.sex` (mirrors nwb_schema.json — single-letter NWB/DANDI codes). */
const SEX_ENUM: ReadonlyArray<string> = ['M', 'F', 'U', 'O'];

/**
 * Root-required fields that are structured collections (an array of strings / of device objects) —
 * a single inline value can't repair them, so a MISSING one is a fix-in-file blocker, not an input.
 * (The other root-required fields — `lab`, `institution`, `times_period_multiplier`,
 * `raw_data_to_volts` — and every required `subject.*` field are scalars the user can supply inline.)
 */
const STRUCTURED_REQUIRED_FIELDS: ReadonlySet<string> = new Set(['experimenter_name', 'data_acq_device']);

/**
 * Free-text → DANDI-valid species suggestions. The KEY is a lower-cased, trimmed lookup of the
 * source value; the VALUE is a Latin binomial that MUST pass `isValidSpecies` (a unit test asserts
 * this). A source value with no entry gets NO suggestion — it surfaces as a user-input row rather
 * than being laundered into a guess.
 */
const SPECIES_SUGGESTIONS: Readonly<Record<string, string>> = {
  rat: 'Rattus norvegicus',
  rats: 'Rattus norvegicus',
  'long evans': 'Rattus norvegicus',
  'long-evans': 'Rattus norvegicus',
  'long evans rat': 'Rattus norvegicus',
  'long-evans rat': 'Rattus norvegicus',
  'sprague dawley': 'Rattus norvegicus',
  'sprague-dawley': 'Rattus norvegicus',
  mouse: 'Mus musculus',
  mice: 'Mus musculus',
  marmoset: 'Callithrix jacchus',
  macaque: 'Macaca mulatta',
  'rhesus macaque': 'Macaca mulatta',
  human: 'Homo sapiens',
};

/** Free-text → schema-enum sex suggestions (lower-cased, trimmed lookup). */
const SEX_SUGGESTIONS: Readonly<Record<string, string>> = {
  m: 'M',
  male: 'M',
  f: 'F',
  female: 'F',
  u: 'U',
  unknown: 'U',
  unspecified: 'U',
  o: 'O',
  other: 'O',
  hermaphrodite: 'O',
};

/** How a repair item is resolved in the UI. */
export type RepairKind = 'suggestion' | 'input';

/** Where the item is grouped in the screen (mirrors the mockup's two sections). */
export type RepairGroup = 'attention' | 'required';

/** One repairable field: a suggestion the user accepts, or a value the user must supply. */
export interface RepairItem {
  /** Dot/bracket path into the flat model (e.g. `subject.species`, `electrode_groups[0].location`). */
  path: string;
  /** Short human label for the field. */
  label: string;
  /** The validator code (or shim id) that produced this item — the item's provenance. */
  code: string;
  /** The section grouping. */
  group: RepairGroup;
  /** Whether the user accepts a suggested value or supplies one. */
  kind: RepairKind;
  /** The original value, verbatim (present whenever the field had one — never laundered away). */
  was?: unknown;
  /** The suggested value (present iff `kind === 'suggestion'`), gated by the flagging predicate. */
  suggested?: unknown;
  /** Why this is flagged (the validator's own message, or the shim explanation). */
  why: string;
  /** Hint for the input control the screen renders. */
  inputType: 'text' | 'number' | 'date';
}

/** An error this screen cannot repair in place (structural / cross-field) — fix in the file. */
export interface RepairBlocker {
  /** The error's path. */
  path: string;
  /** The validator code. */
  code: string;
  /** The validator's message. */
  why: string;
}

/** A format-only normalization the commit applies automatically (listed, never silent). */
export interface BenignNormalization {
  /** The path the normalization touches. */
  path: string;
  /** Short label. */
  label: string;
  /** What changed (and that no values were lost). */
  detail: string;
}

/** The new-animal vs existing-day routing for the parsed file. */
export type ImportDecision =
  | { kind: 'new'; subjectId: string }
  | { kind: 'existing'; subjectId: string; existingAnimalId: string }
  | { kind: 'blocked'; reason: string };

/** The full repair plan for one parsed file. */
export interface ImportRepairPlan {
  /** The source filename (for date attribution + display). */
  sourceName: string;
  /** Repairable fields (suggestions + user inputs), in stable order. */
  items: RepairItem[];
  /** Errors that can't be repaired in this screen (fix in the file, re-import). */
  blockers: RepairBlocker[];
  /** Benign, format-only normalizations the commit applies. */
  benign: BenignNormalization[];
  /** New-animal vs existing-day routing. */
  decision: ImportDecision;
  /** Whether `validate` reported any error (so the screen knows the file isn't clean as-is). */
  hasErrors: boolean;
}

/** A parsed path segment: an object key or an array index. */
type PathSegment = string | number;

/**
 * Parse a dot/bracket path into segments. `electrode_groups[0].location` →
 * `['electrode_groups', 0, 'location']`; `subject.species` → `['subject', 'species']`.
 *
 * @param p - The path string.
 * @returns The ordered segments (numeric indices coerced to numbers).
 */
function parsePath(p: string): PathSegment[] {
  return p
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '')
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/**
 * Read the value at a path, or `undefined` when any segment is absent. Shape-safe.
 *
 * @param model - The flat model.
 * @param p - The path.
 * @returns The value, or undefined.
 */
function getAtPath(model: unknown, p: string): unknown {
  let cursor: unknown = model;
  for (const seg of parsePath(p)) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<PathSegment, unknown>)[seg];
  }
  return cursor;
}

/**
 * Set the value at a path on a (mutable) target, creating intermediate objects/arrays as needed.
 * A numeric segment creates/extends an array; a string segment creates/uses an object.
 *
 * @param target - The object to mutate.
 * @param p - The path.
 * @param value - The value to set.
 */
function setAtPath(target: Record<string, unknown>, p: string, value: unknown): void {
  const segments = parsePath(p);
  let cursor: Record<PathSegment, unknown> = target as Record<PathSegment, unknown>;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (cursor[seg] === null || typeof cursor[seg] !== 'object') {
      cursor[seg] = typeof next === 'number' ? [] : {};
    }
    cursor = cursor[seg] as Record<PathSegment, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

/** A virus-injection array item carrying the two volume spellings. */
interface VolumeShimItem {
  volume_in_uL?: unknown;
  volume_in_ul?: unknown;
  [key: string]: unknown;
}

/**
 * Build the repair items + blockers for a model's `validate` errors. Known leaf codes map to
 * suggestions/inputs; everything else becomes a blocker (fix-in-file).
 *
 * @param model - The flat model.
 * @returns The items and blockers.
 */
function buildValidationItems(model: ValidationModel): {
  items: RepairItem[];
  blockers: RepairBlocker[];
} {
  const errors = validate(model).filter((issue) => issue.severity === 'error');
  const items: RepairItem[] = [];
  const blockers: RepairBlocker[] = [];
  // One field can draw multiple errors (e.g. a null location fails BOTH the schema `type` check and
  // the `empty_location` rule). Surface a path ONCE — the first matching error wins. `validate` sorts
  // by path then code, and today the repairable rule code sorts before the generic schema keyword at
  // each shared path (`empty_location` < `type`; species/sex/weight don't co-occur with a competing
  // same-path code), so the repairable item wins. NB: if a future repairable rule code at a shared
  // path sorted AFTER a co-occurring schema keyword, that keyword would win and shadow the repair as
  // a blocker — add an explicit "prefer the repairable code" rule here before that can happen.
  const handledPaths = new Set<string>();

  for (const issue of errors) {
    const { path, code, message } = issue;
    if (handledPaths.has(path)) continue;
    handledPaths.add(path);
    const was = getAtPath(model, path);

    // --- DANDI species: a free-text value → suggest a binomial from the shared canon. ---
    if (code === 'invalid_species') {
      const suggested = SPECIES_SUGGESTIONS[String(was).trim().toLowerCase()];
      if (suggested !== undefined && isValidSpecies(suggested)) {
        items.push({ path, label: 'Species', code, group: 'attention', kind: 'suggestion', was, suggested, why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Species', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- sex: not in the M/F/U/O set → suggest the single-letter code. ---
    if (code === 'enum' && path === 'subject.sex') {
      const suggested = SEX_SUGGESTIONS[String(was).trim().toLowerCase()];
      if (suggested !== undefined && SEX_ENUM.includes(suggested)) {
        items.push({ path, label: 'Sex', code, group: 'attention', kind: 'suggestion', was, suggested, why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Sex', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- weight: a "541g"-style string → suggest the parsed number. ---
    if (code === 'type' && path === 'subject.weight') {
      const parsed = parseFloat(String(was));
      if (Number.isFinite(parsed) && parsed >= 0) {
        items.push({ path, label: 'Weight (g)', code, group: 'attention', kind: 'suggestion', was, suggested: parsed, why: message, inputType: 'number' });
      } else {
        items.push({ path, label: 'Weight (g)', code, group: 'attention', kind: 'input', was, why: message, inputType: 'number' });
      }
      continue;
    }

    // --- experimenter_name: a scalar string → suggest wrapping into a single-item list (verbatim). ---
    if (code === 'type' && path === 'experimenter_name') {
      if (typeof was === 'string' && was.trim() !== '') {
        items.push({ path, label: 'Experimenter name', code, group: 'attention', kind: 'suggestion', was, suggested: [was], why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Experimenter name', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- electrode-group location: empty/null → the user supplies a region (never auto-filled). ---
    if (code === 'empty_location' || code === 'empty_targeted_location') {
      const label = code === 'empty_location' ? 'Electrode group location' : 'Electrode group targeted location';
      items.push({ path, label, code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      continue;
    }

    // A structured root-required field (an array/object) that is entirely MISSING can't be repaired
    // with a single inline value — surface it as a fix-in-file blocker instead of a text input that
    // could never satisfy the schema (which would falsely enable import, then fail at commit).
    if (code === 'required' && STRUCTURED_REQUIRED_FIELDS.has(path)) {
      blockers.push({ path, code, why: message });
      continue;
    }

    // --- required-but-missing / empty required field → blocks; the user supplies it. ---
    if (code === 'required' || code === 'pattern') {
      const inputType: RepairItem['inputType'] = path.endsWith('date_of_birth')
        ? 'date'
        : path.endsWith('weight')
          ? 'number'
          : 'text';
      const item: RepairItem = { path, label: leafLabel(path), code, group: 'required', kind: 'input', why: message, inputType };
      // A pattern violation has an (empty/whitespace) value; a required-missing field has none.
      if (code === 'pattern') item.was = was;
      items.push(item);
      continue;
    }

    // Anything else can't be repaired field-by-field here — surface it as a fix-in-file blocker.
    blockers.push({ path, code, why: message });
  }

  return { items, blockers };
}

/**
 * A human label for a leaf path (e.g. `subject.date_of_birth` → "Date of birth").
 *
 * @param p - The path.
 * @returns The label.
 */
function leafLabel(p: string): string {
  const leaf = parsePath(p).pop();
  return String(leaf ?? p)
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Detect the benign (format-only, lossless) normalizations the commit will apply, plus any
 * conflicting-volume reconcile items. Surfaces them so they are listed, never silent.
 *
 * @param model - The flat model.
 * @returns The benign normalizations and any extra reconcile items.
 */
function buildBenignAndShim(model: ValidationModel): {
  benign: BenignNormalization[];
  shimItems: RepairItem[];
} {
  const benign: BenignNormalization[] = [];
  const shimItems: RepairItem[] = [];

  // --- task_epoch (singular) → task_epochs in file/video lists (the field the app reads). ---
  for (const key of ['associated_files', 'associated_video_files'] as const) {
    const list = (model as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    const hasSingular = list.some(
      (item) => item && typeof item === 'object' && 'task_epoch' in (item as object)
    );
    if (hasSingular) {
      benign.push({
        path: key,
        label: 'task_epoch → task_epochs',
        detail: `Renamed \`task_epoch\` → \`task_epochs\` in ${key} (the field the app reads) — no values changed.`,
      });
    }
  }

  // --- virus_injection volume shim: one spelling present → benign fill; both differ → reconcile. ---
  const injections = (model as Record<string, unknown>).virus_injection;
  if (Array.isArray(injections)) {
    injections.forEach((raw, i) => {
      if (!raw || typeof raw !== 'object') return;
      const inj = raw as VolumeShimItem;
      const hasUpper = inj.volume_in_uL !== undefined;
      const hasLower = inj.volume_in_ul !== undefined;
      if (hasUpper && hasLower && inj.volume_in_uL !== inj.volume_in_ul) {
        // Conflict: trodes_to_nwb reads the capital-L spelling, so it is authoritative.
        shimItems.push({
          path: `virus_injection[${i}].volume_in_ul`,
          label: 'Virus injection volume',
          code: 'volume_shim_conflict',
          group: 'attention',
          kind: 'suggestion',
          was: inj.volume_in_ul,
          suggested: inj.volume_in_uL,
          why: 'volume_in_uL and volume_in_ul disagree. trodes_to_nwb reads volume_in_uL, so it is authoritative — both keys are kept, reconciled to that value.',
          inputType: 'number',
        });
      } else if (hasUpper !== hasLower) {
        benign.push({
          path: `virus_injection[${i}]`,
          label: 'volume_in_uL / volume_in_ul',
          detail: 'Filled the matching volume spelling so both keys are present (the converter reads volume_in_uL; the schema requires volume_in_ul).',
        });
      }
    });
  }

  return { benign, shimItems };
}

/**
 * Apply the benign, lossless normalizations to a (mutable) model: rename `task_epoch` → the
 * `task_epochs` key the app reads, and fill a missing volume spelling from the present one. Shared
 * by {@link buildImportRepairPlan} (which validates the NORMALIZED model, so a benign-fixable issue
 * never also surfaces as a repair item) and {@link applyImportRepairs}.
 *
 * @param model - The model to mutate in place.
 */
function applyBenignNormalizations(model: Record<string, unknown>): void {
  for (const key of ['associated_files', 'associated_video_files'] as const) {
    const list = model[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === 'object' && 'task_epoch' in (item as object)) {
        const obj = item as Record<string, unknown>;
        if (!('task_epochs' in obj)) obj.task_epochs = obj.task_epoch;
        delete obj.task_epoch;
      }
    }
  }

  const injections = model.virus_injection;
  if (Array.isArray(injections)) {
    for (const raw of injections) {
      if (!raw || typeof raw !== 'object') continue;
      const inj = raw as VolumeShimItem;
      const hasUpper = inj.volume_in_uL !== undefined;
      const hasLower = inj.volume_in_ul !== undefined;
      if (hasUpper && !hasLower) inj.volume_in_ul = inj.volume_in_uL;
      else if (hasLower && !hasUpper) inj.volume_in_uL = inj.volume_in_ul;
    }
  }
}

/**
 * Build the import-repair plan for a parsed flat model.
 *
 * @param flatModel - The decoded flat NWB YAML model.
 * @param sourceName - The source filename (for date attribution + display).
 * @param workspace - The current workspace slice (`{ animals }`), read-only, for the conflict check.
 * @returns The repair plan.
 */
export function buildImportRepairPlan(
  flatModel: unknown,
  sourceName: string,
  workspace: { animals?: unknown } | null | undefined
): ImportRepairPlan {
  const model = (flatModel ?? {}) as ValidationModel;

  // Benign normalizations are detected from the RAW model but validation runs on the NORMALIZED
  // model, so e.g. a `task_epoch`-only video file lists as a benign rename (not also a
  // required-`task_epochs` repair item the rename already resolves).
  const { benign, shimItems } = buildBenignAndShim(model);
  const normalized = structuredClone(model) as Record<string, unknown>;
  applyBenignNormalizations(normalized);
  const { items, blockers } = buildValidationItems(normalized as ValidationModel);

  // Decision: match the subject id against the existing workspace (by key or subject.subject_id).
  const subjectId = (model.subject as { subject_id?: unknown } | undefined)?.subject_id;
  let decision: ImportDecision;
  if (typeof subjectId !== 'string' || subjectId.trim() === '') {
    decision = { kind: 'blocked', reason: 'The file has no subject_id, so it cannot be attributed to an animal.' };
  } else {
    const existingAnimalId = findExistingAnimalId(subjectId, workspace);
    decision = existingAnimalId
      ? { kind: 'existing', subjectId, existingAnimalId }
      : { kind: 'new', subjectId };
  }

  return {
    sourceName,
    items: [...items, ...shimItems],
    blockers,
    benign,
    decision,
    hasErrors: items.length > 0 || blockers.length > 0,
  };
}

/**
 * Apply the benign normalizations and the user's accepted resolutions to a model, returning a NEW
 * model (the input is never mutated, and no key is dropped). Resolutions are keyed by the same path
 * the repair items carry; benign normalizations (task_epoch rename, single-spelling volume fill)
 * are applied unconditionally because the screen lists them.
 *
 * @param flatModel - The decoded flat model.
 * @param resolutions - Accepted/edited values keyed by repair-item path.
 * @returns A repaired deep clone of the model.
 */
export function applyImportRepairs(
  flatModel: unknown,
  resolutions: Record<string, unknown>
): Record<string, unknown> {
  const model = structuredClone((flatModel ?? {}) as Record<string, unknown>);

  // Benign, lossless normalizations (task_epoch rename, single-spelling volume fill).
  applyBenignNormalizations(model);

  // Accepted/edited resolutions, applied at their paths. A reconciled volume sets BOTH spellings
  // to the chosen value (keeping the shim key, never dropping it).
  for (const [path, value] of Object.entries(resolutions)) {
    setAtPath(model, path, value);
    const volMatch = path.match(/^(virus_injection\[\d+\])\.volume_in_ul$/);
    if (volMatch) setAtPath(model, `${volMatch[1]}.volume_in_uL`, value);
  }

  return model;
}
