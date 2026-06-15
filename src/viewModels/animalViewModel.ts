/**
 * @fileoverview AnimalView view-model builder.
 *
 * `buildAnimalViewModel(workspace, animalId, tab)` turns the workspace into the data the tabbed
 * animal shell renders: the animal header (id + the read-only species/sex facts), the grouped
 * LEFT section-nav ('Day work' / 'Animal setup') with each tab's status ring + count token + link,
 * the resolved active tab, and the active panel's heading + scope subhead.
 *
 * It composes domain truth rather than re-deriving it: `getAnimalBlockingSections` (the red ●
 * "blocks export" ring) + `getAnimalSectionStatus` (the hollow ○ "not set up" ring) for each
 * section's status — blocking outranks todo, exactly as the page does; `getPresentDayCount` for the
 * Recording Days count; the per-animal export rows (`buildAnimalRows`) filtered to the valid chip for
 * the "N ready" Validation & Export count; `getAnimalSetupCounts` for the setup-section item counts;
 * `getAnimalOptoCompleteness` for the optogenetics 'used' / 'incomplete' token; and `getAnimalSubject`
 * for the header facts. The status mapping follows the shared severity invariant (a blocking section
 * → 'error'; else a never-/under-configured setup section → 'todo'; else 'ready').
 *
 * This surface currently has no warning (amber) ring — only error / todo / ready — so the builder
 * never emits 'warning'.
 *
 * Pure and React-free; returns plain data only. The `?field=` repair-anchor matching (a requested
 * field → its owning tab) stays in the page: it is a DOM/scroll side-effect with no view-model
 * consumer, so it is deliberately not extracted here.
 */

import { getAnimalSubject } from '../state/workspaceSelectors';
import { getPresentDayCount } from '../domain/dayRecovery';
import {
  getAnimalSectionStatus,
  getAnimalBlockingSections,
  getAnimalSetupCounts,
  getAnimalOptoCompleteness,
  OPTO_COMPLETENESS,
  SECTION_STATUS,
} from '../domain/sectionStatus';
import type { Animal, Day } from '../state/workspaceTypes';
import { buildAnimalRows } from './validationSummaryRows';
import type { SectionViewModel } from './types';

/** The animal header: the store-key id and the read-only species/sex facts shown beside it. */
export interface AnimalHeaderViewModel {
  /** The animal's store key (also the header h1 / id badge). */
  id: string;
  /** Species, when set (e.g. 'Rattus norvegicus'); omitted when empty. */
  speciesLabel?: string;
  /** Biological sex, when set (e.g. 'M'); omitted when empty. */
  sexLabel?: string;
}

/** One labelled group of the section-nav, in display order. */
export interface AnimalSectionGroupViewModel {
  /** Group heading: 'Day work' or 'Animal setup'. */
  label: string;
  /** The group's section items, in display order. */
  sections: SectionViewModel[];
}

/** The active tab's panel descriptor: its heading label and (when defined) its scope subhead. */
export interface AnimalActivePanelViewModel {
  /** The active route `:tab` segment. */
  key: string;
  /** The panel heading / aria-label for the active tab. */
  label: string;
  /** The one-line scope/ownership framing shown under the heading; absent for tabs without one. */
  scope?: string;
}

/** The full AnimalView page view-model. */
export interface AnimalViewModel {
  /** The animal header (id + species/sex facts). */
  header: AnimalHeaderViewModel;
  /** The grouped section-nav, in display order. */
  groups: AnimalSectionGroupViewModel[];
  /** The resolved active tab (an unknown/bare tab falls back to the default, as the route does). */
  activeTab: string;
  /** The active tab's panel heading + scope. */
  activePanel: AnimalActivePanelViewModel;
}

/**
 * Section-nav structure: grouped, in display order. Keys are the route `:tab` segments. Mirrors the
 * page's SECTION_GROUPS so the nav order/labels/keys read one truth.
 */
