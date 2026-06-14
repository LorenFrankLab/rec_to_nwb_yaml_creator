import { useState } from 'react';
import type { ChangeEvent } from 'react';
import Modal from '../../components/Modal/Modal';
import BrainRegionAutocomplete, { canonicalizeRegion, BRAIN_REGIONS } from '../../components/BrainRegionAutocomplete';
import { deviceTypes, deviceTypeLabel } from '../../valueList';
import './ElectrodeGroupModal.scss';

/**
 * Edit-mode input: the saved electrode group as THIS editor reads it. `targeted_location` is a brain-
 * region string here and coordinates live in `targeted_x/y/z` — the editor's contract (mirrors the
 * original PropTypes), which deliberately differs from the canonical workspace `ElectrodeGroup`.
 */
export interface ElectrodeGroupInput {
  id?: number;
  device_type?: string;
  location?: string;
  description?: string;
  targeted_location?: string;
  targeted_x?: string | number;
  targeted_y?: string | number;
  targeted_z?: string | number;
  units?: string;
}

/** Local form state (all fields are strings while editing). */
interface ElectrodeGroupFormData {
  device_type: string;
  location: string;
  description: string;
  targeted_location: string;
  targeted_x: string;
  targeted_y: string;
  targeted_z: string;
  units: string;
  count: string;
}

/** The cleaned electrode-group definition this editor emits on save. */
export interface ElectrodeGroupSaveData {
  device_type: string;
  location: string;
  description: string;
  targeted_location: string;
  targeted_x: number;
  targeted_y: number;
  targeted_z: number;
  units: string;
  count: number;
}

/**
 * Compute initial form state once, from props, at mount. The parent Modal only
 * renders this form while open, so it remounts on each open and this initializer
 * runs fresh — no unstable-dependency init effect needed.
 *
 * @param mode - 'add' or 'edit'.
 * @param group - Electrode group being edited (edit mode).
 * @returns Initial form values.
 */
function getInitialFormData(mode: string, group: ElectrodeGroupInput | null): ElectrodeGroupFormData {
  if (mode === 'edit' && group) {
    return {
      device_type: group.device_type || '',
      location: group.location || '',
      description: group.description || '',
      targeted_location: group.targeted_location || '',
      targeted_x: group.targeted_x !== undefined && group.targeted_x !== '' ? String(group.targeted_x) : '',
      targeted_y: group.targeted_y !== undefined && group.targeted_y !== '' ? String(group.targeted_y) : '',
      targeted_z: group.targeted_z !== undefined && group.targeted_z !== '' ? String(group.targeted_z) : '',
      units: group.units || 'mm',
      count: '1',
    };
  }
  return {
    device_type: '',
    location: '',
    description: '',
    targeted_location: '',
    targeted_x: '',
    targeted_y: '',
    targeted_z: '',
    units: 'mm',
    count: '1',
  };
}

interface ElectrodeGroupFormProps {
  /** 'add' or 'edit'. */
  mode: 'add' | 'edit';
  /** Group data for edit mode. */
  group?: ElectrodeGroupInput | null;
  /** Canonical regions already used in the workspace. */
  knownRegions?: string[];
  /** Save callback with the cleaned group object. */
  onSave: (group: ElectrodeGroupSaveData) => void;
  /** Cancel callback. */
  onCancel: () => void;
}

/**
 * Electrode group add/edit form. Rendered as Modal children (only while open), so
 * its state initializes once per open. Field/validation/save behavior unchanged.
 */
