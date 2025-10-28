import PropTypes from 'prop-types';

/**
 * ReadOnlyDeviceInfo - Display inherited device configuration
 *
 * Shows read-only electrode group configuration inherited from animal level.
 * Used within DevicesStep to provide context for bad channel editing.
 *
 * @param {object} props
 * @param {object} props.group - Electrode group configuration
 * @returns {JSX.Element}
 */
export default function ReadOnlyDeviceInfo({ group }) {
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

ReadOnlyDeviceInfo.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.number.isRequired,
    device_type: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    targeted_location: PropTypes.string.isRequired,
    targeted_x: PropTypes.number.isRequired,
    targeted_y: PropTypes.number.isRequired,
    targeted_z: PropTypes.number.isRequired,
    units: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
  }).isRequired,
};
