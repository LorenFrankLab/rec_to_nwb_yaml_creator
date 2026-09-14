/**
 * Unit tests (the validation slice) for `planImport` — the PURE reconciliation that
 * turns a set of parsed flat YAML files into an import plan. These tests construct flat
 * models from GENUINE merge outputs (so decompose accepts them) and assert grouping,
 * config-version inference, divergence flagging, and conflict detection.
 */
import { describe, it, expect } from 'vitest';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata, createDefaultWorkspace } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { planImport, materializePlanDay } from '../yamlImportPlan';

/**
 * Encode a (animal, day) pair to a flat model exactly as an export would, then decode
 * it back — i.e. the shape the UI hands to `planImport` after `File → text → YAML.parse`.
 *
 * @param {object} animal - Animal record.
 * @param {object} day - Day record.
 * @param {string} sourceName - The source filename to attach.
 * @returns {{ sourceName: string, flatModel: object }}
 */
function toDecodedFile(animal, day, sourceName) {
  const flat = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
  return { sourceName, flatModel: flat };
}

/**
 * A realistic single-day file for a given subject + date, optionally with overrides
 * applied to the animal (e.g. different cameras) or the config (electrode groups).
 *
 * @param {object} [opts]
 * @param {string} [opts.subjectId]
 * @param {string} [opts.date] - ISO date.
 * @param {Function} [opts.mutateAnimal] - Mutates the animal before merge.
 * @param {Function} [opts.mutateConfig] - Mutates the config snapshot/day before merge.
 * @returns {{ sourceName: string, flatModel: object }}
 */
function makeFile({ subjectId = 'remy', date = '2023-06-22', mutateAnimal, mutateConfig } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  animal.id = subjectId;
  animal.subject = { ...animal.subject, subject_id: subjectId };
  day.id = `${subjectId}-${date}`;
  day.animalId = subjectId;
  day.date = date;
  day.session = { ...day.session, session_id: `${subjectId}_${date.replace(/-/g, '')}` };
  if (mutateAnimal) mutateAnimal(animal);
  if (mutateConfig) mutateConfig(animal, day);
  const [year, month, dd] = date.split('-');
  const sourceName = `${month}${dd}${year}_${subjectId}_metadata.yml`;
  return toDecodedFile(animal, day, sourceName);
}

describe('planImport — grouping by subject', () => {
  it('groups 3 remy files + 1 totoro file into 2 animals, 4 days', () => {
    const files = [
      makeFile({ subjectId: 'remy', date: '2023-06-22' }),
      makeFile({ subjectId: 'remy', date: '2023-06-23' }),
      makeFile({ subjectId: 'remy', date: '2023-06-24' }),
      makeFile({ subjectId: 'totoro', date: '2024-01-15' }),
    ];
    const plan = planImport(files, createDefaultWorkspace());

    expect(plan.unimportable).toEqual([]);
    expect(plan.summary).toEqual({ fileCount: 4, animalCount: 2, dayCount: 4 });
    expect(plan.animals.map((a) => a.subjectId).sort()).toEqual(['remy', 'totoro']);

    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days.map((d) => d.date)).toEqual(['2023-06-22', '2023-06-23', '2023-06-24']);
    const totoro = plan.animals.find((a) => a.subjectId === 'totoro');
    expect(totoro.days.map((d) => d.date)).toEqual(['2024-01-15']);
  });

  it('groups case variants under the first-seen subject id', () => {
    const files = [
      makeFile({ subjectId: 'Remy', date: '2023-06-22' }),
      makeFile({ subjectId: 'remy', date: '2023-06-23' }),
    ];

    const plan = planImport(files, createDefaultWorkspace());

    expect(plan.unimportable).toEqual([]);
    expect(plan.summary).toEqual({ fileCount: 2, animalCount: 1, dayCount: 2 });
    expect(plan.animals[0].subjectId).toBe('Remy');
    expect(plan.animals[0].subject.subject_id).toBe('Remy');
    expect(plan.animals[0].days.map((day) => day.date)).toEqual([
      '2023-06-22',
      '2023-06-23',
    ]);
  });
});

