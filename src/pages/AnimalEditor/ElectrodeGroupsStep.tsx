import {
  getAnimalElectrodeGroups,
  getConfigHistory,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
} from '../../state/workspaceSelectors';
import type { ElectrodeGroup } from '../../state/workspaceTypes';
import { animalElectrodeSetupNeedsSync } from '../../domain/workflowStatus';
import { getChannelCount, getShankCount } from '../../utils/deviceTypeUtils';
import { deviceTypeLabel } from '../../valueList';
import Button from '../../components/ui/Button';
import './ElectrodeGroupsStep.scss';

/**
 * Editor-side electrode group: the canonical {@link ElectrodeGroup} plus the `units` field the
 * editor maintains (it is part of the saved snapshot but not the canonical workspace type).
 */
type ElectrodeGroupRow = ElectrodeGroup & { units?: string };

/**
 * Per-group completeness status: a decorative icon paired with a screen-reader
 * label so status is never conveyed by color/emoji alone (WCAG 1.4.1).
 */
const STATUS_META = {
  complete: { icon: '✓', label: 'Complete' },
  incomplete: { icon: '❌', label: 'Missing required fields' },
};

/** True when a required text-ish field has real content. */
function hasNonBlankValue(value: unknown): boolean {
  return value != null && (typeof value !== 'string' || value.trim() !== '');
}

/** True when the coordinate is present and finite. */
function hasFiniteCoordinate(value: unknown): boolean {
  return value != null && value !== '' && Number.isFinite(Number(value));
}

/**
 * Render a catalog-derived geometry count, distinguishing an UNKNOWN probe (count 0,
 * which never occurs for a real catalogued probe) from a real zero. An em dash makes an
 * uncatalogued device visually distinct rather than reading as "0 channels/shanks".
 */
function formatGeometryCount(count: number): number | string {
  return count > 0 ? count : '—';
}

interface ElectrodeGroupsStepProps {
  /** Animal record with `devices.electrode_groups`; read through tolerant selectors. */
  animal: unknown;
  /** Field update callback. */
  onFieldUpdate: (field: string, value: unknown) => void;
  /** Edit button click handler. */
  onEdit?: ((id: number) => void) | null;
  /** Add button click handler. */
  onAdd?: (() => void) | null;
  /** Delete button click handler. */
  onDelete?: ((group: ElectrodeGroup) => void) | null;
  /** Copy from animal click handler. */
  onCopy?: (() => void) | null;
}

/**
 * ElectrodeGroupsStep - Step 1 of Animal Editor
 *
 * Provides CRUD interface for electrode groups with table view.
 */
