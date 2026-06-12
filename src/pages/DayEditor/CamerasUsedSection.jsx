import { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getAnimalCameras, getDayCamerasUsed } from '../../state/workspaceSelectors';
import { inferredCameraKeys } from '../../state/cameraUsage';

/**
 * Per-day "cameras used" checklist (Phase 8C). A camera INFERRED-referenced by a task / video /
 * fs-gui row is used regardless (shown checked + disabled — it cannot be unchecked here). A
 * non-inferred camera is a free checkbox whose checked state = its id is in the explicit
 * `day.cameras_used` set, and it stays ENABLED so the user can toggle it. Extracted verbatim from
 * `pages/DayEditor/DevicesStep.jsx` (Phase 9c-3) with no behavior change.
 *
 * The disabled/hint decision MUST use the INFERRED set (not the export union, which folds in
 * `cameras_used`) — otherwise checking a free camera would immediately disable it and the user could
 * never uncheck it. Toggling writes ONLY the explicit additions (inferred cameras are covered by the
 * union and need not be stored), so `cameras_used` stays absent/empty for all existing data and the
 * export stays byte-identical. Renders `null` when the animal has no cameras.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record (its camera catalog).
 * @param {object} props.day - Day record (raw videos / FsGUI camera refs + explicit `cameras_used`).
 * @param {object} [props.mergedDay] - Merged metadata; its resolved `tasks` are the EFFECTIVE task
 *   camera refs (a migrated catalog day's task-type cameras only appear here). Falls back to raw `day.tasks`.
 * @param {Function} props.onFieldUpdate - `(fieldPath, value) => void` store writer.
 * @returns {JSX.Element|null}
 */
export default function CamerasUsedSection({ animal, day, mergedDay, onFieldUpdate }) {
  const animalCameras = getAnimalCameras(animal);
  // Infer non-negotiable cameras from the day's EFFECTIVE tasks: a migrated catalog day has
  // `taskInstances` and no inline `tasks`, so its task-type camera refs only appear in the RESOLVED
  // `mergedDay.tasks`. Use those for tasks (fall back to raw `day.tasks` when no merge is provided);
  // videos / FsGUI camera refs stay day-owned and are read from the raw `day`. The explicit
  // `cameras_used` checklist is always read from the raw day below.
  const inferredKeys = useMemo(
    () =>
      inferredCameraKeys({
        ...day,
        tasks: Array.isArray(mergedDay?.tasks)
          ? mergedDay.tasks
          : Array.isArray(day?.tasks)
            ? day.tasks
            : [],
      }),
    [day, mergedDay]
  );
  const explicitCameraIds = useMemo(() => getDayCamerasUsed(day), [day]);
  const explicitKeySet = useMemo(
    () => new Set(explicitCameraIds.map((id) => String(id))),
    [explicitCameraIds]
  );

  /**
   * Toggle a NON-referenced camera in the explicit cameras-used set. Rebuilds the set from the
   * full catalog so it stores the ids (in catalog order) of every currently-checked non-referenced
   * camera — referenced cameras are intentionally excluded (covered by the union).
   * @param {*} cameraId - The catalog camera id being toggled.
   * @param {boolean} checked - The next checked state.
   */
  const handleCameraUsedToggle = useCallback(
    (cameraId, checked) => {
      const next = new Set(explicitCameraIds.map((id) => String(id)));
      if (checked) next.add(String(cameraId));
      else next.delete(String(cameraId));
      // Preserve original id types/order by filtering the catalog, never stringifying into the array.
      const nextIds = animalCameras
        .filter(
          (camera) =>
            !inferredKeys.has(String(camera?.id)) && next.has(String(camera?.id))
        )
        .map((camera) => camera.id);
      onFieldUpdate('cameras_used', nextIds);
    },
    [animalCameras, explicitCameraIds, inferredKeys, onFieldUpdate]
  );

  if (animalCameras.length === 0) return null;

  return (
    <section className="cameras-used-section" aria-label="Cameras used this day">
      <h3>Cameras used this day</h3>
      <p className="field-help-text">
        Check the cameras this recording day used. A camera already referenced by a task, video,
        or FsGUI protocol is used regardless and shown checked.
      </p>
      <ul className="cameras-used-list">
        {animalCameras.map((camera) => {
          const key = String(camera?.id);
          const referenced = inferredKeys.has(key);
          const checked = referenced || explicitKeySet.has(key);
          const label = `${camera?.camera_name ?? '(unnamed)'} (id ${camera?.id})`;
          return (
            <li key={key}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={referenced}
                  onChange={(e) => handleCameraUsedToggle(camera.id, e.target.checked)}
                />
                {label}
                {referenced && (
                  <span className="cameras-used-hint"> — used by a task/video</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

CamerasUsedSection.propTypes = {
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
  mergedDay: PropTypes.object,
  onFieldUpdate: PropTypes.func.isRequired,
};

CamerasUsedSection.defaultProps = {
  mergedDay: undefined,
};
