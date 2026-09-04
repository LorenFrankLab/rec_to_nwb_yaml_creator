import {
  deriveStatescriptName,
  deriveStatescriptPath,
  deriveVideoName,
} from './fileNaming';
import type { AssociatedFile, AssociatedVideoFile, Camera } from '../state/workspaceTypes';

interface GeneratedFileRef {
  entry: {
    camera_id?: unknown;
  };
}

interface GeneratedFileRow {
  epoch: number;
  tag: string;
  cameras: Array<number | string>;
  statescript: unknown | null;
  videos: GeneratedFileRef[];
  videoPresence: 'present' | 'missing' | 'absent';
}

interface GeneratedFileGrid {
  rows: GeneratedFileRow[];
  date: string;
  subjectId: string;
  dataFolder: string;
}

function cameraId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function knownCameraIds(cameras: Camera[]): Set<number> {
  const ids = new Set<number>();
  for (const camera of cameras) {
    const id = cameraId(camera.id);
    if (id != null) ids.add(id);
  }
  return ids;
}

/**
 * The camera a row is attributed to when it declares none of its own.
 *
 * `null` when the animal defines no usable camera id: there is nothing to
 * attribute a generated video to, and inventing one would export a dangling
 * `associated_video_files[].camera_id`.
 */
function fallbackCameraId(cameras: Camera[]): number | null {
  for (const camera of cameras) {
    const id = cameraId(camera.id);
    if (id != null) return id;
  }
  return null;
}

/**
 * Camera ids a generated video may be written for. Only ids the animal
 * actually defines: a declared-but-deleted camera and the no-camera fallback
 * both yield nothing, so generation never mints a reference that validation
 * (`dangling_camera_ref`) would then have to block.
 */
function expectedCameraIds(
  row: GeneratedFileRow,
  fallback: number | null,
  known: Set<number>
): number[] {
  const declared = row.cameras
    .map((value) => cameraId(value))
    .filter((value): value is number => value != null);

  // A row that named its cameras is answered only from those. If every one has
  // since been deleted the answer is none, NOT the fallback: silently moving the
  // video to a different camera is a wrong-but-valid reference, which validation
  // cannot catch. Leave it for the user to repair.
  if (declared.length > 0) {
    return [...new Set(declared.filter((value) => known.has(value)))];
  }

  return fallback != null ? [fallback] : [];
}

function missingVideoCameraIds(
  row: GeneratedFileRow,
  fallback: number | null,
  known: Set<number>
): number[] {
  if (row.videoPresence === 'absent') return [];
  const existing = new Set(
    row.videos
      .map((video) => cameraId(video.entry.camera_id))
      .filter((value): value is number => value != null)
  );
  return expectedCameraIds(row, fallback, known).filter((id) => !existing.has(id));
}

export function countMissingGeneratedStatescripts(grid: GeneratedFileGrid): number {
  return grid.rows.filter((row) => row.statescript == null).length;
}

export function countMissingGeneratedVideos(grid: GeneratedFileGrid, cameras: Camera[]): number {
  const fallback = fallbackCameraId(cameras);
  const known = knownCameraIds(cameras);
  return grid.rows.reduce(
    (count, row) => count + missingVideoCameraIds(row, fallback, known).length,
    0
  );
}

export function addMissingGeneratedStatescripts(
  grid: GeneratedFileGrid,
  currentFiles: AssociatedFile[]
): AssociatedFile[] {
  const additions = grid.rows
    .filter((row) => row.statescript == null)
    .map((row) => {
      const name = deriveStatescriptName({
        date: grid.date,
        subjectId: grid.subjectId,
        epoch: row.epoch,
        tag: row.tag,
      });
      return {
        name,
        description: '',
        path: deriveStatescriptPath(grid.dataFolder, name),
        task_epochs: row.epoch,
      };
    });

  return additions.length === 0 ? currentFiles : [...currentFiles, ...additions];
}

export function addMissingGeneratedVideos(
  grid: GeneratedFileGrid,
  currentVideos: AssociatedVideoFile[],
  cameras: Camera[]
): AssociatedVideoFile[] {
  const fallback = fallbackCameraId(cameras);
  const known = knownCameraIds(cameras);
  const additions: AssociatedVideoFile[] = [];

  grid.rows.forEach((row) => {
    const missing = missingVideoCameraIds(row, fallback, known);
    missing.forEach((id, index) => {
      additions.push({
        name: deriveVideoName({
          date: grid.date,
          subjectId: grid.subjectId,
          epoch: row.epoch,
          tag: row.tag,
          index: row.videos.length + index + 1,
        }),
        camera_id: id,
        task_epochs: row.epoch,
      });
    });
  });

  return additions.length === 0 ? currentVideos : [...currentVideos, ...additions];
}
