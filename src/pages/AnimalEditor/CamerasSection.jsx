import PropTypes from 'prop-types';
import { getAnimalCameras } from '../../state/workspaceSelectors';
import { rawArray } from '../../components/rawPropTypes';
import './CamerasSection.scss';

/**
 * CamerasSection - Camera configuration section for Animal Editor
 *
 * Provides CRUD interface for cameras with table view.
 * Displays camera metadata: ID, name, manufacturer, model, meters_per_pixel.
 * Status badges indicate validation state (✓ complete, ⚠ warnings).
 *
 * Integration with CameraModal for add/edit operations (handled by parent).
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with cameras array
 * @param {Function} props.onFieldUpdate - Field update callback
 * @param {Function} [props.onEdit] - Edit button click handler (camera ID)
 * @param {Function} [props.onAdd] - Add button click handler
 * @param {Function} [props.onDelete] - Delete button click handler (camera object)
 * @returns {JSX.Element}
 */
export default function CamerasSection({ animal, onFieldUpdate, onEdit, onAdd, onDelete }) {
  // This section is a repair destination for a malformed-collection finding, so it must
  // tolerate the very corruption it exists to fix. Read cameras through the canonical
  // selector: a non-array `cameras` (e.g. "nope") degrades to the empty state instead of
  // throwing on `.reduce`/`.map`/`.length`.
  const cameras = getAnimalCameras(animal);
  const cameraIdCounts = cameras.reduce((acc, camera) => {
    const key = String(camera.id);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const duplicateCameraIds = new Set(
    Object.entries(cameraIdCounts)
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
  );

  /**
   * Compute status badge for camera
   * ✓ - All required fields present and meters_per_pixel in typical range
   * ⚠ - Required fields present but meters_per_pixel outside typical range
   * ❌ - Missing required fields
   *
   * @param {object} camera
   * @returns {string} Status emoji
   */
  function getStatus(camera) {
    if (duplicateCameraIds.has(String(camera.id))) {
      return 'duplicate';
    }

    // Required fields (lens is schema-required alongside the others).
    const required = ['camera_name', 'manufacturer', 'model', 'lens', 'meters_per_pixel'];
    const hasRequired = required.every(field => {
      const value = camera[field];
      return value !== undefined && value !== null && value !== '';
    });

    if (!hasRequired) {
      return 'incomplete';
    }

    // Check meters_per_pixel range
    const mpp = camera.meters_per_pixel;
    const TYPICAL_MIN = 0.0005;
    const TYPICAL_MAX = 0.002;

    if (mpp < TYPICAL_MIN || mpp > TYPICAL_MAX) {
      return 'warning';
    }

    return 'complete';
  }

  /**
   * Text label for a camera's status symbol, so screen readers and colorblind users
   * get meaning rather than a raw glyph.
   *
   * @param {string} status - The status emoji from {@link getStatus}.
   * @returns {string} A human-readable status.
   */
  function getStatusText(status) {
    if (status === 'duplicate') return 'Duplicate camera ID';
    if (status === 'incomplete') return 'Incomplete: required fields missing';
    if (status === 'warning') return 'Warning: meters per pixel outside the typical range';
    return 'Complete';
  }

  /**
   * @param {string} status - Internal status key from {@link getStatus}.
   * @returns {string} The displayed status glyph.
   */
  function getStatusSymbol(status) {
    if (status === 'complete') return '✓';
    if (status === 'warning') return '⚠';
    return '❌';
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
   * Handle edit button click
   * @param {number} cameraId
   */
  const handleEditClick = (cameraId) => {
    if (onEdit) {
      onEdit(cameraId);
    }
  };

  /**
   * Handle delete button click
   * @param {object} camera - Camera to delete
   */
  const handleDeleteClick = (camera) => {
    if (onDelete) {
      onDelete(camera);
    }
  };

  // Empty state
  if (cameras.length === 0) {
    return (
      <div className="cameras-section empty-state">
        <div className="empty-state-icon">📹</div>
        <h3>No Cameras Configured</h3>
        <p>
          Cameras define your video recording hardware: position tracking, behavioral monitoring, and experimental context.
        </p>
        <p className="empty-state-hint">
          Configure camera metadata including manufacturer, model, lens, and meters per pixel for spatial calibration.
        </p>
        <button type="button" className="button-primary" onClick={handleAddClick}>
          Add First Camera
        </button>
      </div>
    );
  }

  // Table view
  return (
    <div className="cameras-section">
      <header className="section-header">
        <h2>Cameras</h2>
        <p>Configure cameras for video tracking and behavioral recording.</p>
      </header>

      <div className="table-actions">
        <button type="button" className="button-primary" onClick={handleAddClick}>
          + Add Camera
        </button>
      </div>

      <table className="cameras-table" role="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>Meters/Pixel</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cameras.map((camera, index) => (
            <tr key={`${camera.id}-${index}`}>
              <td data-label="ID">{camera.id}</td>
              <td data-label="Name">{camera.camera_name || ''}</td>
              <td data-label="Manufacturer">{camera.manufacturer || ''}</td>
              <td data-label="Model">{camera.model || ''}</td>
              <td data-label="Meters/Pixel">{camera.meters_per_pixel}</td>
              <td data-label="Status">
                {(() => {
                  const status = getStatus(camera);
                  const text = getStatusText(status);
                  return (
                <span
                  className={`status-badge status-${status}`}
                  role="img"
                  aria-label={text}
                  title={text}
                >
                  {getStatusSymbol(status)}
                </span>
                  );
                })()}
              </td>
              <td data-label="Actions">
                <button
                  className="button-small"
                  onClick={() => handleEditClick(camera.id)}
                >
                  Edit
                </button>
                <button
                  className="button-small button-danger"
                  onClick={() => handleDeleteClick(camera)}
                  aria-label={`Delete camera ${camera.id}`}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

CamerasSection.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Tolerant: this is a repair destination — a corrupt non-array `cameras` is the very
    // state it surfaces (read through getAnimalCameras), so it must not warn on it.
    cameras: rawArray(PropTypes.shape({
      id: PropTypes.number.isRequired,
      camera_name: PropTypes.string,
      manufacturer: PropTypes.string,
      model: PropTypes.string,
      lens: PropTypes.string,
      meters_per_pixel: PropTypes.number,
    })),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onAdd: PropTypes.func,
  onDelete: PropTypes.func,
};

CamerasSection.defaultProps = {
  onEdit: null,
  onAdd: null,
  onDelete: null,
};
