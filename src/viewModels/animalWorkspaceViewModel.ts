/**
 * @fileoverview AnimalWorkspace view-model builder.
 *
 * `buildAnimalWorkspaceViewModel(workspace, selectedAnimalId?)` turns the workspace into the data the
 * Animals-home page renders: one row per animal (id, present-day count, link, genotype, species, last
 * recording, opto flag, and a rolled-up day status), and — when an animal is selected — that animal's
 * recording-day rows, its first-run setup checklist, the existing-data review state (corrupt index /
 * recovered / wrong-owner notices), and the carry-forward affordance.
 *
 * It composes domain truth rather than re-deriving it: `classifyAnimalDays` + `getDayRowStatus` for
 * the per-day status, the shared {@link buildDayRowViewModel} for the row shape, `getAnimalSectionStatus`
 * + `getAnimalBlockingSections` for the setup sections, and `getPresentDayCount` for the card counts.
 * The recording-day list's display label is composed here from the domain functions (merge → status →
 * orphan re-link override → humanize); the page renders this builder's output rather than deriving the
 * label itself.
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
  isDayStatus,
  isPresentRecordStatus,
  DAY_STATUS,
} from '../domain/dayRecovery';
import type { DayClassificationRow } from '../domain/dayRecovery';
import { getDayRowStatus } from '../domain/workflowStatus';
import { optoFieldsPresence } from '../domain/optoCompleteness';
import { DAY_LIFECYCLE } from '../domain/dayLifecycle';
import type { DayLifecycle } from '../domain/dayLifecycle';
import { humanizeValidationMessage } from '../domain/humanizeValidationMessage';
import {
  getAnimalBlockingSections,
  getAnimalOptoCompleteness,
  getAnimalSectionStatus,
  OPTO_COMPLETENESS,
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
  WorkflowCommandId,
} from './types';

/** The per-animal status rollup shown on the Animals home (its own summary over the day set). */
export interface StatusRollupViewModel {
  /** A {@link DAY_LIFECYCLE} variant driving the rollup pill's color. */
  variant: DayLifecycle;
  /** Short label, e.g. "1 ready", "2 need review", "All exported", "No recording days". */
  label: string;
}