describe('planImport — configuration versions', () => {
  it('infers 2 config versions for two remy days with different electrode groups, pinning each day', () => {
    const files = [
      // Earlier day: default 8 electrode groups.
      makeFile({ subjectId: 'remy', date: '2023-06-22' }),
      // Later day: a DIFFERENT electrode config (drop the last group + its ntrode).
      makeFile({
        subjectId: 'remy',
        date: '2023-06-23',
        mutateConfig: (animal) => {
          const cfg = animal.configurationHistory[0];
          cfg.devices.electrode_groups = cfg.devices.electrode_groups.slice(0, 7);
          cfg.devices.ntrode_electrode_group_channel_map =
            cfg.devices.ntrode_electrode_group_channel_map.slice(0, 7);
        },
      }),
    ];
    const plan = planImport(files, createDefaultWorkspace());
    const remy = plan.animals.find((a) => a.subjectId === 'remy');

    expect(remy.configVersions).toHaveLength(2);
    // Version 1 = earliest distinct config (the 8-group one).
    expect(remy.configVersions[0].version).toBe(1);
    expect(remy.configVersions[0].devices.electrode_groups).toHaveLength(8);
    expect(remy.configVersions[0].dayDates).toEqual(['2023-06-22']);
    // Version 2 = the later 7-group config.
    expect(remy.configVersions[1].version).toBe(2);
    expect(remy.configVersions[1].devices.electrode_groups).toHaveLength(7);
    expect(remy.configVersions[1].dayDates).toEqual(['2023-06-23']);

    // Per-day pins.
    const byDate = Object.fromEntries(remy.days.map((d) => [d.date, d.configurationVersion]));
    expect(byDate).toEqual({ '2023-06-22': 1, '2023-06-23': 2 });
  });

  it('collapses identical electrode configs to a single version', () => {
    const files = [
      makeFile({ subjectId: 'remy', date: '2023-06-22' }),
      makeFile({ subjectId: 'remy', date: '2023-06-23' }),
    ];
    const plan = planImport(files, createDefaultWorkspace());
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.configVersions).toHaveLength(1);
    expect(remy.configVersions[0].dayDates).toEqual(['2023-06-22', '2023-06-23']);
    expect(remy.days.every((d) => d.configurationVersion === 1)).toBe(true);
  });
});

describe('planImport — divergence flags', () => {
  it('flags diverging cameras across two remy files (not silent)', () => {
    const files = [
      makeFile({ subjectId: 'remy', date: '2023-06-22' }),
      makeFile({
        subjectId: 'remy',
        date: '2023-06-23',
        mutateAnimal: (animal) => {
          // Same camera_name, different dependent field (meters_per_pixel) → divergence.
          animal.cameras = animal.cameras.map((c) =>
            c.camera_name === 'overhead_camera' ? { ...c, meters_per_pixel: 0.5 } : c
          );
        },
      }),
    ];
    const plan = planImport(files, createDefaultWorkspace());
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    const cameraDivergence = remy.divergences.find((d) => d.field === 'cameras');
    expect(cameraDivergence).toBeTruthy();
  });

  it('flags diverging subject scalar fields (latest-date-wins, but surfaced)', () => {
    const files = [
      makeFile({ subjectId: 'remy', date: '2023-06-22' }),
      makeFile({
        subjectId: 'remy',
        date: '2023-06-23',
        mutateAnimal: (animal) => {
          animal.subject = { ...animal.subject, genotype: 'Knockout' };
        },
      }),
    ];
    const plan = planImport(files, createDefaultWorkspace());
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    const subjectDivergence = remy.divergences.find((d) => d.field === 'subject');
    expect(subjectDivergence).toBeTruthy();
    // Latest date wins → genotype is Knockout.
    expect(remy.subject.genotype).toBe('Knockout');
  });
});

