import { describe, it, expect } from 'vitest';
import {
  referencedCameraKeys,
  resolveDayCameraUsage,
  findCameraAffectedDays,
} from '../cameraUsage';

/**
 * Phase 8.7 Task 5: the day-used camera export binding. A day references cameras from the
 * animal catalog via `tasks[].camera_id` (array), `associated_video_files[].camera_id` (scalar),
 * and `fs_gui_yamls[].camera_id` (scalar). Export should emit ONLY the cameras a day uses
 * (filtered from the full catalog objects — never reconstructed), so a new catalog camera for a
 * future day does not change a re-export of an old day. Cameras resolve downstream by `id`, not
 * list position, so dropping unreferenced cameras is safe and more correct.
 */
const animal = {
  cameras: [
    { id: 0, camera_name: 'box', manufacturer: 'M', model: 'G', lens: '16mm', meters_per_pixel: 0.001 },
    { id: 1, camera_name: 'track', manufacturer: 'M', model: 'G', lens: '25mm', meters_per_pixel: 0.002 },
    { id: 2, camera_name: 'unused', manufacturer: 'M', model: 'G', lens: '50mm', meters_per_pixel: 0.003 },
  ],
};

describe('referencedCameraKeys', () => {
  it('collects ids from task arrays, video scalars, and fs_gui scalars (deduped)', () => {
    const day = {
      tasks: [{ camera_id: [0, 1] }, { camera_id: [1] }],
      associated_video_files: [{ camera_id: 0 }],
      fs_gui_yamls: [{ camera_id: 1 }],
    };
    expect([...referencedCameraKeys(day)].sort()).toEqual(['0', '1']);
  });

  it('tolerates missing/non-array fields and null/undefined ids', () => {
    expect([...referencedCameraKeys({})]).toEqual([]);
    expect([...referencedCameraKeys(null)]).toEqual([]);
    expect([...referencedCameraKeys({ tasks: 'nope', associated_video_files: null, fs_gui_yamls: 5 })]).toEqual([]);
    expect([...referencedCameraKeys({ tasks: [{ camera_id: null }, { camera_id: undefined }, {}] })]).toEqual([]);
  });

  it('treats a scalar task camera_id (not an array) gracefully', () => {
    expect([...referencedCameraKeys({ tasks: [{ camera_id: 2 }] })]).toEqual(['2']);
  });

  it('normalizes numeric and string ids to the same key', () => {
    const keys = referencedCameraKeys({ tasks: [{ camera_id: [1] }], associated_video_files: [{ camera_id: '1' }] });
    expect([...keys]).toEqual(['1']);
  });
});

describe('resolveDayCameraUsage', () => {
  it('returns only the day-used cameras, in catalog order, as the full objects (incl. lens)', () => {
    const day = { tasks: [{ camera_id: [1] }], associated_video_files: [{ camera_id: 0 }] };
    const used = resolveDayCameraUsage(animal, day);
    expect(used.map((c) => c.id)).toEqual([0, 1]); // catalog order, camera 2 dropped (unused)
    // Filtered, not reconstructed — every schema-required field (incl. lens) survives.
    expect(used[0]).toEqual(animal.cameras[0]);
    expect(used[1].lens).toBe('25mm');
  });

  it('returns [] for a day that references no cameras (export keeps cameras: [])', () => {
    expect(resolveDayCameraUsage(animal, { tasks: [], associated_video_files: [] })).toEqual([]);
    expect(resolveDayCameraUsage(animal, {})).toEqual([]);
  });

  it('drops unreferenced catalog cameras (a future camera does not leak into an old day)', () => {
    const day = { tasks: [{ camera_id: [0] }] };
    expect(resolveDayCameraUsage(animal, day).map((c) => c.id)).toEqual([0]);
  });

  it('omits a dangling reference (id not in the catalog) without crashing — validation gates it', () => {
    const day = { tasks: [{ camera_id: [0, 99] }] };
    // 99 has no camera object, so it is simply absent from the emitted list (the app's
    // dangling_camera_ref rule blocks export separately, so this never reaches a real export).
    expect(resolveDayCameraUsage(animal, day).map((c) => c.id)).toEqual([0]);
  });

  it('tolerates a corrupt animal.cameras (non-array) → []', () => {
    expect(resolveDayCameraUsage({ cameras: 'nope' }, { tasks: [{ camera_id: [0] }] })).toEqual([]);
    expect(resolveDayCameraUsage(null, { tasks: [{ camera_id: [0] }] })).toEqual([]);
  });

  it('includes a camera referenced only by an fs_gui protocol', () => {
    const day = { fs_gui_yamls: [{ camera_id: 2 }] };
    expect(resolveDayCameraUsage(animal, day).map((c) => c.id)).toEqual([2]);
  });

  it('returns the FULL catalog when every camera is referenced (the golden-fixture case → baselines unchanged)', () => {
    // Every golden/legacy fixture references all its cameras, so the day-used subset equals the
    // full catalog and the 125 byte-identical baselines do not move.
    const day = { tasks: [{ camera_id: [0, 1] }], fs_gui_yamls: [{ camera_id: 2 }] };
    expect(resolveDayCameraUsage(animal, day)).toEqual(animal.cameras);
  });
});

describe('findCameraAffectedDays (blast radius)', () => {
  const days = [
    { id: 'd1', tasks: [{ camera_id: [0, 1] }] },
    { id: 'd2', associated_video_files: [{ camera_id: 1 }] },
    { id: 'd3', tasks: [{ camera_id: [0] }] },
    { id: 'd4', fs_gui_yamls: [{ camera_id: 2 }] },
  ];

  it('returns the ids of days that reference a given camera', () => {
    expect(findCameraAffectedDays(days, 1)).toEqual(['d1', 'd2']);
    expect(findCameraAffectedDays(days, 0)).toEqual(['d1', 'd3']);
    expect(findCameraAffectedDays(days, 2)).toEqual(['d4']);
  });

  it('returns [] for an unreferenced camera or bad inputs', () => {
    expect(findCameraAffectedDays(days, 99)).toEqual([]);
    expect(findCameraAffectedDays(days, null)).toEqual([]);
    expect(findCameraAffectedDays(null, 1)).toEqual([]);
  });
});
