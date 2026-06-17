/**
 * CreateAnimalWizard — the guided new-animal "deliberate setup" journey.
 *
 * Identity → Electrodes → Cameras → Optogenetics → Tasks → Recording system → Team. It is a
 * presentation layer over the EXISTING substrate and introduces no new create logic:
 *
 * - **Identity (step 1)** is collected locally; advancing past it commits the animal through
 *   `createAnimal` (the SAME shared `buildAnimalFromForm` glue every entry uses), so the wizard and
 *   any other entry build an identical animal. The animal is created EARLY (not at the end) because
 *   the setup containers are store-bound — they read/write the live record. Once created, the
 *   `subject_id` (the store key) is locked; other identity fields edit through `updateAnimal`.
 * - **Steps 2–6** mount the EXISTING store-bound `AnimalEditor/wiring` containers (ElectrodeGroups /
 *   Cameras / Optogenetics / TaskTypes / RecordingSystem) verbatim — the same implementations the
 *   tabbed Animal View renders. No fork.
 * - **Team (step 7)** edits `experimenters` through `updateAnimal`.
 *
 * Pure decisions (step order, per-step status, identity validity, the opto meter, the commit
 * payload) live in {@link module:viewModels/createAnimalWizardViewModel}; this component is a thin
 * renderer + the store-write wiring.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { getDefaultExperimenters } from '../../domain/animalCreation';
import {
  buildCreateAnimalWizardViewModel,
  buildWizardCommitPayload,
  validateWizardIdentity,
  validateWizardTeam,
  WIZARD_STEP_KEYS,
} from '../../viewModels/createAnimalWizardViewModel';
import type { IdentityDraft, WizardStepKey } from '../../viewModels/createAnimalWizardViewModel';
import { getAnimalExperimenters, getAnimalSubject, getExperimenterNames } from '../../state/workspaceSelectors';
import type { Animal, ExperimenterInfo, WorkspaceSettings } from '../../state/workspaceTypes';
import Button from '../../components/ui/Button';
import ElectrodeGroupsContainer from '../AnimalEditor/wiring/ElectrodeGroupsContainer';
import CamerasContainer from '../AnimalEditor/wiring/CamerasContainer';
import OptogeneticsContainer from '../AnimalEditor/wiring/OptogeneticsContainer';
import TaskTypesContainer from '../AnimalEditor/wiring/TaskTypesContainer';
import RecordingSystemContainer from '../AnimalEditor/wiring/RecordingSystemContainer';
import { useAnimalFieldUpdate } from '../AnimalEditor/wiring/useAnimalFieldUpdate';
import styles from './CreateAnimalWizard.module.css';

/** The species options offered in step 1 (a Latin binomial each, plus the custom escape). */
const SPECIES_OPTIONS = [
  { value: 'Rattus norvegicus', label: 'Rat (Rattus norvegicus)' },
  { value: 'Mus musculus', label: 'Mouse (Mus musculus)' },
  { value: 'Callithrix jacchus', label: 'Marmoset (Callithrix jacchus)' },
  { value: 'Macaca mulatta', label: 'Rhesus macaque (Macaca mulatta)' },
  { value: 'other', label: 'Other (specify)…' },
];

/** The initial identity draft (the same valid defaults the retired form seeded). */
const INITIAL_IDENTITY: IdentityDraft = {
  subject_id: '',
  species: 'Rattus norvegicus',
  speciesCustom: '',
  sex: 'U',
  genotype: 'Wild-type',
  date_of_birth: '',
  weight: '',
  description: '',
};

/**
 * Read the `#/home?animal=<id>` adopt handshake: the id of an EXISTING animal the wizard should
 * continue (e.g. the copy-from-animal flow creates an animal with the copied setup, then routes
 * here to confirm identity + continue). Returns null when absent or unknown.
 *
 * @param existingAnimals - The workspace's animals map.
 * @returns The adopted animal id, or null.
 */