describe('planImport — camera references follow the unioned catalog', () => {
  /**
   * The realistic fixture: id 0 = overhead_camera, id 1 = side_camera. Swap the ids in one file.
   * @param {object} animal - The file's animal (cameras renumbered in place).
   * @param {object} day - The file's day (every camera reference follows the renumbering).
   */
  const swapCameraIds = (animal, day) => {
    animal.cameras = animal.cameras.map((c) => ({ ...c, id: c.id === 0 ? 1 : c.id === 1 ? 0 : c.id }));
    const swap = (id) => (id === 0 ? 1 : id === 1 ? 0 : id);
    day.tasks = day.tasks.map((t) => ({ ...t, camera_id: t.camera_id.map(swap) }));
    day.associated_video_files = day.associated_video_files.map((v) => ({ ...v, camera_id: swap(v.camera_id) }));
    day.cameras_used = [1, 0];
  };

  it('remaps a later file whose cameras carry different ids onto the union ids (by camera_name)', () => {
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22' }),
        makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: swapCameraIds }),
      ],
      createDefaultWorkspace()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    // First-seen catalog: overhead is 0, side is 1.
    expect(remy.cameras.map((c) => [c.camera_name, c.id])).toEqual([['overhead_camera', 0], ['side_camera', 1]]);
    const later = materializePlanDay(remy.days.find((d) => d.date === '2023-06-23'), 'create');
    // The later day named overhead as 1 and side as 0 — after the union its overhead videos MUST
    // still be overhead videos.
    expect(later.associated_video_files.find((v) => v.name === 'overhead_video_epoch2').camera_id).toBe(0);
    expect(later.associated_video_files.find((v) => v.name === 'side_view_video_epoch2').camera_id).toBe(1);
    expect(later.tasks.find((t) => t.task_name === 'w_alternation').camera_id).toEqual([0, 1]);
    expect(later.cameras_used).toEqual([0, 1]);
    expect(remy.divergences.some((d) => d.field === 'cameras' && /2023-06-23|06232023/.test(d.detail))).toBe(true);
  });

  it('renumbers a later file\'s NEW camera whose id collides with a unioned camera, and remaps its refs', () => {
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22' }),
        makeFile({
          subjectId: 'remy',
          date: '2023-06-23',
          mutateConfig: (animal, day) => {
            // This file's id 0 is a DIFFERENT camera ("arena_camera"); its videos reference 0.
            animal.cameras = [{ ...animal.cameras[0], id: 0, camera_name: 'arena_camera' }];
            day.tasks = day.tasks.map((t) => ({ ...t, camera_id: [0] }));
            day.associated_video_files = [{ name: 'arena_video', camera_id: 0, task_epochs: 2 }];
            day.cameras_used = [0];
          },
        }),
      ],
      createDefaultWorkspace()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    const ids = remy.cameras.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids in the unioned catalog
    const arena = remy.cameras.find((c) => c.camera_name === 'arena_camera');
    expect(arena.id).not.toBe(0);
    const later = materializePlanDay(remy.days.find((d) => d.date === '2023-06-23'), 'create');
    expect(later.associated_video_files[0].camera_id).toBe(arena.id);
    expect(later.tasks.every((t) => t.camera_id.every((id) => id === arena.id))).toBe(true);
    expect(later.cameras_used).toEqual([arena.id]);
  });

  it('leaves a file whose ids already agree with the union untouched', () => {
    const plan = planImport(
      [makeFile({ subjectId: 'remy', date: '2023-06-22' }), makeFile({ subjectId: 'remy', date: '2023-06-23' })],
      createDefaultWorkspace()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    const later = materializePlanDay(remy.days.find((d) => d.date === '2023-06-23'), 'create');
    expect(later.associated_video_files.find((v) => v.name === 'side_view_video_epoch2').camera_id).toBe(1);
    expect(remy.divergences.filter((d) => d.field === 'cameras')).toEqual([]);
  });
});

