/**
 * @fileoverview Pure view-model for the guided create-animal wizard.
 *
 * The wizard ("deliberate setup" journey: Identity → Electrodes → Cameras → Optogenetics → Tasks →
 * Recording system → Team) is a presentation layer over the EXISTING substrate — it introduces no
 * new create logic. This module owns the React-free decisions the wizard component renders:
 *
 * - **Step order + markers** ({@link WIZARD_STEPS}) — the seven steps, which is optional (only
 *   optogenetics, per the design), and which are required for a clean export.
 * - **Identity validity** ({@link validateWizardIdentity}) — reuses the DANDI predicates
 *   `isValidSpecies` / `idHasSlash` and the same case-collision / subject_id charset checks the
 *   retired AnimalCreationForm did, so the wizard and the export gate agree.
 * - **The commit payload** ({@link buildWizardCommitPayload}) — delegates to `buildAnimalFromForm`
 *   (the shared glue), so the wizard builds an animal IDENTICAL to any other entry point.
 * - **Per-step completeness** ({@link computeStepStatuses}) — derived from the live animal record
 *   (read through the tolerant selectors); the optogenetics step's all-or-nothing meter reuses
 *   `optoFieldsPresence` (a partial opto setup silently drops ALL opto downstream).
 *
 * Pure and React-free; returns plain data only.
 */
import { isValidSpecies, idHasSlash } from '../validation/dandiSubject';
import { optoFieldsPresence } from '../domain/optoCompleteness';
import type { OptoFieldsPresence } from '../domain/optoCompleteness';
import { buildAnimalFromForm } from '../domain/animalCreation';
import type { AnimalCreationFormData } from '../domain/animalCreation';
import {
  getAnimalElectrodeGroups,
  getAnimalCameras,
  getAnimalTaskTypes,
  getDataAcqDevices,
  getAnimalExperimenters,
  getExperimenterNames,
} from '../state/workspaceSelectors';

/** The seven wizard step keys, in display order. */
export type WizardStepKey =
  | 'identity'
  | 'electrodes'
  | 'cameras'
  | 'optogenetics'
  | 'tasks'
  | 'recording-system'
  | 'team';

/** A wizard step descriptor (the pill the component renders). */
export interface WizardStepDescriptor {
  /** Stable key. */
  key: WizardStepKey;
  /** Display label. */
  label: string;
  /** 1-based step number shown in the pill. */
  number: number;
  /** Whether the step carries the "optional" tag (the design tags only optogenetics). */
  optional: boolean;
  /**
   * Whether this step's completion is required for a clean export. Identity (the subject),
   * electrodes (an ephys day needs a probe — the step offers a behavior-only skip), the recording
   * system (`data_acq_device`, seeded on create), and team (`experimenters`) all block a standard
   * export. Cameras / tasks are needed only when a day uses them, and optogenetics is opt-in — so
   * those three are NOT marked required here.
   */
  requiredForExport: boolean;
}

/** The ordered step descriptors. */
export const WIZARD_STEPS: WizardStepDescriptor[] = [
  { key: 'identity', label: 'Identity', number: 1, optional: false, requiredForExport: true },
  { key: 'electrodes', label: 'Electrodes', number: 2, optional: false, requiredForExport: true },
  { key: 'cameras', label: 'Cameras', number: 3, optional: false, requiredForExport: false },
  { key: 'optogenetics', label: 'Optogenetics', number: 4, optional: true, requiredForExport: false },
  { key: 'tasks', label: 'Tasks', number: 5, optional: false, requiredForExport: false },
  { key: 'recording-system', label: 'Recording system', number: 6, optional: false, requiredForExport: true },
  { key: 'team', label: 'Team', number: 7, optional: false, requiredForExport: true },
];

/** The step keys in display order (a convenience for nav/index math). */
export const WIZARD_STEP_KEYS: WizardStepKey[] = WIZARD_STEPS.map((s) => s.key);

