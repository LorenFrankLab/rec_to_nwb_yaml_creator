import type { ElectrodeGroup } from '../../state/workspaceTypes';

interface ReadOnlyDeviceInfoProps {
  /**
   * Electrode group configuration (the canonical `ElectrodeGroup`, plus an optional `units`
   * string this read-only panel also displays when present on an effective/merged group).
   */
  group: ElectrodeGroup & { units?: string };
}

/**
 * ReadOnlyDeviceInfo - Display inherited device configuration
 *
 * Shows read-only electrode group configuration inherited from animal level.
 * Used within DevicesStep to provide context for bad channel editing.
 */
export default function ReadOnlyDeviceInfo({ group }: ReadOnlyDeviceInfoProps) {
  return (
    <div className="device-info-readonly">
      <h4>Device Configuration</h4>

      <div className="read-only-grid">
        <div className="read-only-field">
          <label>Device Type</label>
          <span>{group.device_type}</span>
        </div>

        <div className="read-only-field">
          <label>Location</label>
          <span>{group.location}</span>
        </div>

        <div className="read-only-field">
          <label>Targeted Location</label>
          <span>{group.targeted_location}</span>
        </div>

        <div className="read-only-field">
          <label>Stereotaxic Coordinates</label>
          <span>
            ({group.targeted_x}, {group.targeted_y}, {group.targeted_z}) {group.units}
          </span>
        </div>

        <div className="read-only-field">
          <label>Description</label>
          <span>{group.description}</span>
        </div>
      </div>
    </div>
  );
}

