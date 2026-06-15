/**
 * @fileoverview AnimalWorkspace view-model builder.
 *
 * `buildAnimalWorkspaceViewModel(workspace, selectedAnimalId?)` turns the workspace into the data the
 * animal-picker page renders: the animal cards (id + present-day count + link), and — when an animal
 * is selected — that animal's recording-day rows, its first-run setup checklist, the existing-data
 * review state (corrupt index / recovered / wrong-owner notices), and the carry-forward affordance.
 *
 * It composes domain truth rather than re-deriving it: `classifyAnimalDays` + `getDayRowStatus` for
 * the per-day status, the shared {@link buildDayRowViewModel} for the row shape, `getAnimalSectionStatus`
 * + `getAnimalBlockingSections` for the setup sections, and `getPresentDayCount` for the card counts.
 * The recording-day list's display label is re-derived here by composing the same domain functions the
 * page component does (merge → status → orphan re-link override → humanize), because that display logic
 * lives inline in the page rather than in a separately-exported pure module.
 *
 * Pure and React-free; returns plain data only.
 */

import { mergeDayMetadata } from '../state/workspaceUtils';
import type { Animal, Day } from '../state/workspaceTypes';
import {
  getAnimalSubject,
  getConfigHistory,
  getDaySession,
  getMostRecentDayId,
  isAnimalDaysIndexCorrupt,
} from '../state/workspaceSelectors';
import {
  classifyAnimalDays,
  dayHasArtifacts,
  describeOwner,
  getPresentDayCount,
  isPresentRecordStatus,
  DAY_STATUS,
} from '../domain/dayRecovery';
import type { DayClassificationRow } from '../domain/dayRecovery';
import { getDayRowStatus } from '../domain/workflowStatus';
import { DAY_LIFECYCLE } from '../domain/dayLifecycle';
import { humanizeValidationMessage } from '../domain/humanizeValidationMessage';
import {
  getAnimalBlockingSections,
  getAnimalSectionStatus,
  SECTION_STATUS,
} from '../domain/sectionStatus';
import { DOWNSTREAM_NOT_DELETED_NOTE } from '../domain/animalDeleteCascade';
import { validateRawAnimal } from '../validation/rawShape';
import { buildDayRowViewModel } from './dayRowViewModel';
import type {
  DayRowViewModel,
  DayStatus,
  RecoveryNoticeViewModel,
  SectionViewModel,
  WorkflowAction,
} from './types';

/** One animal in the picker: its id, the present-day-record count, and its tabbed-view link. */
export interface AnimalCardViewModel {
  /** The animal's store key (also its display name on the card). */
  id: string;
  /** Day RECORDS present (OK + recovered), via `getPresentDayCount` — not just the index length. */
  dayCount: number;
  /** Link to this animal's recording-days tab. */
  href: string;
}

/**
 * The "Review existing data" state for a recovered/imported animal — the corrupt-index, recovered,
 * and wrong-owner notices the page surfaces (each already pluralized), the raw-shape corruption
 * notices with their executable repairs, plus the found-days/configs lead line and the Validation &
 * Export link.
 */
export interface ExistingDataReviewViewModel {
  /** Lead line: 'Found N recording days and M hardware configurations for <id>. <corruption note>'. */
  summary: string;
  /** True when any saved data is corrupt (drives the alarm styling + the corruption lead copy). */
  hasCorruption: boolean;
  /** The malformed-index note, when the day index itself is not an array. */
  corruptIndexNote?: string;
  /** The recovered-days note, when one or more records are not in the index. */
  recoveredNote?: string;
  /** The wrong-owner note, when one or more listed days belong to another animal. */
  wrongOwnerNote?: string;
  /**
   * Raw-shape corruption of the animal's own collections (cameras / configuration history /
   * data-acq devices loaded as non-arrays) — each with its executable repair command, so the UI
   * doesn't have to re-run raw validation to render the repairs.
   */
  rawCorruptionNotices: RecoveryNoticeViewModel[];
  /** Link to this animal's Validation & Export tab. */
  reviewLink: WorkflowAction;
}

