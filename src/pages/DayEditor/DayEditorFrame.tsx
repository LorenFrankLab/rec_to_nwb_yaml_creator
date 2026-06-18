import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ComponentProps } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useDayIdFromUrl } from '../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import {
  getCopyableDioSources,
  resolveDayOwner,
} from '../../state/workspaceSelectors';
import { applyRepairCommand } from '../../state/repairCommands';
import type { RepairCommand, RepairCommandContext } from '../../state/repairCommands';
import { animalSetupTabForFieldPath } from '../../domain/validation';
import { repairTargetForIssue, stepIdForIssue } from '../../domain/repairRouting';
import type { RepairableIssue } from '../../domain/repairRouting';
import { validateDay } from '../../domain/dayValidationComposer';
import {
  isDayValidationDeferred,
  presentValidationIssues,
} from '../../domain/validationPresentation';
import { buildDayEditorViewModel } from '../../viewModels/dayEditorViewModel';
import type { DayTabKey } from '../../viewModels/dayEditorViewModel';
import { buildAnimalViewModel } from '../../viewModels/animalViewModel';
import Breadcrumb from './Breadcrumb';
import StatusPill from '../../components/ui/StatusPill';
import AnimalScopeCard from '../../components/AnimalScopeCard';
import type { AnimalScopeSummary } from '../../components/AnimalScopeCard';
import ReadinessBar from '../../components/ReadinessBar';
import { DayEditorProvider } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import SaveIndicator from './SaveIndicator';
import DayTab from './DayTab';
import DayFilesWeightSection from './DayFilesWeightSection';
import FailedChannelsTab from './FailedChannelsTab';
import EpochsTab from './EpochsTab';
import DioTab from './DioTab';
import ExportPreview from './ExportPreview';
import DayEditorSectionNav from './DayEditorSectionNav';
import type { CopyableDioSource } from './BehavioralEventsDisplay';
import ErrorState from './ErrorState';
import styles from './DayEditorFrame.module.css';

/** A repair-routed focus request: the target field path + a monotonic token to retrigger the effect. */
interface FocusRequest {
  fieldPath: string;
  token: number;
}

/** The frame's main-content modes: one of the five IA sections. */
type FrameMode = DayTabKey;

/** The five sections' fixed order (drives the Alt+←/→ cycle). */
const TAB_ORDER: DayTabKey[] = ['overview', 'files', 'devices', 'epochs', 'finish'];

/**
 * An underlying step key → the tab that folds it, for routing a repair (which targets the old step
 * keys) to its Phase 15 section. Behavioral/DIO folds into RECORDING, and validation/export fold
 * into the finish panel.
 */
const TAB_FOR_STEP: Record<string, DayTabKey | null> = {
  overview: 'overview',
  devices: 'devices',
  epochs: 'epochs',
  behavioral: 'devices',
  validation: 'finish',
  export: 'finish',
};

/** Presentation-only repair routing for fields that moved to new Phase 15 sections. */
function sectionForRepair(step: string | null | undefined, focusPath?: string): DayTabKey | null {
  const path = focusPath ?? '';
  if (path.startsWith('associated_files')) return 'files';
  if (path === 'subject.weight' || path === 'session.weight') return 'files';
  return TAB_FOR_STEP[step ?? ''] ?? null;
}

/** The field path rendered by the section, when it differs from the validation/export path. */
function focusPathForSection(path?: string): string | undefined {
  if (path === 'subject.weight') return 'session.weight';
  return path;
}

/** Map the animal-static summary view-model to the AnimalScopeCard's render contract. */
function toScopeSummary(summary: ReturnType<typeof buildAnimalViewModel>['summary']): AnimalScopeSummary {
  const identity =
    [summary.genotype, summary.sex, summary.species].filter(Boolean).join(' · ') || summary.id;
  const probes =
    summary.probeCount > 0
      ? `${summary.probeCount} probe${summary.probeCount === 1 ? '' : 's'}` +
        (summary.probeSummary ? ` · ${summary.probeSummary}` : '')
      : 'No probes';
  const config = summary.configVersion != null ? `v${summary.configVersion}` : '—';
  return { identity, probes, config, team: summary.team || '—' };
}