const SECTION_GROUPS: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ key: string; label: string }>;
}> = [
  {
    label: 'Day work',
    items: [
      { key: 'days', label: 'Recording Days' },
      { key: 'export', label: 'Validation & Export' },
    ],
  },
  {
    label: 'Animal setup',
    items: [
      { key: 'electrode-groups', label: 'Electrode Groups' },
      { key: 'recording-system', label: 'Recording System' },
      { key: 'cameras', label: 'Cameras' },
      { key: 'task-types', label: 'Task Types' },
      { key: 'optogenetics', label: 'Optogenetics' },
    ],
  },
];

/** The valid route `:tab` segments, derived from the grouped nav (the route's allow-list). */
const SECTION_TAB_KEYS: ReadonlySet<string> = new Set(
  SECTION_GROUPS.flatMap((g) => g.items.map((i) => i.key))
);

/** The default tab an unknown/bare tab resolves to (matches the route's redirect-to-days). */
const DEFAULT_TAB = 'days';

/** Tab key → display label, derived from the grouped nav (the panel heading + placeholder heading). */
const TAB_LABEL: Record<string, string> = Object.fromEntries(
  SECTION_GROUPS.flatMap((g) => g.items).map((i): [string, string] => [i.key, i.label])
);

/**
 * Per-tab scope descriptor shown under the panel heading: the one-line framing of a section's
 * ownership/blast-radius. Only tabs with a defined framing carry an entry (mirrors the page's
 * TAB_SCOPE — setup tabs extracted so far).
 */
const TAB_SCOPE: Record<string, string> = {
  'electrode-groups':
    'Shared across all recording days — a hardware change starts a new version (with an audit trail).',
  'recording-system': 'Animal-wide catalog — each recording day uses one.',
  cameras: 'Catalog — referenced per day.',
  'task-types': 'Define once — each recording day picks and orders its epochs.',
};

/** Resolve an unknown/bare tab to the default, exactly as the route does. */
function resolveTab(tab: string | undefined): string {
  return tab != null && SECTION_TAB_KEYS.has(tab) ? tab : DEFAULT_TAB;
}

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The per-tab count token the section-nav shows in its trailing slot. Day-work counts read the same
 * sources the rest of the view uses (`getPresentDayCount`, the valid export rows), so the nav can
 * never disagree with the Days tab / the Export tab; the setup counts come from `getAnimalSetupCounts`
 * and the optogenetics token from `getAnimalOptoCompleteness`. A token is `undefined` when the page
 * shows no count for that tab (e.g. task-types, which has no count slot).
 */
function buildCountLabels(
  animalId: string,
  animal: Animal,
  workspace: { animals?: unknown; days?: Record<string, Day> }
): Record<string, string> {
  const dayCount = getPresentDayCount(animalId, animal, workspace.days);
  const readyCount = buildAnimalRows(workspace, animalId).filter((r) => r.chip === 'valid').length;
  return {
    days: String(dayCount),
    export: `${readyCount} ready`,
    ...Object.fromEntries(
      Object.entries(getAnimalSetupCounts(animal)).map(([k, n]): [string, string] => [k, String(n)])
    ),
    // The opto token is honest about completeness: COMPLETE → 'used'; PARTIAL → 'incomplete' (so the
    // token agrees with the red ● a partial config fires). The NONE case never shows a token — its
    // hollow-○ todo ring owns the count slot — so a valid unused-opto row reads empty, not a bare 0.
    optogenetics:
      getAnimalOptoCompleteness(animal) === OPTO_COMPLETENESS.COMPLETE ? 'used' : 'incomplete',
  };
}

/** Numeric count tabs (the count token is a bare number) → the section's `issueCount`. */
const NUMERIC_COUNT_KEYS: ReadonlySet<string> = new Set([
  'days',
  'electrode-groups',
  'recording-system',
  'cameras',
]);

/**
 * Build one section's view-model: its status ring (blocking outranks todo), the aria-label-style
 * summary the page announces, the count token + whether it's shown, and the link to the section route.
 */
