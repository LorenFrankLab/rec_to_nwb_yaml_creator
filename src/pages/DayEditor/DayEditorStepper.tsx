import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ComponentType } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useDayIdFromUrl } from '../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import {
  getAnimalSubject,
  getCopyableDioSources,
  resolveDayOwner,
} from '../../state/workspaceSelectors';
import { applyRepairCommand } from '../../state/repairCommands';
import type { RepairCommand, RepairCommandContext } from '../../state/repairCommands';
import { animalSetupTabForFieldPath } from '../../domain/validation';
import type { RepairableIssue } from '../../domain/repairRouting';
import { buildDayEditorViewModel } from '../../viewModels/dayEditorViewModel';
import type { BreadcrumbViewModel, StepViewModel } from '../../viewModels/types';
import { DayEditorProvider } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import DayEditorSectionNav from './DayEditorSectionNav';
import SaveIndicator from './SaveIndicator';
import OverviewStep from './OverviewStep';
import DevicesStep from './DevicesStep';
import TasksEpochsStep from './TasksEpochsStep';
import BehavioralEventsStep from './BehavioralEventsStep';
import ValidationStep from './ValidationStep';
import ExportStep from './ExportStep';
import type { CopyableDioSource } from './BehavioralEventsDisplay';
import ErrorState from './ErrorState';

/** A repair-routed focus request: the target field path + a monotonic token to retrigger the effect. */
interface FocusRequest {
  fieldPath: string;
  token: number;
}

/**
 * The section-specific props the stepper passes to whichever step is active. The shared bundle
 * fields reach each step via `DayEditorContext`, NOT through these props, so the dynamic
 * `<CurrentStepComponent>` render is typed to this (all-optional) section surface — each step
 * picks the ones it uses.
 */
interface StepSectionProps {
  onSubjectUpdate?: (field: string, value: string) => void;
  onNavigate?: (target: string, fieldPath?: string) => void;
  onRepair?: (issue: RepairableIssue) => void;
  focusRequest?: FocusRequest | null;
  copyableDioSources?: CopyableDioSource[];
  /** The view-model breadcrumb trail (Overview step renders it). */
  breadcrumb?: BreadcrumbViewModel;
}

/**
 * Section-nav structure: the sections grouped for the tabbed nav, in display order. Labels are
 * display-only (richer than the bare step ids) — the `id` is the step key used for `currentStep`,
 * the component lookup, and to match each group item to its view-model step (`vm.steps`).
 */
const SECTION_GROUPS = [
  { label: 'Session', items: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Recording',
    items: [
      { id: 'devices', label: 'Devices & Failed Channels' },
      { id: 'epochs', label: 'Tasks & Epochs' },
      { id: 'behavioral', label: 'Behavioral Events' },
    ],
  },
  {
    label: 'Finish',
    items: [
      { id: 'validation', label: 'Validation' },
      { id: 'export', label: 'Export' },
    ],
  },
];

/**
 * Day Editor - Container for tabbed session metadata editing.
 *
 * This is NOT a linear stepper: the day editor is a single route (`#/day/:id`) whose
 * active section is LOCAL STATE (`currentStep`), and a grouped section-nav (mirroring
 * AnimalView's `section-nav`) lets the user move FREELY between the five sections — no
 * wizard gating. The five sections (rendered by the same five components) are:
 *   1. Overview   - Session metadata
 *   2. Devices    - Electrode groups, channel maps, failed channels
 *   3. Epochs     - Tasks, behavioral events
 *   4. Validation - Summary of all validation issues
 *   5. Export     - Download YAML file
 *
 * The export gate is NOT a nav lock — Export is a freely reachable tab. The gate survives
 * inside ExportStep itself, which independently computes `isExportEnabled`/`exportBlocked`
 * and hard-stops `handleDownload` while the day is invalid (defense in depth). The Export
 * nav item shows its status glyph (✗/⚠) so the block stays visible.
 *
 * A visible "Next ▸"/"◂ Prev" affordance and the global Alt+←/→ shortcuts advance/retreat
 * through the order overview→devices→epochs→validation→export (Export included).
 *
 * @example
 * // URL: #/day/remy-2023-06-22
 * <DayEditorStepper />
 */
