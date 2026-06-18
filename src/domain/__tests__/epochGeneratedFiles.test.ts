import { describe, expect, it } from 'vitest';
import {
  addMissingGeneratedStatescripts,
  addMissingGeneratedVideos,
  countMissingGeneratedStatescripts,
  countMissingGeneratedVideos,
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