/** The full AnimalWorkspace page view-model. */
export interface AnimalWorkspaceViewModel {
  /** The animal cards (picker), in workspace-key order. */
  animals: AnimalCardViewModel[];
  /** Present only when an animal is selected. */
  selectedAnimal?: {
    id: string;
    /** One row per classified day (ok / dangling / recovered / wrong-owner), in classification order. */
    dayRows: DayRowViewModel[];
    /** The first-run "Set up this animal" card sections. */
    setupSections: SectionViewModel[];
    /** Whether the first-run setup card is shown (an animal is established once it has a subject + a day). */
    showSetupCard: boolean;
    /** Whether the recording-day list itself is corrupt (empty-state copy). */
    daysCorrupt: boolean;
    /** Present when there is something to review (corruption / recovered / wrong-owner records). */
    review?: ExistingDataReviewViewModel;
    /** The carry-forward affordance state: whether a prior day exists to seed from, and its date. */
    carryForward: { available: boolean; lastDayDate?: string };
  };
  /** The picker's create-animal action. */
  primaryAction: WorkflowAction;
  /** Whether YAML import is offered. */
  importState: { canImport: boolean };
  /** Present when the workspace has no animals; the empty-state copy. */
  empty?: { message: string };
}

// The day-row status separator between "Needs fixing" and its reason (em-dash, padded).
const NEEDS_FIXING_SEPARATOR = ' — ';

const EMPTY_WORKSPACE_MESSAGE = 'No animals created yet.';

/**
 * The first-run setup card sections, in the order and with the keys the section-nav "Animal setup"
 * group uses, so the card and the nav rings read one truth via `getAnimalSectionStatus`.
 */
const SETUP_CARD_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'electrode-groups', label: 'Electrode Groups' },
  { key: 'recording-system', label: 'Recording System' },
  { key: 'cameras', label: 'Cameras' },
  { key: 'optogenetics', label: 'Optogenetics' },
];

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Humanize the reason half of a "Needs fixing — {reason}" row label — the raw validation reason can
 * expose a schema key. The "Needs fixing" prefix and the non-needs-fixing labels pass through. Mirrors
 * the page component's inline display wrapper (the page keeps `getDayRowStatus` pure, humanizing only
 * for display).
 */
function humanizeNeedsFixingLabel(label: string): string {
  if (typeof label !== 'string') return label;
  const sepIndex = label.indexOf(NEEDS_FIXING_SEPARATOR);
  if (sepIndex === -1) return label;
  const prefix = label.slice(0, sepIndex + NEEDS_FIXING_SEPARATOR.length);
  const reason = label.slice(sepIndex + NEEDS_FIXING_SEPARATOR.length);
  return `${prefix}${humanizeValidationMessage(reason)}`;
}

/** Pluralize 'day' / 'days'. */
function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days';
}

/**
 * The OK-status day records of an animal, date-sorted — the cross-day context the bad-channel
 * monotonicity export gate reads when computing each row's status. Mirrors the page's
 * `selectedAnimalDays` derivation so a row's "Needs fixing — …un-failed…" status matches the editor.
 */
function okAnimalDays(classification: DayClassificationRow[]): Array<Record<string, unknown>> {
  return classification
    .filter((d) => d.status === DAY_STATUS.OK && d.record)
    .map((d) => d.record as Record<string, unknown>)
    .sort((a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? '')));
}

/**
 * Build the day row for one classified day, reproducing the page's per-row display: a missing-record
 * (dangling) row, a wrong-owner row, or an ordinary/recovered row whose status comes from
 * `getDayRowStatus` with the orphan "Re-link to export" override. Delegates the row shape (severity,
 * editor link, lifecycle, export-eligibility, recovery detail + repair) to {@link buildDayRowViewModel}.
 */
