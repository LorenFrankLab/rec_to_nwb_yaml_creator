import { DAY_LIFECYCLE_LABEL } from '../../domain/dayLifecycle';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useDayIdFromUrl } from '../../hooks/useDayIdFromUrl';
import {
  getCopyableDioSources,
  resolveDayOwner,
} from '../../state/workspaceSelectors';
import { applyRepairCommand } from '../../state/repairCommands';
import type { RepairCommand, RepairCommandContext } from '../../state/repairCommands';
import { animalSetupTabForFieldPath } from '../../domain/validation';
import {
  dayEditorFocusPath,
  dayEditorSectionForRepair,
  repairTargetForIssue,
  stepIdForIssue,
} from '../../domain/repairRouting';
import type { RepairableIssue } from '../../domain/repairRouting';
import { evaluateDay } from '../../domain/dayEvaluation';
import {
  isDayValidationDeferred,
} from '../../domain/validationPresentation';
import { buildDayEditorViewModel } from '../../viewModels/dayEditorViewModel';
import type { DayTabKey } from '../../viewModels/dayEditorViewModel';
import Breadcrumb from './Breadcrumb';
import ReadinessBar from '../../components/ReadinessBar';
import { DayEditorProvider } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import SaveIndicator from './SaveIndicator';
import DayTab from './DayTab';
import { RecordingSetupSection, FailedChannelsSection } from './FailedChannelsTab';
import DioTab from './DioTab';
import ExportPreview from './ExportPreview';
import DayEditorSectionNav from './DayEditorSectionNav';
import type { CopyableDioSource } from './BehavioralEventsDisplay';
import ErrorState from './ErrorState';
import styles from './DayEditorFrame.module.css';
import { flushAllDrafts } from '../../state/draftRegistry';

/** A repair-routed focus request: the target field path + a monotonic token to retrigger the effect. */
interface FocusRequest {
  fieldPath: string;
  token: number;
}

/** The frame's main-content modes: one of the six IA sections. */
type FrameMode = DayTabKey;

function modeFromHash(): FrameMode {
  if (typeof window === 'undefined') return 'daily';
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const section = params.get('section');
  if (section && TAB_ORDER.includes(section as DayTabKey)) return section as FrameMode;
  const step = params.get('step');
  const field = params.get('field') ?? undefined;
  return dayEditorSectionForRepair(step, field) ?? 'daily';
}

function sectionHash(dayId: string, section: FrameMode, fieldPath?: string): string {
  const params = new URLSearchParams();
  params.set('section', section);
  if (fieldPath) params.set('field', fieldPath);
  return `#/day/${encodeURIComponent(dayId)}?${params.toString()}`;
}

/**
 * The sections' fixed order (drives the Alt+←/→ cycle). The epoch editor lives INSIDE the daily
 * log (the first screen), so `tasks` is no longer a rail stop — a repair that targets it lands on
 * `daily`, where the same editor renders.
 */
const TAB_ORDER: DayTabKey[] = ['daily', 'recording', 'channels', 'dio', 'export'];

const sectionForRepair = dayEditorSectionForRepair;
const focusPathForSection = dayEditorFocusPath;

/**
 * DayEditorFrame — the day editor's chrome and section navigation.
 *
 * The compact header identifies the animal and recording date, shows persistence/download status,
 * and offers review of outstanding entries through the authoritative validator (never a local
 * check). The body is a grouped vertical rail — DAY / RECORDING / FINISH — with free navigation
 * and Alt+←/→; the panels read their data through {@link DayEditorProvider} (NOT props), so the
 * provider must wrap them. A header **Export** action opens the Fix & Export section (the
 * issue-gated download/copy + the YAML preview + the batch "export all days").
 *
 * Behavior reused from the former stepper: owner resolution, the merge, the field/subject writers,
 * executable repairs, and the repair-focus + section-change focus effects.
 *
 * @example
 * // URL: #/day/remy-2023-06-22
 * <DayEditorFrame />
 */
