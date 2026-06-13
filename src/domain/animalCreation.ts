/**
 * Shared animal-creation glue (Phase 4b).
 *
 * The Home route and the workspace's inline "+ New Animal" panel both turn an AnimalCreationForm
 * payload into the exact `subject` + `metadata` shapes `createAnimal` expects, and both seed the
 * creation form with the same default experimenters. Extracting that here (verbatim from the Home
 * container) means the two entry points build IDENTICAL animals — neither can drift from the other
 * or from the NWB schema seeds.
 *
 * @module domain/animalCreation
 */
import { getAnimalExperimenters } from '../state/workspaceSelectors';
import type { WorkspaceSettings } from '../state/workspaceTypes';

/** The processed AnimalCreationForm payload (already trimmed/numbered) consumed by {@link buildAnimalFromForm}. */
interface AnimalCreationFormData {
  /** Subject id (lower-cased/trimmed to derive the store key + subject_id). */
  subject_id: string;
  /** Species (Latin binomial). */
  species: string;
  /** Biological sex. */
  sex: string;
  /** Genetic background. */
  genotype: string;
  /** ISO date of birth. */
  date_of_birth: string;
  /** Baseline weight in grams. */
  weight?: number;
  /** Free-text subject description (auto-generated when blank). */
  description?: string;
  /** Experimenter names (blank entries filtered out). */
  experimenter_names: string[];
  /** Lab name. */
  lab: string;
  /** Institution name. */
  institution: string;
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
 * Build the `{ animalId, subject, metadata }` triple a creation form submits into `createAnimal`.
 * The store key + subject_id are the lower-cased/trimmed subject id; `description` is schema-required
 * (non-empty), so it auto-generates a `genotype species` label when left blank. Devices are seeded
 * empty with the legacy `device.name: ['Trodes']` default (schema minItems: 1).
 *
 * @param formData - The processed AnimalCreationForm payload (already trimmed/numbered).
 * @returns
 */
export function buildAnimalFromForm(formData: AnimalCreationFormData) {
  const animalId = formData.subject_id.toLowerCase().trim();

  const subject = {
    subject_id: animalId,
    species: formData.species,
    sex: formData.sex,
    genotype: formData.genotype,
    date_of_birth: formData.date_of_birth,
    weight: formData.weight,
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