export default function DayEditorStepper() {
  const { model, actions, selectors, persistence } = useStoreContext();
  const dayId = useDayIdFromUrl();
  const [currentStep, setCurrentStep] = useState('overview');

  // Global Alt+Arrow shortcuts advance/retreat the active section. The section order is
  // fixed, so a ref captures it once and the handler stays stable. Export is now a freely
  // reachable tab (its DOWNLOAD action self-gates in ExportStep), so there is NO keyboard
  // fail-close here — Alt+→ advances all the way into Export.
  const stepOrderRef = useRef(['overview', 'devices', 'epochs', 'behavioral', 'validation', 'export']);
  const goToStep = useCallback((direction: 'next' | 'prev') => {
    setCurrentStep((cur) => {
      const ids = stepOrderRef.current;
      const idx = ids.indexOf(cur);
      if (direction === 'next') return ids[Math.min(idx + 1, ids.length - 1)];
      if (direction === 'prev') return ids[Math.max(idx - 1, 0)];
      return cur;
    });
  }, []);
  useStepperShortcut(
    useCallback((action: 'next' | 'prev' | 'add') => {
      if (action === 'next' || action === 'prev') goToStep(action);
    }, [goToStep])
  );

  // Get day + its owning animal from the store. `resolveDayOwner` is the SHARED selector the
  // day-editor view-model also resolves with (the previously-duplicated inline copies were extracted
  // there), so a recovered/imported day (missing/stale/non-string `animalId`) opens under one owner truth:
  // normally `day.animalId`, falling back to the animal whose index references this day's store key
  // ONLY when the day declares no owner, and staying unresolved for a present-but-unresolvable owner
  // (→ "Animal not found"). `ownerKey` (not the record's `animal.id` field) is the store key every
  // animal write below uses.
  const day = model.workspace?.days?.[dayId as string];
  const { ownerKey, animal } = resolveDayOwner(model.workspace, dayId);

  // Merge animal + day for validation (must be before early returns to follow Rules of Hooks).
  // mergeDayMetadata throws BY DESIGN on a malformed animal (missing/non-array
  // configurationHistory); tolerate it so the stepper renders (the gate fails closed and
  // the raw-shape animal validation surfaces the repairable issue) instead of crashing.
  const mergedDay = useMemo(() => {
    if (!animal || !day) return null;
    try {
      return mergeDayMetadata(animal, day);
    } catch (err) {
      // Tolerated (the gate fails closed + the raw-shape issue is surfaced/repairable), but log
      // WHY the merge failed so a "this day won't export" report is diagnosable later instead of
      // the reason being silently lost.
      // eslint-disable-next-line no-console
      console.error(`[day-editor] could not merge day "${dayId}" with its animal config:`, err);
      return null;
    }
  }, [animal, day, dayId]);

  // The animal's days (sorted by date), resolved by the STORE KEY the animal was indexed by.
  // Powers the Devices step's reconfiguration wizard AND the bad-channel monotonicity export
  // gate (the earlier same-config bad set this day must not silently un-fail). Computed before
  // the step-status memo so the gate sees the cross-day context; `getAnimalDays` returns [] for
  // a missing/unresolved owner, so this is safe before the null-checks below.
  // `ownerKey` may be null (unresolved owner); `getAnimalDays` returns [] for a null/missing id, so
  // the erased cast keeps the [] behavior while satisfying the `string` selector param.
  const animalDays = selectors.getAnimalDays(ownerKey as string);

  // Other animals whose existing DIO set can seed a blank first day (the Behavioral Events tab's
  // copy-from-animal bootstrap). Recomputed only when the workspace or owner changes.
  const copyableDioSources = useMemo(
    () => getCopyableDioSources(model.workspace, ownerKey as string),
    [model.workspace, ownerKey]
  );

  // The day-editor view-model: the shell load-state, the breadcrumb trail, and the section steps
  // (each step's status + the Validation "N to fix" count) — built from the SAME workspace + the live
  // active section, so the nav scent + the not-found shell render the builder's truth instead of
  // re-deriving step status / to-fix counts here. (The overview / issues / export / bad-channel
  // slices are wired in the later DayEditor sub-slices; the write handlers below stay raw.)
  const vm = useMemo(
    () => buildDayEditorViewModel(model.workspace, dayId, currentStep),
    [model.workspace, dayId, currentStep]
  );
  // Grouped steps for the section nav: the static Session/Recording/Finish grouping over the
  // view-model's flat step list (matched by key).
  const navGroups = SECTION_GROUPS.map((group) => ({
    label: group.label,
    steps: group.items
      .map((item) => vm.steps.find((step) => step.key === item.id))
      .filter((step): step is StepViewModel => step != null),
  }));

  // Repair-action navigation. A repair routes to the step that owns the fix and,
  // when a field target is available, focuses/highlights that control after the
  // destination step renders. With no matching anchor it degrades to the step
  // itself (focusing the main content region).
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const focusTokenRef = useRef(0);

  // Mirror AnimalView's focus-on-section-change: move focus onto the panel (#main-content)
  // when the active section changes, so keyboard/SR users land on the new content rather
  // than being stranded at the top. Skip the initial mount (AppLayout/route owns mount
  // focus). When a repair routed here WITH a field target (`focusRequest` set), the
  // repair-focus effect below owns focus instead (it lands on the specific control), so this
  // generic effect must not fight it — it only fires for a plain section switch.
  const isFirstSectionRender = useRef(true);
  // Skip the section-change focus EXACTLY ONCE, set only by a field-targeted repair
  // navigation (the repair-focus effect below owns focusing the specific control then).
  // We must NOT skip based on `focusRequest` itself: `focusRequest` is sticky (it is only
  // cleared on a no-field navigate), so keying the skip off it would permanently disable
  // this a11y focus after the first repair, stranding keyboard/SR users at the top on every
  // later plain section switch. The ref consumes the skip once and never gets stuck.
  const skipNextSectionFocusRef = useRef(false);
  useEffect(() => {
    if (isFirstSectionRender.current) {
      isFirstSectionRender.current = false;
      return undefined;
    }
    if (skipNextSectionFocusRef.current) {
      // A field-targeted repair just navigated here; the repair-focus effect will land on
      // the specific control. Consume the skip so the NEXT plain switch focuses the panel.
      skipNextSectionFocusRef.current = false;
      return undefined;
    }
    document.getElementById('main-content')?.focus();
    return undefined;
  }, [currentStep, focusRequest]);
  const handleStepNavigate = useCallback((target: string, fieldPath?: string) => {
    // An 'animal' target routes to the Animal Editor (the editable owner of device
    // geometry, channel maps, cameras, data-acq devices, and subject identity),
    // mirroring the camera-banner link. Day-Editor step targets stay in this stepper.
    if (target === 'animal') {
      if (ownerKey != null) {
        // Navigate by the resolved owner STORE KEY (not the possibly-stale `animal.id` record
        // field), so the tabbed Animal View opens the right animal. Re-point at the SETUP TAB that
        // owns the fix (tabbed IA) and carry `?field=` so the destination can highlight the control;
        // with no field, land on the animal home (`days`).
        const animalBase = `#/animal/${encodeURIComponent(ownerKey)}`;
        window.location.hash = fieldPath
          ? `${animalBase}/${animalSetupTabForFieldPath(fieldPath).tab}?field=${encodeURIComponent(fieldPath)}`
          : `${animalBase}/days`;
      }
      return;
    }
    setCurrentStep(target);
    if (fieldPath) {
      // The repair-focus effect will own focusing this specific field — skip the generic
      // section-change focus exactly once so the two don't fight (and so the field, not the
      // panel, receives focus). The skip is consumed in the section-change effect.
      skipNextSectionFocusRef.current = true;
      focusTokenRef.current += 1;
      setFocusRequest({ fieldPath, token: focusTokenRef.current });
    } else {
      setFocusRequest(null);
    }
  }, [ownerKey]);

  useEffect(() => {
    if (!focusRequest) return undefined;
    let highlighted: HTMLElement | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      if (!main) return;
      const target = Array.from(main.querySelectorAll<HTMLElement>('[data-field-path]')).find(
        (el) => el.getAttribute('data-field-path') === focusRequest.fieldPath
      );
      if (target) {
        target.focus();
        target.classList.add('repair-target-highlight');
        highlighted = target;
        // Transient cue: drop the highlight so it does not read as a persistent state.
        removeTimer = setTimeout(() => target.classList.remove('repair-target-highlight'), 2000);
      } else {
        // No precise anchor: land the user on the owning step's content.
        main.focus();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (removeTimer) clearTimeout(removeTimer);
      if (highlighted) highlighted.classList.remove('repair-target-highlight');
    };
  }, [focusRequest]);

  // Field update handler with nested path support. The write is synchronous; real
  // save status (and any failure) is reported by the store's debounced autosave via
  // `persistence`, not optimistically here.
  const handleFieldUpdate = useCallback((fieldPath: string, value: unknown) => {
    if (!day || !dayId) return;

    // Parse path: "session.session_id" → ["session", "session_id"]
    const pathSegments = fieldPath.split('.');

    // Clone day and update nested field immutably. Typed as a loose record for the dynamic
    // path write below (the segments index arbitrary nested keys).
    const updated = structuredClone(day) as Record<string, unknown>;
    let target: Record<string, unknown> = updated;

    // Navigate to parent object, (re)creating intermediate objects. A repair write-through
    // a path whose intermediate is corrupt (e.g. `day.session` loaded as a scalar/array)
    // must not throw on `scalar.field = value` (strict-mode TypeError): replace any
    // non-plain-object intermediate with a fresh object so the repaired field lands cleanly.
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      const child = target[segment];
      if (child === null || typeof child !== 'object' || Array.isArray(child)) {
        target[segment] = {};
      }
      target = target[segment] as Record<string, unknown>;
    }

    // Set the final value
    target[pathSegments[pathSegments.length - 1]] = value;

    // Extract top-level keys that changed and update the store.
    const topLevelKey = pathSegments[0];
    actions.updateDay(dayId, { [topLevelKey]: updated[topLevelKey] });
  }, [day, dayId, actions]);

  // Executable repair: run an issue's serializable repairCommand against the store, in
  // place. The stepper owns the animal/day/actions the executor needs, so it is the single
  // place that context is assembled — no global side effects. A commandable issue's button
  // (in ExportStep's blocked list and the Validation summary) calls this instead of
  // navigating to a destination that may render a blank empty state.
  const handleRepair = useCallback((issue: RepairableIssue) => {
    if (!issue?.repairCommand) return;
    // `RepairableIssue.repairCommand` is `unknown` (a serializable command); narrow it to the
    // executor's command type for the reads + the call below.
    const command = issue.repairCommand as RepairCommand;
    // An ANIMAL-surface repair needs a resolved owner key; if it's null (a wrong-owner / non-string
    // animalId day that never resolved an owner), the executor would no-op. That should be
    // unreachable from this stepper (such a day renders "Animal not found", not a repair button),
    // but log if it ever happens so a silently-dead repair click is diagnosable rather than mute.
    if (ownerKey == null && command.type && issue.repairSurface === 'animal') {
      // eslint-disable-next-line no-console
      console.warn(`[day-editor] repair "${command.type}" no-op: unresolved animal owner key.`);
    }
    // The assembled context matches RepairCommandContext, which tolerates an absent (null) id by
    // no-op'ing the corresponding surface; the cast preserves the exact runtime values (the store
    // actions + possibly-null owner/day ids) while satisfying its stricter optional types.
    applyRepairCommand(command, {
      actions,
      // The resolved owner STORE KEY, not the possibly-stale `animal.id` record field, so an
      // ANIMAL-surface repair (resetAnimalCameras / resetDataAcqDevice / rebuildConfigurationHistory)
      // lands on the right animal even for a recovered record whose id drifted from its store key.
      animalId: ownerKey,
      dayId,
      day,
      animal,
    } as unknown as RepairCommandContext);
  }, [actions, animal, ownerKey, dayId, day]);

  // Subject fields live on the animal, not the day. The Overview step uses this to
  // repair inherited subject metadata (DOB / weight / description / species) in
  // place, writing through to the animal so existing animals can be fixed.
  const handleSubjectUpdate = useCallback((field: string, value: string) => {
    if (!animal) return;
    // Write through the resolved owner STORE KEY, not the possibly stale `animal.id` record
    // field, so the repair lands on the right animal. `animal` non-null here implies `ownerKey`
    // resolved to a string (it is the key the animal was found by).
    actions.updateAnimal(ownerKey as string, { subject: { ...getAnimalSubject(animal), [field]: value } });
  }, [animal, ownerKey, actions]);

  // Section → component lookup. The five sections and their internals are unchanged; only
  // the navigation shell is tabbed now. Labels here are display-only (the nav may use
  // richer labels), so they must NOT be relied on as ids.
  const STEP_COMPONENTS = {
    overview: OverviewStep,
    devices: DevicesStep,
    epochs: TasksEpochsStep,
    behavioral: BehavioralEventsStep,
    validation: ValidationStep,
    export: ExportStep,
  };

  // Early returns AFTER all hooks (Rules of Hooks requirement). The not-found message comes from the
  // view-model's shell state (no-day-id / day-not-found / animal-not-found); the guards stay so the
  // non-null narrowing of `day`/`animal` below holds.
  if (!dayId || !day || !animal) {
    return <ErrorState message={vm.shell.message ?? ''} />;
  }

  // The active step component. Each step reads its shared bundle from DayEditorContext, so the
  // dynamic render only passes the section-specific props — typed via `StepSectionProps` (the bundle
  // props are NOT passed here; the cast drops each step's required-bundle-prop contract accordingly).
  const CurrentStepComponent = STEP_COMPONENTS[
    currentStep as keyof typeof STEP_COMPONENTS
  ] as ComponentType<StepSectionProps>;
  const stepOrder = stepOrderRef.current;
  const currentIndex = stepOrder.indexOf(currentStep);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < stepOrder.length - 1;

  // The per-day bundle every section needs, provided once via DayEditorContext instead of
  // drilling the same seven props through each <CurrentStepComponent>. Built fresh per render
  // (matching the prior per-render prop passing). Section-specific props (onNavigate, onRepair,
  // copyableDioSources, …) stay as ordinary props below.
  const dayEditorContextValue: DayEditorBundle = {
    animal,
    day,
    // `mergedDay` is null on the merge-failed fail-closed path (corrupt animal config); the bundle
    // types it non-null and every section guards it with `|| {}`, so the erased cast keeps the null
    // runtime value while satisfying the contract.
    mergedDay: mergedDay as Record<string, unknown>,
    animalDays,
    onFieldUpdate: handleFieldUpdate,
    // The bundle exposes `actions` as the loose store-action bag the sections cast back from.
    actions: actions as unknown as Record<string, unknown>,
    // `animal` is non-null here (early return), reachable only once `ownerKey` resolved to a string.
    animalKey: ownerKey as string,
  };

  return (
    <div className="day-editor-stepper">
      {/* Plain div, not <header>: a <header> here (not inside a sectioning element)
          maps to the banner landmark, duplicating AppLayout's banner. */}
      <div className="day-editor-header">
        <div className="day-editor-title">
          <a
            href={`#/workspace?animal=${ownerKey}`}
            className="back-button"
            aria-label="Back to Workspace"
          >
            ← Back to Workspace
          </a>
          <h1>Day Editor: {ownerKey} - {day.date}</h1>
        </div>
        <SaveIndicator persistence={persistence} />
      </div>

      <div className="day-editor-body">
        <DayEditorSectionNav
          groups={navGroups}
          onNavigate={(id) => setCurrentStep(id)}
        />

        <main
          id="main-content"
          className="day-editor-content"
          role="main"
          aria-label="Day editor"
          tabIndex={-1}
        >
          <DayEditorProvider value={dayEditorContextValue}>
            <CurrentStepComponent
              onSubjectUpdate={handleSubjectUpdate}
              onNavigate={handleStepNavigate}
              onRepair={handleRepair}
              focusRequest={focusRequest}
              copyableDioSources={copyableDioSources}
              breadcrumb={vm.breadcrumb}
            />
          </DayEditorProvider>

          {/* Free-navigation affordance: advances/retreats through the fixed section order
              (Export included — its DOWNLOAD action self-gates in ExportStep, not here). */}
          <div className="day-editor-section-pager">
            <button
              type="button"
              className="day-editor-pager-prev"
              onClick={() => goToStep('prev')}
              disabled={!hasPrev}
            >
              ◂ Prev
            </button>
            <button
              type="button"
              className="day-editor-pager-next"
              onClick={() => goToStep('next')}
              disabled={!hasNext}
            >
              Next ▸
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
