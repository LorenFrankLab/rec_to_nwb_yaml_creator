import { describe, expect, it } from 'vitest';
import {
  addMissingGeneratedStatescripts,
  addMissingGeneratedVideos,
  countMissingGeneratedStatescripts,
  countMissingGeneratedVideos,
  videoCameraIdFor,
} from '../epochGeneratedFiles';
import type { Camera } from '../../state/workspaceTypes';

const cameras = [
  { id: 0, meters_per_pixel: 1, manufacturer: '', model: '', camera_name: 'cam0' },
  { id: 1, meters_per_pixel: 1, manufacturer: '', model: '', camera_name: 'cam1' },
] satisfies Camera[];

const grid = {
  date: '20230622',
  subjectId: 'remy',
  dataFolder: '/data/remy/20230622',
  rows: [
    {
      epoch: 1,
      tag: 's1',
      cameras: [0, 1],
      statescript: null,
      videos: [],
      videoPresence: 'missing' as const,
    },
    {
      epoch: 2,
      tag: 'r1',
      cameras: [1],
      statescript: { entry: {}, index: 0 },
      videos: [{ entry: { camera_id: 1 } }],
      videoPresence: 'present' as const,
    },
    {
      epoch: 3,
      tag: 's2',
      cameras: [0],
      statescript: null,
      videos: [],
      videoPresence: 'absent' as const,
    },
  ],
};

describe('epoch generated file helpers', () => {
  it('counts and appends only missing statescripts', () => {
    expect(countMissingGeneratedStatescripts(grid)).toBe(2);

    expect(addMissingGeneratedStatescripts(grid, [])).toEqual([
      {
        name: '20230622_remy_01_s1.stateScriptLog',
        description: '',
        path: '/data/remy/20230622/20230622_remy_01_s1.stateScriptLog',
        task_epochs: 1,
      },
      {
        name: '20230622_remy_03_s2.stateScriptLog',
        description: '',
        path: '/data/remy/20230622/20230622_remy_03_s2.stateScriptLog',
        task_epochs: 3,
      },
    ]);
  });

  it('generates one missing video per expected camera and skips no-video epochs', () => {
    expect(countMissingGeneratedVideos(grid, cameras)).toBe(2);

    expect(addMissingGeneratedVideos(grid, [], cameras)).toEqual([
      {
        name: '20230622_remy_01_s1.1.h264',
        camera_id: 0,
        task_epochs: 1,
      },
      {
        name: '20230622_remy_01_s1.2.h264',
        camera_id: 1,
        task_epochs: 1,
      },
    ]);
  });

  describe('never generates a video for a camera that does not exist', () => {
    // A generated video's camera_id is exported as associated_video_files[].camera_id.
    // Emitting an id no camera defines writes a dangling reference into the NWB
    // metadata, so these rows must generate nothing and let the user add the camera.

    it('generates nothing when the animal has no cameras at all', () => {
      // Every row falls back to the animal's first camera; there isn't one.
      const noCameras: Camera[] = [];

      expect(countMissingGeneratedVideos(grid, noCameras)).toBe(0);
      expect(addMissingGeneratedVideos(grid, [], noCameras)).toEqual([]);
    });

    it('leaves existing videos untouched when the animal has no cameras', () => {
      const current = [{ name: 'manual_video.h264', camera_id: 1, task_epochs: 2 }];

      expect(addMissingGeneratedVideos(grid, current, [])).toBe(current);
    });

    it('skips a row whose declared camera was deleted', () => {
      // Row declares camera 7; the animal only defines 0 and 1 (e.g. camera 7 was
      // removed after the epoch was configured).
      const staleGrid = {
        ...grid,
        rows: [
          {
            epoch: 4,
            tag: 'r2',
            cameras: [7],
            statescript: null,
            videos: [],
            videoPresence: 'missing' as const,
          },
        ],
      };

      expect(countMissingGeneratedVideos(staleGrid, cameras)).toBe(0);
      expect(addMissingGeneratedVideos(staleGrid, [], cameras)).toEqual([]);
    });

    it('generates only the declared cameras that still exist', () => {
      const mixedGrid = {
        ...grid,
        rows: [
          {
            epoch: 5,
            tag: 'r3',
            cameras: [1, 7],
            statescript: null,
            videos: [],
            videoPresence: 'missing' as const,
          },
        ],
      };

      expect(addMissingGeneratedVideos(mixedGrid, [], cameras)).toEqual([
        {
          name: '20230622_remy_05_r3.1.h264',
          camera_id: 1,
          task_epochs: 5,
        },
      ]);
    });

    it('still falls back to the first camera when the row declares none', () => {
      // Regression guard: the fallback is correct behavior whenever a camera exists.
      const undeclaredGrid = {
        ...grid,
        rows: [
          {
            epoch: 6,
            tag: 'r4',
            cameras: [],
            statescript: null,
            videos: [],
            videoPresence: 'missing' as const,
          },
        ],
      };

      expect(addMissingGeneratedVideos(undeclaredGrid, [], cameras)).toEqual([
        {
          name: '20230622_remy_06_r4.1.h264',
          camera_id: 0,
          task_epochs: 6,
        },
      ]);
    });
  });

  it('preserves existing arrays by appending without overwriting', () => {
    const current = [{ name: 'manual_video.h264', camera_id: 1, task_epochs: 2 }];

    expect(addMissingGeneratedVideos(grid, current, cameras)).toEqual([
      current[0],
      {
        name: '20230622_remy_01_s1.1.h264',
        camera_id: 0,
        task_epochs: 1,
      },
      {
        name: '20230622_remy_01_s1.2.h264',
        camera_id: 1,
        task_epochs: 1,
      },
    ]);
  });
});

describe('videoCameraIdFor — the single attribution decision for a NEW video', () => {
  const row = grid.rows[0]; // declares cameras [0, 1]
  const undeclared = { ...grid.rows[0], cameras: [] };

  it('uses the first surviving declared camera', () => {
    expect(videoCameraIdFor(row, cameras)).toBe(0);
    expect(videoCameraIdFor(row, [cameras[1]])).toBe(1);
  });

  it('returns null when every declared camera has been deleted (never silently re-attributes)', () => {
    expect(videoCameraIdFor(row, [])).toBeNull();
    expect(videoCameraIdFor(row, [{ ...cameras[0], id: 7 }])).toBeNull();
  });

  it('falls back to the animal\'s first camera only for a row that declares none', () => {
    expect(videoCameraIdFor(undeclared, cameras)).toBe(0);
    expect(videoCameraIdFor(undeclared, [])).toBeNull();
  });
});
