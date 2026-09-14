/**
 * Copy-from-animal screen (`#/copy-from-animal`).
 *
 * Reuse a same-rig animal's hardware/library setup for a brand-new animal, then hand off to the
 * guided wizard to confirm identity and continue. The new animal gets its OWN identity — only the
 * SETUP is copied; recording days and DIO/behavioral events are per-day and are never copied.
 *
 * It reuses the canonical read selectors (the same ones the in-app "Copy from another animal" dialog
 * reads) plus the store's create/update actions. Copying into a FRESH animal needs neither the
 * dialog's electrode re-id (a new animal's ids stay 0-based) nor its identity-divergence guard (a
 * verbatim copy of an existing identity cannot diverge from itself), so the screen composes the
 * selectors directly rather than the into-existing dialog's assembly.
 *
 * @module pages/CopyFromAnimal
 */

import { useMemo, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import {
  getAnimalCameras,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getAnimalSubject,
  getAnimalTaskTypes,
  getDataAcqDevices,
} from '../../state/workspaceSelectors';
import type { Animal, OptogeneticsConfig } from '../../state/workspaceTypes';
import Button from '../../components/ui/Button';
import { optoFieldsPresence } from '../../domain/optoCompleteness';
import type { OptoFields } from '../../domain/optoCompleteness';
import styles from './CopyFromAnimal.module.css';
import PageShell from '../../components/PageShell';

/** The copyable setup sections, in display order. */
const SECTIONS = ['probes', 'cameras', 'recording-system', 'task-types', 'optogenetics'] as const;
type Section = (typeof SECTIONS)[number];

/** Human labels for the section checklist. */
const SECTION_LABELS: Record<Section, string> = {
  probes: 'Configuration (probes)',
  cameras: 'Cameras',
  'recording-system': 'Recording system',
  'task-types': 'Task types',
  optogenetics: 'Optogenetics',
};

/** Whether an animal carries any optogenetics setup — the app's ONE definition of "present". */
function hasOpto(animal: unknown): boolean {
  const opto = (animal as { optogenetics?: unknown } | null)?.optogenetics;
  return optoFieldsPresence(opto && typeof opto === 'object' ? (opto as OptoFields) : null).count > 0;
}

/**
 * Whether a source animal has content for a given section.
 *
 * @param animal - The source animal.
 * @param section - The section to test.
 * @returns True when the section has copyable content.
 */
function sectionHasContent(animal: unknown, section: Section): boolean {
  switch (section) {
    case 'probes':
      return getAnimalElectrodeGroups(animal).length > 0;
    case 'cameras':
      return getAnimalCameras(animal).length > 0;
    case 'recording-system':
      return getDataAcqDevices(animal).length > 0;
    case 'task-types':
      return getAnimalTaskTypes(animal).length > 0;
    case 'optogenetics':
      return hasOpto(animal);
    default:
      return false;
  }
}

/**
 * The copy-from-animal screen.
 */
export default function CopyFromAnimal() {
  const { model, actions } = useStoreContext();
  const animals = useMemo(() => (model.workspace.animals ?? {}) as Record<string, Animal>, [model.workspace.animals]);

  const [sourceId, setSourceId] = useState('');
  // null = defaults (every available section checked); otherwise the explicit map.
  const [checked, setChecked] = useState<Record<string, boolean> | null>(null);
  const [newId, setNewId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const source = sourceId ? animals[sourceId] : null;

  // The candidate sources: every animal with ANY copyable setup.
  const sources = useMemo(
    () =>
      Object.entries(animals)
        .map(([id, animal]) => ({ id, name: getAnimalSubject(animal).subject_id || id, animal }))
        .filter((s) => SECTIONS.some((section) => sectionHasContent(s.animal, section))),
    [animals]
  );

  const availableSections = useMemo(
    () => (source ? SECTIONS.filter((s) => sectionHasContent(source, s)) : []),
    [source]
  );

  /** Whether a section is checked (defaults on until the user toggles). */
  const isChecked = (section: Section) => (checked === null ? true : !!checked[section]);

  /** Toggle a section, materializing the defaults on first toggle. */
  const toggle = (section: Section) => {
    setChecked((prev) => {
      const base =
        prev === null
          ? Object.fromEntries(availableSections.map((s): [string, boolean] => [s, true]))
          : { ...prev };
      base[section] = !base[section];
      return base;
    });
  };

  const normalizedId = newId.toLowerCase().trim();
  const idValid = /^[a-zA-Z0-9_-]+$/.test(normalizedId);
  const canCopy = !!source && idValid && !animals[normalizedId];

  /** Create the new animal from the copied setup, then hand off to the wizard to continue. */
  const handleCopy = () => {
    if (!source || !idValid) return;
    if (animals[normalizedId]) {
      setError(`An animal named “${normalizedId}” already exists.`);
      return;
    }

    const copyProbes = isChecked('probes') && availableSections.includes('probes');
    const copyCameras = isChecked('cameras') && availableSections.includes('cameras');
    const copyRecording = isChecked('recording-system') && availableSections.includes('recording-system');
    const copyTasks = isChecked('task-types') && availableSections.includes('task-types');
    const copyOpto = isChecked('optogenetics') && availableSections.includes('optogenetics');

    const devices = {
      electrode_groups: copyProbes ? structuredClone(getAnimalElectrodeGroups(source)) : [],
      ntrode_electrode_group_channel_map: copyProbes ? structuredClone(getAnimalNtrodeMaps(source)) : [],
      data_acq_device: copyRecording
        ? structuredClone(getDataAcqDevices(source))
        : [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
      device: { name: ['Trodes'] },
    };

    actions.createAnimal(
      normalizedId,
      { subject_id: normalizedId },
      {
        devices,
        cameras: copyCameras ? structuredClone(getAnimalCameras(source)) : [],
        optogenetics: copyOpto
          ? (structuredClone((source as { optogenetics?: OptogeneticsConfig }).optogenetics) ?? null)
          : null,
      }
    );
    if (copyTasks) {
      actions.updateAnimal(normalizedId, { taskTypes: structuredClone(getAnimalTaskTypes(source)) });
    }

    // Continue in the guided wizard, which adopts the just-created animal (identity to confirm,
    // the copied setup pre-filled).
    window.location.hash = `#/home?animal=${normalizedId}`;
  };

  return (
    <PageShell
      headingId="copy-heading"
      heading="Copy setup from another animal"
      crumb="New animal › Copy from another animal"
      lede="Reuse a same-rig animal's hardware setup, then tweak. The new animal gets its own identity — only the setup is copied."
      maxWidth={760}
    >

        {sources.length === 0 ? (
          <p className={styles.empty}>No other animals have a setup to copy from yet.</p>
        ) : (
          <>
            <div className={styles.card}>
              <h2 className={styles.cardHeading}>Copy from</h2>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Source animal</span>
                <select
                  className={styles.select}
                  value={sourceId}
                  onChange={(e) => {
                    setSourceId(e.target.value);
                    setChecked(null);
                    setError(null);
                  }}
                >
                  <option value="">Select an animal…</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {source && (
              <div className={styles.card}>
                <h2 className={styles.cardHeading}>What to copy</h2>
                <fieldset className={styles.checklist}>
                  <legend className="visually-hidden">Choose what to copy</legend>
                  {availableSections.map((section) => (
                    <label key={section} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={isChecked(section)}
                        onChange={() => toggle(section)}
                      />
                      <span>{SECTION_LABELS[section]}</span>
                    </label>
                  ))}
                </fieldset>
                <p className={styles.excluded}>
                  <strong>Not copied:</strong> identity (species/sex/genotype/DOB — the new animal is
                  its own subject), recording days, and DIO/behavioral events (those are set per
                  recording day).
                </p>
              </div>
            )}

            <div className={styles.card}>
              <h2 className={styles.cardHeading}>New animal</h2>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Subject ID *</span>
                <input
                  className={styles.input}
                  type="text"
                  value={newId}
                  placeholder="e.g. Wilbur"
                  onChange={(e) => {
                    setNewId(e.target.value);
                    setError(null);
                  }}
                />
              </label>
              {newId.trim() !== '' && !idValid && (
                <p className={styles.fieldError} role="alert">
                  Use only letters, numbers, hyphen, or underscore.
                </p>
              )}
              {error && <p className={styles.fieldError} role="alert">{error}</p>}
              <p className={styles.hint}>You&apos;ll confirm identity and the copied setup in the next step.</p>
            </div>

            <div className={styles.actions}>
              <Button disabled={!canCopy} onClick={handleCopy}>
                Copy &amp; continue setup →
              </Button>
              <span className={styles.spacer} />
              <a className={styles.cancelLink} href="#/workspace">Cancel</a>
            </div>
          </>
        )}
    </PageShell>
  );
}