function ElectrodeGroupForm({ mode, group = null, knownRegions = [], onSave, onCancel }: ElectrodeGroupFormProps) {
  const [formData, setFormData] = useState<ElectrodeGroupFormData>(() => getInitialFormData(mode, group));

  const isFiniteCoordinate = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));

  const isFormValid = () => {
    // At recording time the scientist only has the TARGET; the actual `location`
    // is confirmed later by histology, so only `targeted_location` is required here.
    // `location` and `description` are optional and filled in on save (see handleSave).
    const { device_type, targeted_location, targeted_x, targeted_y, targeted_z, count } = formData;
    const isCountValid = mode === 'edit' || (count && parseInt(count, 10) > 0 && parseInt(count, 10) <= 100);
    return (
      device_type.trim() !== '' &&
      targeted_location.trim() !== '' &&
      isFiniteCoordinate(targeted_x) &&
      isFiniteCoordinate(targeted_y) &&
      isFiniteCoordinate(targeted_z) &&
      isCountValid
    );
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }) as ElectrodeGroupFormData);
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    // Snap region fields to their canonical spelling so a case-only variant
    // (e.g. "ca1") does not fragment Spyglass BrainRegion rows. Canonicalize
    // against the standard regions plus any already used in this workspace.
    const canonicalRegions = [...BRAIN_REGIONS, ...knownRegions];
    const targetedLocation = canonicalizeRegion(formData.targeted_location, canonicalRegions);
    // `location` is schema-required and Spyglass keys its BrainRegion off it, so
    // default it to the target until the actual (post-histology) location is known.
    const location = formData.location.trim() !== ''
      ? canonicalizeRegion(formData.location, canonicalRegions)
      : targetedLocation;
    // `description` is schema-required (non-empty); derive a sensible default when
    // the scientist leaves it blank so the export stays valid.
    const description = formData.description.trim() !== ''
      ? formData.description.trim()
      : `${formData.device_type} targeting ${targetedLocation}`;
    onSave({
      device_type: formData.device_type,
      location,
      description,
      targeted_location: targetedLocation,
      targeted_x: Number(formData.targeted_x),
      targeted_y: Number(formData.targeted_y),
      targeted_z: Number(formData.targeted_z),
      units: formData.units,
      count: mode === 'add' ? parseInt(formData.count, 10) : 1,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={mode === 'edit' ? 'Edit Electrode Group' : 'Add Electrode Group'}
      titleId="electrode-group-modal-title"
      className="electrode-group-modal-content"
      footer={
        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            aria-label="Cancel and close modal"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleSave}
            disabled={!isFormValid()}
            aria-label="Save electrode group configuration"
          >
            Save
          </button>
        </div>
      }
    >
      <form className="electrode-group-modal-form">
        {/* Device Type (single source: valueList deviceTypes()) */}
      <div className="form-group">
        <label htmlFor="device_type">
          Device Type <span className="required">*</span>
        </label>
        <select
          id="device_type"
          name="device_type"
          value={formData.device_type}
          onChange={handleInputChange}
          required
        >
          <option value="">Select device type...</option>
          {/* Display a recognition-friendly summary; the option VALUE stays the exact probe ID
              (it keys into trodes_to_nwb probe-metadata filenames, so it must not change). */}
          {deviceTypes().map((deviceType) => (
            <option key={deviceType} value={deviceType}>
              {deviceTypeLabel(deviceType)}
            </option>
          ))}
        </select>
      </div>

      {/* Count (Add mode only) */}
      {mode === 'add' && (
        <div className="form-group">
          <label htmlFor="count">Number of Electrode Groups</label>
          <input
            id="count"
            type="number"
            name="count"
            min="1"
            max="100"
            value={formData.count}
            onChange={handleInputChange}
            required
          />
          <span className="help-text">
            Create multiple identical electrode groups at once (e.g., 4 tetrodes in CA1)
          </span>
        </div>
      )}

      {/* Targeted Location (the planned implant target — the region known at
          recording time, before histology; the primary required region field). */}
      <div className="form-group">
        <BrainRegionAutocomplete
          value={formData.targeted_location}
          onChange={(value) => setFormData((prev) => ({ ...prev, targeted_location: value }))}
          label="Targeted Location"
          name="targeted_location"
          suggestions={knownRegions}
          required
        />
        <span className="help-text">
          <span className="required" aria-hidden="true">*</span> Required. Planned implant target
          region (e.g., CA1) — the region you know at recording time.
        </span>
      </div>

      {/* Location (actual, post-histology). Optional here — defaults to the target
          until the confirmed location is known. */}
      <div className="form-group">
        <BrainRegionAutocomplete
          value={formData.location}
          onChange={(value) => setFormData((prev) => ({ ...prev, location: value }))}
          label="Location (optional)"
          name="location"
          suggestions={knownRegions}
        />
        <span className="help-text">
          Actual recorded region, confirmed by histology. Leave blank to use the
          targeted location for now; update it once histology is done.
        </span>
      </div>

      {/* Description (optional; auto-derived from device + target when left blank). */}
      <div className="form-group">
        <label htmlFor="description">Description (optional)</label>
        <input
          id="description"
          type="text"
          name="description"
          placeholder="e.g., Dorsal CA1 right hemisphere tetrode"
          value={formData.description}
          onChange={handleInputChange}
        />
        <span className="help-text">
          Free-text label for this group in the NWB file. Leave blank to auto-generate
          one from the device type and target.
        </span>
      </div>

      {/* Coordinates. Values are in the unit selected below (mm by default). */}
      <div className="form-group-coordinates">
        <div className="form-group">
          <label htmlFor="targeted_x">
            AP (Anterior-Posterior) ({formData.units}) <span className="required">*</span>
          </label>
          <input
            id="targeted_x"
            type="number"
            name="targeted_x"
            placeholder="0.0"
            step="any"
            value={formData.targeted_x}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="targeted_y">
            ML (Medial-Lateral) ({formData.units}) <span className="required">*</span>
          </label>
          <input
            id="targeted_y"
            type="number"
            name="targeted_y"
            placeholder="0.0"
            step="any"
            value={formData.targeted_y}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="targeted_z">
            DV (Dorsal-Ventral) ({formData.units}) <span className="required">*</span>
          </label>
          <input
            id="targeted_z"
            type="number"
            name="targeted_z"
            placeholder="0.0"
            step="any"
            value={formData.targeted_z}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>
      <p className="help-text">
        Stereotaxic coordinates in the unit selected below (millimeters by default).
      </p>

      {/* Units */}
      <div className="form-group">
        <label htmlFor="units">Units</label>
        <select id="units" name="units" value={formData.units} onChange={handleInputChange} required>
          <option value="mm">mm</option>
          <option value="μm">μm</option>
        </select>
      </div>

      {/* Bad channels are not set here — they vary per recording day. */}
      <p className="help-text">
        Failed channels are marked per recording day in the Day Editor (Devices step),
        not here, since channels fail over time.
      </p>

      {/* Tell the user what is still missing rather than leaving Save silently disabled. */}
      {!isFormValid() && (
        <p className="form-invalid-hint" role="status">
          Fill in all required fields (device type, targeted location, and the
          AP/ML/DV coordinates) to save.
        </p>
      )}

      </form>
    </Modal>
  );
}