function buildDayRow(
  classified: DayClassificationRow,
  animalId: string,
  animal: unknown,
  animalDays: Array<Record<string, unknown>>
): DayRowViewModel {
  const { dayId, record, status } = classified;
  const recovery = status as DayStatus;

  // Dangling reference: the index lists an id with no resolvable record. The page renders a fixed
  // "Missing record" error chip with no editor link; the shared helper adds the remove-reference repair.
  if (status === DAY_STATUS.DANGLING_REFERENCE) {
    return buildDayRowViewModel({
      dayId,
      date: dayId,
      recovery,
      display: { variant: 'error', label: 'Missing record' },
      valid: false,
      animalKey: animalId,
    });
  }

  // Wrong owner: listed here but the record names a different animal. The page renders a "belongs to …"
  // warning with an unlink repair, not an ordinary exportable row. The shared helper adds the repair.
  if (status === DAY_STATUS.WRONG_OWNER) {
    const rec = record as Record<string, unknown>;
    const owner = describeOwner(rec.animalId);
    const date = (typeof rec.date === 'string' && rec.date) || dayId;
    return buildDayRowViewModel({
      dayId,
      date,
      recovery,
      display: {
        variant: 'error',
        label: `Belongs to ${owner} — listed here by mistake; not exported with this animal.`,
      },
      valid: false,
      animalKey: animalId,
      declaredOwner: rec.animalId,
    });
  }

  // Ordinary (OK) or recovered-unlinked day: one read-only status over the same export gate the day
  // editor uses. mergeDayMetadata throws on a corrupt/missing configuration — caught and surfaced as a
  // needs-fixing row by getDayRowStatus(…, null), never a crash.
  const isOrphan = status === DAY_STATUS.RECOVERED_UNLINKED;
  const rec = record as Record<string, unknown>;
  const date = typeof rec.date === 'string' ? rec.date : undefined;
  const session = getDaySession(rec);
  const sessionDescription =
    typeof session.session_description === 'string' ? session.session_description.trim() : '';

  let mergedDay: Record<string, unknown> | null = null;
  try {
    mergedDay = mergeDayMetadata(animal as Animal, rec as unknown as Day);
  } catch {
    mergedDay = null;
  }
  const rowStatus = getDayRowStatus(animal, rec, mergedDay, animalDays);
  // A recovered-unlinked day is valid metadata but NOT exportable until re-linked. When its validation
  // lifecycle would read Ready/Validated/Exported, show the linkage blocker instead; an orphan that
  // Needs fixing / is Draft keeps that (more urgent) status.
  const claimsExportReady =
    rowStatus.variant === DAY_LIFECYCLE.READY ||
    rowStatus.variant === DAY_LIFECYCLE.VALIDATED ||
    rowStatus.variant === DAY_LIFECYCLE.EXPORTED;
  const displayStatus =
    isOrphan && claimsExportReady
      ? { variant: DAY_LIFECYCLE.DRAFT, label: 'Re-link to export' }
      : rowStatus;

  const row = buildDayRowViewModel({
    dayId,
    date: date ?? '',
    sessionDescription: sessionDescription || undefined,
    recovery,
    display: { variant: displayStatus.variant, label: humanizeNeedsFixingLabel(displayStatus.label) },
    // `valid` is the UNDERLYING (pre-override) readiness — drives the shared helper's lifecycle +
    // export-eligibility, which the orphan label override must not change.
    valid: claimsExportReady,
    state: rec.state,
    animalKey: animalId,
  });

  // Per-row general actions, ONLY on ordinary (OK) rows — recovered/wrong-owner/dangling rows carry
  // their own repair affordance (in recoveryDetail) instead.
  if (status === DAY_STATUS.OK) {
    const deleteCommand: WorkflowAction = {
      label: 'Delete day…',
      command: {
        id: 'deleteDay',
        target: { animalId, dayId },
        ...(dayHasArtifacts(rec) ? { confirmCaveat: DOWNSTREAM_NOT_DELETED_NOTE } : {}),
      },
    };
    row.actions = [
      { label: 'Duplicate day…', command: { id: 'duplicateDay', target: { animalId, dayId } } },
      deleteCommand,
    ];
  }

  return row;
}

