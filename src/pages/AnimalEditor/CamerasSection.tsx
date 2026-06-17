import { getAnimalCameras } from '../../state/workspaceSelectors';
import type { Camera } from '../../state/workspaceTypes';
import Button from '../../components/ui/Button';
import './CamerasSection.scss';

interface CamerasSectionProps {
  /** Animal record with cameras array; read through the tolerant selector. */
  animal: unknown;
  /** Field update callback. */
  onFieldUpdate: (field: string, value: unknown) => void;
  /** Edit button click handler (camera ID). */
  onEdit?: ((id: number) => void) | null;
  /** Add button click handler. */
  onAdd?: (() => void) | null;
  /** Delete button click handler (camera object). */
  onDelete?: ((camera: Camera) => void) | null;
}

/**
 * CamerasSection - Camera configuration section for Animal Editor
 *
 * Provides CRUD interface for cameras with table view.
 * Displays camera metadata: ID, name, manufacturer, model, lens, meters_per_pixel — the
 * identity fields that distinguish one camera from another (a changed lens/calibration is a
 * different camera identity downstream, so they are visible in the table, not just the modal).
 * Status badges indicate validation state (✓ complete, ⚠ warnings).
 *
 * Integration with CameraModal for add/edit operations (handled by parent).
 */
export default function CamerasSection({ animal, onFieldUpdate, onEdit, onAdd, onDelete }: CamerasSectionProps) {
  // This section is a repair destination for a malformed-collection finding, so it must
  // tolerate the very corruption it exists to fix. Read cameras through the canonical
  // selector: a non-array `cameras` (e.g. "nope") degrades to the empty state instead of
  // throwing on `.reduce`/`.map`/`.length`.
  const cameras = getAnimalCameras(animal);
  const cameraIdCounts = cameras.reduce((acc, camera) => {
    const key = String(camera.id);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
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
   */
  function getStatus(camera: Camera): string {
    if (duplicateCameraIds.has(String(camera.id))) {
      return 'duplicate';
    }

    // Required fields (lens is schema-required alongside the others).
    const required: Array<keyof Camera> = ['camera_name', 'manufacturer', 'model', 'lens', 'meters_per_pixel'];
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
   */
  function getStatusText(status: string): string {
    if (status === 'duplicate') return 'Duplicate camera ID';
    if (status === 'incomplete') return 'Incomplete: required fields missing';
    if (status === 'warning') return 'Warning: meters per pixel outside the typical range';
    return 'Complete';
  }

  /** The displayed status glyph for an internal status key from {@link getStatus}. */
  function getStatusSymbol(status: string): string {
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

  /** Handle edit button click. */
  const handleEditClick = (cameraId: number) => {
    if (onEdit) {
      onEdit(cameraId);
    }
  };

  /** Handle delete button click. */
  const handleDeleteClick = (camera: Camera) => {
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
        <Button variant="primary" onClick={handleAddClick}>
          Add First Camera
        </Button>
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
        <Button variant="primary" onClick={handleAddClick}>
          + Add Camera
        </Button>
      </div>

      {/* Horizontal-scroll container so the Actions column (Edit/Delete) stays reachable when
          long camera/lens names would otherwise push it off-screen at desktop widths. */}
      <div className="cameras-table-scroll">
        <table className="cameras-table" role="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>Lens</th>
            <th>Meters per Pixel</th>
            <th>Status</th>
            <th className="cameras-actions-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cameras.map((camera, index) => (
            <tr key={`${camera.id}-${index}`}>
              <td data-label="ID">{camera.id}</td>
              {/* title= surfaces the full value when the cell truncates with an ellipsis. */}
              <td data-label="Name" title={camera.camera_name || ''}>{camera.camera_name || ''}</td>
              <td data-label="Manufacturer" title={camera.manufacturer || ''}>{camera.manufacturer || ''}</td>
              <td data-label="Model" title={camera.model || ''}>{camera.model || ''}</td>
              <td data-label="Lens" title={camera.lens || ''}>{camera.lens || ''}</td>
              <td data-label="Meters per Pixel">{camera.meters_per_pixel}</td>
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
              <td data-label="Actions" className="cameras-actions-cell">
                <Button
                  variant="neutral"
                  size="small"
                  onClick={() => handleEditClick(camera.id)}
                  aria-label={`Edit camera ${camera.id}`}
                >
                  Edit
                </Button>
                <Button
                  variant="dangerSubtle"
                  size="small"
                  onClick={() => handleDeleteClick(camera)}
                  aria-label={`Delete camera ${camera.id}`}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