describe('planImport — conflict with existing workspace', () => {
  it('marks conflict:exists when the subject already exists, defaultResolution add', () => {
    const ws = createDefaultWorkspace();
    ws.animals.remy = { id: 'remy', subject: { subject_id: 'remy' }, days: [] };

    const plan = planImport([makeFile({ subjectId: 'remy', date: '2023-06-22' })], ws);
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.conflict).toBe('exists');
    expect(remy.existingAnimalId).toBe('remy');
    expect(remy.defaultResolution).toBe('add');
  });

  it('resolves a conflict by subject.subject_id even under a different animal key', () => {
    const ws = createDefaultWorkspace();
    ws.animals['remy-key-2'] = { id: 'remy-key-2', subject: { subject_id: 'remy' }, days: [] };

    const plan = planImport([makeFile({ subjectId: 'remy', date: '2023-06-22' })], ws);
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.conflict).toBe('exists');
    expect(remy.existingAnimalId).toBe('remy-key-2');
  });

  it('marks conflict:none when the subject is new', () => {
    const plan = planImport(
      [makeFile({ subjectId: 'totoro', date: '2024-01-15' })],
      createDefaultWorkspace()
    );
    const totoro = plan.animals.find((a) => a.subjectId === 'totoro');
    expect(totoro.conflict).toBe('none');
    expect(totoro.existingAnimalId).toBeNull();
  });
});

describe('planImport — unimportable files', () => {
  it('imports a legacy YYYYMMDD_subject filename even when session_id has no date suffix', () => {
    const file = makeFile({ subjectId: 'remy', date: '2023-11-08' });
    file.sourceName = '20231108_remy.yml';
    file.flatModel.session_id = 'remy';

    const plan = planImport([file], createDefaultWorkspace());

    expect(plan.unimportable).toEqual([]);
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days).toHaveLength(1);
    expect(remy.days[0].date).toBe('2023-11-08');
  });

  it('imports with the Import & Repair manual recording-date marker when filename/session_id are dateless', () => {
    const file = makeFile({ subjectId: 'remy', date: '2023-11-08' });
    file.sourceName = 'metadata.yml';
    file.flatModel.session_id = 'remy';
    file.flatModel.__importRepair = { recording_date: '2023-11-08T00:00:00' };

    const plan = planImport([file], createDefaultWorkspace());

    expect(plan.unimportable).toEqual([]);
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days).toHaveLength(1);
    expect(remy.days[0].date).toBe('2023-11-08');
  });

  it('lists a dateless file in unimportable but still plans the valid ones', () => {
    const valid = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    // A file with no derivable date: strip session_id and give it a dateless name.
    const dateless = makeFile({ subjectId: 'remy', date: '2023-06-23' });
    delete dateless.flatModel.session_id;
    dateless.sourceName = 'no-date.yml';

    const plan = planImport([valid, dateless], createDefaultWorkspace());

    expect(plan.unimportable).toHaveLength(1);
    expect(plan.unimportable[0].sourceName).toBe('no-date.yml');
    expect(plan.unimportable[0].reason).toMatch(/date/i);
    // The valid file still planned.
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days).toHaveLength(1);
  });

  it('lists a schema-invalid file in unimportable with a reason', () => {
    const valid = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    const invalid = makeFile({ subjectId: 'remy', date: '2023-06-23' });
    // Corrupt a required field so decompose rejects it.
    delete invalid.flatModel.subject;

    const plan = planImport([valid, invalid], createDefaultWorkspace());

    expect(plan.unimportable).toHaveLength(1);
    expect(plan.unimportable[0].sourceName).toBe(invalid.sourceName);
    expect(typeof plan.unimportable[0].reason).toBe('string');
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days).toHaveLength(1);
  });

  it('routes a file whose analysis THROWS to unimportable and keeps planning the rest', () => {
    const valid = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    // A pathological flat model: reading `subject` throws (e.g. a corrupt proxy/getter
    // from a malformed parse). decompose → validate accesses it and throws. The whole
    // import preview must NOT abort — this one file is routed to unimportable.
    const pathological = { sourceName: 'pathological.yml', flatModel: {} };
    Object.defineProperty(pathological.flatModel, 'subject', {
      enumerable: true,
      get() {
        throw new Error('boom from getter');
      },
    });

    let plan;
    expect(() => {
      plan = planImport([valid, pathological], createDefaultWorkspace());
    }).not.toThrow();

    const bad = plan.unimportable.find((u) => u.sourceName === 'pathological.yml');
    expect(bad).toBeDefined();
    expect(bad.reason).toMatch(/could not analyze file/i);
    expect(bad.reason).toMatch(/boom from getter/);
    // The valid file is still planned.
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days).toHaveLength(1);
  });
});

