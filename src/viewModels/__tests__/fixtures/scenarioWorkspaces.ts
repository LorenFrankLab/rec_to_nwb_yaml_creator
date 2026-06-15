/**
 * @fileoverview Consolidated scenario fixtures for the cross-surface view-model boundary tests
 * (Phase 5). Each builder returns one canonical workspace (`{ animals, days }`) plus the ids the
 * matrix asserts against, composed on the shared `buildRealisticWorkspace` (the export-ready
 * baseline) so the matrix and the per-builder tests draw from ONE source — no copy-pasted
 * workspaces. Values are deterministic (the realistic fixture uses fixed timestamps).
 *
 * Each scenario's intended workflow state was confirmed against the live builders before these were
 * written (e.g. a blank `experiment_description` is a blocking error on every surface; a no-tasks day
 * is a non-blocking DRAFT; removing `data_acq_device` is an animal-surface blocker that lights the
 * recording-system ring). See `scenarios.test.ts` for the assertions.
 */

import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

/** A record with a string `id` (the shape the builders index animals/days by). */
export type Idable = { id: string } & Record<string, unknown>;
/** The minimal workspace the four builders read. */
export type Workspace = { animals: Record<string, unknown>; days: Record<string, unknown> };
/** A scenario: the workspace plus the ids the matrix drives the builders with. */
export interface Scenario {
  workspace: Workspace;
  animalId: string;
  dayId?: string;
}

const clone = (value: unknown): any => structuredClone(value);

/**
 * The realistic animal + its single export-ready day, made INTERNALLY CONSISTENT for the view-model
 * surfaces. The export-parity fixture leaves `devices.electrode_groups` / `ntrode_*` empty (the merge
 * reads the configuration snapshot, not `devices`), but production `createAnimal` snapshots `devices`
 * INTO `configurationHistory`, so the two always agree. We mirror that here — copy the snapshot back
 * into `devices` — so a "complete animal" is genuinely complete: the AnimalView setup rings (which
 * read current `animal.devices.*` by design) reflect the same configuration the day exports with,
 * instead of a spurious "electrode groups not set up" on an export-ready animal.
 */
export const loadRealistic = (): { animal: Idable; day: Idable } => {
  const { animal, day } = buildRealisticWorkspace() as { animal: Idable; day: Idable };
  const a = animal as Record<string, any>;
  const snapshot = a.configurationHistory?.[0]?.devices;
  if (snapshot && a.devices) {
    a.devices.electrode_groups = structuredClone(snapshot.electrode_groups ?? []);
    a.devices.ntrode_electrode_group_channel_map = structuredClone(
      snapshot.ntrode_electrode_group_channel_map ?? []
    );
  }
  return { animal, day };
};

/** Wrap one animal + one day into a workspace. */
export const wrap = (animal: Idable, day: Idable): Workspace => ({
  animals: { [animal.id]: animal },
  days: { [day.id]: day },
});

// ── Scenario builders ─────────────────────────────────────────────────────────────────────────

/** Empty workspace — no animals, no days. */
export const emptyWorkspace = (): Workspace => ({ animals: {}, days: {} });

/** A complete animal whose single day is export-ready. */
export const realisticReady = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  return { workspace: wrap(animal, day), animalId: animal.id, dayId: day.id };
};

/** A fresh, under-configured animal: no subject, no recording days. */
export const incompleteAnimal = (): Scenario => {
  const animal: Idable = {
    id: 'newbie',
    subject: {},
    devices: {},
    cameras: [],
    configurationHistory: [],
    days: [],
  };
  return { workspace: { animals: { newbie: animal }, days: {} }, animalId: 'newbie' };
};

/** A complete animal with zero recording days. */
export const completeAnimalNoDays = (): Scenario => {
  const { animal } = loadRealistic();
  const a = { ...clone(animal), days: [] } as Idable;
  return { workspace: { animals: { [a.id]: a }, days: {} }, animalId: a.id };
};

/** A ready animal whose day is missing an export-required field (blank experiment description). */
export const dayMissingRequiredField = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const d = clone(day);
  d.session.experiment_description = '';
  return { workspace: wrap(animal, d), animalId: animal.id, dayId: d.id };
};

/** A day whose animal config is corrupt (empty `configurationHistory` → `mergeDayMetadata` throws). */
export const corruptConfigDay = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const a = clone(animal);
  a.configurationHistory = [];
  return { workspace: wrap(a, day), animalId: a.id, dayId: day.id };
};