export default function DayEditorFrame() {
  const { model, actions, selectors, persistence } = useStoreContext();
  const dayId = useDayIdFromUrl();
  const [mode, setMode] = useState<FrameMode>(modeFromHash);
  // Keyboard shortcuts can arrive faster than React commits a render (for example four
  // Alt+ArrowRight presses in quick succession). Keep the current section synchronously as well as
  // in state so every intent advances from the section selected by the preceding intent.
  const modeRef = useRef<FrameMode>(mode);

  const day = model.workspace?.days?.[dayId as string];
  const { ownerKey, animal } = resolveDayOwner(model.workspace, dayId);

  const animalDays = useMemo(
    () => ownerKey ? selectors.getAnimalDays(ownerKey) : [],
    [selectors, ownerKey]
  );

  const evaluation = useMemo(
    () => animal && day ? evaluateDay(animal, day, animalDays) : null,
    [animal, day, animalDays]
  );
  const mergedDay = evaluation && !evaluation.mergeFailed ? evaluation.merged : null;

  const copyableDioSources = useMemo(
    () => getCopyableDioSources(model.workspace, ownerKey as string),
    [model.workspace, ownerKey]
  );

  // The day-editor view-model: chips, grouped rail, breadcrumb, the Overview field slice, and the
  // bad-channel marks — all from the SAME builder, so the frame is a thin renderer.
  const vm = useMemo(
    () => buildDayEditorViewModel(model.workspace, dayId, mode, evaluation ?? undefined),
    [model.workspace, dayId, mode, evaluation]
  );

  // The readiness bar and view-model share this authoritative evaluation; neither revalidates.
  const readinessIssues = evaluation?.issues ?? [];

  useEffect(() => {
    if (!dayId || !day || !isDayValidationDeferred(day)) return;
    const state =
      day.state !== null && typeof day.state === 'object' && !Array.isArray(day.state)
        ? (day.state as unknown as Record<string, unknown>)
        : {};
    actions.updateDay(dayId, { state: { ...state, validationDeferred: false } });
  }, [actions, day, dayId]);

  // ── Focus management (mirrors the former stepper) ──
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const focusTokenRef = useRef(0);
  const isFirstModeRender = useRef(true);
  const skipNextModeFocusRef = useRef(false);
  useEffect(() => {
    if (isFirstModeRender.current) {
      isFirstModeRender.current = false;
      return undefined;
    }
    if (skipNextModeFocusRef.current) {
      skipNextModeFocusRef.current = false;
      return undefined;
    }
    document.getElementById('main-content')?.focus();
    return undefined;
  }, [mode, focusRequest]);

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
        // A field inside a collapsed disclosure (the daily log's "Descriptions…" group) must be
        // revealed before it can take focus.
        let ancestor: HTMLElement | null = target.parentElement;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        target.focus();
        target.classList.add('repair-target-highlight');
        highlighted = target;
        removeTimer = setTimeout(() => target.classList.remove('repair-target-highlight'), 2000);
      } else {
        main.focus();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (removeTimer) clearTimeout(removeTimer);
      if (highlighted) highlighted.classList.remove('repair-target-highlight');
    };
  }, [focusRequest]);

  // Switch the active tab, optionally focusing a field after it renders (the repair-focus effect
  // owns focusing the field, so the generic mode-change focus is skipped exactly once).
  const goToTab = useCallback((tab: DayTabKey, fieldPath?: string) => {
    const flushed = flushAllDrafts();
    if (flushed.rejected.length > 0 || flushed.unapplied > 0) return;
    modeRef.current = tab;
    setMode(tab);
    if (fieldPath) {
      skipNextModeFocusRef.current = true;
      focusTokenRef.current += 1;
      setFocusRequest({ fieldPath, token: focusTokenRef.current });
    } else {
      setFocusRequest(null);
    }
    if (dayId && typeof window !== 'undefined') {
      const nextHash = sectionHash(dayId, tab, fieldPath);
      if (window.location.hash !== nextHash) window.location.hash = nextHash;
    }
  }, [dayId]);

  // The hash QUERY (everything after `?`), synced on `hashchange`. A cross-day Fix link changes the day
  // id (which `useDayIdFromUrl` already tracks), but a SAME-day batch Fix link changes ONLY the query —
  // `useDayIdFromUrl` strips the query and bails on an unchanged id, so the routing effect below would
  // not see it without this dedicated subscription. Initialized synchronously from the current hash.
  const [repairQuery, setRepairQuery] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] || ''
  );
  useEffect(() => {
    const sync = () => setRepairQuery(window.location.hash.split('?')[1] || '');
    sync(); // re-read in case the hash changed between the lazy initializer and this attach
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // A repair deep-link (`#/day/:id?field=…&step=…`, emitted by the export-preview batch "Fix in …"
  // links) lands the user on the issue's OWNING tab + field, routing through the SAME `goToTab` the
  // in-page readiness "Fix" uses. The explicit `step` is PREFERRED over inferring the step from the
  // field name, because some issues route to a step their field name would not infer (e.g.
  // `unpinned_configuration` → `devices`, field `configurationVersion`, which alone infers the
  // `validation` catch-all). Keyed on `repairQuery` (not just `dayId`) so a SAME-day query-only change
  // (the user already on this day's Export panel) still re-fires. Re-fires once per (day, step, field)
  // so it can't fight a subsequent user tab click; a step with no day-tab no-ops.
  const lastFieldRouteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dayId || !day || !animal) return;
    // Ignore query strings belonging to another route. A repair handoff to Animal Setup can leave
    // this component mounted until the router's next render; treating its `?field=` as a same-day
    // repair would rewrite the destination back to the Day Editor.
    const currentPath = window.location.hash.split('?')[0];
    if (currentPath !== `#/day/${encodeURIComponent(dayId)}`) return;
    const params = new URLSearchParams(repairQuery);
    const field = params.get('field');
    const stepParam = params.get('step');
    const sectionParam = params.get('section');
    if (!field && !stepParam && !sectionParam) {
      lastFieldRouteRef.current = null;
      modeRef.current = 'daily';
      setMode('daily');
      setFocusRequest(null);
      return;
    }
    const routeKey = `${dayId}::${sectionParam ?? ''}::${stepParam ?? ''}::${field ?? ''}`;
    if (lastFieldRouteRef.current === routeKey) return;
    lastFieldRouteRef.current = routeKey;
    const explicitSection = sectionParam && TAB_ORDER.includes(sectionParam as DayTabKey)
      ? sectionParam as DayTabKey
      : null;
    const step = stepParam || stepIdForIssue({ path: field ?? '' });
    const tab = explicitSection ?? sectionForRepair(step, field ?? undefined);
    if (!tab) return;
    const flushed = flushAllDrafts();
    if (flushed.rejected.length > 0 || flushed.unapplied > 0) return;
    modeRef.current = tab;
    setMode(tab);
    if (field) {
      skipNextModeFocusRef.current = true;
      focusTokenRef.current += 1;
      setFocusRequest({ fieldPath: focusPathForSection(field) ?? field, token: focusTokenRef.current });
    } else {
      setFocusRequest(null);
    }
    // Normalize legacy `?step=` deep links without adding a second browser-history entry.
    const canonical = sectionHash(dayId, tab, field ?? undefined);
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
  }, [dayId, day, animal, repairQuery]);

  // Alt+←/→ steps through the sections and CLAMPS at the ends (it does not wrap), matching the
  // former stepper's section pager.
  const stepTab = useCallback((direction: 'next' | 'prev') => {
    const idx = TAB_ORDER.indexOf(modeRef.current);
    const base = idx < 0 ? 0 : idx;
    const next = direction === 'next'
      ? TAB_ORDER[Math.min(base + 1, TAB_ORDER.length - 1)]
      : TAB_ORDER[Math.max(base - 1, 0)];
    goToTab(next);
  }, [goToTab]);
  useStepperShortcut(
    useCallback((action: 'next' | 'prev' | 'add') => {
      if (action === 'next' || action === 'prev') stepTab(action);
    }, [stepTab])
  );

  // ── Writers + repairs (mirrors the former stepper) ──
  const handleFieldUpdate = useCallback((fieldPath: string, value: unknown) => {
    if (!day || !dayId) return;
    return actions.updateDayField(dayId, fieldPath, value);
  }, [day, dayId, actions]);

  const handleFieldsUpdate = useCallback((
    changes: ReadonlyArray<readonly [fieldPath: string, value: unknown]>
  ) => {
    if (!day || !dayId) return;
    return actions.updateDayFields(dayId, changes);
  }, [day, dayId, actions]);

  const handleRepair = useCallback((issue: RepairableIssue) => {
    if (!issue?.repairCommand) return;
    const command = issue.repairCommand as RepairCommand;
    applyRepairCommand(command, {
      actions,
      animalId: ownerKey,
      dayId,
      day,
      animal,
    } as unknown as RepairCommandContext);
  }, [actions, animal, ownerKey, dayId, day]);

  // The readiness bar / Export-panel "Fix" routing: an executable repair runs in place; an
  // animal-surface issue deep-links the owning setup tab; a day-surface issue switches to the tab
  // that folds the owning step and focuses the field.
  const handleFix = useCallback((issue: RepairableIssue) => {
    if (issue?.repairCommand) {
      handleRepair(issue);
      return;
    }
    const target = repairTargetForIssue(issue);
    const focusPath = issue.focusPath || issue.path || issue.instancePath;
    if (target.surface === 'animal') {
      if (ownerKey != null) {
        const base = `#/animal/${encodeURIComponent(ownerKey)}`;
        window.location.hash = focusPath
          ? `${base}/${animalSetupTabForFieldPath(focusPath).tab}?field=${encodeURIComponent(focusPath)}`
          : `${base}/days`;
      }
      return;
    }
    if (target.surface === 'day') {
      const tab = sectionForRepair(target.step, focusPath);
      if (tab) goToTab(tab, focusPathForSection(focusPath));
    }
    // A `none`/validation/export issue has no in-tab field to focus; the message is shown in the bar.
  }, [handleRepair, ownerKey, goToTab]);

  // Whether an issue has an actionable in-app fix — mirrors `handleFix`'s action branches exactly, so
  // the readiness bar only renders a "Fix" button for issues a click can actually route (an
  // executable repair, an animal-surface deep-link, or a day-surface issue a tab folds). A
  // `none`-surface or catch-all-`validation` issue shows its message without a dead button.
  const canFixIssue = useCallback((issue: RepairableIssue) => {
    if (issue?.repairCommand) return true;
    const target = repairTargetForIssue(issue);
    if (target.surface === 'animal') return true;
    if (target.surface === 'day') {
      const focusPath = issue.focusPath || issue.path || issue.instancePath;
      return sectionForRepair(target.step, focusPath) != null;
    }
    return false;
  }, []);

  // Early returns AFTER all hooks. The not-found message comes from the view-model's shell state.
  if (!dayId || !day || !animal) {
    return <ErrorState message={vm.shell.message ?? ''} />;
  }

  const dayEditorContextValue: DayEditorBundle = {
    animal,
    day,
    mergedDay: mergedDay as Record<string, unknown>,
    animalDays,
    onFieldUpdate: handleFieldUpdate,
    onFieldsUpdate: handleFieldsUpdate,
    actions,
    animalKey: ownerKey as string,
  };

  const chips = vm.chips;
  const dioCopyableSources: CopyableDioSource[] = copyableDioSources;
  const showReadinessBar = mode !== 'export';

  return (
    <div className="day-editor-stepper">
      {/* Plain div, not <header>: a <header> here maps to the banner landmark, duplicating AppLayout's. */}
      <div className={styles.frameHeader}>
        <Breadcrumb items={vm.breadcrumb.items.slice(0, 2)} />
        <div className={styles.topRow}>
          <div>
            <h1 className={styles.title}>{ownerKey} · {day.date}</h1>
            <div className={styles.saveRow}>
              <SaveIndicator persistence={persistence} />
              {(chips.lifecycle === 'exported' || chips.lifecycle === 'changed_since_export') && (
                <span className={styles.downloadStatus}>{DAY_LIFECYCLE_LABEL[chips.lifecycle]}</span>
              )}
            </div>
          </div>

        </div>

        {showReadinessBar && (
          <ReadinessBar issues={readinessIssues} onFix={handleFix} canFix={canFixIssue}
            exportGate={vm.export} onReview={() => goToTab('export')} />
        )}
      </div>

      <div className="day-editor-body">
        <DayEditorSectionNav groups={vm.sectionGroups} onNavigate={(section) => goToTab(section as DayTabKey)} />

        <main
          id="main-content"
          className="day-editor-content"
          role="main"
          aria-label="Day editor"
          tabIndex={-1}
        >
          <DayEditorProvider value={dayEditorContextValue}>
            {(mode === 'daily' || mode === 'tasks') && (
              <DayTab
                {...dayEditorContextValue}
                // DayTab's onRepair is typed `(issue: unknown)`; it forwards the RawCorruptionBanner's
                // issue (which carries a repairCommand) — narrow it to the executor's input.
                onRepair={(issue) => handleRepair(issue as RepairableIssue)}
                focusRequest={focusRequest}
                overviewFields={vm.overview.fields}
                onGoToRecordingSetup={() => goToTab('recording')}
              />
            )}
            {mode === 'recording' && (
              <RecordingSetupSection
                {...dayEditorContextValue}
                badChannelMarks={vm.badChannels.marks}
                focusRequest={focusRequest}
              />
            )}
            {mode === 'channels' && (
              <FailedChannelsSection
                {...dayEditorContextValue}
                badChannelMarks={vm.badChannels.marks}
                focusRequest={focusRequest}
              />
            )}
            {mode === 'dio' && (
              <section className="day-editor-section recording-dio-section">
                <DioTab
                  {...dayEditorContextValue}
                  copyableDioSources={dioCopyableSources}
                  carriedFrom={chips.carriedFrom}
                />
              </section>
            )}
            {mode === 'export' && (
              <ExportPreview
                {...dayEditorContextValue}
                workspace={model.workspace}
                issues={vm.issues}
                exportGate={vm.export}
                hasPendingDrafts={persistence.hasPendingDrafts}
                // The blocked list dispatches an executable repair; run it in place. (Its
                // RepairDispatch carries the repairCommand the executor reads.)
                onRepair={(dispatch) => handleRepair(dispatch as unknown as RepairableIssue)}
                onNavigate={(stepId, fieldPath) => {
                  // An 'animal' target deep-links the owning animal-setup tab (geometry/cameras/etc.
                  // are animal-owned), mirroring the former stepper; a day-step target switches to
                  // the tab that folds it and focuses the field.
                  if (stepId === 'animal') {
                    if (ownerKey != null) {
                      const base = `#/animal/${encodeURIComponent(ownerKey)}`;
                      window.location.hash = fieldPath
                        ? `${base}/${animalSetupTabForFieldPath(fieldPath).tab}?field=${encodeURIComponent(fieldPath)}`
                        : `${base}/days`;
                    }
                    return;
                  }
                  const tab = sectionForRepair(stepId, fieldPath);
                  if (tab) goToTab(tab, focusPathForSection(fieldPath));
                }}
              />
            )}
          </DayEditorProvider>
        </main>
      </div>
    </div>
  );
}