function readAdoptedAnimalId(existingAnimals: Record<string, unknown>): string | null {
  const query = window.location.hash.split('?')[1];
  const id = query ? new URLSearchParams(query).get('animal') : null;
  return id && existingAnimals[id] ? id : null;
}

/**
 * Seed an identity draft from an existing animal's subject (for the adopt handshake). A known
 * species maps to its option; an unknown one falls to "other" + custom; the date is sliced to the
 * `YYYY-MM-DD` the date input wants (the commit re-derives the ISO datetime). The placeholder
 * `description: 'Subject'` and `weight: 100` that `createAnimal` seeds for an identity-less animal
 * (e.g. the copy-from flow, which copies setup but NOT identity) are treated as blank so the user
 * supplies a real value rather than silently accepting the placeholder.
 *
 * @param animal - The existing animal record.
 * @returns The seeded identity draft.
 */
function seedIdentityFromAnimal(animal: unknown): IdentityDraft {
  const subject = getAnimalSubject(animal);
  const speciesKnown = SPECIES_OPTIONS.some((o) => o.value === subject.species);
  const species = typeof subject.species === 'string' ? subject.species : '';
  // The placeholders `createAnimal` seeds when the caller omits these (workspaceActions.ts).
  const SEED_WEIGHT = 100;
  const SEED_DESCRIPTION = 'Subject';
  return {
    subject_id: subject.subject_id || '',
    species: speciesKnown ? species : species ? 'other' : INITIAL_IDENTITY.species,
    speciesCustom: speciesKnown ? '' : species,
    sex: subject.sex || INITIAL_IDENTITY.sex,
    genotype: subject.genotype || INITIAL_IDENTITY.genotype,
    date_of_birth: typeof subject.date_of_birth === 'string' ? subject.date_of_birth.slice(0, 10) : '',
    weight: subject.weight != null && subject.weight !== SEED_WEIGHT ? String(subject.weight) : '',
    description: subject.description && subject.description !== SEED_DESCRIPTION ? subject.description : '',
  };
}

/**
 * The Team (experimenters) step — a small local-state editor that commits to `updateAnimal` on blur.
 * Seeded from the animal's current experimenters (set from defaults at create-time).
 */
interface TeamDraft {
  names: string[];
  lab: string;
  institution: string;
  experiment_description: string;
}

interface TeamCommit {
  experimenters: ExperimenterInfo;
  experiment_description: string;
  settings: Partial<WorkspaceSettings>;
}

function buildTeamCommit(draft: TeamDraft): TeamCommit {
  const experimenterNames = draft.names.filter((n) => n.trim());
  const settings: Partial<WorkspaceSettings> = { defaultExperimenters: experimenterNames };
  if (draft.lab.trim()) settings.defaultLab = draft.lab;
  if (draft.institution.trim()) settings.defaultInstitution = draft.institution;
  return {
    experimenters: {
      experimenter_name: experimenterNames,
      lab: draft.lab,
      institution: draft.institution,
    },
    experiment_description: draft.experiment_description,
    settings,
  };
}