describe('planImport — intra-plan duplicate (subject, date)', () => {
  it('keeps ONE day and pushes the duplicate (same subject + same resolved date) to unimportable', () => {
    // Two files resolving to the SAME subject AND the SAME recording date (e.g. a .yml and a
    // .yaml of the same session). Without dedup these would produce two days with the same id.
    const first = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    const second = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    second.sourceName = '06222023_remy_metadata.yaml';

    const plan = planImport([first, second], createDefaultWorkspace());

    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    // Exactly ONE day for that (subject, date) — never two with the same id.
    expect(remy.days).toHaveLength(1);
    expect(remy.days[0].date).toBe('2023-06-22');
    // The first-by-source-order file is the one kept.
    expect(remy.days[0].sourceName).toBe(first.sourceName);

    // The duplicate is recorded as unimportable with a reason naming the collision.
    const dup = plan.unimportable.find((u) => u.sourceName === second.sourceName);
    expect(dup).toBeTruthy();
    expect(dup.reason).toMatch(/2023-06-22/);
    expect(dup.reason).toMatch(/remy/);
    expect(dup.reason).toMatch(/duplicate/i);

    // Summary day count reflects the single retained day.
    expect(plan.summary.dayCount).toBe(1);
  });
});

describe('planImport — camera references against an EXISTING animal', () => {
  /** A workspace already holding remy with cameras 0 = overhead, 1 = side (the fixture's own). */
  const existingRemy = () => {
    const ws = createDefaultWorkspace();
    const { animal, day } = buildRealisticWorkspace();
    ws.animals[animal.id] = { ...animal, days: [] };
    void day;
    return ws;
  };
  /**
   * Rewrite a file so its ONE camera is `{ id, camera_name }` and every day reference points at it.
   * @param {number} id - The camera id the file uses.
   * @param {string} camera_name - The camera's name in the file.
   * @returns {(animal: object, day: object) => void} The `mutateConfig` callback.
   */
  const singleCamera = (id, camera_name) => (animal, day) => {
    animal.cameras = [{ ...animal.cameras[0], id, camera_name }];
    day.tasks = day.tasks.map((t) => ({ ...t, camera_id: [id] }));
    day.associated_video_files = [{ name: `video_${camera_name}`, camera_id: id, task_epochs: 2 }];
    day.cameras_used = [id];
  };

  it('keeps an explicitly mapped reference: a row whose id IS an existing camera is that camera, per day', () => {
    // Import & Repair mapped file 1's camera to existing id 0 and file 2's to existing id 1 (both
    // rows still carry the file's own name). Each day must keep the id the user chose.
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22', mutateConfig: singleCamera(0, 'arena_side') }),
        makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: singleCamera(1, 'arena_side') }),
      ],
      existingRemy()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.conflict).toBe('exists');
    const added = (date) => materializePlanDay(remy.days.find((d) => d.date === date), 'add');
    expect(added('2023-06-22').associated_video_files[0].camera_id).toBe(0);
    expect(added('2023-06-23').associated_video_files[0].camera_id).toBe(1);
    expect(remy.catalogAdditions.cameras).toEqual([]);
    // Under 'replace' the files are self-describing: both rows are named "arena_side", so they are
    // ONE camera (first-seen id 0) and day 2's references follow it there.
    expect(remy.cameras.map((c) => [c.id, c.camera_name])).toEqual([[0, 'arena_side']]);
    expect(materializePlanDay(remy.days.find((d) => d.date === '2023-06-23'), 'replace').associated_video_files[0].camera_id).toBe(0);
  });

  it('allocates a brought camera an id the existing animal does not use, and the additions carry it', () => {
    // Two files each BRING a new camera with source id 3: "arena" and "wall". The second must not
    // become id 0 (the existing overhead camera) — it gets an id free in existing ∪ additions.
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22', mutateConfig: singleCamera(3, 'arena') }),
        makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: singleCamera(3, 'wall') }),
      ],
      existingRemy()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    const additions = remy.catalogAdditions.cameras;
    expect(additions.map((c) => c.camera_name)).toEqual(['arena', 'wall']);
    const [arena, wall] = additions;
    expect(arena.id).toBe(3);
    expect([0, 1, 3]).not.toContain(wall.id);
    const added = (date) => materializePlanDay(remy.days.find((d) => d.date === date), 'add');
    expect(added('2023-06-22').associated_video_files[0].camera_id).toBe(3);
    expect(added('2023-06-23').associated_video_files[0].camera_id).toBe(wall.id);
    // The additions were allocated so that existing ∪ additions has no duplicate id.
    const finalIds = [0, 1, ...additions.map((c) => c.id)];
    expect(new Set(finalIds).size).toBe(finalIds.length);
    // The plan's own catalog is the REPLACE space — the files alone, existing ids irrelevant: two
    // distinct cameras under two distinct ids, and day 2 follows its own.
    expect(remy.cameras.map((c) => c.camera_name)).toEqual(['arena', 'wall']);
    const [ra, rw] = remy.cameras;
    expect(ra.id).not.toBe(rw.id);
    expect(materializePlanDay(remy.days.find((d) => d.date === '2023-06-23'), 'replace').associated_video_files[0].camera_id).toBe(rw.id);
  });

  it('routes a brought camera named like an existing one onto the existing id (no duplicate by name)', () => {
    const plan = planImport(
      [makeFile({ subjectId: 'remy', date: '2023-06-22', mutateConfig: singleCamera(5, 'overhead_camera') })],
      existingRemy()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.catalogAdditions.cameras).toEqual([]);
    expect(materializePlanDay(remy.days[0], 'add').associated_video_files[0].camera_id).toBe(0);
  });
});