/** The wizard's step-1 identity local state (all-string form values). */
export interface IdentityDraft {
  /** Subject id (lower-cased to derive the store key). */
  subject_id: string;
  /** Selected species (a Latin binomial) or the literal `'other'`. */
  species: string;
  /** Custom species value when `species === 'other'`. */
  speciesCustom: string;
  /** Biological sex (single letter). */
  sex: string;
  /** Genetic background. */
  genotype: string;
  /** Date of birth (YYYY-MM-DD from the date input). */
  date_of_birth: string;
  /** Baseline weight in grams (string from the number input). */
  weight: string;
  /** Free-text subject description (auto-derived when blank). */
  description: string;
}

/** Identity validation result: a validity flag and per-field messages. */
export interface IdentityValidation {
  /** True when every identity field is well-formed. */
  valid: boolean;
  /** Field name → message for the fields that failed. */
  errors: Record<string, string>;
}

/**
 * Validate the wizard's identity draft. Mirrors the retired AnimalCreationForm's identity checks —
 * reusing the SAME DANDI predicates (`idHasSlash` for the subject_id slash rule, `isValidSpecies`
 * for a custom species) and the SAME case-insensitive store-key collision check — but covers ONLY
 * the identity fields (experimenters/lab/institution move to the Team step).
 *
 * @param identity - The step-1 draft.
 * @param existingAnimals - The workspace's animals map (for the uniqueness check; keys are lower-cased).
 * @returns The validity flag + per-field errors.
 */
