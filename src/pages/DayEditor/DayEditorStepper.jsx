import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useDayIdFromUrl } from '../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import {
  getAnimalSubject,
  getDayTasks,
  getAnimalDayIds,
  getCopyableDioSources,
} from '../../state/workspaceSelectors';
import { applyRepairCommand } from '../../state/repairCommands';
import { computeStepStatus, animalSetupTabForFieldPath, validateDay } from '../../domain/validation';
import { describeOwner } from '../../domain/dayRecovery';
import DayEditorSectionNav from './DayEditorSectionNav';
import SaveIndicator from './SaveIndicator';
import OverviewStep from './OverviewStep';
import DevicesStep from './DevicesStep';
import TasksEpochsStep from './TasksEpochsStep';
import BehavioralEventsStep from './BehavioralEventsStep';
import ValidationStep from './ValidationStep';
import ExportStep from './ExportStep';
import ErrorState from './ErrorState';

/**
 * Section-nav structure: the five sections grouped for the tabbed nav, in display order.
 * Labels are display-only (richer than the bare step ids) — the `id` is the step key used
 * for `currentStep`, `computeStepStatus`, and the component lookup. The 5 components are
 * unchanged: 5 nav items, never split.
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
 * @returns {JSX.Element}
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
  const goToStep = useCallback((direction) => {
    setCurrentStep((cur) => {
      const ids = stepOrderRef.current;
      const idx = ids.indexOf(cur);
      if (direction === 'next') return ids[Math.min(idx + 1, ids.length - 1)];
      if (direction === 'prev') return ids[Math.max(idx - 1, 0)];
      return cur;
    });
  }, []);
  useStepperShortcut(
    useCallback((action) => {
      if (action === 'next' || action === 'prev') goToStep(action);
    }, [goToStep])
  );

  // Get day and animal from store. Resolve the OWNER KEY robustly: normally `day.animalId`, but a
  // recovered/imported day can have a missing/stale `animalId` while still being listed in some
  // animal's index — fall back to the animal whose index references this day, so the editor opens
  // under its real owner instead of dead-ending on "Animal not found". `ownerKey` (not the record's
  // `animal.id` field) is the store key used for every animal write below.
  const day = model.workspace?.days?.[dayId];
  const animalsMap = model.workspace?.animals ?? {};
  // The owner key MUST be a string before it is used as a map key. A corrupt import can persist a
  // non-string `animalId` (object/number); coercing one to a property name would invent a phantom
  // key (`animalsMap['[object Object]']`) and diverge from dayRecovery's WRONG_OWNER classification.
  // A non-string owner is therefore treated as "no resolvable owner" (ownerKey = null).
  let ownerKey = typeof day?.animalId === 'string' ? day.animalId : null;
  let animal = ownerKey != null ? animalsMap[ownerKey] : null;
  // Fall back to the indexing animal ONLY when the day declares NO owner (`animalId` absent) —
  // the legitimate recovered-missing-animalId case. A PRESENT but unresolvable `animalId` (e.g.
  // "ghost", an object, or a number) means the day belongs to a different/absent owner; it must NOT
  // open under whichever animal happens to index it (that would let a wrong-owner day export as the
  // wrong subject). It stays unresolved → "Animal not found", matching the batch wrong-owner/orphan
  // block. Only the truly owner-less case (`animalId == null`) takes the indexing-animal fallback.
  if (!animal && day && day.animalId == null) {
    // Match by the store MAP KEY (`dayId`, from the URL) — that is what an animal's `days` index
    // holds. For well-formed data `day.id === dayId`, but a corrupt import can let the record's
    // own `id` field drift from its map key, so the map key is the reliable membership test.
    const indexingKey = Object.keys(animalsMap).find((key) =>
      getAnimalDayIds(animalsMap[key]).includes(dayId)
    );
    if (indexingKey != null) {
      ownerKey = indexingKey;
      animal = animalsMap[indexingKey];
    }
  }

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

  // Dataset-wide task_name -> task_description map for the Spyglass task-name
  // identity guard. task_name is an identity across the whole
  // dataset, so the modal must check a reused name against EVERY other day's
  // description, not just the current day's siblings. The CURRENT day's tasks are
  // excluded here (the step folds them back in, giving live siblings precedence);
  // a name appearing in multiple other days keeps the last-seen description, which
  // is sufficient to detect a conflicting reuse. Must precede early returns.
  const knownTaskDescriptions = useMemo(() => {
    const map = {};
    const days = model.workspace?.days || {};
    for (const id of Object.keys(days)) {
      if (id === dayId) continue;
      const siblingTasks = getDayTasks(days[id]);
      siblingTasks.forEach((task) => {
        if (task.task_name) {
          map[task.task_name] = task.task_description ?? '';
        }
      });
    }
    return map;
  }, [model.workspace?.days, dayId]);

  // The animal's days (sorted by date), resolved by the STORE KEY the animal was indexed by.
  // Powers the Devices step's reconfiguration wizard AND the bad-channel monotonicity export
  // gate (the earlier same-config bad set this day must not silently un-fail). Computed before
  // the step-status memo so the gate sees the cross-day context; `getAnimalDays` returns [] for
  // a missing/unresolved owner, so this is safe before the null-checks below.
  const animalDays = selectors.getAnimalDays(ownerKey);

  // Other animals whose existing DIO set can seed a blank first day (the Behavioral Events tab's
  // copy-from-animal bootstrap). Recomputed only when the workspace or owner changes.
  const copyableDioSources = useMemo(
    () => getCopyableDioSources(model.workspace, ownerKey),
    [model.workspace, ownerKey]
  );

  // Compute step validation status (must be before early returns to follow Rules of Hooks)
  const stepStatus = useMemo(() => {
    if (!day || !mergedDay) {
      return {
        overview: 'incomplete',
        devices: 'incomplete',
        epochs: 'incomplete',
        behavioral: 'incomplete',
        validation: 'incomplete',
        export: 'error',
      };
    }
    return computeStepStatus(day, mergedDay, animal, animalDays);
  }, [day, mergedDay, animal, animalDays]);

  // To-fix count shown on the Validation nav item: the number of blocking (error-severity)
  // issues the day still has. Cheap reuse of the same validator ExportStep gates on, so the
  // nav scent can never disagree with the export block.
  const toFixCount = useMemo(() => {
    if (!day || !mergedDay) return 0;
    return validateDay(day, mergedDay, animal, animalDays).filter(
      (issue) => issue.severity === 'error'
    ).length;
  }, [day, mergedDay, animal, animalDays]);

  // Repair-action navigation. A repair routes to the step that owns the fix and,
  // when a field target is available, focuses/highlights that control after the
  // destination step renders. With no matching anchor it degrades to the step
  // itself (focusing the main content region).
  const [focusRequest, setFocusRequest] = useState(null);
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
  const handleStepNavigate = useCallback((target, fieldPath) => {
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
    let highlighted = null;
    let removeTimer = null;
    const raf = requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      if (!main) return;
      const target = Array.from(main.querySelectorAll('[data-field-path]')).find(
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
  const handleFieldUpdate = useCallback((fieldPath, value) => {
    if (!day || !dayId) return;

    // Parse path: "session.session_id" → ["session", "session_id"]
    const pathSegments = fieldPath.split('.');

    // Clone day and update nested field immutably
    const updated = structuredClone(day);
    let target = updated;

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
      target = target[segment];
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
  const handleRepair = useCallback((issue) => {
    if (!issue?.repairCommand) return;
    // An ANIMAL-surface repair needs a resolved owner key; if it's null (a wrong-owner / non-string
    // animalId day that never resolved an owner), the executor would no-op. That should be
    // unreachable from this stepper (such a day renders "Animal not found", not a repair button),
    // but log if it ever happens so a silently-dead repair click is diagnosable rather than mute.
    if (ownerKey == null && issue.repairCommand.type && issue.repairSurface === 'animal') {
      // eslint-disable-next-line no-console
      console.warn(`[day-editor] repair "${issue.repairCommand.type}" no-op: unresolved animal owner key.`);
    }
    applyRepairCommand(issue.repairCommand, {
      actions,
      // The resolved owner STORE KEY, not the possibly-stale `animal.id` record field, so an
      // ANIMAL-surface repair (resetAnimalCameras / resetDataAcqDevice / rebuildConfigurationHistory)
      // lands on the right animal even for a recovered record whose id drifted from its store key.
      animalId: ownerKey,
      dayId,
      day,
      animal,
    });
  }, [actions, animal, ownerKey, dayId, day]);

  // Subject fields live on the animal, not the day. The Overview step uses this to
  // repair inherited subject metadata (DOB / weight / description / species) in
  // place, writing through to the animal so existing animals can be fixed.
  const handleSubjectUpdate = useCallback((field, value) => {
    if (!animal) return;
    // Write through the resolved owner STORE KEY, not the possibly stale `animal.id` record
    // field, so the repair lands on the right animal.
    actions.updateAnimal(ownerKey, { subject: { ...getAnimalSubject(animal), [field]: value } });
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

  // Early returns AFTER all hooks (Rules of Hooks requirement)
  if (!dayId) {
    return <ErrorState message="No day ID provided in URL" />;
  }

  if (!day) {
    return <ErrorState message={`Day not found: ${dayId}`} />;
  }

  if (!animal) {
    return <ErrorState message={`Animal not found: ${describeOwner(day.animalId)}`} />;
  }

  const CurrentStepComponent = STEP_COMPONENTS[currentStep];
  const stepOrder = stepOrderRef.current;
  const currentIndex = stepOrder.indexOf(currentStep);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < stepOrder.length - 1;

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
          groups={SECTION_GROUPS}
          currentStep={currentStep}
          stepStatus={stepStatus}
          onNavigate={(id) => setCurrentStep(id)}
          toFixCount={toFixCount}
        />

        <main
          id="main-content"
          className="day-editor-content"
          role="main"
          aria-label="Day editor"
          tabIndex="-1"
        >
          <CurrentStepComponent
            animal={animal}
            animalKey={ownerKey}
            day={day}
            mergedDay={mergedDay}
            knownTaskDescriptions={knownTaskDescriptions}
            onFieldUpdate={handleFieldUpdate}
            onSubjectUpdate={handleSubjectUpdate}
            onNavigate={handleStepNavigate}
            onRepair={handleRepair}
            focusRequest={focusRequest}
            animalDays={animalDays}
            actions={actions}
            copyableDioSources={copyableDioSources}
          />

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

DayEditorStepper.propTypes = {};