function sameErrors(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

function TeamStep({
  initialNames,
  initialLab,
  initialInstitution,
  initialExperimentDescription,
  errors,
  onDraftChange,
  onCommit,
}: {
  initialNames: string[];
  initialLab: string;
  initialInstitution: string;
  initialExperimentDescription: string;
  errors: Record<string, string>;
  onDraftChange: (draft: TeamDraft) => void;
  onCommit: (next: TeamCommit) => void;
}) {
  const [draft, setDraft] = useState<TeamDraft>(() => ({
    names: initialNames.length ? initialNames : [''],
    lab: initialLab,
    institution: initialInstitution,
    experiment_description: initialExperimentDescription,
  }));

  useEffect(() => {
    onDraftChange(draft);
  }, [draft, onDraftChange]);

  const updateDraft = (patch: Partial<TeamDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const commit = (next = draft) => onCommit(buildTeamCommit(next));

  return (
    <div className={styles.panel}>
      <h2>Team</h2>
      <p className={styles.panelDesc}>
        Who works on this animal. This seeds each recording day&apos;s &ldquo;who ran it&rdquo;
        (editable per day).
      </p>

      <div className={styles.field}>
        <label htmlFor="team-experiment-description">Experiment description</label>
        <textarea
          id="team-experiment-description"
          value={draft.experiment_description}
          aria-invalid={!!errors.experiment_description}
          onChange={(e) => updateDraft({ experiment_description: e.target.value })}
          onBlur={() => commit()}
        />
        <span className={styles.hint}>
          Required for export. New recording days inherit this unless a day overrides it.
        </span>
        {errors.experiment_description && (
          <span className={styles.error} role="alert">
            {errors.experiment_description}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label id="team-names-label">Experimenter names</label>
        <div role="group" aria-labelledby="team-names-label">
          {draft.names.map((name, idx) => (
            <div className={styles.teamRow} key={idx}>
              <input
                type="text"
                className={styles.teamNameInput}
                value={name}
                aria-label={`Experimenter ${idx + 1}`}
                placeholder="Last, First (e.g. Doe, Jane)"
                onChange={(e) =>
                  updateDraft({ names: draft.names.map((n, i) => (i === idx ? e.target.value : n)) })
                }
                onBlur={() => commit()}
              />
              {idx > 0 && (
                <Button
                  variant="secondary"
                  size="small"
                  aria-label={`Remove experimenter ${idx + 1}`}
                  onClick={() => {
                    // Persist the removal immediately — it must not wait on a later field's blur.
                    const next = { ...draft, names: draft.names.filter((_, i) => i !== idx) };
                    setDraft(next);
                    onCommit(buildTeamCommit(next));
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="secondary"
            size="small"
            onClick={() => updateDraft({ names: [...draft.names, ''] })}
          >
            + Add experimenter
          </Button>
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.field}>
          <label htmlFor="team-lab">Lab</label>
          <input
            id="team-lab"
            type="text"
            value={draft.lab}
            aria-invalid={!!errors.lab}
            onChange={(e) => updateDraft({ lab: e.target.value })}
            onBlur={() => commit()}
          />
          {errors.lab && (
            <span className={styles.error} role="alert">
              {errors.lab}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="team-institution">Institution</label>
          <input
            id="team-institution"
            type="text"
            value={draft.institution}
            aria-invalid={!!errors.institution}
            onChange={(e) => updateDraft({ institution: e.target.value })}
            onBlur={() => commit()}
          />
          {errors.institution && (
            <span className={styles.error} role="alert">
              {errors.institution}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The guided create-animal wizard.
 */
export default function CreateAnimalWizard() {
  const { model, actions } = useStoreContext();
  const existingAnimals = model.workspace.animals || {};

  // Adopt handshake (`#/home?animal=<id>`): continue an EXISTING animal (e.g. the copy-from-animal
  // flow creates one with the copied setup, then routes here). Resolved once at mount.
  const adoptedAnimalId = readAdoptedAnimalId(existingAnimals);

  const [identity, setIdentity] = useState<IdentityDraft>(() =>
    adoptedAnimalId ? seedIdentityFromAnimal(existingAnimals[adoptedAnimalId]) : INITIAL_IDENTITY
  );
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
  const [currentStepKey, setCurrentStepKey] = useState<WizardStepKey>('identity');
  const [createdAnimalId, setCreatedAnimalId] = useState<string | null>(adoptedAnimalId);
  const [behaviorOnly, setBehaviorOnly] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [teamErrors, setTeamErrors] = useState<Record<string, string>>({});
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamDraftRef = useRef<TeamDraft | null>(null);

  const animal = (createdAnimalId ? existingAnimals[createdAnimalId] : null) as Animal | null;
  const defaults = useMemo(() => getDefaultExperimenters(model.workspace), [model.workspace]);
  const { handleFieldUpdate } = useAnimalFieldUpdate(createdAnimalId ?? '');

  const commitTeamDraft = useCallback(
    (draft: TeamDraft) => {
      if (!createdAnimalId) return;
      const next = buildTeamCommit(draft);
      handleFieldUpdate('experimenters', next.experimenters);
      handleFieldUpdate('experiment_description', next.experiment_description);
      actions.updateWorkspaceSettings(next.settings);
    },
    [actions, createdAnimalId, handleFieldUpdate]
  );

  const teamDraftFromAnimal = useCallback((): TeamDraft | null => {
    if (!animal) return null;
    const experimenters = getAnimalExperimenters(animal);
    return {
      names: getExperimenterNames(animal).length ? getExperimenterNames(animal) : defaults.experimenter_names,
      lab: experimenters.lab || defaults.lab,
      institution: experimenters.institution || defaults.institution,
      experiment_description: String((animal as { experiment_description?: unknown }).experiment_description ?? ''),
    };
  }, [animal, defaults]);

  const validateAndCommitTeam = () => {
    const draft = teamDraftRef.current ?? teamDraftFromAnimal();
    if (!draft) return false;
    const validation = validateWizardTeam({
      experiment_description: draft.experiment_description,
      lab: draft.lab,
      institution: draft.institution,
    });
    setTeamErrors(validation.errors);
    if (!validation.valid) {
      setCurrentStepKey('team');
      return false;
    }
    commitTeamDraft(draft);
    return true;
  };

  const handleTeamDraftChange = useCallback((draft: TeamDraft) => {
    teamDraftRef.current = draft;
    setTeamErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = validateWizardTeam({
        experiment_description: draft.experiment_description,
        lab: draft.lab,
        institution: draft.institution,
      }).errors;
      return sameErrors(prev, next) ? prev : next;
    });
  }, []);

  const handleTeamCommit = useCallback(
    (next: TeamCommit) => {
      handleFieldUpdate('experimenters', next.experimenters);
      handleFieldUpdate('experiment_description', next.experiment_description);
      actions.updateWorkspaceSettings(next.settings);
      const validation = validateWizardTeam({
        experiment_description: next.experiment_description,
        lab: next.experimenters.lab,
        institution: next.experimenters.institution,
      });
      setTeamErrors((prev) => (sameErrors(prev, validation.errors) ? prev : validation.errors));
    },
    [actions, handleFieldUpdate]
  );

  const vm = buildCreateAnimalWizardViewModel({
    currentStepKey,
    identity,
    existingAnimals,
    animal,
    behaviorOnly,
  });

  const currentIndex = WIZARD_STEP_KEYS.indexOf(currentStepKey);
  const isCreated = createdAnimalId != null;

  // Roving-tabindex focus index for the tablist (follows the active step on a programmatic change).
  const activeIndex = currentIndex;
  const [focusIndex, setFocusIndex] = useState(activeIndex);
  useEffect(() => setFocusIndex(activeIndex), [activeIndex]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(
    () => () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    },
    []
  );

  /**
   * The animals to check identity uniqueness against. The created animal is excluded: its subject_id
   * (the store key) is locked, so it would otherwise self-collide and block every legitimate
   * post-create edit (and falsely surface an "already exists" error).
   */
  const identityCheckAnimals = (): Record<string, unknown> => {
    if (!createdAnimalId) return existingAnimals;
    const others = { ...existingAnimals };
    delete others[createdAnimalId];
    return others;
  };

  /**
   * The single identity leave/commit gate. Validates the WHOLE draft; on failure it surfaces ALL
   * errors and stays on step 1 (an invalid edit is NEVER silently dropped — the user always sees why
   * it didn't save), returning null. On success it materializes the animal the first time (so the
   * store-bound setup containers can edit it) or commits the subject edit post-create, returning the
   * animal id. Idempotent for the create.
   */
  const tryCommitIdentity = (): string | null => {
    const result = validateWizardIdentity(identity, identityCheckAnimals());
    if (!result.valid) {
      setIdentityErrors(result.errors);
      setCurrentStepKey('identity');
      return null;
    }
    if (createdAnimalId) {
      handleFieldUpdate('subject', buildWizardCommitPayload(identity, defaults).subject);
      return createdAnimalId;
    }
    const payload = buildWizardCommitPayload(identity, defaults);
    // Defense-in-depth: createAnimal throws on a duplicate id from inside a React updater (uncatchable
    // here). The identity check already enforces uniqueness; if the animal somehow exists, adopt it.
    if (!existingAnimals[payload.animalId]) {
      actions.createAnimal(payload.animalId, payload.subject, payload.metadata);
    }
    setCreatedAnimalId(payload.animalId);
    return payload.animalId;
  };

  /**
   * Post-create, incrementally persist the subject from `draft` on a field's blur/select-change ONLY
   * when the WHOLE draft validates — a single field's edit must never write a subject that another
   * field has made invalid (e.g. species "other" + blank custom would otherwise persist an empty
   * species). Silent when invalid; the user is told what's wrong by the per-field error
   * (`handleIdentityBlur`) and by the leave gate ({@link tryCommitIdentity}).
   */
  const commitIdentityIfCreated = (draft: IdentityDraft) => {
    if (!createdAnimalId) return;
    if (validateWizardIdentity(draft, identityCheckAnimals()).valid) {
      handleFieldUpdate('subject', buildWizardCommitPayload(draft, defaults).subject);
    }
  };

  /**
   * Update an identity field; clear its error. `commitNow` (used by the selects, which have no
   * blur-commit) persists the change immediately when the animal already exists.
   */
  const handleIdentityChange = (field: keyof IdentityDraft, value: string, commitNow = false) => {
    const next = { ...identity, [field]: value };
    setIdentity(next);
    if (identityErrors[field]) {
      setIdentityErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
    if (commitNow) commitIdentityIfCreated(next);
  };

  /** Validate one identity field on blur; persist the subject edit when the animal already exists. */
  const handleIdentityBlur = (field: keyof IdentityDraft) => {
    const { errors } = validateWizardIdentity(identity, identityCheckAnimals());
    setIdentityErrors((prev) => {
      const copy = { ...prev };
      if (errors[field]) copy[field] = errors[field];
      else delete copy[field];
      return copy;
    });
    commitIdentityIfCreated(identity);
  };

  const goToAnimal = (id: string) => {
    window.location.hash = `#/animal/${id}/days`;
  };

  /** Advance (or, on the last step, finish — navigate to the new animal's days). */
  const handleNext = () => {
    if (vm.isLastStep) {
      const id = createdAnimalId ?? tryCommitIdentity();
      if (id && validateAndCommitTeam()) goToAnimal(id);
      return;
    }
    // Leaving Identity forward goes through the commit gate, which blocks + surfaces errors on an
    // invalid draft (so an invalid edit is never silently dropped).
    if (currentStepKey === 'identity' && !tryCommitIdentity()) return;
    setCurrentStepKey(WIZARD_STEP_KEYS[currentIndex + 1]);
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentStepKey(WIZARD_STEP_KEYS[currentIndex - 1]);
  };

  /** Save draft: commit the (valid) animal and leave; the partial draft persists. */
  const handleSaveDraft = () => {
    const id = tryCommitIdentity();
    if (!id) {
      setDraftSaved(false);
      return;
    }
    setDraftSaved(true);
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => goToAnimal(id), 500);
  };

  /** Jump to a step pill. Leaving Identity (or creating the animal) goes through the commit gate. */
  const handleTabActivate = (key: WizardStepKey) => {
    if (key === 'identity') {
      setCurrentStepKey('identity');
      return;
    }
    if ((!createdAnimalId || currentStepKey === 'identity') && !tryCommitIdentity()) return;
    setCurrentStepKey(key);
  };

  /** Declare a behavior-only animal: skip electrodes and move on. */
  const handleBehaviorOnly = () => {
    setBehaviorOnly(true);
    setCurrentStepKey('cameras');
  };

  /** Tablist roving-focus keyboard handling (Left/Right/Up/Down/Home/End move focus). */
  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const last = WIZARD_STEP_KEYS.length - 1;
    let next = focusIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = focusIndex === last ? 0 : focusIndex + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = focusIndex === 0 ? last : focusIndex - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    setFocusIndex(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <main id="main-content" tabIndex={-1} role="main" aria-labelledby="wizard-heading">
      <div className={styles.wizard}>
        <nav className={styles.crumb} aria-label="Breadcrumb">
          <a href="#/workspace">Animals</a> › New animal
        </nav>
        <h1 id="wizard-heading" className={styles.heading}>
          New animal — guided setup
        </h1>
        <p className={styles.lede}>
          Enter once what stays the same for this animal across every recording day. Recording days
          reuse all of this; you&apos;ll only revisit it on a re-implant.
        </p>
        <p className={styles.startOptions}>
          Starting fresh below, or{' '}
          <a href="#/import">Import a YAML…</a> ·{' '}
          <a href="#/copy-from-animal">Copy from another animal…</a>
        </p>

        {/* Stepper — a WAI-ARIA tablist over the seven steps; the active step's panel follows. */}
        <div
          className={styles.stepper}
          role="tablist"
          aria-label="Setup steps"
          data-testid="wizard-stepper"
          data-layout="single-row-scroll"
        >
          {vm.steps.map((step, index) => {
            const done = step.status === 'complete' || step.status === 'skipped';
            return (
              <button
                key={step.key}
                type="button"
                role="tab"
                id={`wizard-tab-${step.key}`}
                aria-selected={step.isActive}
                aria-controls="wizard-panel"
                tabIndex={index === focusIndex ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                className={`${styles.step} ${step.isActive ? styles.stepActive : ''} ${
                  done && !step.isActive ? styles.stepDone : ''
                }`}
                onClick={() => handleTabActivate(step.key)}
                onKeyDown={handleTabKeyDown}
              >
                <span className={styles.stepNum} aria-hidden="true">
                  {step.number}
                </span>
                {step.label}
                {step.optional && <span className={styles.stepOptional}> optional</span>}
              </button>
            );
          })}
        </div>

        <section
          id="wizard-panel"
          role="tabpanel"
          aria-labelledby={`wizard-tab-${currentStepKey}`}
          tabIndex={-1}
        >
          {currentStepKey === 'identity' && (
            <div className={styles.panel}>
              <h2>Identity</h2>
              <p className={styles.panelDesc}>
                Who this animal is. Fixed for the animal&apos;s life — set carefully; it can&apos;t
                drift day to day.
              </p>

              <div className={styles.field}>
                <label htmlFor="wizard-subject_id">Subject ID</label>
                <input
                  id="wizard-subject_id"
                  type="text"
                  value={identity.subject_id}
                  readOnly={isCreated}
                  placeholder="e.g. Laurent"
                  aria-invalid={!!identityErrors.subject_id}
                  onChange={(e) => handleIdentityChange('subject_id', e.target.value)}
                  onBlur={() => handleIdentityBlur('subject_id')}
                />
                <span className={styles.hint}>
                  Must be unique. Case folds to one key (RS10 = rs10). No slashes (DANDI).
                  {isCreated && ' Locked once the animal is created.'}
                </span>
                {identityErrors.subject_id && (
                  <span className={styles.error} role="alert">
                    {identityErrors.subject_id}
                  </span>
                )}
              </div>

              <div className={styles.two}>
                <div className={styles.field}>
                  <label htmlFor="wizard-species">Species</label>
                  <select
                    id="wizard-species"
                    value={identity.species}
                    onChange={(e) => handleIdentityChange('species', e.target.value, true)}
                    onBlur={() => handleIdentityBlur('species')}
                  >
                    {SPECIES_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className={styles.hint}>
                    Latin binomial — DANDI rejects free text like &ldquo;Rat&rdquo;.
                  </span>
                </div>
                <div className={styles.field}>
                  <label htmlFor="wizard-sex">Sex</label>
                  <select
                    id="wizard-sex"
                    value={identity.sex}
                    onChange={(e) => handleIdentityChange('sex', e.target.value, true)}
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="U">Unknown (U)</option>
                  </select>
                  <span className={styles.hint}>Single letter (NWB/DANDI), not &ldquo;Male&rdquo;.</span>
                </div>
              </div>

              {identity.species === 'other' && (
                <div className={styles.field}>
                  <label htmlFor="wizard-speciesCustom">Custom species</label>
                  <input
                    id="wizard-speciesCustom"
                    type="text"
                    value={identity.speciesCustom}
                    placeholder="Enter scientific name (e.g. Homo sapiens)"
                    aria-invalid={!!identityErrors.speciesCustom}
                    onChange={(e) => handleIdentityChange('speciesCustom', e.target.value)}
                    onBlur={() => handleIdentityBlur('speciesCustom')}
                  />
                  <span className={styles.hint}>
                    Must be a Latin binomial or an NCBI Taxon URI.
                  </span>
                  {identityErrors.speciesCustom && (
                    <span className={styles.error} role="alert">
                      {identityErrors.speciesCustom}
                    </span>
                  )}
                </div>
              )}

              <div className={styles.two}>
                <div className={styles.field}>
                  <label htmlFor="wizard-genotype">Genotype</label>
                  <input
                    id="wizard-genotype"
                    type="text"
                    value={identity.genotype}
                    placeholder="e.g. Wild-type, PV-Cre"
                    aria-invalid={!!identityErrors.genotype}
                    onChange={(e) => handleIdentityChange('genotype', e.target.value)}
                    onBlur={() => handleIdentityBlur('genotype')}
                  />
                  <span className={styles.hint}>
                    Genetic background — not the strain. Use &ldquo;Wild-type&rdquo; for unmodified.
                  </span>
                  {identityErrors.genotype && (
                    <span className={styles.error} role="alert">
                      {identityErrors.genotype}
                    </span>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="wizard-weight">Weight (grams)</label>
                  <input
                    id="wizard-weight"
                    type="number"
                    min="0"
                    step="any"
                    value={identity.weight}
                    placeholder="e.g. 450"
                    aria-invalid={!!identityErrors.weight}
                    onChange={(e) => handleIdentityChange('weight', e.target.value)}
                    onBlur={() => handleIdentityBlur('weight')}
                  />
                  {identityErrors.weight && (
                    <span className={styles.error} role="alert">
                      {identityErrors.weight}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="wizard-dob">Date of Birth</label>
                <input
                  id="wizard-dob"
                  type="date"
                  value={identity.date_of_birth}
                  max={new Date().toISOString().split('T')[0]}
                  aria-invalid={!!identityErrors.date_of_birth}
                  onChange={(e) => handleIdentityChange('date_of_birth', e.target.value)}
                  onBlur={() => handleIdentityBlur('date_of_birth')}
                />
                {identityErrors.date_of_birth && (
                  <span className={styles.error} role="alert">
                    {identityErrors.date_of_birth}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="wizard-description">Description</label>
                <input
                  id="wizard-description"
                  type="text"
                  value={identity.description}
                  placeholder="e.g. Long-Evans rat from Charles River"
                  onChange={(e) => handleIdentityChange('description', e.target.value)}
                  onBlur={() => handleIdentityBlur('description')}
                />
                <span className={styles.hint}>
                  Free-text note. Leave blank to auto-generate one from genotype and species.
                </span>
              </div>
            </div>
          )}

          {currentStepKey === 'electrodes' && createdAnimalId && (
            <div className={styles.panel}>
              <h2>Electrodes / probes</h2>
              <p className={styles.panelDesc}>
                One group per probe (or tetrode). Channel maps and geometry come from the device type
                automatically.
              </p>
              {behaviorOnly && (
                <p className={styles.behaviorOnlyNote} role="status">
                  Behavior-only animal — electrodes skipped. Add a probe here if that changes.
                </p>
              )}
              <ElectrodeGroupsContainer animalId={createdAnimalId} />
              <p className={styles.skip}>
                No electrophysiology?{' '}
                <button type="button" className={styles.skipButton} onClick={handleBehaviorOnly}>
                  This is a behavior-only animal — skip electrodes.
                </button>
              </p>
            </div>
          )}

          {currentStepKey === 'cameras' && animal && (
            <div className={styles.panel}>
              <h2>Cameras</h2>
              <p className={styles.panelDesc}>
                The cameras on this rig. Each day&apos;s epochs pick which cameras they used.
              </p>
              <p className={styles.calibrationNote} role="note">
                Verify each camera&apos;s meters-per-pixel calibration — a placeholder value silently
                mis-scales position.
              </p>
              <CamerasContainer animal={animal} onFieldUpdate={handleFieldUpdate} />
            </div>
          )}

          {currentStepKey === 'optogenetics' && createdAnimalId && (
            <div className={styles.panel}>
              <h2>
                Optogenetics <span className={styles.stepOptional}>optional</span>
              </h2>
              <p className={styles.panelDesc}>
                Only if this animal is stimulated. It&apos;s all-or-nothing: include every section or
                none — a partial setup silently drops all opto downstream.
              </p>
              {vm.opto.count > 0 && (
                <p className={styles.meter} data-testid="wizard-opto-meter">
                  Opto configured · {vm.opto.count} of 4
                </p>
              )}
              <OptogeneticsContainer animalId={createdAnimalId} />
            </div>
          )}

          {currentStepKey === 'tasks' && animal && (
            <div className={styles.panel}>
              <h2>Tasks</h2>
              <p className={styles.panelDesc}>
                Define task types once. Each recording day&apos;s epochs pick from these.
              </p>
              <TaskTypesContainer animal={animal} onFieldUpdate={handleFieldUpdate} />
            </div>
          )}

          {currentStepKey === 'recording-system' && animal && (
            <div className={styles.panel}>
              <h2>Recording system</h2>
              <p className={styles.panelDesc}>
                The acquisition hardware. Usually the same across the lab — change only if this animal
                used a different rig.
              </p>
              <RecordingSystemContainer animal={animal} onFieldUpdate={handleFieldUpdate} />
            </div>
          )}

          {currentStepKey === 'team' && animal && (
            <TeamStep
              initialNames={getExperimenterNames(animal)}
              initialLab={getAnimalExperimenters(animal).lab || defaults.lab}
              initialInstitution={getAnimalExperimenters(animal).institution || defaults.institution}
              initialExperimentDescription={String(
                (animal as { experiment_description?: unknown }).experiment_description ?? ''
              )}
              errors={teamErrors}
              onDraftChange={handleTeamDraftChange}
              onCommit={handleTeamCommit}
            />
          )}
        </section>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={handleBack} disabled={currentIndex === 0}>
            ← Back
          </Button>
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={handleSaveDraft}>
              Save draft
            </Button>
            {draftSaved && (
              <span className={styles.draftStatus} role="status" aria-live="polite">
                Draft saved
              </span>
            )}
            <Button variant="primary" onClick={handleNext}>
              {vm.nextLabel}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