export function validateWizardIdentity(
  identity: IdentityDraft,
  existingAnimals: Record<string, unknown>
): IdentityValidation {
  const errors: Record<string, string> = {};

  // Subject ID — required, no whitespace, route-/DANDI-safe charset, and no '/' (DANDI CRITICAL).
  if (!identity.subject_id?.trim()) {
    errors.subject_id = 'Subject ID is required';
  } else if (idHasSlash(identity.subject_id)) {
    errors.subject_id = 'Subject ID cannot contain "/" — DANDI rejects it';
  } else if (/\s/.test(identity.subject_id)) {
    errors.subject_id = 'Subject ID cannot contain spaces';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(identity.subject_id)) {
    errors.subject_id = 'Use only letters, numbers, underscores, and hyphens';
  } else {
    // The store key lower-cases the subject id, so "RS10" and "rs10" are the SAME animal — a
    // different-cased duplicate is a real collision, not a near-duplicate.
    const normalized = identity.subject_id.toLowerCase().trim();
    if (Object.keys(existingAnimals).includes(normalized)) {
      errors.subject_id = `Animal "${identity.subject_id}" already exists`;
    }
  }

  // Species — a Latin binomial or NCBI Taxon URI (free text is rejected by DANDI).
  if (!identity.species?.trim()) {
    errors.species = 'Species is required';
  }
  if (identity.species === 'other') {
    if (!identity.speciesCustom?.trim()) {
      errors.speciesCustom = 'Custom species name is required';
    } else if (!isValidSpecies(identity.speciesCustom.trim())) {
      errors.speciesCustom =
        'Use a scientific name (e.g. "Rattus norvegicus") or an NCBI Taxonomy URI — free text like "Rat" is rejected by NWB archives';
    }
  }

  // Weight (grams) — schema-required, non-negative number.
  if (identity.weight === '' || identity.weight == null) {
    errors.weight = 'Weight is required';
  } else if (!(Number(identity.weight) >= 0)) {
    errors.weight = 'Weight must be a non-negative number';
  }

  // Sex.
  if (!identity.sex) {
    errors.sex = 'Sex is required';
  }

  // Genotype.
  if (!identity.genotype?.trim()) {
    errors.genotype = 'Genotype is required';
  }

  // Date of birth — required and not in the future.
  if (!identity.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required';
  } else if (new Date(identity.date_of_birth) > new Date()) {
    errors.date_of_birth = 'Date of birth cannot be in the future';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** The `{ animalId, subject, metadata }` triple `createAnimal` consumes. */
export type WizardCommitPayload = ReturnType<typeof buildAnimalFromForm>;

/** Default experimenter seed for the commit payload (the Team step edits them after create). */
export interface WizardExperimenterDefaults {
  experimenter_names: string[];
  lab: string;
  institution: string;
}

/** Team-step draft fields that are required before finishing the wizard. */
export interface WizardTeamDraft {
  /** Animal-level experiment description inherited by new days. */
  experiment_description: string;
  /** Lab name inherited by new animals and exported by every day. */
  lab: string;
  /** Institution name inherited by new animals and exported by every day. */
  institution: string;
}

/** Team validation result: a validity flag and per-field messages. */
export interface TeamValidation {
  /** True when every required team/default field is present. */
  valid: boolean;
  /** Field name → message for the fields that failed. */
  errors: Record<string, string>;
}

/**
 * Validate the wizard's Team step fields that otherwise become first-day export errors.
 *
 * @param team - The team/default metadata draft.
 * @returns The validity flag + per-field errors.
 */
export function validateWizardTeam(team: WizardTeamDraft): TeamValidation {
  const errors: Record<string, string> = {};
  if (!team.experiment_description?.trim()) {
    errors.experiment_description = 'Experiment description is required before creating recording days';
  }
  if (!team.lab?.trim()) {
    errors.lab = 'Lab is required';
  }
  if (!team.institution?.trim()) {
    errors.institution = 'Institution is required';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Build the createAnimal payload from a (valid) identity draft, delegating to the shared
 * `buildAnimalFromForm` glue so the wizard builds an animal byte-identical to any other entry
 * point. The processing mirrors the retired form's submit path: trim the subject id / description,
 * resolve a custom species, midnight-normalize the date, and coerce the weight to a number.
 * Experimenters seed from `defaults` (the Team step edits them via `updateAnimal` after create).
 *
 * @param identity - The step-1 draft (assumed valid — the caller gates on {@link validateWizardIdentity}).
 * @param defaults - Default experimenter seed (resolved from the workspace).
 * @returns The `{ animalId, subject, metadata }` triple.
 */
export function buildWizardCommitPayload(
  identity: IdentityDraft,
  defaults: WizardExperimenterDefaults = { experimenter_names: [], lab: '', institution: '' }
): WizardCommitPayload {
  const formData: AnimalCreationFormData = {
    subject_id: identity.subject_id.trim(),
    species: (identity.species === 'other' ? identity.speciesCustom : identity.species).trim(),
    sex: identity.sex,
    genotype: identity.genotype,
    date_of_birth: identity.date_of_birth
      ? new Date(identity.date_of_birth).toISOString()
      : '',
    weight: Number(identity.weight),
    description: identity.description.trim(),
    experimenter_names: defaults.experimenter_names.filter((n) => n.trim()),
    lab: defaults.lab,
    institution: defaults.institution,
    experiment_description: '',
  };
  return buildAnimalFromForm(formData);
}

/**
 * Per-step completeness:
 * - `complete` — the step is satisfied.
 * - `incomplete` — a required step is not yet satisfied (or optogenetics is partial → blocks export).
 * - `optional` — an optional step is not configured (a neutral, valid state — only optogenetics).
 * - `skipped` — electrodes deliberately skipped for a behavior-only animal.
 */
export type StepStatus = 'complete' | 'incomplete' | 'optional' | 'skipped';

/** Inputs for {@link computeStepStatuses} that aren't on the animal record. */
export interface StepCompletenessInput {
  /** Whether the identity draft validates (gates leaving step 1; identity precedes the create). */
  identityValid: boolean;
  /** Whether the user declared this a behavior-only animal (electrodes skipped). */
  behaviorOnly: boolean;
}

/**
 * Compute each step's completeness from the live animal record (read tolerantly) + the identity
 * draft validity. The optogenetics step reuses `optoFieldsPresence` for its all-or-nothing meter.
 *
 * @param animal - The created animal record (null before the create — only identity is known then).
 * @param input - Identity validity + the behavior-only declaration.
 * @returns A status per step key.
 */
export function computeStepStatuses(
  animal: unknown,
  input: StepCompletenessInput
): Record<WizardStepKey, StepStatus> {
  const electrodeGroups = getAnimalElectrodeGroups(animal);
  const cameras = getAnimalCameras(animal);
  const taskTypes = getAnimalTaskTypes(animal);
  const dataAcq = getDataAcqDevices(animal);
  const experimenters = getAnimalExperimenters(animal);
  const experimenterNames = getExperimenterNames(animal);
  const opto = optoFieldsPresence(
    (animal as { optogenetics?: unknown })?.optogenetics as Parameters<typeof optoFieldsPresence>[0]
  );

  // Opto is all-or-nothing: none → a valid neutral state; all four → complete; a partial setup
  // silently drops ALL opto downstream, so it BLOCKS (incomplete).
  const optoStatus: StepStatus =
    opto.count === 0 ? 'optional' : opto.count === 4 ? 'complete' : 'incomplete';

  const teamComplete =
    experimenterNames.some((n) => String(n).trim()) &&
    validateWizardTeam({
      experiment_description: String((animal as { experiment_description?: unknown })?.experiment_description ?? ''),
      lab: String(experimenters.lab ?? ''),
      institution: String(experimenters.institution ?? ''),
    }).valid;

  return {
    identity: input.identityValid ? 'complete' : 'incomplete',
    electrodes:
      electrodeGroups.length > 0 ? 'complete' : input.behaviorOnly ? 'skipped' : 'incomplete',
    cameras: cameras.length > 0 ? 'complete' : 'incomplete',
    optogenetics: optoStatus,
    tasks: taskTypes.length > 0 ? 'complete' : 'incomplete',
    'recording-system': dataAcq.length > 0 ? 'complete' : 'incomplete',
    team: teamComplete ? 'complete' : 'incomplete',
  };
}

/** A step descriptor enriched with its resolved status + active flag, for the component. */
export interface WizardStepViewModel extends WizardStepDescriptor {
  /** The step's completeness in the current draft. */
  status: StepStatus;
  /** Whether this is the active step. */
  isActive: boolean;
}

/** Inputs for {@link buildCreateAnimalWizardViewModel}. */
export interface CreateAnimalWizardInput {
  /** The active step. */
  currentStepKey: WizardStepKey;
  /** The step-1 identity draft. */
  identity: IdentityDraft;
  /** The workspace's animals map (for the identity uniqueness check). */
  existingAnimals: Record<string, unknown>;
  /** The created animal record (null until the create commits). */
  animal: unknown;
  /** The behavior-only (skip electrodes) declaration. */
  behaviorOnly: boolean;
}

/** The assembled wizard view-model the component renders. */
export interface CreateAnimalWizardViewModel {
  /** The steps with resolved status + active flag. */
  steps: WizardStepViewModel[];
  /** Identity validity (gates leaving step 1). */
  identity: IdentityValidation;
  /** The optogenetics all-or-nothing meter (`count` of 4). */
  opto: OptoFieldsPresence;
  /** Whether the active step is the last one. */
  isLastStep: boolean;
  /** The forward-button label ("Next →" / "✓ Create animal"). */
  nextLabel: string;
}

/**
 * Assemble the wizard view-model: the steps with their resolved status, the identity validity, the
 * optogenetics meter, and the footer's forward-button label. A thin renderer consumes this.
 *
 * @param input - The current step, identity draft, animals map, created animal, behavior-only flag.
 * @returns The assembled view-model.
 */
export function buildCreateAnimalWizardViewModel(
  input: CreateAnimalWizardInput
): CreateAnimalWizardViewModel {
  const identity = validateWizardIdentity(input.identity, input.existingAnimals);
  // Once the animal is created, identity is complete by construction — the draft's subject_id now
  // matches the just-created animal, so the live uniqueness check would (correctly) flag a
  // self-collision; that must not make the identity step read as incomplete.
  const identityComplete = input.animal != null || identity.valid;
  const statuses = computeStepStatuses(input.animal, {
    identityValid: identityComplete,
    behaviorOnly: input.behaviorOnly,
  });
  const steps: WizardStepViewModel[] = WIZARD_STEPS.map((step) => ({
    ...step,
    status: statuses[step.key],
    isActive: step.key === input.currentStepKey,
  }));
  const isLastStep = input.currentStepKey === WIZARD_STEP_KEYS[WIZARD_STEP_KEYS.length - 1];
  const opto = optoFieldsPresence(
    (input.animal as { optogenetics?: unknown })?.optogenetics as Parameters<
      typeof optoFieldsPresence
    >[0]
  );
  return {
    steps,
    identity,
    opto,
    isLastStep,
    nextLabel: isLastStep ? '✓ Create animal' : 'Next →',
  };
}