/** One animal row on the home: identity, day metadata, and the rolled-up status over its days. */
export interface AnimalCardViewModel {
  /** The animal's store key (also its display name on the row). */
  id: string;
  /** Day RECORDS present (OK + recovered), via `getPresentDayCount` — not just the index length. */
  dayCount: number;
  /** Link to this animal's recording-days tab. */
  href: string;
  /** Subject genotype (e.g. "PV-Cre"), or '' when unknown. */
  genotype: string;
  /** Subject species (e.g. "Rattus norvegicus"), or '' when unknown. */
  species: string;
  /** Date of the most recent recording day, or null when the animal has none. */
  lastRecording: string | null;
  /** True when the animal has any optogenetics hardware configured. */
  isOpto: boolean;
  /** Rolled-up day status (reuses the export gate, never a recount). */
  statusRollup: StatusRollupViewModel;
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
  /** How many recovered (orphan) days the note covers — drives the note's it/them grammar + count. */
  recoveredCount?: number;
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
    /** Whether the setup card is shown (missing subject or required setup, not merely zero days). */
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

/**
 * The setup card is an onboarding prompt for missing REQUIRED setup. A no-opto animal can be fully
 * configured; a partially-configured opto animal still needs review because it will block export.
 */
function shouldShowSetupCard(
  subjectPresent: boolean,
  sections: SectionViewModel[],
  animal: unknown
): boolean {
  if (!subjectPresent) return true;
  const optoCompleteness = getAnimalOptoCompleteness(
    animal as Parameters<typeof getAnimalOptoCompleteness>[0]
  );
  return sections.some((section) => {
    if (section.status === 'error') return true;
    if (section.status !== 'todo') return false;
    if (section.key !== 'optogenetics') return true;
    return optoCompleteness === OPTO_COMPLETENESS.PARTIAL;
  });
}

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
  const recovery: DayStatus = isDayStatus(status) ? status : DAY_STATUS.ORPHAN_NO_OWNER;

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

/**
 * Summarize an animal's recording days into one status rollup for the Animals home, reusing the SAME
 * export gate the day editor reads (`getDayRowStatus`) rather than a separate recount. Days that
 * themselves need attention (recovered / dangling / wrong-owner) fold into the "needs review" bucket.
 * Priority is most-actionable first: needs review → draft → pending export (ready/validated) →
 * all exported.
 */
function buildAnimalRowStatusRollup(
  animalId: string,
  animal: unknown,
  daysMap: Record<string, unknown>
): StatusRollupViewModel {
  const classification = classifyAnimalDays(animalId, animal, daysMap);
  const okDays = okAnimalDays(classification);
  const anomalyCount = classification.filter(
    (d) =>
      d.status === DAY_STATUS.DANGLING_REFERENCE ||
      d.status === DAY_STATUS.WRONG_OWNER ||
      d.status === DAY_STATUS.RECOVERED_UNLINKED
  ).length;

  let draftCount = 0;
  let needsFixingCount = 0;
  let pendingExportCount = 0;
  let exportedCount = 0;
  for (const rec of okDays) {
    let mergedDay: Record<string, unknown> | null = null;
    try {
      mergedDay = mergeDayMetadata(animal as Animal, rec as unknown as Day);
    } catch {
      mergedDay = null;
    }
    const { variant } = getDayRowStatus(animal, rec, mergedDay, okDays);
    if (variant === DAY_LIFECYCLE.NEEDS_FIXING) needsFixingCount += 1;
    else if (variant === DAY_LIFECYCLE.DRAFT) draftCount += 1;
    else if (variant === DAY_LIFECYCLE.EXPORTED) exportedCount += 1;
    else pendingExportCount += 1; // ready or validated — valid but not yet exported
  }

  const needsReview = needsFixingCount + anomalyCount;
  const total = okDays.length + anomalyCount;

  if (total === 0) return { variant: DAY_LIFECYCLE.DRAFT, label: 'No recording days' };
  if (needsReview > 0) {
    return {
      variant: DAY_LIFECYCLE.NEEDS_FIXING,
      label: `${needsReview} ${needsReview === 1 ? 'needs' : 'need'} review`,
    };
  }
  if (draftCount > 0) return { variant: DAY_LIFECYCLE.DRAFT, label: `${draftCount} draft` };
  if (pendingExportCount > 0) {
    return { variant: DAY_LIFECYCLE.READY, label: `${pendingExportCount} ready` };
  }
  void exportedCount; // every present day is exported
  return { variant: DAY_LIFECYCLE.EXPORTED, label: 'All exported' };
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
  // data_acq_device loaded as non-arrays) — the SAME `validateRawAnimal` set the page's review reads.
  // Surfaced here as structured repair notices, which `ExistingDataReview` renders directly; the page
  // no longer re-runs raw validation or self-detects corruption.
  const rawCorruptionNotices: RecoveryNoticeViewModel[] = validateRawAnimal(animal).map((issue) => {
    const command = issue.repairCommand as { type?: string } | undefined;
    return {
      kind:
        issue.code === 'missing_configuration_history'
          ? 'badchannel-corruption'
          : 'malformed-collection',
      message: issue.message,
      actionLabel: issue.actionLabel,
      repair: {
        // A raw-animal repairCommand carries a catalogued reset type; the fallback is the catalogued
        // no-op id. Cast to the closed command-id union (the runtime value is always a catalog key).
        id: (command?.type ?? 'repairAnimalCollection') as WorkflowCommandId,
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
    review.recoveredCount = orphanIds.length;
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

  const animals: AnimalCardViewModel[] = animalIds.map((id) => {
    const animal = animalsMap[id];
    const subject = getAnimalSubject(animal);
    const mostRecentDayId = getMostRecentDayId(animal, daysMap);
    const mostRecentDay =
      mostRecentDayId != null && isRecord(daysMap[mostRecentDayId])
        ? (daysMap[mostRecentDayId] as Record<string, unknown>)
        : null;
    const optoSource = isRecord(animal) ? animal.optogenetics : undefined;
    return {
      id,
      dayCount: getPresentDayCount(id, animal, daysMap),
      href: `#/animal/${id}/days`,
      genotype: typeof subject.genotype === 'string' ? subject.genotype : '',
      species: typeof subject.species === 'string' ? subject.species : '',
      lastRecording:
        mostRecentDay && typeof mostRecentDay.date === 'string' ? mostRecentDay.date : null,
      isOpto:
        optoFieldsPresence(optoSource as Parameters<typeof optoFieldsPresence>[0]).count > 0,
      statusRollup: buildAnimalRowStatusRollup(id, animal, daysMap),
    };
  });

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

    const subjectPresent = Boolean(getAnimalSubject(animal).subject_id);
    const setupSections = buildSetupSections(selectedAnimalId, animal, daysMap);
    const showSetupCard = shouldShowSetupCard(subjectPresent, setupSections, animal);

    const mostRecentDayId = getMostRecentDayId(animal, daysMap);
    const lastDayDate =
      mostRecentDayId && isRecord(daysMap[mostRecentDayId])
        ? ((daysMap[mostRecentDayId] as Record<string, unknown>).date as string | undefined)
        : undefined;

    vm.selectedAnimal = {
      id: selectedAnimalId,
      dayRows,
      setupSections,
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
