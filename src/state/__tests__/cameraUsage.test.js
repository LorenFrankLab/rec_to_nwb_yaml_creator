import { describe, it, expect } from 'vitest';
import {
  inferredCameraRefs,
  referencedCameraRefs,
  referencedCameraKeys,
  inferredCameraKeys,
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

  it('unions the explicit day.cameras_used set (no task/video/fs-gui reference needed)', () => {
    expect([...referencedCameraKeys({ cameras_used: [1] })]).toEqual(['1']);
  });

  it('is identical to today when cameras_used is absent (additive regression)', () => {
    // Existing data carries no cameras_used; the field adds nothing — same key set as without it.
    const day = { tasks: [{ camera_id: [0, 1] }], associated_video_files: [{ camera_id: 0 }] };
    expect([...referencedCameraKeys(day)].sort()).toEqual(['0', '1']);
  });

  it('tolerates a non-array cameras_used (no throw, adds nothing)', () => {
    expect([...referencedCameraKeys({ cameras_used: 'nope' })]).toEqual([]);
    expect([...referencedCameraKeys({ cameras_used: 5 })]).toEqual([]);
  });
});

describe('inferredCameraKeys vs referencedCameraKeys (the split)', () => {
  it('inferredCameraKeys does NOT include cameras_used ids while referencedCameraKeys DOES', () => {
    // A camera present ONLY in the explicit cameras_used set (no task/video/fs-gui reference).
    const day = { cameras_used: [2] };
    expect([...inferredCameraKeys(day)]).toEqual([]); // inferred = task/video/fs-gui only
    expect([...referencedCameraKeys(day)]).toEqual(['2']); // referenced = inferred ∪ explicit
  });

  it('inferredCameraKeys still collects task/video/fs-gui references', () => {
    const day = {
      tasks: [{ camera_id: [0] }],
      associated_video_files: [{ camera_id: 1 }],
      fs_gui_yamls: [{ camera_id: 2 }],
      cameras_used: [3],
    };
    expect([...inferredCameraKeys(day)].sort()).toEqual(['0', '1', '2']); // 3 excluded
    expect([...referencedCameraKeys(day)].sort()).toEqual(['0', '1', '2', '3']);
  });

  it('inferredCameraKeys is shape-tolerant like referencedCameraKeys', () => {
    expect([...inferredCameraKeys({})]).toEqual([]);
    expect([...inferredCameraKeys(null)]).toEqual([]);
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

  it('exports the union of explicit cameras_used and inferred references, in catalog order', () => {
    // Camera 1 is referenced by a task; camera 2 is only in the explicit set. Both export.
    const day = { tasks: [{ camera_id: [1] }], cameras_used: [2] };
    expect(resolveDayCameraUsage(animal, day).map((c) => c.id)).toEqual([1, 2]);
  });

  it('returns the FULL catalog when every camera is referenced (the golden-fixture case → baselines unchanged)', () => {
    // Every golden/legacy fixture references all its cameras, so the day-used subset equals the
    // full catalog and the byte-identical export baselines do not move. (The merge byte-parity is
    // carried by workspace-merge.test.js; this just pins the helper's full-catalog behavior.)
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
    expect(findCameraAffectedDays(days, 1, animal)).toEqual(['d1', 'd2']);
    expect(findCameraAffectedDays(days, 0, animal)).toEqual(['d1', 'd3']);
    expect(findCameraAffectedDays(days, 2, animal)).toEqual(['d4']);
  });

  it('returns [] for an unreferenced camera or bad inputs', () => {
    expect(findCameraAffectedDays(days, 99, animal)).toEqual([]);
    expect(findCameraAffectedDays(days, null, animal)).toEqual([]);
    expect(findCameraAffectedDays(null, 1, animal)).toEqual([]);
  });
});

/**
 * The blast radius must be computed from the day's EFFECTIVE tasks. A catalog-shaped day carries
 * `taskInstances` and an EMPTY inline `tasks`, so its task camera references live on the referenced
 * animal task TYPE (the default) or on the instance itself (the day's own override). Reading raw
 * `day.tasks` would miss both, and editing that camera's identity would silently rewrite the day's
 * export instead of offering the "new camera vs correct history" decision.
 */
describe('findCameraAffectedDays resolves catalog days through the task-type catalog', () => {
  const catalogAnimal = {
    cameras: animal.cameras,
    taskTypes: [
      { id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep box', camera_id: [0] },
      { id: 'tasktype-1', task_name: 'Run', task_description: 'w-track' },
    ],
  };
  const days = [
    // Only reference to camera 0: the referenced task TYPE's default `camera_id`.
    { id: 'type-default', tasks: [], taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }] },
    // Only reference to camera 1: the INSTANCE's per-day override.
    {
      id: 'instance-override',
      tasks: [],
      taskInstances: [{ taskTypeId: 'tasktype-1', task_epochs: [2], camera_id: [1] }],
    },
    // A legacy inline day still behaves exactly as before.
    { id: 'inline', tasks: [{ camera_id: [1] }] },
    // Catalog day whose resolved task references no camera at all.
    { id: 'no-ref', tasks: [], taskInstances: [{ taskTypeId: 'tasktype-1', task_epochs: [3] }] },
  ];

  it('returns a catalog day whose ONLY reference is an instance override', () => {
    expect(findCameraAffectedDays(days, 1, catalogAnimal)).toEqual(['instance-override', 'inline']);
  });

  it("returns a catalog day whose ONLY reference is the task type's default camera_id", () => {
    expect(findCameraAffectedDays(days, 0, catalogAnimal)).toEqual(['type-default']);
  });

  it('does not return a day that references the camera nowhere', () => {
    expect(findCameraAffectedDays(days, 2, catalogAnimal)).toEqual([]);
  });

  it('keeps the explicit cameras_used checklist in the blast radius for a catalog day', () => {
    const explicit = [{ id: 'explicit', tasks: [], taskInstances: [], cameras_used: [2] }];
    expect(findCameraAffectedDays(explicit, 2, catalogAnimal)).toEqual(['explicit']);
  });
});

describe('inferredCameraRefs / referencedCameraRefs — the ONE camera-reference enumeration', () => {
  const day = {
    cameras_used: [9, 1],
    tasks: [
      { task_name: 'run', camera_id: [1, 2] },
      // A legacy/corrupt scalar is still a reference (the export path always read it this way;
      // the import repair planner now does too).
      { task_name: 'sleep', camera_id: 3 },
      { task_name: 'none' },
    ],
    associated_video_files: [{ name: 'v', camera_id: 2 }, { name: 'w', camera_id: null }],
    fs_gui_yamls: [{ name: 'f', camera_id: '4' }],
  };

  it('enumerates task (array OR scalar), video and fs-gui camera ids, first-seen, exact-deduped', () => {
    expect(inferredCameraRefs(day)).toEqual([1, 2, 3, '4']);
  });

  it('does not string-launder ids: a numeric 2 and a string "2" are distinct references', () => {
    expect(inferredCameraRefs({ tasks: [{ camera_id: [2, '2'] }] })).toEqual([2, '2']);
  });

  it('referencedCameraRefs lists the explicit cameras_used set first, then the inferred refs', () => {
    expect(referencedCameraRefs(day)).toEqual([9, 1, 2, 3, '4']);
  });

  it('tolerates non-array collections and a missing day', () => {
    expect(inferredCameraRefs({ tasks: 'corrupt', associated_video_files: null })).toEqual([]);
    expect(referencedCameraRefs(undefined)).toEqual([]);
  });
});
