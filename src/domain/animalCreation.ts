/**
 * Shared animal-creation glue.
 *
 * `buildAnimalFromForm` turns a processed creation payload into the exact `subject` + `metadata`
 * shapes `createAnimal` expects; `getDefaultExperimenters` resolves the experimenter seed. The
 * guided create-animal wizard commits through these (via `buildWizardCommitPayload`), so the wizard
 * — and any other entry that reuses this glue (e.g. the YAML import path) — builds IDENTICAL
 * animals, none drifting from the others or from the NWB schema seeds. (Originally extracted from
 * the retired Home/AnimalCreationForm container.)
 *
 * @module domain/animalCreation
 */
import { getAnimalExperimenters } from '../state/workspaceSelectors';
import { recordingFilenameIssue } from './recordingFilename';
import { idHasSlash } from '../validation/dandiSubject';
import type { WorkspaceSettings } from '../state/workspaceTypes';

/** The processed AnimalCreationForm payload (already trimmed/numbered) consumed by {@link buildAnimalFromForm}. */
export interface AnimalCreationFormData {
  /** Subject id (trimmed, case preserved, to derive the store key + subject_id). */
  subject_id: string;
  /** Species (Latin binomial). */
  species: string;
  /** Biological sex. */
  sex: string;
  /** Genetic background. */
  genotype: string;
  /** ISO date of birth; blank/omitted when unknown (the key is then absent from the subject). */
  date_of_birth?: string;
  /** Baseline weight in grams; omitted when unknown (the key is then absent from the subject). */
  weight?: number;
  /** Free-text subject description (auto-generated when blank). */
  description?: string;
  /** Experimenter names (blank entries filtered out). */
  experimenter_names: string[];
  /** Lab name. */
  lab: string;
  /** Institution name. */
  institution: string;
  /** Animal-level experiment description inherited by new days when their day field is blank. */
  experiment_description?: string;
}

/**
 * The workspace state slice {@link getDefaultExperimenters} reads. Both `settings` and `animals`
 * are optional so an incomplete/partial workspace can't crash the picker.
 */
interface DefaultExperimentersWorkspace {
  /** Workspace settings (lab/institution/experimenter defaults). */
  settings?: WorkspaceSettings;
  /** All animals keyed by id (read shape-safely). */
  animals?: Record<string, unknown>;
}

/** The default experimenter seed values resolved by {@link getDefaultExperimenters}. */
interface DefaultExperimenters {
  /** Experimenter names (always at least one, `['']` when none). */
  experimenter_names: string[];
  /** Lab name. */
  lab: string;
  /** Institution name. */
  institution: string;
}

/**
 * Normalize a subject id for LOOKUP only (duplicate detection, matching an import to an existing
 * animal). Never used for the exported identity or the store key: the converter's scanner matches
 * the metadata filename's animal token to the recording's token case-sensitively, so the exported
 * `subject_id` must keep the exact spelling the recordings use.
 *
 * @param subjectId - A subject id in any spelling.
 * @returns The trimmed, lower-cased lookup key.
 */
export function subjectLookupKey(subjectId: unknown): string {
  return typeof subjectId === 'string' ? subjectId.trim().toLowerCase() : '';
}

/** The stored scientific identity of an animal record (its `subject.subject_id`), if any. */
function storedSubjectId(animal: unknown): string | null {
  const subject = animal && typeof animal === 'object' ? (animal as { subject?: unknown }).subject : null;
  const id = subject && typeof subject === 'object' ? (subject as { subject_id?: unknown }).subject_id : null;
  return typeof id === 'string' ? id : null;
}

/**
 * Find the existing animal whose SCIENTIFIC identity (its stored `subject.subject_id`) matches
 * `subjectId` under {@link subjectLookupKey} — an exact match wins, then a case-insensitive one —
 * falling back to the store key (an animal is stored under the id it was created with, which the
 * profile editor may since have corrected).
 *
 * @param subjectId - The candidate subject id.
 * @param animals - The workspace `animals` map (keys are the store ids).
 * @returns The matching store key, or null.
 */
export function findAnimalIdByLookup(subjectId: unknown, animals: Record<string, unknown>): string | null {
  if (typeof subjectId !== 'string') return null;
  const entries = Object.entries(animals);
  const exact = entries.find(([, animal]) => storedSubjectId(animal) === subjectId.trim());
  if (exact) return exact[0];
  const target = subjectLookupKey(subjectId);
  if (!target) return null;
  const folded = entries.find(([, animal]) => subjectLookupKey(storedSubjectId(animal)) === target);
  if (folded) return folded[0];
  if (Object.prototype.hasOwnProperty.call(animals, subjectId)) return subjectId;
  return entries.find(([id]) => subjectLookupKey(id) === target)?.[0] ?? null;
}

