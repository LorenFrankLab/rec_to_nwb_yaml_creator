import {
  deriveEpochStatescript,
  deriveVideoName,
} from './fileNaming';
import type { StatescriptState } from './statescriptExpectation';
import { STATESCRIPT_DESCRIPTION } from './associatedFiles';
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
  /** Whether a statescript is linked, expected, or not expected for this epoch. */
  statescriptState: StatescriptState;
  videos: GeneratedFileRef[];
  videoPresence: 'present' | 'missing' | 'absent';
}

interface GeneratedFileGrid {
  rows: GeneratedFileRow[];
  date: string;
  subjectId: string;
  dataFolder: string;
  pathTemplate?: string;
}

function cameraId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The animal's usable camera ids, in declaration order (the first is the fallback). */
function knownCameraIds(cameras: Camera[]): Set<number> {
  const ids = new Set<number>();
  for (const camera of cameras) {
    const id = cameraId(camera.id);
    if (id != null) ids.add(id);
  }
  return ids;
}

/**
 * Camera ids a generated video may be written for. Only ids the animal
 * actually defines: a declared-but-deleted camera and the no-camera fallback
 * both yield nothing, so generation never mints a reference that validation
 * (`dangling_camera_ref`) would then have to block.
 */
function expectedCameraIds(row: GeneratedFileRow, known: Set<number>): number[] {
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

  // A row that declares no camera is attributed to the animal's first usable one.
  // When the animal defines none there is nothing to attribute to, and inventing an
  // id would export a dangling `associated_video_files[].camera_id`.
  const [fallback] = known;
  return fallback === undefined ? [] : [fallback];
}

/**
 * The camera a NEW video for this row is attributed to, or null when there is none: the row's
 * first surviving declared camera, else the animal's first camera, else nothing. The single
 * decision behind both the bulk "generate missing videos" and a per-epoch "Add video" — a caller
 * that gets null must not write a video (inventing an id exports a dangling `camera_id`).
 *
 * @param row - The epoch row (its declared cameras).
 * @param cameras - The animal's camera catalog.
 * @returns The camera id to attribute a new video to, or null.
 */
export function videoCameraIdFor(row: GeneratedFileRow, cameras: Camera[]): number | null {
  return expectedCameraIds(row, knownCameraIds(cameras))[0] ?? null;
}

function missingVideoCameraIds(row: GeneratedFileRow, known: Set<number>): number[] {
  if (row.videoPresence === 'absent') return [];
  const existing = new Set(
    row.videos
      .map((video) => cameraId(video.entry.camera_id))
      .filter((value): value is number => value != null)
  );
  return expectedCameraIds(row, known).filter((id) => !existing.has(id));
}

/**
 * Rows the bulk generator answers: those that EXPECT a statescript and have none linked. A sleep
 * epoch this animal has never logged a statescript for is not missing one — generating a file for
 * it would force a nonexistent recording into the metadata. The per-epoch "Add" in the drill-in
 * stays the way to write one deliberately.
 *
 * @param grid - The epoch grid.
 * @returns The rows a bulk generation would write for.
 */
function expectedStatescriptRows(grid: GeneratedFileGrid): GeneratedFileRow[] {
  return grid.rows.filter((row) => row.statescriptState === 'expected');
}

export function countMissingGeneratedStatescripts(grid: GeneratedFileGrid): number {
  return expectedStatescriptRows(grid).length;
}

export function countMissingGeneratedVideos(grid: GeneratedFileGrid, cameras: Camera[]): number {
  const known = knownCameraIds(cameras);
  return grid.rows.reduce((count, row) => count + missingVideoCameraIds(row, known).length, 0);
}

export function addMissingGeneratedStatescripts(
  grid: GeneratedFileGrid,
  currentFiles: AssociatedFile[]
): AssociatedFile[] {
  const additions = expectedStatescriptRows(grid)
    .map((row) => {
      const file = deriveEpochStatescript({
        dataFolder: grid.dataFolder, pathTemplate: grid.pathTemplate,
        date: grid.date,
        subjectId: grid.subjectId,
        epoch: row.epoch,
        tag: row.tag,
      });
      return {
        ...file,
        description: STATESCRIPT_DESCRIPTION,
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
  const known = knownCameraIds(cameras);
  const additions: AssociatedVideoFile[] = [];

  grid.rows.forEach((row) => {
    const missing = missingVideoCameraIds(row, known);
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