/**
 * DayEditorFrame — the day editor's chrome (replaces the former DayEditorStepper's 6-section nav).
 *
 * The header carries the Workspace › Animal › Day breadcrumb, the date title, the day chips
 * (configuration version · opto · "carried from <date>" · the lifecycle StatusPill), the autosave
 * indicator, the read-only {@link AnimalScopeCard} (the animal-static scope boundary), and the
 * issue-driven {@link ReadinessBar} (fed the authoritative `validateDay` issues — never a local
 * check). The body is a grouped vertical rail — SESSION / RECORDING / FINISH — with free navigation
 * and Alt+←/→; the panels read their data through {@link DayEditorProvider} (NOT props), so the
 * provider must wrap them. A header **Export** action opens the Validation & Export section (the
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
  const [mode, setMode] = useState<FrameMode>('overview');

  const day = model.workspace?.days?.[dayId as string];
  const { ownerKey, animal } = resolveDayOwner(model.workspace, dayId);

  // Merge animal + day for validation (before early returns, per Rules of Hooks). The merge throws
  // BY DESIGN on a malformed animal (missing/non-array configurationHistory); tolerate it so the
  // frame renders fail-closed (the readiness bar surfaces the merge-error blocker) instead of crashing.
  const mergedDay = useMemo(() => {
    if (!animal || !day) return null;
    try {
      return mergeDayMetadata(animal, day);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[day-editor] could not merge day "${dayId}" with its animal config:`, err);
      return null;
    }
  }, [animal, day, dayId]);

  const animalDays = selectors.getAnimalDays(ownerKey as string);

  const copyableDioSources = useMemo(
    () => getCopyableDioSources(model.workspace, ownerKey as string),
    [model.workspace, ownerKey]
  );

  // The day-editor view-model: chips, grouped rail, breadcrumb, the Overview field slice, and the
  // bad-channel marks — all from the SAME builder, so the frame is a thin renderer.
  const vm = useMemo(
    () => buildDayEditorViewModel(model.workspace, dayId, mode),
    [model.workspace, dayId, mode]
  );

  // The animal-static scope summary (read-only scope card). Built from the animal view-model so the
  // card can never disagree with the animal page.
  const scopeSummary = useMemo(
    () => (ownerKey != null ? toScopeSummary(buildAnimalViewModel(model.workspace, ownerKey, 'days').summary) : null),
    [model.workspace, ownerKey]
  );

  // The issue-driven readiness bar's input: the AUTHORITATIVE `validateDay` (never a local re-check).
  // Mirrors the view-model exactly — on a merge failure (null mergedDay) it validates the empty
  // merged model, so the raw-shape animal blockers (e.g. a missing configuration history with its
  // executable "Rebuild" repair) still surface and stay fixable. A validation contract violation is
  // caught and surfaced as a single blocker rather than white-screening the editor.
  const readinessIssues = useMemo<RepairableIssue[]>(() => {
    if (!day || !animal) return [];
    try {
      const issues = validateDay(
        day as unknown as Record<string, unknown>,
        mergedDay ?? {},
        animal,
        animalDays
      ) as RepairableIssue[];
      return presentValidationIssues(issues, day) as RepairableIssue[];
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[day-editor] could not validate day "${dayId}":`, err);
      return [
        { severity: 'error', code: 'day_validation_failed', message: 'This day could not be validated.' } as RepairableIssue,
      ];
    }
  }, [day, animal, mergedDay, animalDays, dayId]);

  useEffect(() => {
    if (!dayId || !day || !isDayValidationDeferred(day)) return;
    const state =
      day.state !== null && typeof day.state === 'object' && !Array.isArray(day.state)
        ? (day.state as Record<string, unknown>)
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
    setMode(tab);
    if (fieldPath) {
      skipNextModeFocusRef.current = true;
      focusTokenRef.current += 1;
      setFocusRequest({ fieldPath, token: focusTokenRef.current });
    } else {
      setFocusRequest(null);
    }
  }, []);

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
    const params = new URLSearchParams(repairQuery);
    const field = params.get('field');
    const stepParam = params.get('step');
    if (!field && !stepParam) {
      lastFieldRouteRef.current = null;
      return;
    }
    const routeKey = `${dayId}::${stepParam ?? ''}::${field ?? ''}`;
    if (lastFieldRouteRef.current === routeKey) return;
    lastFieldRouteRef.current = routeKey;
    const step = stepParam || stepIdForIssue({ path: field ?? '' });
    const tab = sectionForRepair(step, field ?? undefined);
    if (tab) goToTab(tab, focusPathForSection(field ?? undefined));
  }, [dayId, day, animal, repairQuery, goToTab]);

  // Alt+←/→ steps through the five sections and CLAMPS at the ends (it does not wrap), matching the
  // former stepper's section pager.
  const stepTab = useCallback((direction: 'next' | 'prev') => {
    setMode((cur) => {
      const idx = TAB_ORDER.indexOf(cur as DayTabKey);
      const base = idx < 0 ? 0 : idx;
      if (direction === 'next') return TAB_ORDER[Math.min(base + 1, TAB_ORDER.length - 1)];
      return TAB_ORDER[Math.max(base - 1, 0)];
    });
  }, []);
  useStepperShortcut(
    useCallback((action: 'next' | 'prev' | 'add') => {
      if (action === 'next' || action === 'prev') stepTab(action);
    }, [stepTab])
  );

  // ── Writers + repairs (mirrors the former stepper) ──
  const handleFieldUpdate = useCallback((fieldPath: string, value: unknown) => {
    if (!day || !dayId) return;
    const pathSegments = fieldPath.split('.');
    const updated = structuredClone(day) as Record<string, unknown>;
    let target: Record<string, unknown> = updated;
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      const child = target[segment];
      if (child === null || typeof child !== 'object' || Array.isArray(child)) {
        target[segment] = {};
      }
      target = target[segment] as Record<string, unknown>;
    }
    target[pathSegments[pathSegments.length - 1]] = value;
    const topLevelKey = pathSegments[0];
    actions.updateDay(dayId, { [topLevelKey]: updated[topLevelKey] });
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
    actions: actions as unknown as Record<string, unknown>,
    animalKey: ownerKey as string,
  };

  const chips = vm.chips;
  const dioCopyableSources: CopyableDioSource[] = copyableDioSources;

  return (
    <div className="day-editor-stepper">
      {/* Plain div, not <header>: a <header> here maps to the banner landmark, duplicating AppLayout's. */}
      <div className={styles.frameHeader}>
        <div className={styles.topRow}>
          <Breadcrumb items={vm.breadcrumb.items} />
          <div className={styles.headerActions}>
            <SaveIndicator persistence={persistence} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => setMode('finish')}
              aria-pressed={mode === 'finish'}
            >
              Export
            </button>
          </div>
        </div>

        <h1 className={styles.title}>Day Editor: {ownerKey} - {day.date}</h1>

        <div className={styles.chips}>
          {chips.configVersion != null && (
            <span className={styles.chip}>Configuration v{chips.configVersion}</span>
          )}
          {chips.isOpto && <span className={`${styles.chip} ${styles.chipOpto}`}>◑ Optogenetics</span>}
          {chips.carriedFrom && (
            <span className={`${styles.chip} ${styles.chipCarry}`}>↩ carried from {chips.carriedFrom}</span>
          )}
          <StatusPill
            variant={chips.lifecycle as ComponentProps<typeof StatusPill>['variant']}
            label={chips.lifecycle === 'ready' ? 'Ready' : undefined}
          />
        </div>

        {scopeSummary && (
          <AnimalScopeCard summary={scopeSummary} editHref={`#/animal/${ownerKey}/days`} />
        )}

        <ReadinessBar issues={readinessIssues} onFix={handleFix} canFix={canFixIssue} />
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
            {mode === 'overview' && (
              <DayTab
                {...dayEditorContextValue}
                // DayTab's onRepair is typed `(issue: unknown)`; it forwards the RawCorruptionBanner's
                // issue (which carries a repairCommand) — narrow it to the executor's input.
                onRepair={(issue) => handleRepair(issue as RepairableIssue)}
                focusRequest={focusRequest}
                overviewFields={vm.overview.fields}
              />
            )}
            {mode === 'files' && (
              <DayFilesWeightSection
                {...dayEditorContextValue}
                overviewFields={vm.overview.fields}
              />
            )}
            {mode === 'epochs' && <EpochsTab {...dayEditorContextValue} focusRequest={focusRequest} />}
            {mode === 'devices' && (
              <>
                <FailedChannelsTab {...dayEditorContextValue} badChannelMarks={vm.badChannels.marks} />
                <section className="day-editor-section recording-dio-section">
                  <DioTab
                    {...dayEditorContextValue}
                    copyableDioSources={dioCopyableSources}
                    carriedFrom={chips.carriedFrom}
                  />
                </section>
              </>
            )}
            {mode === 'finish' && (
              <ExportPreview
                {...dayEditorContextValue}
                workspace={model.workspace}
                issues={vm.issues}
                exportGate={vm.export}
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