/**
 * The OTHER animal already using `subjectId` (case-insensitively), or null. Two animals with the
 * same subject id would export the same `{date}_{subject}_metadata.yml` and be one animal
 * downstream; a case correction of the edited animal's own id is not a collision.
 *
 * @param subjectId - The candidate subject id.
 * @param animals - The workspace `animals` map.
 * @param exceptAnimalId - The store key of the animal being edited (ignored).
 * @returns The colliding animal's store key, or null.
 */
export function subjectIdCollision(
  subjectId: unknown,
  animals: Record<string, unknown>,
  exceptAnimalId: string | null = null
): string | null {
  const target = subjectLookupKey(subjectId);
  if (!target) return null;
  for (const [id, animal] of Object.entries(animals)) {
    if (id === exceptAnimalId) continue;
    const stored = storedSubjectId(animal);
    if (subjectLookupKey(stored ?? id) === target) return id;
  }
  return null;
}

/** The outcome of {@link validateSubjectId}: the accepted id, or the one reason it was refused. */
export type SubjectIdValidation =
  | { ok: true; subjectId: string }
  | { ok: false; message: string };

/**
 * The ONE identity boundary every animal-creation entry point shares (the guided wizard, copy-from-
 * animal, and any future entry): decide whether a typed subject id may become an animal, and return
 * the exact spelling to store.
 *
 * A subject id is scientific identity, not a slug. The converter matches a session's metadata file
 * to its recordings by splitting `{date}_{animal}_{epoch}_{tag}.rec` on `_` and comparing the animal
 * token CASE-SENSITIVELY, so this boundary trims but never case-folds, and rejects any character
 * that could not appear in that token (reusing `recordingFilenameIssue`). Duplicate detection is the
 * mirror image: case-INSENSITIVE, because `RS10` and `rs10` are one animal whose days would
 * otherwise fragment downstream in Spyglass.
 *
 * Validating BEFORE `createAnimal` is the point — an id laundered or waved through at create becomes
 * the animal's permanent store key, and the wizard then locks that field, trapping the scientist
 * behind an identity they can no longer fix.
 *
 * @param candidate - The typed subject id (any value; a non-string is treated as blank).
 * @param existingAnimals - The workspace `animals` map, for the duplicate check.
 * @param exceptAnimalId - The store key of the animal being edited, ignored when looking for a
 *   duplicate (so correcting an animal's own capitalization is not a self-collision).
 * @returns The accepted, trimmed, case-preserved id, or the message to show under the field.
 */
export function validateSubjectId(
  candidate: unknown,
  existingAnimals: Record<string, unknown>,
  exceptAnimalId: string | null = null
): SubjectIdValidation {
  const subjectId = typeof candidate === 'string' ? candidate.trim() : '';
  if (!subjectId) {
    return { ok: false, message: 'Subject ID is required' };
  }
  if (idHasSlash(subjectId)) {
    return { ok: false, message: 'Subject ID cannot contain "/" — DANDI rejects it' };
  }
  if (/\s/.test(subjectId)) {
    return { ok: false, message: 'Subject ID cannot contain spaces' };
  }
  if (recordingFilenameIssue(subjectId)) {
    // The converter groups `{date}_{subject}_metadata.yml` with `{date}_{subject}_{epoch}_{tag}.rec`
    // by splitting on `_`, so an underscore (or any other unsafe character) can never be matched.
    return {
      ok: false,
      message:
        'Use only letters, numbers, and hyphens (no underscores — the converter splits filenames on them)',
    };
  }
  // The stored id keeps its case, but "RS10" and "rs10" are still the SAME animal for lookup — a
  // different-cased duplicate is a real collision, not a near-duplicate. Look up against the store
  // key AND the stored scientific identity (a profile edit may have moved them apart).
  const others =
    exceptAnimalId === null
      ? existingAnimals
      : Object.fromEntries(Object.entries(existingAnimals).filter(([id]) => id !== exceptAnimalId));
  const collision = findAnimalIdByLookup(subjectId, others);
  if (collision) {
    return {
      ok: false,
      message:
        collision === subjectId
          ? `Animal "${subjectId}" already exists`
          : `Animal "${collision}" already exists (same ID with different capitalization)`,
    };
  }
  return { ok: true, subjectId };
}