describe('planImport — the imported catalog for replace', () => {
  it('plans `cameras` / `devices` from the FILES, not the existing animal, so replace keeps imported values', () => {
    // The existing remy has camera 0 "overhead_camera" @ 0.00085 and system "SpikeGadgets". The
    // file re-declares camera 0 with a new calibration + name and a system named "MCU". Under
    // 'replace' the recreated animal must be what the file says — and must not carry the existing
    // side camera (id 1) the file never mentions.
    const ws = createDefaultWorkspace();
    const { animal } = buildRealisticWorkspace();
    ws.animals[animal.id] = { ...animal, days: [] };
    const plan = planImport(
      [
        makeFile({
          subjectId: 'remy',
          date: '2023-06-22',
          mutateConfig: (a, day) => {
            a.cameras = [{ ...a.cameras[0], id: 0, camera_name: 'recalibrated_overhead', meters_per_pixel: 0.0015 }];
            a.devices.data_acq_device = [{ name: 'MCU', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' }];
            day.tasks = day.tasks.map((t) => ({ ...t, camera_id: [0] }));
            day.associated_video_files = [{ name: 'v', camera_id: 0, task_epochs: 2 }];
            day.cameras_used = [0];
            day.data_acq_device_name = 'MCU';
          },
        }),
      ],
      ws
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.conflict).toBe('exists');
    expect(remy.cameras).toEqual([
      expect.objectContaining({ id: 0, camera_name: 'recalibrated_overhead', meters_per_pixel: 0.0015 }),
    ]);
    expect(remy.devices.data_acq_device.map((d) => d.name)).toEqual(['MCU']);
    // …while 'add' brings only what the animal lacks: nothing for camera 0 (it IS existing 0), MCU.
    expect(remy.catalogAdditions.cameras).toEqual([]);
    expect(remy.catalogAdditions.data_acq_device.map((d) => d.name)).toEqual(['MCU']);
    expect(remy.days[0].associated_video_files[0].camera_id).toBe(0);
  });
});

describe('planImport — recording systems named like an existing one still diverge across files', () => {
  it('flags two files that both call the system "SpikeGadgets" but disagree on its fields', () => {
    const ws = createDefaultWorkspace();
    const { animal } = buildRealisticWorkspace();
    ws.animals[animal.id] = { ...animal, days: [] }; // its system is "SpikeGadgets"
    const withSystem = (system) => (a) => {
      a.devices.data_acq_device = [{ name: 'SpikeGadgets', system, amplifier: 'Intan', adc_circuit: 'Intan' }];
    };
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22', mutateConfig: withSystem('SpikeGadgets') }),
        makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: withSystem('MCU') }),
      ],
      ws
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.divergences.some((d) => d.field === 'data_acq_device' && /SpikeGadgets/.test(d.detail))).toBe(true);
    // The name matches the animal's own system, so nothing is brought under 'add'…
    expect(remy.catalogAdditions.data_acq_device).toEqual([]);
    // …and 'replace' gets the first-seen imported definition.
    expect(remy.devices.data_acq_device).toEqual([expect.objectContaining({ name: 'SpikeGadgets', system: 'SpikeGadgets' })]);
  });
});

