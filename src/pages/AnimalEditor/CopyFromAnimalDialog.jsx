import { useState, useMemo, useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import {
  getAnimalCameras,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getDataAcqDevices,
} from '../../state/workspaceSelectors';
import {
  normalizeElectrodeGroupWithDefaults,
  normalizeIdKey,
  normalizeNtrodeMapWithDefaults,
} from '../../utils/deviceNormalization';
import {
  CAMERA_DEPENDENT_FIELDS,
  DATA_ACQ_DEPENDENT_FIELDS,
  IDENTITY_FIELD_LABELS,
  collectCameraIdentities,
  collectDataAcqIdentities,
  findIdentityDivergence,
} from './identitySafety';
import './CopyFromAnimalDialog.scss';

/** The sections this dialog can copy, in display order. */
const ALL_SECTIONS = ['electrode_groups', 'cameras', 'data_acq_device'];

/** Human labels for the section checklist. */
const SECTION_LABELS = {
  electrode_groups: 'Electrode groups + channel maps',
  cameras: 'Cameras',
  data_acq_device: 'Recording system',
};

/**
 * Dialog for copying shared hardware catalogs from another animal.
 *
 * A lab's rig is shared across animals, so this copies any combination of an existing animal's
 * electrode groups (+ channel maps), cameras, and recording-system (`data_acq_device`) catalogs.
 * Electrode groups/maps are re-ID'd to the current animal's next ids; cameras / data-acq are
 * deep-cloned as-is. Before emitting, copied camera/data-acq names are checked against the rest of
 * the workspace: a name reused with different dependent fields (a Spyglass identity divergence) is
 * surfaced and blocks the whole copy.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether dialog is open.
 * @param {string} props.currentAnimalId - ID of current animal (excluded from list + divergence registry).
 * @param {object} props.animals - All animals from workspace.
 * @param {string[]} [props.availableSections] - Which sections this host offers.
 * @param {Function} props.onCopy - Callback when copy confirmed.
 * @param {Function} props.onCancel - Callback when canceled.
 * @returns {JSX.Element}
 */
export default function CopyFromAnimalDialog({
  open,
  currentAnimalId,
  animals,
  availableSections = ALL_SECTIONS,
  onCopy,
  onCancel,
}) {
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  // Which sections are checked. Keyed by section name; defaults are applied per source (all
  // offerable sections start checked) the first time a source is selected.
  const [checkedSections, setCheckedSections] = useState(null);
  // Set when a camera/data-acq name in the copy diverges from an existing workspace identity. When
  // set, the copy is blocked and the alert(s) render. Cleared whenever the selection/checks change.
  const [divergences, setDivergences] = useState(null);
  const titleId = useId();

  // The sections this host offers, restricted to the allow-list and preserving display order.
  const offerableSections = useMemo(
    () => ALL_SECTIONS.filter((s) => availableSections.includes(s)),
    [availableSections]
  );

  /**
   * Get available source animals (exclude current). Each carries its catalogs so the radio list can
   * decide selectability and the per-section checklist can decide which sections have content.
   */
  const availableAnimals = useMemo(() => {
    return Object.entries(animals || {})
      .filter(([animalId]) => animalId !== currentAnimalId)
      .map(([animalId, animalData]) => ({
        id: animalId,
        name: animalData.subject?.subject_id || animalId,
        electrodeGroups: getAnimalElectrodeGroups(animalData),
        channelMaps: getAnimalNtrodeMaps(animalData),
        cameras: getAnimalCameras(animalData),
        dataAcqDevices: getDataAcqDevices(animalData),
      }));
  }, [animals, currentAnimalId]);

  /** Get current animal data. */
  const currentAnimal = useMemo(() => {
    return animals?.[currentAnimalId] || null;
  }, [animals, currentAnimalId]);

  /** Get selected source animal. */
  const selectedAnimal = useMemo(() => {
    if (!selectedAnimalId) return null;
    return availableAnimals.find((a) => a.id === selectedAnimalId) || null;
  }, [availableAnimals, selectedAnimalId]);

  /**
   * Whether a given offerable section has content on a source animal AND is safe to offer given
   * the current (target) animal's existing catalog.
   *
   * Asymmetry by design: cameras and data_acq_device are identity-keyed catalogs (camera `id`,
   * device `name`) and are deep-cloned as-is — `normalizeDevices` does NOT re-id or dedupe them,
   * so appending into a non-empty catalog can create an intra-animal duplicate identity (data
   * corruption that the whole-object `uniqueItems` schema check does not catch). We therefore only
   * offer to SEED them into an EMPTY target catalog. Electrode groups are re-ID'd to the target's
   * next ids on copy, so appending is already collision-safe and is offered whenever the source has
   * them (matching the electrode-groups-tab copy host).
   *
   * @param {object} animal - A source-animal descriptor.
   * @param {string} section - A section key.
   * @returns {boolean}
   */
  function sectionHasContent(animal, section) {
    if (!animal) return false;
    if (section === 'electrode_groups') return animal.electrodeGroups.length > 0;
    if (section === 'cameras') {
      return animal.cameras.length > 0 && getAnimalCameras(currentAnimal).length === 0;
    }
    if (section === 'data_acq_device') {
      return animal.dataAcqDevices.length > 0 && getDataAcqDevices(currentAnimal).length === 0;
    }
    return false;
  }

  /**
   * Whether a source animal has content for ANY offerable section (so it can be selected).
   * @param {object} animal - A source-animal descriptor.
   * @returns {boolean}
   */
  function animalHasAnyContent(animal) {
    return offerableSections.some((s) => sectionHasContent(animal, s));
  }

  // The offerable sections the SELECTED source actually has content for (these are the checklist).
  const sourceSections = useMemo(
    () => offerableSections.filter((s) => sectionHasContent(selectedAnimal, s)),
    // sectionHasContent is a stable in-component function that reads only its args plus
    // currentAnimal; currentAnimal is itself memoized on [animals, currentAnimalId], so it is
    // listed explicitly here and the function reference is intentionally omitted (re-created each
    // render, would defeat the memo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offerableSections, selectedAnimal, currentAnimal]
  );

  /**
   * Whether a section is checked. Until the user toggles, all offerable-with-content sections
   * default checked (checkedSections === null means "defaults").
   * @param {string} section - A section key.
   * @returns {boolean}
   */
  function isChecked(section) {
    if (checkedSections === null) return true;
    return !!checkedSections[section];
  }

  /** Calculate next available IDs for electrode groups and channel maps. */
  const nextIds = useMemo(() => {
    const currentGroups = getAnimalElectrodeGroups(currentAnimal);
    const currentMaps = getAnimalNtrodeMaps(currentAnimal);

    const maxGroupId =
      currentGroups.length > 0
        ? Math.max(
            ...currentGroups.map((g) => {
              const parsed = parseInt(g.id, 10);
              return Number.isNaN(parsed) ? -1 : parsed;
            })
          )
        : -1;

    const maxNtrodeId =
      currentMaps.length > 0
        ? Math.max(
            ...currentMaps.map((m) => {
              const parsed = parseInt(m.ntrode_id, 10);
              return Number.isNaN(parsed) ? -1 : parsed;
            })
          )
        : -1;

    return {
      nextGroupId: maxGroupId + 1,
      nextNtrodeId: maxNtrodeId + 1,
    };
  }, [currentAnimal]);

  /**
   * Select a source animal and reset the per-source checks + any divergence.
   * @param animalId
   */
  function handleSelectAnimal(animalId) {
    setSelectedAnimalId(animalId);
    setCheckedSections(null);
    setDivergences(null);
  }

  /**
   * Toggle a section's checkbox, materializing defaults on first toggle. Clears divergence.
   * @param section
   */
  function toggleSection(section) {
    setCheckedSections((prev) => {
      const base = prev === null
        ? Object.fromEntries(sourceSections.map((s) => [s, true]))
        : { ...prev };
      base[section] = !base[section];
      return base;
    });
    setDivergences(null);
  }

  /** Build the electrode groups + channel maps copy with new ids (unchanged from the original). */
  function buildElectrodeCopy() {
    const groupIdMap = new Map();

    const copiedGroups = selectedAnimal.electrodeGroups.map((group, index) => {
      const oldId = normalizeIdKey(group.id);
      const newId = nextIds.nextGroupId + index;
      groupIdMap.set(oldId, newId);
      return normalizeElectrodeGroupWithDefaults({ ...group, id: newId }, newId);
    });

    let nextNtrodeId = nextIds.nextNtrodeId;
    const copiedMaps = selectedAnimal.channelMaps.flatMap((map) => {
      const oldGroupId = normalizeIdKey(map.electrode_group_id);
      if (!groupIdMap.has(oldGroupId)) {
        return [];
      }
      const copied = normalizeNtrodeMapWithDefaults(
        {
          ...map,
          ntrode_id: nextNtrodeId,
          electrode_group_id: groupIdMap.get(oldGroupId),
        },
        nextNtrodeId,
        groupIdMap.get(oldGroupId)
      );
      nextNtrodeId += 1;
      return [copied];
    });

    return { electrode_groups: copiedGroups, ntrode_electrode_group_channel_map: copiedMaps };
  }

  /**
   * Check copied cameras / data-acq devices against the rest of the workspace for an identity
   * divergence (same name, different dependent fields). Returns an array of divergence descriptors,
   * each `{ kind, name, existing, differingFields }`; empty when the copy is safe.
   *
   * @param {Array} cameras - The cameras to be copied (or []).
   * @param {Array} dataAcq - The data-acq devices to be copied (or []).
   * @returns {Array<{kind: string, name: string, existing: object, differingFields: string[]}>}
   */
  function detectDivergences(cameras, dataAcq) {
    const found = [];

    if (cameras.length > 0) {
      const registry = collectCameraIdentities({ animals }, { animalId: currentAnimalId });
      for (const camera of cameras) {
        const candidateFields = Object.fromEntries(
          CAMERA_DEPENDENT_FIELDS.map((f) => [f, camera[f]])
        );
        const divergence = findIdentityDivergence(camera.camera_name, candidateFields, registry);
        if (divergence) {
          found.push({
            kind: 'camera',
            name: camera.camera_name,
            existing: divergence.existing,
            differingFields: divergence.differingFields,
            candidateFields,
          });
        }
      }
    }

    if (dataAcq.length > 0) {
      const registry = collectDataAcqIdentities({ animals }, currentAnimalId);
      for (const device of dataAcq) {
        const candidateFields = Object.fromEntries(
          DATA_ACQ_DEPENDENT_FIELDS.map((f) => [f, device[f]])
        );
        const divergence = findIdentityDivergence(device.name, candidateFields, registry);
        if (divergence) {
          found.push({
            kind: 'data_acq',
            name: device.name,
            existing: divergence.existing,
            differingFields: divergence.differingFields,
            candidateFields,
          });
        }
      }
    }

    return found;
  }

  /** Handle copy button click. */
  function handleCopy() {
    if (!selectedAnimal) return;

    const checked = sourceSections.filter((s) => isChecked(s));
    if (checked.length === 0) return;

    const payload = { sourceAnimalName: selectedAnimal.name };

    if (checked.includes('electrode_groups')) {
      const { electrode_groups, ntrode_electrode_group_channel_map } = buildElectrodeCopy();
      payload.electrode_groups = electrode_groups;
      payload.ntrode_electrode_group_channel_map = ntrode_electrode_group_channel_map;
    }

    const copiedCameras = checked.includes('cameras')
      ? structuredClone(selectedAnimal.cameras)
      : [];
    const copiedDataAcq = checked.includes('data_acq_device')
      ? structuredClone(selectedAnimal.dataAcqDevices)
      : [];

    // Identity guard BEFORE emitting: a divergent camera/data-acq name blocks the whole copy.
    const found = detectDivergences(copiedCameras, copiedDataAcq);
    if (found.length > 0) {
      setDivergences(found);
      return;
    }

    if (copiedCameras.length > 0) payload.cameras = copiedCameras;
    if (copiedDataAcq.length > 0) payload.data_acq_device = copiedDataAcq;

    onCopy(payload);

    // Reset selection
    setSelectedAnimalId(null);
    setCheckedSections(null);
    setDivergences(null);
  }

  /** Handle cancel button click. */
  function handleCancel() {
    setSelectedAnimalId(null);
    setCheckedSections(null);
    setDivergences(null);
    onCancel();
  }

  // ≥1 checked section that has content.
  const checkedWithContent = sourceSections.filter((s) => isChecked(s));
  const canCopy = !!selectedAnimal && checkedWithContent.length > 0;

  // The electrode-only host (single offerable section) keeps its original wording so its
  // existing tests + UX are unchanged; otherwise use the generic title + a section checklist.
  const isMultiSection = offerableSections.length > 1;
  const title = isMultiSection ? 'Copy from Animal' : 'Copy Electrode Groups from Animal';
  const groupCount = selectedAnimal?.electrodeGroups.length || 0;

  return (
    <Modal
      isOpen={open}
      onClose={handleCancel}
      title={title}
      titleId={titleId}
      className="copy-from-animal-modal"
    >
      <div className="modal-body">
        {availableAnimals.length === 0 ? (
          <p className="info-message">No other animals available to copy from.</p>
        ) : (
          <>
            <p className="info-message">
              {isMultiSection
                ? 'Select an animal to copy shared hardware from, then choose which catalogs to copy.'
                : 'Select an animal to copy electrode groups from. All electrode groups and their channel mappings will be copied with new IDs.'}
            </p>

            <div className="animal-list">
              {availableAnimals.map((animal) => {
                const selectable = animalHasAnyContent(animal);
                const groupText =
                  animal.electrodeGroups.length === 1
                    ? '1 electrode group'
                    : `${animal.electrodeGroups.length} electrode groups`;
                // Summary text describing the animal's offerable content.
                const parts = [];
                if (offerableSections.includes('electrode_groups') && animal.electrodeGroups.length > 0) {
                  parts.push(groupText);
                }
                if (offerableSections.includes('cameras') && animal.cameras.length > 0) {
                  parts.push(animal.cameras.length === 1 ? '1 camera' : `${animal.cameras.length} cameras`);
                }
                if (offerableSections.includes('data_acq_device') && animal.dataAcqDevices.length > 0) {
                  parts.push('recording system');
                }
                const summary = parts.length > 0 ? parts.join(', ') : 'nothing to copy';

                return (
                  <label
                    key={animal.id}
                    className={`animal-option ${!selectable ? 'disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="sourceAnimal"
                      value={animal.id}
                      checked={selectedAnimalId === animal.id}
                      disabled={!selectable}
                      onChange={(e) => handleSelectAnimal(e.target.value)}
                      aria-label={`${animal.name} (${summary})`}
                    />
                    <div className="animal-info">
                      <span className="animal-name">{animal.name}</span>
                      <span className="animal-group-count">{summary}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Section checklist (only when >1 section is offerable, to keep the electrode-only
                host visually unchanged). */}
            {selectedAnimal && isMultiSection && sourceSections.length > 0 && (
              <fieldset className="copy-section-list">
                <legend>Choose what to copy</legend>
                {sourceSections.map((section) => (
                  <label key={section} className="copy-section-option">
                    <input
                      type="checkbox"
                      checked={isChecked(section)}
                      onChange={() => toggleSection(section)}
                    />
                    <span>{SECTION_LABELS[section]}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {/* Identity divergence: a copied camera/data-acq name reused with different dependent
                fields. The whole copy is blocked until the conflict is resolved upstream. */}
            {divergences && divergences.length > 0 && (
              <div className="identity-divergence" role="alert">
                <p className="identity-divergence-title">
                  Copy blocked: a name in this copy is already used elsewhere with different
                  settings. The same name must mean the same device. Resolve the conflict before
                  copying.
                </p>
                {divergences.map((d) => (
                  <div key={`${d.kind}-${d.name}`} className="identity-divergence-conflict">
                    <p className="identity-divergence-subtitle">
                      The {d.kind === 'camera' ? 'camera' : 'recording-system'} name “{String(d.name ?? '').trim()}”
                      {' '}is already used by {d.existing.label} with different settings.
                    </p>
                    <table className="identity-divergence-table">
                      <thead>
                        <tr><th>Field</th><th>Existing</th><th>This copy</th></tr>
                      </thead>
                      <tbody>
                        {d.differingFields.map((field) => (
                          <tr key={field}>
                            <td>{IDENTITY_FIELD_LABELS[field] || field}</td>
                            <td>{String(d.existing.fields[field] ?? '')}</td>
                            <td>{String(d.candidateFields[field] ?? '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {selectedAnimal && !isMultiSection && groupCount > 0 && (
              <div className="copy-preview">
                <p>
                  {groupCount} electrode {groupCount === 1 ? 'group' : 'groups'} will be copied from{' '}
                  <strong>{selectedAnimal.name}</strong> with new IDs starting from{' '}
                  {nextIds.nextGroupId}.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={handleCancel} className="button-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!canCopy}
          className="button-primary"
        >
          Copy
        </button>
      </footer>
    </Modal>
  );
}

CopyFromAnimalDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  currentAnimalId: PropTypes.string.isRequired,
  animals: PropTypes.object.isRequired,
  availableSections: PropTypes.arrayOf(PropTypes.string),
  onCopy: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