/**
 * Build the `{ animalId, subject, metadata }` triple a creation form submits into `createAnimal`.
 * The store key + subject_id are the TRIMMED subject id with its case preserved — the exported
 * `subject_id` is the scientific identity and must match the recording filenames' animal token
 * exactly (see `domain/recordingFilename`); duplicate detection is case-insensitive via
 * {@link subjectLookupKey}. `description` is schema-required (non-empty), so it auto-generates a
 * `genotype species` label when left blank. An unknown `date_of_birth` / `weight` is carried as an
 * explicit `undefined` — the store's "unknown means absent" rule then leaves the key OFF the record
 * (and a later edit that blanks the field REMOVES it) rather than defaulting it; the export gate
 * asks for what is genuinely missing. Devices are seeded empty with the legacy
 * `device.name: ['Trodes']` default (schema minItems: 1).
 *
 * @param formData - The processed AnimalCreationForm payload (already trimmed/numbered).
 * @returns
 */
export function buildAnimalFromForm(formData: AnimalCreationFormData) {
  const animalId = formData.subject_id.trim();

  const subject = {
    subject_id: animalId,
    species: formData.species,
    sex: formData.sex,
    genotype: formData.genotype,
    // An unknown fact is spelled as an explicit `undefined`, which BOTH store write paths read as
    // "this key is absent" (`createAnimal` / `applyAnimalUpdates` — see `workspaceTransitions`'s
    // `mergeSubject`). Never an empty-string date or a fabricated weight, and — because the same
    // payload commits a post-create identity edit — clearing either field really clears the record
    // instead of leaving a stale value behind a blank input. A new animal may legitimately be a
    // draft: the baseline weight is only a first-day suggestion (each recording day carries its own
    // measurement), and a missing date of birth surfaces at EXPORT as a blocking issue routed to
    // the animal profile.
    date_of_birth: formData.date_of_birth || undefined,
    weight: Number.isFinite(formData.weight) ? formData.weight : undefined,
    description: formData.description?.trim()
      ? formData.description.trim()
      : `${formData.genotype} ${formData.species}`.trim(),
  };

  const metadata = {
    experimenters: {
      experimenter_name: formData.experimenter_names.filter((n) => n.trim()),
      lab: formData.lab,
      institution: formData.institution,
    },
    experiment_description: formData.experiment_description?.trim() || '',
    // Electrodes/cameras are configured later. The recording system is seeded with the lab-standard
    // rig (the value every golden fixture uses) so a new animal starts with ONE — consistent with the
    // schema's `data_acq_device` minItems:1 and the Recording System tab's "must keep at least one"
    // rule. Editable (or extendable to several) on that tab. `device.name` is likewise schema-required.
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [],
    technicalDefaults: {
      raw_data_to_volts: 0.195,
      times_period_multiplier: 1.5,
    },
  };

  return { animalId, subject, metadata };
}

/**
 * Resolve the default experimenter values to seed a new creation form, in priority order:
 * (1) non-empty workspace settings, (2) the most-recent animal's experimenters, (3) hardcoded
 * Frank Lab defaults.
 *
 * @param workspace - The workspace state slice (`settings`, `animals`).
 * @returns
 */
export function getDefaultExperimenters(
  workspace: DefaultExperimentersWorkspace
): DefaultExperimenters {
  // Default `animals` so an incomplete workspace can't crash the Object.keys() below.
  const { settings, animals = {} } = workspace;

  // Priority 1: Workspace settings (if non-empty). Keys are camelCase to match the canonical
  // settings shape (createDefaultWorkspace / useWorkspace / WorkspaceSettings); snake_case keys
  // never exist at runtime, so reading them silently skipped this branch.
  if (settings?.defaultLab?.trim()) {
    return {
      experimenter_names: settings.defaultExperimenters || [''],
      lab: settings.defaultLab,
      institution: settings.defaultInstitution,
    };
  }

  // Priority 2: Most recent animal's experimenters. The picker computes defaults over WHATEVER
  // animals exist — including a recovered/imported animal that may be missing `experimenters` — so
  // read through the shape-safe selector (returns {} for a malformed animal) rather than crash the
  // whole workspace render. The `|| ['']` keeps the form's "one empty experimenter input" default
  // when no names are present.
  const animalIds = Object.keys(animals).sort();
  if (animalIds.length > 0) {
    const lastExperimenters = getAnimalExperimenters(animals[animalIds[animalIds.length - 1]]);
    return {
      experimenter_names: lastExperimenters.experimenter_name || [''],
      lab: lastExperimenters.lab || '',
      institution: lastExperimenters.institution || '',
    };
  }

  // Priority 3: Hardcoded Frank Lab defaults
  return {
    experimenter_names: [''],
    lab: 'Loren Frank Lab',
    institution: 'University of California, San Francisco',
  };
}