describe('planImport — sourceKey identity', () => {
  it('echoes the caller\'s sourceKey on every planned day and unimportable entry, defaulting to sourceName', () => {
    const kept = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    const dup = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    const plan = planImport(
      [
        { ...kept, sourceKey: '0:day.yml', sourceName: 'day.yml' },
        { ...dup, sourceKey: '1:day.yml', sourceName: 'day.yml' },
        makeFile({ subjectId: 'remy', date: '2023-06-23' }),
      ],
      createDefaultWorkspace()
    );
    const remy = plan.animals.find((a) => a.subjectId === 'remy');
    expect(remy.days.map((d) => d.sourceKey)).toEqual(['0:day.yml', '06232023_remy_metadata.yml']);
    expect(plan.unimportable.map((u) => u.sourceKey)).toEqual(['1:day.yml']);
  });
});

describe('planImport — purity', () => {
  it('does not mutate or alias the input decodedFiles or workspace', () => {
    const files = [makeFile({ subjectId: 'remy', date: '2023-06-22' })];
    const ws = createDefaultWorkspace();
    const filesSnapshot = JSON.parse(JSON.stringify(files));
    const wsSnapshot = JSON.parse(JSON.stringify(ws));

    const plan = planImport(files, ws);
    // Mutating the plan must not reach back into inputs.
    plan.animals[0].days[0].date = 'MUTATED';

    expect(files).toEqual(filesSnapshot);
    expect(ws).toEqual(wsSnapshot);
  });
});

describe('planImport — subject_id must be a route-safe animal id', () => {
  // The animal store key + hash-route param IS the subject_id; a non-route-safe value would import
  // as valid data yet make the animal unreachable. (`/` is excluded here because it is rejected
  // UPSTREAM during decompose validation by the DANDI `subject_id_slash` error rule — a `/` id
  // fails `decomposeYaml` and is flagged "Validation failed: …", never reaching this gate. Verified:
  // adding `'rat/1'` here yields that upstream reason, not this gate's.)
  it.each(['rat 1', 'rat?1', 'rat#1', 'rat%1'])(
    'flags a subject_id with a route-unsafe character (%s) as unimportable, not a silent unreachable animal',
    (badId) => {
      const file = makeFile({ subjectId: 'remy', date: '2023-06-22' });
      file.flatModel.subject = { ...file.flatModel.subject, subject_id: badId };

      const plan = planImport([file], createDefaultWorkspace());

      expect(plan.animals).toEqual([]);
      expect(plan.unimportable).toHaveLength(1);
      expect(plan.unimportable[0].reason).toMatch(/aren't allowed in an animal id|letters, numbers/i);
    }
  );

  it('imports a route-safe subject_id normally', () => {
    const plan = planImport(
      [makeFile({ subjectId: 'remy', date: '2023-06-22' })],
      createDefaultWorkspace()
    );
    expect(plan.unimportable).toEqual([]);
    expect(plan.animals.map((a) => a.subjectId)).toEqual(['remy']);
  });
});