/** An animal-setup issue that blocks day export: no data-acquisition device (recording-system). */
export const animalSetupBlocksExport = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const a = clone(animal);
  a.devices.data_acq_device = [];
  return { workspace: wrap(a, day), animalId: a.id, dayId: day.id };
};

/** A ready day with a non-blocking warning: the same location in inconsistent capitalization. */
export const dayWithWarning = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const a = clone(animal);
  // 'CA1' is used by other electrode groups; lowercasing one yields an inconsistent-case WARNING.
  a.configurationHistory[0].devices.electrode_groups[0].location = 'ca1';
  if (Array.isArray(a.devices?.electrode_groups) && a.devices.electrode_groups[0]) {
    a.devices.electrode_groups[0].location = 'ca1';
  }
  return { workspace: wrap(a, day), animalId: a.id, dayId: day.id };
};

/** A ready day whose persisted lifecycle is saved-`validated`. */
export const validatedDay = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const d = clone(day);
  d.state = { ...(d.state ?? {}), validated: true };
  return { workspace: wrap(animal, d), animalId: animal.id, dayId: d.id };
};

/** A ready day whose persisted lifecycle is downloaded-`exported`. */
export const exportedDay = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const d = clone(day);
  d.state = { ...(d.state ?? {}), validated: true, exported: true };
  return { workspace: wrap(animal, d), animalId: animal.id, dayId: d.id };
};

/** A DRAFT day: complete fields but no tasks yet → non-blocking 'incomplete'. */
export const incompleteDay = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const d = clone(day);
  d.tasks = [];
  d.taskInstances = [];
  d.associated_files = [];
  d.associated_video_files = [];
  return { workspace: wrap(animal, d), animalId: animal.id, dayId: d.id };
};

/**
 * A two-day animal whose later day un-marks a channel that an earlier same-config day marked bad —
 * an un-acked monotonic regression (export-blocking) unless `acked`. Extracted from the inline
 * dayEditorViewModel fixture so both that suite and the matrix share one source.
 */
export const twoDayRegression = (
  acked: boolean
): { workspace: Workspace; animal: Idable; earlier: Idable; later: Idable } => {
  const { animal, day } = loadRealistic();
  const earlier = clone(day);
  earlier.id = 'remy-2023-06-21';
  earlier.date = '2023-06-21';
  earlier.deviceOverrides = { bad_channels: { 1: [0] } };

  const later = clone(day);
  later.id = 'remy-2023-06-22';
  later.date = '2023-06-22';
  later.deviceOverrides = { bad_channels: {} };
  if (acked) {
    later.state = { ...(later.state ?? {}), badChannelRemovalAcks: { 1: [0] } };
  }

  const a = clone(animal);
  a.days = [earlier.id, later.id];
  return {
    workspace: { animals: { [a.id]: a }, days: { [earlier.id]: earlier, [later.id]: later } },
    animal: a,
    earlier,
    later,
  };
};

// ── Recovery scenarios (a day not in its normal place) ──────────────────────────────────────────

/** An animal that indexes a day id with no matching record (dangling reference). */
export const danglingReference = (): Required<Scenario> => ({
  workspace: {
    animals: { remy: { id: 'remy', days: ['ghost'], subject: { subject_id: 'remy' } } },
    days: {},
  },
  animalId: 'remy',
  dayId: 'ghost',
});

/** An animal that lists a day whose record declares a DIFFERENT owner (wrong owner). */
export const wrongOwner = (): Required<Scenario> => ({
  workspace: {
    animals: { remy: { id: 'remy', days: ['d1'], subject: { subject_id: 'remy' } } },
    days: { d1: { id: 'd1', animalId: 'bean', date: '2023-07-01' } },
  },
  animalId: 'remy',
  dayId: 'd1',
});

/** A day record whose declared owner does not exist and which no animal indexes (orphan, no owner). */
export const orphanNoOwner = (): Required<Scenario> => ({
  workspace: { animals: {}, days: { d1: { id: 'd1', animalId: 'ghost', date: '2023-07-01' } } },
  animalId: 'ghost',
  dayId: 'd1',
});

/** A real day record whose owner is present but does NOT list it (recovered, unlinked). */
export const recoveredUnlinked = (): Required<Scenario> => {
  const { animal, day } = loadRealistic();
  const a = { ...clone(animal), days: [] } as Idable;
  return { workspace: { animals: { [a.id]: a }, days: { [day.id]: day } }, animalId: a.id, dayId: day.id };
};