export default function ElectrodeGroupsStep({ animal, onFieldUpdate, onEdit, onAdd, onDelete, onCopy }: ElectrodeGroupsStepProps) {
  const electrodeGroups = getAnimalElectrodeGroups(animal);

  /** Compute status badge (✓ complete, ❌ missing required). */
  function getStatusKey(group: ElectrodeGroupRow): 'complete' | 'incomplete' {
    // `location` and `description` are optional in the editor (filled in on save),
    // so completeness keys off the fields the scientist must supply.
    const requiredText: Array<keyof ElectrodeGroupRow> = ['device_type', 'targeted_location', 'units'];
    const hasRequired = (
      requiredText.every(field => hasNonBlankValue(group[field])) &&
      hasFiniteCoordinate(group.targeted_x) &&
      hasFiniteCoordinate(group.targeted_y) &&
      hasFiniteCoordinate(group.targeted_z)
    );
    return hasRequired ? 'complete' : 'incomplete';
  }

  /**
   * Handle add button click
   */
  const handleAddClick = () => {
    if (onAdd) {
      onAdd();
    }
  };

  /**
   * Handle copy button click
   */
  const handleCopyClick = () => {
    if (onCopy) {
      onCopy();
    }
  };

  /** Handle edit button click. */
  const handleEditClick = (groupId: number) => {
    if (onEdit) {
      onEdit(groupId);
    }
  };

  /** Handle delete button click. */
  const handleDeleteClick = (group: ElectrodeGroup) => {
    if (onDelete) {
      onDelete(group);
    }
  };

  // Mirror-divergence repair state: the saved configuration HAS electrode geometry but the
  // editable mirror (animal.devices) is empty (recovered/imported data). Offer a safe re-sync
  // instead of the blank "add your first group" state — adding a group here would OVERWRITE the
  // saved snapshot via the devices→snapshot mirror.
  if (animalElectrodeSetupNeedsSync(animal)) {
    const latest = getConfigHistory(animal).slice(-1)[0];
    const snapshotGroups = getProbeElectrodeGroups(latest?.devices);
    const handleLoadSaved = () => {
      onFieldUpdate('devices', {
        electrode_groups: snapshotGroups,
        ntrode_electrode_group_channel_map: getProbeNtrodeMaps(latest?.devices),
      });
    };
    return (
      <div className="electrode-groups-step">
        <section className="raw-corruption-banner" role="alert" aria-label="Electrode setup needs repair">
          <p className="field-help-text">
            This animal&apos;s saved configuration has {snapshotGroups.length} electrode{' '}
            {snapshotGroups.length === 1 ? 'group' : 'groups'} that {snapshotGroups.length === 1 ? 'is' : 'are'} not
            loaded for editing. Load the saved configuration to review or edit it — adding new
            groups here instead would replace the saved configuration.
          </p>
          <button type="button" className="button-primary" onClick={handleLoadSaved}>
            Load saved electrode configuration
          </button>
        </section>
      </div>
    );
  }

  // Empty state
  if (electrodeGroups.length === 0) {
    return (
      <div className="electrode-groups-step empty-state">
        <div className="empty-state-icon" aria-hidden="true">🔌</div>
        <h3>No Electrode Groups Configured</h3>
        <p>
          Electrode groups define your recording hardware: brain regions, device types, and stereotaxic coordinates.
        </p>
        <p className="empty-state-hint">
          After adding electrode groups, you'll configure channel maps to match your Trodes hardware setup.
        </p>
        <button className="button-primary" onClick={handleAddClick}>
          Add First Electrode Group
        </button>
        <button className="button-secondary" onClick={handleCopyClick}>
          Copy from Existing Animal
        </button>
      </div>
    );
  }

  // Table view
  return (
    <div className="electrode-groups-step">
      <header className="step-header">
        <h2>Electrode Groups</h2>
        <p>Configure the electrode groups for this animal.</p>
        <p className="auto-maps-note">
          Channel maps are generated automatically from each electrode group&apos;s device type.
        </p>
      </header>

      <div className="table-actions">
        <button className="button-primary" onClick={handleAddClick}>
          + Add Electrode Group
        </button>
        <button className="button-secondary" onClick={handleCopyClick}>
          Copy from Animal
        </button>
      </div>

      <table className="electrode-groups-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device Type</th>
            <th>Location</th>
            <th>Channels</th>
            <th>Shanks</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {electrodeGroups.map((group) => (
            <tr key={group.id}>
              <td data-label="ID">{group.id}</td>
              <td data-label="Device Type" title={String(group.device_type ?? '')}>
                {deviceTypeLabel(group.device_type)}
              </td>
              <td data-label="Location">{group.location}</td>
              <td data-label="Channels">{formatGeometryCount(getChannelCount(group.device_type))}</td>
              <td data-label="Shanks">{formatGeometryCount(getShankCount(group.device_type))}</td>
              <td data-label="Status">
                {(() => {
                  const key = getStatusKey(group);
                  const meta = STATUS_META[key];
                  return (
                    <span className={`status-badge status-${key}`} role="img" aria-label={meta.label}>
                      <span aria-hidden="true">{meta.icon}</span>
                    </span>
                  );
                })()}
              </td>
              <td data-label="Actions">
                <Button
                  variant="neutral"
                  size="small"
                  onClick={() => handleEditClick(group.id)}
                  aria-label={`Edit electrode group ${group.id}`}
                >
                  Edit
                </Button>
                <Button
                  variant="dangerSubtle"
                  size="small"
                  onClick={() => handleDeleteClick(group)}
                  aria-label={`Delete electrode group ${group.id}`}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dialogs will be implemented in next tasks */}
    </div>
  );
}
