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

function fallbackCameraId(cameras: Camera[]): number {
  for (const camera of cameras) {
    const id = cameraId(camera.id);
    if (id != null) return id;
  }
  return 0;
}

function expectedCameraIds(row: GeneratedFileRow, fallback: number): number[] {
  const ids = row.cameras
    .map((value) => cameraId(value))
    .filter((value): value is number => value != null);
  return ids.length > 0 ? [...new Set(ids)] : [fallback];
}

function missingVideoCameraIds(row: GeneratedFileRow, fallback: number): number[] {
  if (row.videoPresence === 'absent') return [];
  const existing = new Set(
    row.videos
      .map((video) => cameraId(video.entry.camera_id))
      .filter((value): value is number => value != null)
  );
  return expectedCameraIds(row, fallback).filter((id) => !existing.has(id));
}

export function countMissingGeneratedStatescripts(grid: GeneratedFileGrid): number {
  return grid.rows.filter((row) => row.statescript == null).length;
}

export function countMissingGeneratedVideos(grid: GeneratedFileGrid, cameras: Camera[]): number {
  const fallback = fallbackCameraId(cameras);
  return grid.rows.reduce((count, row) => count + missingVideoCameraIds(row, fallback).length, 0);
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
  const additions: AssociatedVideoFile[] = [];

  grid.rows.forEach((row) => {
    const missing = missingVideoCameraIds(row, fallback);
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