/** Build the first-run setup-card sections for an animal. */
function buildSetupSections(
  animalId: string,
  animal: unknown,
  days: Record<string, unknown>
): SectionViewModel[] {
  // The SAME source the section-nav red ● reads — so the card can't say a section is fine while the
  // nav shows it red. Blocking outranks the neutral never-configured "To do".
  const blockingSections = getAnimalBlockingSections(
    animal as Parameters<typeof getAnimalBlockingSections>[0],
    days as Parameters<typeof getAnimalBlockingSections>[1]
  );
  return SETUP_CARD_SECTIONS.map(({ key, label }) => {
    const blocking = blockingSections.has(key);
    const todo =
      !blocking &&
      getAnimalSectionStatus(animal as Parameters<typeof getAnimalSectionStatus>[0], key) ===
        SECTION_STATUS.TODO;
    const status: SectionViewModel['status'] = blocking ? 'error' : todo ? 'todo' : 'ready';
    const verb = blocking ? 'Fix' : todo ? 'Set up' : 'Review';
    const intent: WorkflowAction['intent'] = blocking ? 'fix' : todo ? 'setup' : 'review';
    const summary = blocking ? 'Needs fixing' : todo ? 'To do' : 'Done';
    return {
      key,
      label,
      status,
      summary,
      issueCount: 0,
      action: { label: verb, href: `#/animal/${animalId}/${key}`, intent },
    };
  });
}

/** Build the existing-data review state. Returns undefined when there is nothing to review. */
function buildReview(
  animalId: string,
  animal: unknown,
  classification: DayClassificationRow[],
  daysCorrupt: boolean
): ExistingDataReviewViewModel | undefined {
  const orphanIds = classification
    .filter((d) => d.status === DAY_STATUS.RECOVERED_UNLINKED)
    .map((d) => d.dayId);
  const wrongOwnerIds = classification
    .filter((d) => d.status === DAY_STATUS.WRONG_OWNER)
    .map((d) => d.dayId);
  // Raw-shape corruption of the animal's OWN collections (cameras / configurationHistory /
  // data_acq_device loaded as non-arrays) — the SAME `validateRawAnimal` set the page's review drives
  // on (RecordingDaysTab `hasCorruption`). Surfaced here as structured repair notices so a VM-driven
  // UI renders the repairs from data instead of re-running raw validation (and mounting its own
  // self-detecting banner) — the logic leak this layer exists to remove.
  const rawCorruptionNotices: RecoveryNoticeViewModel[] = validateRawAnimal(animal).map((issue) => {
    const command = issue.repairCommand as { type?: string } | undefined;
    return {
      kind:
        issue.code === 'missing_configuration_history'
          ? 'badchannel-corruption'
          : 'malformed-collection',
      message: issue.message,
      repair: {
        id: command?.type ?? 'repairAnimalCollection',
        target: { animalId, fieldPath: issue.field },
      },
    };
  });
  const hasCorruption =
    daysCorrupt ||
    orphanIds.length > 0 ||
    wrongOwnerIds.length > 0 ||
    rawCorruptionNotices.length > 0;
  if (!hasCorruption) return undefined;

  const dayCount = classification.filter((d) => isPresentRecordStatus(d.status)).length;
  const configCount = getConfigHistory(animal).length;
  const lead =
    `Found ${dayCount} recording ${dayWord(dayCount)} and ${configCount} hardware ` +
    `${configCount === 1 ? 'configuration' : 'configurations'} for ${animalId}. ` +
    (hasCorruption
      ? 'Some saved data is corrupt — resolve it before exporting.'
      : 'Review electrodes and cameras before exporting to confirm they match this animal.');

  const review: ExistingDataReviewViewModel = {
    summary: lead,
    hasCorruption,
    rawCorruptionNotices,
    reviewLink: {
      label: "Open this animal's Validation & Export",
      href: `#/animal/${animalId}/export`,
    },
  };

  if (daysCorrupt) {
    review.corruptIndexNote =
      "This animal's recording-day list is corrupt (expected a list), so its index can't be read. " +
      (orphanIds.length > 0
        ? 'The recovered day records below are shown from the day store directly.'
        : 'Re-import or recreate this animal’s data.');
  }
  if (orphanIds.length > 0) {
    review.recoveredNote =
      `${orphanIds.length} recovered recording ${orphanIds.length === 1 ? 'day is' : 'days are'} ` +
      'not listed in this animal\'s day index (shown below as "not in day list").';
  }
  if (wrongOwnerIds.length > 0) {
    review.wrongOwnerNote =
      `${wrongOwnerIds.length} day ${wrongOwnerIds.length === 1 ? 'is' : 'are'} listed here but ` +
      'belong to a different animal (shown below as "belongs to …"). They are not exported with this ' +
      "animal — remove them from this animal's list.";
  }

  return review;
}

