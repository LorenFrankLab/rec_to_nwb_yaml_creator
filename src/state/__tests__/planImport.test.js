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
import { planImport } from '../yamlImportPlan';

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
  // as valid data yet make the animal unreachable. (`/` is already rejected by the slash rule
  // upstream, so it is covered there, not here.)
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