interface ElectrodeGroupModalProps {
  /** Whether modal is currently open. */
  isOpen: boolean;
  /** 'add' or 'edit'. */
  mode?: 'add' | 'edit';
  /** Electrode group data (optional for add mode). */
  group?: ElectrodeGroupInput | null;
  /** Canonical regions already used in the workspace. */
  knownRegions?: string[];
  /** Callback with form data when saved. */
  onSave: (group: ElectrodeGroupSaveData) => void;
  /** Callback when modal is cancelled/closed. */
  onCancel: () => void;
}

/**
 * ElectrodeGroupModal - Add/edit an electrode group. Dialog accessibility (focus
 * trap, focus return, ESC/overlay close, scroll lock) is provided by the shared
 * Modal primitive, which ElectrodeGroupForm renders directly so the Save/Cancel
 * actions ride in the sticky footer (reachable without scrolling a tall form)
 * while sharing the form's state. The form mounts only while open, so its state
 * initializes fresh on each open.
 */
const ElectrodeGroupModal = ({ isOpen, mode = 'add', group = null, knownRegions = [], onSave, onCancel }: ElectrodeGroupModalProps) =>
  isOpen ? (
    <ElectrodeGroupForm mode={mode} group={group} knownRegions={knownRegions} onSave={onSave} onCancel={onCancel} />
  ) : null;

export default ElectrodeGroupModal;