/**
 * Build the AnimalWorkspace page view-model.
 *
 * @param workspace - `model.workspace` ({ animals, days }).
 * @param selectedAnimalId - When set (and present), include that animal's day rows + setup + review.
 * @returns The page view-model — pure data, no React.
 */
export function buildAnimalWorkspaceViewModel(
  workspace: unknown,
  selectedAnimalId?: string
): AnimalWorkspaceViewModel {
  const animalsMap: Record<string, unknown> =
    isRecord(workspace) && isRecord(workspace.animals) ? workspace.animals : {};
  const daysMap: Record<string, unknown> =
    isRecord(workspace) && isRecord(workspace.days) ? workspace.days : {};
  const animalIds = Object.keys(animalsMap);

  const animals: AnimalCardViewModel[] = animalIds.map((id) => ({
    id,
    dayCount: getPresentDayCount(id, animalsMap[id], daysMap),
    href: `#/animal/${id}/days`,
  }));

  const vm: AnimalWorkspaceViewModel = {
    animals,
    primaryAction: { label: 'Create Animal', command: { id: 'createAnimal' }, intent: 'setup' },
    importState: { canImport: true },
  };

  if (animalIds.length === 0) {
    vm.empty = { message: EMPTY_WORKSPACE_MESSAGE };
  }

  const animal = selectedAnimalId != null ? animalsMap[selectedAnimalId] : undefined;
  if (selectedAnimalId != null && isRecord(animal)) {
    const classification = classifyAnimalDays(selectedAnimalId, animal, daysMap);
    // A recovered/imported animal can carry a malformed (non-array) day index, which the canonical
    // selector laundered to []; surface it explicitly so the review can report the corrupt-index note.
    const daysCorrupt = isAnimalDaysIndexCorrupt(animal);
    const animalDays = okAnimalDays(classification);
    const dayRows = classification.map((c) =>
      buildDayRow(c, selectedAnimalId, animal, animalDays)
    );

    const dayCount = classification.filter((d) => isPresentRecordStatus(d.status)).length;
    const subjectPresent = Boolean(getAnimalSubject(animal).subject_id);
    const showSetupCard = !(subjectPresent && dayCount > 0);

    const mostRecentDayId = getMostRecentDayId(animal, daysMap);
    const lastDayDate =
      mostRecentDayId && isRecord(daysMap[mostRecentDayId])
        ? ((daysMap[mostRecentDayId] as Record<string, unknown>).date as string | undefined)
        : undefined;

    vm.selectedAnimal = {
      id: selectedAnimalId,
      dayRows,
      setupSections: buildSetupSections(selectedAnimalId, animal, daysMap),
      showSetupCard,
      daysCorrupt,
      carryForward: {
        available: mostRecentDayId != null,
        ...(lastDayDate ? { lastDayDate } : {}),
      },
    };

    const review = buildReview(selectedAnimalId, animal, classification, daysCorrupt);
    if (review) vm.selectedAnimal.review = review;
  }

  return vm;
}
