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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { getDefaultExperimenters } from '../../domain/animalCreation';
import {
  buildCreateAnimalWizardViewModel,
  buildWizardCommitPayload,
  validateWizardIdentity,
  WIZARD_STEP_KEYS,
} from '../../viewModels/createAnimalWizardViewModel';
import type { IdentityDraft, WizardStepKey } from '../../viewModels/createAnimalWizardViewModel';
import { getAnimalExperimenters, getExperimenterNames } from '../../state/workspaceSelectors';
import type { Animal, ExperimenterInfo } from '../../state/workspaceTypes';
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
 * The Team (experimenters) step — a small local-state editor that commits to `updateAnimal` on blur.
 * Seeded from the animal's current experimenters (set from defaults at create-time).
 */
function TeamStep({
  initialNames,
  initialLab,
  initialInstitution,
  onCommit,
}: {
  initialNames: string[];
  initialLab: string;
  initialInstitution: string;
  onCommit: (next: ExperimenterInfo) => void;
}) {
  const [names, setNames] = useState<string[]>(initialNames.length ? initialNames : ['']);
  const [lab, setLab] = useState<string>(initialLab);
  const [institution, setInstitution] = useState<string>(initialInstitution);

  const commit = () =>
    onCommit({
      experimenter_name: names.filter((n) => n.trim()),
      lab,
      institution,
    });

  return (
    <div className={styles.panel}>
      <h2>Team</h2>
      <p className={styles.panelDesc}>
        Who works on this animal. This seeds each recording day&apos;s &ldquo;who ran it&rdquo;
        (editable per day).
      </p>

      <div className={styles.field}>
        <label id="team-names-label">Experimenter names</label>
        <div role="group" aria-labelledby="team-names-label">
          {names.map((name, idx) => (
            <div className={styles.teamRow} key={idx}>
              <input
                type="text"
                className={styles.teamNameInput}
                value={name}
                aria-label={`Experimenter ${idx + 1}`}
                placeholder="Last, First (e.g. Doe, Jane)"
                onChange={(e) =>
                  setNames((prev) => prev.map((n, i) => (i === idx ? e.target.value : n)))
                }
                onBlur={commit}
              />
              {idx > 0 && (
                <Button
                  variant="secondary"
                  size="small"
                  aria-label={`Remove experimenter ${idx + 1}`}
                  onClick={() => {
                    // Persist the removal immediately — it must not wait on a later field's blur.
                    const nextNames = names.filter((_, i) => i !== idx);
                    setNames(nextNames);
                    onCommit({
                      experimenter_name: nextNames.filter((n) => n.trim()),
                      lab,
                      institution,
                    });
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
            onClick={() => setNames((prev) => [...prev, ''])}
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
            value={lab}
            onChange={(e) => setLab(e.target.value)}
            onBlur={commit}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="team-institution">Institution</label>
          <input
            id="team-institution"
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            onBlur={commit}
          />
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

  const [identity, setIdentity] = useState<IdentityDraft>(INITIAL_IDENTITY);
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
  const [currentStepKey, setCurrentStepKey] = useState<WizardStepKey>('identity');
  const [createdAnimalId, setCreatedAnimalId] = useState<string | null>(null);
  const [behaviorOnly, setBehaviorOnly] = useState(false);

  const animal = (createdAnimalId ? existingAnimals[createdAnimalId] : null) as Animal | null;
  const defaults = useMemo(() => getDefaultExperimenters(model.workspace), [model.workspace]);
  const { handleFieldUpdate } = useAnimalFieldUpdate(createdAnimalId ?? '');

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

  /**
   * Materialize the animal in the store (once) so the store-bound setup containers can edit it.
   * Requires a valid identity; on an invalid identity it surfaces the errors and routes back to
   * step 1, returning null. Idempotent: a second call returns the already-created id.
   */
  const ensureCreated = (): string | null => {
    if (createdAnimalId) return createdAnimalId;
    const result = validateWizardIdentity(identity, existingAnimals);
    if (!result.valid) {
      setIdentityErrors(result.errors);
      setCurrentStepKey('identity');
      return null;
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
   * Post-create, persist the subject from `draft` ONLY when the WHOLE identity draft validates — a
   * single field's blur must never write a subject that another field has made invalid (e.g.
   * species "other" + blank custom would otherwise persist an empty species). The created animal is
   * excluded from the uniqueness check: its subject_id (the store key) is locked, so it would
   * otherwise self-collide and block every legitimate post-create edit.
   */
  const commitIdentityIfCreated = (draft: IdentityDraft) => {
    if (!createdAnimalId) return;
    const others = { ...existingAnimals };
    delete others[createdAnimalId];
    if (validateWizardIdentity(draft, others).valid) {
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
    const { errors } = validateWizardIdentity(identity, existingAnimals);
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
      const id = createdAnimalId ?? ensureCreated();
      if (id) goToAnimal(id);
      return;
    }
    if (currentStepKey === 'identity' && !ensureCreated()) return;
    setCurrentStepKey(WIZARD_STEP_KEYS[currentIndex + 1]);
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentStepKey(WIZARD_STEP_KEYS[currentIndex - 1]);
  };

  /** Save draft: commit the (valid) animal and leave; the partial draft persists. */
  const handleSaveDraft = () => {
    const id = ensureCreated();
    if (id) goToAnimal(id);
  };

  /** Jump to a step pill. Steps past identity require the animal to exist first. */
  const handleTabActivate = (key: WizardStepKey) => {
    if (key === 'identity') {
      setCurrentStepKey('identity');
      return;
    }
    if (!ensureCreated()) return;
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
          <a href="#/workspace?import=1">Import a YAML…</a> ·{' '}
          <a href="#/workspace">Copy from another animal…</a>
        </p>

        {/* Stepper — a WAI-ARIA tablist over the seven steps; the active step's panel follows. */}
        <div className={styles.stepper} role="tablist" aria-label="Setup steps">
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
              initialLab={getAnimalExperimenters(animal).lab ?? ''}
              initialInstitution={getAnimalExperimenters(animal).institution ?? ''}
              onCommit={(next) => handleFieldUpdate('experimenters', next)}
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
            <Button variant="primary" onClick={handleNext}>
              {vm.nextLabel}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