function buildSection(
  item: { key: string; label: string },
  animalId: string,
  animal: Animal,
  blockingSections: ReadonlySet<string>,
  countLabels: Record<string, string>
): SectionViewModel {
  const { key, label } = item;
  // A BLOCKING export error (red ●) outranks a never-configured TODO (hollow ○): the blocker is the
  // more urgent signal, and the accessible name carries the meaning.
  const isBlocking = blockingSections.has(key);
  const isTodo = !isBlocking && getAnimalSectionStatus(animal, key) === SECTION_STATUS.TODO;
  const status: SectionViewModel['status'] = isBlocking ? 'error' : isTodo ? 'todo' : 'ready';

  // The summary reproduces the page's per-tab accessible-name framing (blocks export / not set up);
  // a section in neither state announces nothing extra beyond its label.
  const summary = isBlocking
    ? `${label} — blocks export`
    : isTodo
      ? `${label} — not set up`
      : label;

  const countLabel = countLabels[key];
  const section: SectionViewModel = {
    key,
    label,
    status,
    summary,
    // issueCount is the numeric count for bare-number tabs; non-numeric/suffixed tokens
    // ('N ready', 'used'/'incomplete') ride on countLabel instead.
    issueCount: NUMERIC_COUNT_KEYS.has(key) ? Number(countLabel) || 0 : 0,
    // The nav hides the count for a never-/under-configured todo section (its hollow ○ ring takes the
    // slot); every other section shows its token.
    showCount: !isTodo,
    action: { label, href: `#/animal/${animalId}/${key}` },
  };
  if (countLabel != null) section.countLabel = countLabel;
  return section;
}

/**
 * Build the AnimalView page view-model.
 *
 * @param workspace - `model.workspace` ({ animals, days }).
 * @param animalId - The animal whose view to build.
 * @param tab - The requested route `:tab` segment; an unknown/bare value resolves to the default.
 * @returns The page view-model — pure data, no React. When the animal is absent the groups are empty
 *   and only the header id + resolved active tab are populated (the page renders its own not-found
 *   escape, which this builder does not duplicate).
 */
export function buildAnimalViewModel(
  workspace: unknown,
  animalId: string,
  tab: string
): AnimalViewModel {
  const activeTab = resolveTab(tab);
  const ws = isRecord(workspace) ? workspace : {};
  const animalsMap: Record<string, unknown> = isRecord(ws.animals) ? ws.animals : {};
  const animal = animalsMap[animalId];

  const activePanel: AnimalActivePanelViewModel = {
    key: activeTab,
    label: TAB_LABEL[activeTab] || 'Section',
  };
  if (TAB_SCOPE[activeTab]) activePanel.scope = TAB_SCOPE[activeTab];

  if (!isRecord(animal)) {
    return { header: { id: animalId }, groups: [], activeTab, activePanel };
  }
  // The domain selectors below are shape-safe over any record (they guard their own inputs); narrow
  // the validated record to Animal once so the call sites read cleanly.
  const animalRecord = animal as unknown as Animal;

  const subject = getAnimalSubject(animal);
  const header: AnimalHeaderViewModel = { id: (animal.id as string) ?? animalId };
  if (subject.species) header.speciesLabel = subject.species;
  if (subject.sex) header.sexLabel = subject.sex;

  const daysMap: Record<string, Day> = isRecord(ws.days) ? (ws.days as Record<string, Day>) : {};
  const blockingSections = getAnimalBlockingSections(animalRecord, daysMap);
  const countLabels = buildCountLabels(animalId, animalRecord, {
    animals: animalsMap,
    days: daysMap,
  });

  const groups: AnimalSectionGroupViewModel[] = SECTION_GROUPS.map((group) => ({
    label: group.label,
    sections: group.items.map((item) =>
      buildSection(item, animalId, animalRecord, blockingSections, countLabels)
    ),
  }));

  return { header, groups, activeTab, activePanel };
}
