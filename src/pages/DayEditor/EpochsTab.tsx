import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfirmDialog } from '../../components/Modal';
import { useUndoToast } from '../../components/ui/UndoToast';
import { EpochStatusPill } from '../../components/ui/StatusPill';
import GeneratedValue from '../../components/ui/GeneratedValue';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import TaskTypeModal from '../AnimalEditor/TaskTypeModal';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import { buildEpochGrid } from '../../viewModels/epochGridViewModel';
import type { EpochGridRow } from '../../viewModels/epochGridViewModel';
import {
  addEpochToTask,
  removeEpoch,
  duplicateEpoch,
  setEpochTask,
  swapEpochs,
  insertEpochAfter,
  swapEpochRemap,
  insertAfterRemap,
  remapEpochRefs,
  remapVideolessEpochs,
  removeVideolessEpoch,
  epochsOrphanedBy,
  nextEpochNumber,
} from '../../domain/epochOperations';
import type { OrphanedReferences } from '../../domain/epochOperations';
import {
  deriveStatescriptName,
  deriveStatescriptPath,
  deriveVideoName,
  isDerivedVideo,
} from '../../domain/fileNaming';
import {
  getAnimalCameras,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayDeferredEpochs,
  getDayFsGuiYamls,
  getDayVideolessEpochs,
} from '../../state/workspaceSelectors';
import { preserveInlineTaskDefinitions, resolveDayCatalogView } from '../../state/dayTaskCatalog';
import { addTaskType, nextTaskTypeId } from '../../state/taskCatalogActions';
import type { TaskTypeDefinitionInput } from '../../state/taskCatalogActions';
import type { TaskInstance, TaskType, Camera } from '../../state/workspaceTypes';
import styles from './EpochsTab.module.css';

/** A repair-routed focus request from the frame (`{ fieldPath, token }`). */
interface FocusRequest {
  fieldPath: string;
  token: number;
}

/** A pending instance-array edit awaiting orphan-repair confirmation. */
interface PendingOrphan extends OrphanedReferences {
  nextInstances: TaskInstance[];
}

/** Parse an `epoch-<n>-video` repair focus path → the epoch number (or null). */
function epochFromFocusPath(fieldPath: string | undefined): number | null {
  const match = /^epoch-(\d+)-/.exec(fieldPath ?? '');
  return match ? Number(match[1]) : null;
}

/** Resolve a camera id to its display name (falls back to "camera <id>"). */
function cameraName(cameras: Camera[], id: number | string): string {
  const cam = cameras.find((c) => c?.id === id || String(c?.id) === String(id));
  return cam?.camera_name || `camera ${id}`;
}

/** Compact display for task-definition values inside the collision review notice. */
function formatDefinitionValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => String(item)).join(', ')}]`;
  if (value === undefined || value === null || value === '') return '(blank)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** The exported fields most useful when comparing an inline task with a catalog task type. */
function taskDefinitionSummary(definition: Record<string, unknown>): string {
  return [
    `description: ${formatDefinitionValue(definition.task_description)}`,
    `environment: ${formatDefinitionValue(definition.task_environment)}`,
    `cameras: ${formatDefinitionValue(definition.camera_id)}`,
  ].join('; ');
}

function taskInstanceEpochs(instances: TaskInstance[]): Set<number> {
  const epochs = new Set<number>();
  instances.forEach((instance) => {
    (Array.isArray(instance.task_epochs) ? instance.task_epochs : []).forEach((value) => {
      const n = Number(value);
      if (Number.isInteger(n)) epochs.add(n);
    });
  });
  return epochs;
}

/**
 * EpochsTab — the epoch grid (Phase 4), the day editor's spine. A pure-view-model-driven table with
 * one row per epoch (Edit + Task + Camera(s) + Statescript-naming + Video-presence + Opto + Status)
 * and a per-epoch drill-in (Epoch task / Files for this epoch / Optogenetics). Every edit maps to an
 * {@link updateDay} patch over the day's EXISTING arrays via the pure {@link buildEpochGrid} join +
 * {@link module:domain/epochOperations} transforms — storage/export are unchanged. Replaces the
 * `TasksEpochsStep` bridge.
 */
export default function EpochsTab(props: DayEditorBundle & { focusRequest?: FocusRequest | null }) {
  const { animal, day, animalDays = [], onFieldUpdate, actions = undefined, animalKey = undefined } =
    useDayEditorContext(props);
  const ownerKey = animalKey ?? (animal as { id?: string })?.id;
  const focusRequest = props.focusRequest ?? null;

  const grid = buildEpochGrid(animal, day);
  const view = resolveDayCatalogView(animal, day);
  const cameras = getAnimalCameras(animal);
  const unresolvedTaskCatalogDivergence = view.derived && view.divergences.length > 0;

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [pendingOrphan, setPendingOrphan] = useState<PendingOrphan | null>(null);
  const [quickAddEpoch, setQuickAddEpoch] = useState<number | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [menuEpoch, setMenuEpoch] = useState<number | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  // Epochs whose statescript/video name is being manually overridden (UI mode; GeneratedValue's
  // `derived` flag is consumer-driven). A name only becomes stored-manual once the user types.
  const [manualStatescript, setManualStatescript] = useState<Set<number>>(new Set());
  const [manualVideo, setManualVideo] = useState<Set<string>>(new Set());
  const { show: showToast, node: toastNode } = useUndoToast();

  // Alt+N (the stepper "add" intent) opens the template menu — the grid's primary add affordance.
  useStepperShortcut(useCallback((action) => { if (action === 'add') setTemplateOpen(true); }, []));

  // Repair landing: expand the targeted epoch (the frame's focus effect then focuses the control).
  useEffect(() => {
    const epoch = epochFromFocusPath(focusRequest?.fieldPath);
    if (epoch != null) setExpanded((prev) => new Set(prev).add(epoch));
  }, [focusRequest]);

  // Close any open popup menu on an outside click.
  useEffect(() => {
    if (menuEpoch == null && !templateOpen) return undefined;
    const close = () => {
      setMenuEpoch(null);
      setTemplateOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuEpoch, templateOpen]);

  const statePatch = useCallback((patch: Record<string, unknown>, sourceDay = day) => {
    const state = (sourceDay as { state?: unknown }).state;
    const base =
      state !== null && typeof state === 'object' && !Array.isArray(state)
        ? (state as Record<string, unknown>)
        : {};
    return { ...base, validationDeferred: false, ...patch };
  }, [day]);

  const statePatchWithVideoless = useCallback((videolessEpochs: number[], sourceDay = day) =>
    statePatch({ videolessEpochs }, sourceDay), [day, statePatch]);

  const clearDeferredEpoch = useCallback((epoch: number) => {
    const current = getDayDeferredEpochs(day);
    if (!current.includes(epoch)) return;
    onFieldUpdate('state', statePatch({ deferredEpochs: current.filter((e) => e !== epoch) }));
  }, [day, onFieldUpdate, statePatch]);

  const toggle = useCallback((epoch: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(epoch)) next.delete(epoch);
      else {
        next.add(epoch);
        clearDeferredEpoch(epoch);
      }
      return next;
    });
  }, [clearDeferredEpoch]);

  /**
   * Persist a next instance array (and an optionally-extended catalog), retiring inline `day.tasks`
   * the first time a derived/legacy day is edited into the catalog. Mirrors the former
   * TasksEpochsStep write path.
   */
  const applyCommit = useCallback(
    (
      nextInstances: TaskInstance[],
      nextTaskTypes: TaskType[],
      repair: boolean,
      allowTaskCatalogDivergence = false,
      options: { trackAddedEpochs?: boolean } = {}
    ) => {
      if (unresolvedTaskCatalogDivergence && !allowTaskCatalogDivergence) return;
      if (nextTaskTypes !== view.taskTypes && actions?.updateAnimal && ownerKey) {
        (actions.updateAnimal as (id: string, patch: Record<string, unknown>) => void)(ownerKey, {
          taskTypes: nextTaskTypes,
        });
      }
      onFieldUpdate('taskInstances', nextInstances);
      const currentEpochs = taskInstanceEpochs(view.taskInstances);
      const addedEpochs = [...taskInstanceEpochs(nextInstances)].filter((epoch) => !currentEpochs.has(epoch));
      if ((options.trackAddedEpochs ?? true) && addedEpochs.length > 0) {
        const currentDeferred = getDayDeferredEpochs(day);
        onFieldUpdate('state', statePatch({ deferredEpochs: [...new Set([...currentDeferred, ...addedEpochs])] }));
      }
      if (view.derived && Array.isArray((day as { tasks?: unknown[] }).tasks) && (day as { tasks: unknown[] }).tasks.length > 0) {
        onFieldUpdate('tasks', []);
      }
      if (repair) {
        const valid = new Set<number>();
        nextInstances.forEach((i) =>
          (Array.isArray(i.task_epochs) ? i.task_epochs : []).forEach((e) => valid.add(Number(e)))
        );
        const clear = <T extends { task_epochs?: number | string }>(entries: T[]) =>
          entries.map((entry) =>
            entry.task_epochs !== '' && entry.task_epochs != null && !valid.has(Number(entry.task_epochs))
              ? { ...entry, task_epochs: '' }
              : entry
          );
        onFieldUpdate('associated_video_files', clear(getDayAssociatedVideos(day)));
        onFieldUpdate('associated_files', clear(getDayAssociatedFiles(day)));
      }
    },
    [
      unresolvedTaskCatalogDivergence,
      view.taskTypes,
      view.taskInstances,
      view.derived,
      actions,
      ownerKey,
      onFieldUpdate,
      day,
      statePatch,
    ]
  );

  const keepCatalogDefinition = useCallback(() => {
    applyCommit(view.taskInstances, view.taskTypes, false, true);
  }, [applyCommit, view.taskInstances, view.taskTypes]);

  const keepDayValues = useCallback(() => {
    const preserved = preserveInlineTaskDefinitions(animal, day);
    applyCommit(preserved.taskInstances, preserved.taskTypes, false, true);
  }, [animal, day, applyCommit]);

  /**
   * Commit a next instance set, prompting for orphan repair first when the edit would strand a bound
   * video/file ref. Confirm-before-orphan; never auto-scrubs.
   */
  const commit = useCallback(
    (nextInstances: TaskInstance[], nextTaskTypes: TaskType[] = view.taskTypes) => {
      if (unresolvedTaskCatalogDivergence) return;
      const { videos, files } = epochsOrphanedBy(day, nextInstances);
      if (videos.length === 0 && files.length === 0) {
        applyCommit(nextInstances, nextTaskTypes, false);
        return;
      }
      // The pending edit may also extend the catalog (a quick-add type); stash it for the confirm.
      pendingTypesRef.current = nextTaskTypes;
      setPendingOrphan({ nextInstances, videos, files });
    },
    [unresolvedTaskCatalogDivergence, view.taskTypes, day, applyCommit]
  );
  const pendingTypesRef = useRef<TaskType[]>(view.taskTypes);
  // A callback to run AFTER a pending orphan-repair is confirmed (e.g. the delete's undo toast — it
  // must fire only once the delete is actually committed, not while the confirm dialog is still open).
  const pendingAfterRef = useRef<(() => void) | null>(null);

  // ── Task / epoch write-backs (instance-array transforms) ──
  const reassignTask = (epoch: number, taskTypeId: string) => {
    clearDeferredEpoch(epoch);
    commit(setEpochTask(view.taskInstances, epoch, taskTypeId));
  };
  const onDuplicate = (epoch: number) => commit(duplicateEpoch(view.taskInstances, epoch));

  // A renumber (insert / move) shifts epoch numbers, so the day's bound file/video/fs_gui refs are
  // remapped in LOCKSTEP — each follows its task content to the new epoch number instead of being
  // silently re-pointed at a different task. Because the refs follow, the edit creates no orphan
  // (no confirm needed); only the arrays that actually change are written.
  const renumberCommit = (nextInstances: TaskInstance[], remap: Map<number, number>, insertedEpoch?: number) => {
    if (unresolvedTaskCatalogDivergence) return;
    const stateUpdates: Record<string, unknown> = {};
    if (remap.size > 0) {
      const refs = remapEpochRefs(day, remap);
      const videos = getDayAssociatedVideos(day);
      const files = getDayAssociatedFiles(day);
      const fsgui = getDayFsGuiYamls(day);
      if (JSON.stringify(refs.associated_video_files) !== JSON.stringify(videos)) {
        onFieldUpdate('associated_video_files', refs.associated_video_files);
      }
      if (JSON.stringify(refs.associated_files) !== JSON.stringify(files)) {
        onFieldUpdate('associated_files', refs.associated_files);
      }
      if (JSON.stringify(refs.fs_gui_yamls) !== JSON.stringify(fsgui)) {
        onFieldUpdate('fs_gui_yamls', refs.fs_gui_yamls);
      }
      const videoless = getDayVideolessEpochs(day);
      const nextVideoless = remapVideolessEpochs(videoless, remap);
      const deferred = getDayDeferredEpochs(day);
      const nextDeferred = remapVideolessEpochs(deferred, remap);
      if (
        JSON.stringify(nextVideoless) !== JSON.stringify(videoless) ||
        JSON.stringify(nextDeferred) !== JSON.stringify(deferred)
      ) {
        stateUpdates.videolessEpochs = nextVideoless;
        stateUpdates.deferredEpochs = nextDeferred;
      }
    }
    if (insertedEpoch != null) {
      const deferred = Array.isArray(stateUpdates.deferredEpochs)
        ? stateUpdates.deferredEpochs as number[]
        : getDayDeferredEpochs(day);
      stateUpdates.deferredEpochs = [...new Set([...deferred, insertedEpoch])];
    }
    applyCommit(nextInstances, view.taskTypes, false, false, { trackAddedEpochs: false });
    if (Object.keys(stateUpdates).length > 0) {
      onFieldUpdate('state', statePatch(stateUpdates));
    }
  };
  const onInsertAfter = (epoch: number) =>
    renumberCommit(insertEpochAfter(view.taskInstances, epoch), insertAfterRemap(view.taskInstances, epoch), epoch + 1);
  const onMove = (epoch: number, dir: 'up' | 'down') => {
    const other = dir === 'up' ? epoch - 1 : epoch + 1;
    if (grid.rows.some((r) => r.epoch === other)) {
      renumberCommit(swapEpochs(view.taskInstances, epoch, other), swapEpochRemap(epoch, other));
    }
  };
  const onDelete = (epoch: number) => {
    if (unresolvedTaskCatalogDivergence) return;
    const next = removeEpoch(view.taskInstances, epoch);
    const { videos, files } = epochsOrphanedBy(day, next);
    // Snapshot everything an Undo must restore — the instances AND any refs the orphan repair clears.
    const snapInstances = view.taskInstances;
    const snapVideos = getDayAssociatedVideos(day);
    const snapFiles = getDayAssociatedFiles(day);
    const snapVideoless = getDayVideolessEpochs(day);
    const snapDeferred = getDayDeferredEpochs(day);
    const nextVideoless = removeVideolessEpoch(snapVideoless, epoch);
    const nextDeferred = removeVideolessEpoch(snapDeferred, epoch);
    const videolessChanged = JSON.stringify(nextVideoless) !== JSON.stringify(snapVideoless);
    const deferredChanged = JSON.stringify(nextDeferred) !== JSON.stringify(snapDeferred);
    const writeDeletedState = () => {
      if (videolessChanged || deferredChanged) {
        onFieldUpdate('state', statePatch({ videolessEpochs: nextVideoless, deferredEpochs: nextDeferred }));
      }
    };
    const announce = () =>
      showToast(`Epoch ${epoch} deleted`, () => {
        onFieldUpdate('taskInstances', snapInstances);
        onFieldUpdate('associated_video_files', snapVideos);
        onFieldUpdate('associated_files', snapFiles);
        if (videolessChanged || deferredChanged) {
          onFieldUpdate('state', statePatch({ videolessEpochs: snapVideoless, deferredEpochs: snapDeferred }));
        }
      });
    if (videos.length === 0 && files.length === 0) {
      applyCommit(next, view.taskTypes, false);
      writeDeletedState();
      announce();
      return;
    }
    // Orphan: confirm first. The toast (and its full-restore Undo) fires only AFTER the user confirms.
    pendingTypesRef.current = view.taskTypes;
    pendingAfterRef.current = () => {
      writeDeletedState();
      announce();
    };
    setPendingOrphan({ nextInstances: next, videos, files });
  };

  // ── "+ new task type" quick-add (define-and-assign to the epoch being edited) ──
  const saveNewType = (definition: TaskTypeDefinitionInput) => {
    if (unresolvedTaskCatalogDivergence) return;
    // The catalog enforces one name → one definition (the Spyglass task-name identity): reusing an
    // existing name is blocked at its source. Keep the modal open with the clash message.
    const clashes = view.taskTypes.some((t) => t?.task_name === definition.task_name);
    if (clashes) {
      setQuickAddError(
        `A task type named "${definition.task_name}" already exists. Pick it instead, or use a different name.`
      );
      return;
    }
    const newId = nextTaskTypeId(view.taskTypes);
    const nextTypes = addTaskType(view.taskTypes, definition);
    const epoch = quickAddEpoch;
    setQuickAddEpoch(null);
    setQuickAddError(null);
    if (epoch == null) commit(addEpochToTask(view.taskInstances, newId), nextTypes);
    else commit(setEpochTask(view.taskInstances, epoch, newId), nextTypes);
  };

  // ── Opto (fs_gui) per-epoch power / pulse ──
  const setOpto = (row: EpochGridRow, field: 'power_in_mW' | 'pulseLength', value: string) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(row.epoch);
    const fsgui = getDayFsGuiYamls(day);
    const parsed = value === '' ? '' : Number(value);
    if (row.opto) {
      const next = fsgui.map((g, i) => (i === row.opto!.index ? { ...g, [field]: parsed } : g));
      onFieldUpdate('fs_gui_yamls', next);
    } else if (value !== '') {
      onFieldUpdate('fs_gui_yamls', [...fsgui, { name: '', epochs: [row.epoch], [field]: parsed }]);
    }
  };

  // ── Statescript naming (Override / Revert) ──
  const statescriptDerivedName = (row: EpochGridRow) =>
    deriveStatescriptName({ date: grid.date, subjectId: grid.subjectId, epoch: row.epoch, tag: row.tag });
  const setStatescriptManual = (epoch: number, on: boolean) =>
    setManualStatescript((prev) => {
      const next = new Set(prev);
      if (on) next.add(epoch);
      else next.delete(epoch);
      return next;
    });
  const writeStatescriptPath = (row: EpochGridRow, path: string) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(row.epoch);
    const files = getDayAssociatedFiles(day);
    if (!row.statescript) return;
    onFieldUpdate('associated_files', files.map((f, i) => (i === row.statescript!.index ? { ...f, path } : f)));
  };
  const addStatescript = (row: EpochGridRow) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(row.epoch);
    const name = statescriptDerivedName(row);
    const path = deriveStatescriptPath(grid.dataFolder, name);
    onFieldUpdate('associated_files', [
      ...getDayAssociatedFiles(day),
      { name, description: '', path, task_epochs: row.epoch },
    ]);
  };

  // ── Video 3-state ──
  const setVideoless = (epoch: number, on: boolean) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(epoch);
    const current = getDayVideolessEpochs(day);
    const next = on ? [...new Set([...current, epoch])] : current.filter((e) => e !== epoch);
    onFieldUpdate('state', statePatchWithVideoless(next));
  };
  const addVideo = (row: EpochGridRow) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(row.epoch);
    const videos = getDayAssociatedVideos(day);
    const index = videos.filter((v) => Number(v.task_epochs) === row.epoch).length + 1;
    const name = deriveVideoName({ date: grid.date, subjectId: grid.subjectId, epoch: row.epoch, tag: row.tag, index });
    const camId = (row.cameras[0] as number) ?? (cameras[0]?.id as number) ?? 0;
    onFieldUpdate('associated_video_files', [...videos, { name, camera_id: camId, task_epochs: row.epoch }]);
    setVideoless(row.epoch, false);
  };
  const removeVideo = (videoIndex: number) => {
    if (unresolvedTaskCatalogDivergence) return;
    onFieldUpdate('associated_video_files', getDayAssociatedVideos(day).filter((_, i) => i !== videoIndex));
  };
  const writeVideoName = (videoIndex: number, name: string) => {
    if (unresolvedTaskCatalogDivergence) return;
    const row = grid.rows.find((candidate) => candidate.videos.some((video) => video.index === videoIndex));
    if (row) clearDeferredEpoch(row.epoch);
    onFieldUpdate('associated_video_files', getDayAssociatedVideos(day).map((v, i) => (i === videoIndex ? { ...v, name } : v)));
  };

  const confirmOrphanRepair = () => {
    if (!pendingOrphan) return;
    applyCommit(pendingOrphan.nextInstances, pendingTypesRef.current, true);
    setPendingOrphan(null);
    // Fire any post-commit follow-up (e.g. the delete's undo toast) now that the write has happened.
    const after = pendingAfterRef.current;
    pendingAfterRef.current = null;
    if (after) after();
  };

  const hasOpto = grid.isOpto;
  const colCount = hasOpto ? 9 : 7;

  return (
    <div className={`day-editor-section ${styles.root}`}>
      <h2>Epochs</h2>
      <p className={styles.intro}>
        Each row is one <strong>epoch</strong> — a numbered recording block belonging to a task. Open a
        row to set its task, generated files, and (for opto animals) its stimulation. File names derive
        from <code>{'{date}_{animal}_{epoch}_{tag}'}</code>; you set the data folder in Daily Setup.
      </p>

      {unresolvedTaskCatalogDivergence && (
        <section className={styles.catalogConflict} aria-labelledby="task-catalog-conflict-heading">
          <h3 id="task-catalog-conflict-heading" className={styles.catalogConflictHeading}>
            Review task catalog match
          </h3>
          <p className={styles.catalogConflictText}>
            This day has inline task values that match animal task types by name but differ in saved
            details. Choose which definition should be used before changing epochs.
          </p>
          <ul className={styles.catalogConflictList}>
            {view.divergences.map((divergence) => (
              <li key={`${divergence.taskName}-${divergence.inlineTaskIndex}`}>
                <strong>{divergence.taskName}</strong>
                <span>Day: {taskDefinitionSummary(divergence.inline)}</span>
                <span>Catalog: {taskDefinitionSummary(divergence.catalog)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.catalogConflictActions}>
            <Button variant="secondary" onClick={keepCatalogDefinition}>
              Keep catalog definition
            </Button>
            <Button variant="primary" onClick={keepDayValues}>
              Keep this day&apos;s values
            </Button>
          </div>
        </section>
      )}

      <div className={styles.toolbar}>
        <div className={styles.toolbarSpacer} />
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="button-primary"
            aria-haspopup="menu"
            aria-expanded={templateOpen}
            onClick={(e) => {
              e.stopPropagation();
              setTemplateOpen((o) => !o);
            }}
          >
            + from template ▾
          </button>
          {templateOpen && (
            <div className={styles.menu} role="menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => applyTemplate('sleep')}>
                Sleep day<span className={styles.menuSub}>4 sleep epochs</span>
              </button>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => applyTemplate('wtrack')}>
                W-track day<span className={styles.menuSub}>sleep / run alternation</span>
              </button>
              {priorDayInstances() && (
                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => applyTemplate('copy')}>
                  Copy structure from prior day<span className={styles.menuSub}>same epochs; files re-derive</span>
                </button>
              )}
              <div className={styles.menuSep} />
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => applyTemplate('blank')}>
                Blank<span className={styles.menuSub}>add one epoch to start</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {grid.rows.length === 0 ? (
        <EmptyState
          icon="▦"
          title="No epochs yet"
          actions={
            <Button variant="primary" onClick={() => applyTemplate('blank')}>
              ＋ Add an epoch
            </Button>
          }
        >
          Each epoch is a numbered recording block belonging to a task. Start from a template above
          (<strong>+ from template</strong>) for a full day, or add a single epoch and fill in its
          task and files. Need a new task? Add one on the animal&apos;s Task Types tab.
        </EmptyState>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.caretCell}>Edit</th>
              <th scope="col" className={styles.numCell}>#</th>
              <th scope="col">Task</th>
              <th scope="col">Camera(s)</th>
              <th scope="col">Statescript</th>
              <th scope="col">Video(s)</th>
              {hasOpto && <th scope="col">Opto (mW)</th>}
              {hasOpto && <th scope="col">Pulse (ms)</th>}
              <th scope="col">Status</th>
              <th scope="col" className={styles.menuCell}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const isOpen = expanded.has(row.epoch);
              const drillInId = `epoch-${row.epoch}-details`;
              return (
                <EpochRowBlock
                  key={row.epoch}
                  row={row}
                  isOpen={isOpen}
                  drillInId={drillInId}
                  hasOpto={hasOpto}
                  colCount={colCount}
                  cameras={cameras}
                  taskTypes={view.taskTypes}
                  grid={grid}
                  menuOpen={menuEpoch === row.epoch}
                  manualStatescript={manualStatescript.has(row.epoch)}
                  manualVideoKeys={manualVideo}
                  onToggle={() => toggle(row.epoch)}
                  onOpenMenu={(e) => {
                    e.stopPropagation();
                    setMenuEpoch((cur) => (cur === row.epoch ? null : row.epoch));
                  }}
                  onReassignTask={(taskTypeId) => reassignTask(row.epoch, taskTypeId)}
                  onNewTaskType={() => {
                    setQuickAddError(null);
                    setQuickAddEpoch(row.epoch);
                  }}
                  onOpto={(field, value) => setOpto(row, field, value)}
                  onInsertAfter={() => onInsertAfter(row.epoch)}
                  onDuplicate={() => onDuplicate(row.epoch)}
                  onMoveUp={() => onMove(row.epoch, 'up')}
                  onMoveDown={() => onMove(row.epoch, 'down')}
                  onDelete={() => onDelete(row.epoch)}
                  statescriptDerivedName={statescriptDerivedName(row)}
                  onStatescriptOverride={() => setStatescriptManual(row.epoch, true)}
                  onStatescriptRevert={() => {
                    setStatescriptManual(row.epoch, false);
                    writeStatescriptPath(row, deriveStatescriptPath(grid.dataFolder, statescriptDerivedName(row)));
                  }}
                  onStatescriptChange={(path) => writeStatescriptPath(row, path)}
                  onAddStatescript={() => addStatescript(row)}
                  onAddVideo={() => addVideo(row)}
                  onMarkNoVideo={() => setVideoless(row.epoch, true)}
                  onUndoNoVideo={() => setVideoless(row.epoch, false)}
                  onRemoveVideo={removeVideo}
                  onVideoOverride={(key) => setManualVideo((p) => new Set(p).add(key))}
                  onVideoRevert={(key, videoIndex) => {
                    setManualVideo((p) => {
                      const n = new Set(p);
                      n.delete(key);
                      return n;
                    });
                    const vi = row.videos.findIndex((v) => v.index === videoIndex);
                    writeVideoName(videoIndex, deriveVideoName({ date: grid.date, subjectId: grid.subjectId, epoch: row.epoch, tag: row.tag, index: vi + 1 }));
                  }}
                  onVideoNameChange={writeVideoName}
                />
              );
            })}
          </tbody>
        </table>
      )}

      {quickAddEpoch !== null && (
        <TaskTypeModal
          isOpen
          mode="add"
          animal={animal}
          nameError={quickAddError}
          onSave={saveNewType}
          onCancel={() => {
            setQuickAddEpoch(null);
            setQuickAddError(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingOrphan != null}
        title="Repair affected files?"
        message={
          pendingOrphan
            ? `This change removes an epoch still referenced by: ${[...pendingOrphan.videos, ...pendingOrphan.files]
                .map((e) => e.name || '(unnamed)')
                .join(', ')}. Confirm to save and clear the orphaned epoch reference(s); cancel to discard this change.`
            : ''
        }
        confirmLabel="Clear references"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmOrphanRepair}
        onCancel={() => {
          setPendingOrphan(null);
          pendingAfterRef.current = null;
        }}
      />

      {toastNode}
    </div>
  );

  /** Read the prior same-config day's instances for "Copy structure" (null when none). */
  function priorDayInstances(): TaskInstance[] | null {
    const days = animalDays ?? [];
    const idx = days.findIndex((d) => (d as { id?: string }).id === (day as { id?: string }).id);
    for (let i = idx - 1; i >= 0; i--) {
      const candidate = days[i] as { configurationVersion?: number; taskInstances?: TaskInstance[]; tasks?: unknown };
      if (candidate.configurationVersion === (day as { configurationVersion?: number }).configurationVersion) {
        const v = resolveDayCatalogView(animal, candidate);
        return v.taskInstances.length > 0 ? v.taskInstances : null;
      }
    }
    return null;
  }

  /** Apply a starter template, writing the corresponding instances (+ minted task types). */
  function applyTemplate(kind: 'sleep' | 'wtrack' | 'copy' | 'blank') {
    setTemplateOpen(false);
    if (unresolvedTaskCatalogDivergence) return;
    if (kind === 'copy') {
      const prior = priorDayInstances();
      if (prior) commit(structuredClone(prior));
      return;
    }
    if (kind === 'blank') {
      const firstType = view.taskTypes[0];
      if (firstType) commit(addEpochToTask(view.taskInstances, firstType.id));
      else setQuickAddEpoch(nextEpochNumber(view.taskInstances)); // define a type first
      return;
    }
    // sleep / wtrack: find-or-create the needed task types, then lay down the epoch sequence.
    let types = view.taskTypes;
    const ensure = (name: string): string => {
      const existing = types.find((t) => t?.task_name?.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      const id = nextTaskTypeId(types);
      types = addTaskType(types, { task_name: name, task_description: name });
      return id;
    };
    const instances: TaskInstance[] = [];
    const push = (typeId: string, epoch: number) => {
      const found = instances.find((i) => i.taskTypeId === typeId);
      if (found) found.task_epochs.push(epoch);
      else instances.push({ taskTypeId: typeId, task_epochs: [epoch] });
    };
    if (kind === 'sleep') {
      const sleep = ensure('Sleep');
      [1, 2, 3, 4].forEach((e) => push(sleep, e));
    } else {
      const sleep = ensure('Sleep');
      const run = ensure('W-track');
      push(sleep, 1);
      push(run, 2);
      push(sleep, 3);
      push(run, 4);
    }
    commit(instances, types);
  }
}

/** Props for one epoch row + its drill-in. */
interface EpochRowProps {
  row: EpochGridRow;
  isOpen: boolean;
  drillInId: string;
  hasOpto: boolean;
  colCount: number;
  cameras: Camera[];
  taskTypes: TaskType[];
  grid: ReturnType<typeof buildEpochGrid>;
  menuOpen: boolean;
  manualStatescript: boolean;
  manualVideoKeys: Set<string>;
  onToggle: () => void;
  onOpenMenu: (e: React.MouseEvent) => void;
  onReassignTask: (taskTypeId: string) => void;
  onNewTaskType: () => void;
  onOpto: (field: 'power_in_mW' | 'pulseLength', value: string) => void;
  onInsertAfter: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  statescriptDerivedName: string;
  onStatescriptOverride: () => void;
  onStatescriptRevert: () => void;
  onStatescriptChange: (path: string) => void;
  onAddStatescript: () => void;
  onAddVideo: () => void;
  onMarkNoVideo: () => void;
  onUndoNoVideo: () => void;
  onRemoveVideo: (videoIndex: number) => void;
  onVideoOverride: (key: string) => void;
  onVideoRevert: (key: string, videoIndex: number) => void;
  onVideoNameChange: (videoIndex: number, name: string) => void;
}

/** Collapsed statescript-cell label. */
const STATESCRIPT_LABEL: Record<EpochGridRow['statescriptNaming'], string> = {
  generated: 'Generated',
  manual: 'Manual',
  none: '—',
};

/** One epoch row (collapsed cells = STATE, not names) + its focused drill-in groups. */
function EpochRowBlock(p: EpochRowProps) {
  const { row, isOpen, drillInId, hasOpto, colCount, cameras, taskTypes, grid } = p;
  const videoLabel =
    row.videoPresence === 'absent' ? 'No video' : row.videoPresence === 'missing' ? 'Missing' : `${row.videos.length} video`;
  const videoClass =
    row.videoPresence === 'absent' ? styles.vidNone : row.videoPresence === 'missing' ? styles.vidMissing : styles.vidPresent;
  const ownerTypeId = row.taskTypeId ?? '';
  const hasManualVideo = row.videos.some((v) => p.manualVideoKeys.has(`e${row.epoch}-v${v.index}`));
  const generatedFilesNeedReview =
    !grid.dataFolder ||
    !row.statescript ||
    row.statescriptNaming === 'manual' ||
    row.videoPresence !== 'present' ||
    hasManualVideo;

  return (
    <>
      <tr>
        <td className={styles.caretCell}>
          <button
            type="button"
            className={styles.editButton}
            aria-expanded={isOpen}
            aria-controls={drillInId}
            aria-label={`${isOpen ? 'Hide' : 'Edit'} epoch ${row.epoch} details`}
            onClick={p.onToggle}
          >
            <span className={styles.editChevron} aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            <span>{isOpen ? 'Hide' : 'Edit'}</span>
          </button>
        </td>
        <td className={styles.numCell}>{row.epoch}</td>
        <td>
          {/* A real button so the larger task target is keyboard-operable; its accessible name is the
              task label (distinct from the row's "Edit epoch N details"), and it shares the
              disclosure semantics (aria-expanded/-controls) with the caret. */}
          <button
            type="button"
            className={styles.taskCellButton}
            aria-expanded={isOpen}
            aria-controls={drillInId}
            onClick={p.onToggle}
          >
            {row.taskName || <em>(no task)</em>} <span className={styles.tag}>file tag {row.tag}</span>
          </button>
          {row.duplicate && <span className={styles.duplicateBadge} title="This epoch is claimed by more than one task">duplicate</span>}
        </td>
        <td>
          {row.cameras.length === 0
            ? <span className={styles.vidNone}>—</span>
            : row.cameras.map((id) => <span key={String(id)} className={styles.cam}>{cameraName(cameras, id)}</span>)}
        </td>
        <td>
          <span className={`${styles.fstate} ${row.statescriptNaming === 'manual' ? styles.fstateManual : row.statescriptNaming === 'generated' ? styles.fstateGenerated : styles.fstateNone}`}>
            {STATESCRIPT_LABEL[row.statescriptNaming]}
          </span>
        </td>
        <td><span className={videoClass}>{videoLabel}</span></td>
        {hasOpto && (
          <td>
            <input
              className={styles.optoInput}
              type="number"
              aria-label={`Epoch ${row.epoch} opto power (mW)`}
              defaultValue={row.opto?.entry.power_in_mW ?? ''}
              onBlur={(e) => p.onOpto('power_in_mW', e.target.value)}
            />
          </td>
        )}
        {hasOpto && (
          <td>
            <input
              className={styles.optoInput}
              type="number"
              aria-label={`Epoch ${row.epoch} opto pulse (ms)`}
              defaultValue={row.opto?.entry.pulseLength ?? ''}
              onBlur={(e) => p.onOpto('pulseLength', e.target.value)}
            />
          </td>
        )}
        <td><EpochStatusPill status={row.status} /></td>
        <td className={styles.menuCell} style={{ position: 'relative' }}>
          <button type="button" className={styles.menuButton} aria-haspopup="menu" aria-expanded={p.menuOpen} aria-label={`Epoch ${row.epoch} actions`} onClick={p.onOpenMenu}>
            ⋯
          </button>
          {p.menuOpen && (
            <div className={styles.menu} role="menu" style={{ right: 0 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={p.onInsertAfter}>Insert epoch after</button>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={p.onDuplicate}>Duplicate epoch</button>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={p.onMoveUp}>Move up</button>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={p.onMoveDown}>Move down</button>
              <div className={styles.menuSep} />
              <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.danger}`} onClick={p.onDelete}>Delete epoch</button>
            </div>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className={styles.drillIn}>
          <td colSpan={colCount + 1}>
            <div className={styles.drillInInner} id={drillInId}>
              <div className={styles.group}>
                <h3 className={styles.groupHeading}>Epoch task</h3>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Task</span>
                  <span className={styles.inlineControls}>
                    <select
                      aria-label={`Epoch ${row.epoch} task`}
                      value={ownerTypeId}
                      onChange={(e) => p.onReassignTask(e.target.value)}
                    >
                      {taskTypes.length === 0 && <option value="">(no task types)</option>}
                      {taskTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.task_name || t.id}</option>
                      ))}
                    </select>
                    <button type="button" className="button-small" onClick={p.onNewTaskType}>+ new task type</button>
                  </span>
                </div>
                <details className={styles.contextDetails}>
                  <summary>Task type context</summary>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Environment</span>
                    <span className={styles.derivedNote}>{row.taskEnvironment || '—'}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Cameras</span>
                    <span>
                      {row.cameras.length === 0
                        ? <span className={styles.derivedNote}>none</span>
                        : row.cameras.map((id) => <span key={String(id)} className={styles.cam}>{cameraName(cameras, id)}</span>)}
                    </span>
                  </div>
                </details>
              </div>

              <details
                className={`${styles.group} ${styles.genPanel} ${styles.generatedDetails}`}
                open={generatedFilesNeedReview}
              >
                <summary className={styles.generatedSummary}>
                  <span>Files for this epoch</span>
                  <span className={styles.generatedStatus}>
                    {generatedFilesNeedReview ? 'needs review' : 'generated'}
                  </span>
                </summary>
                <div className={styles.generatedContent}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>File tag</span>
                    <span>
                      <code className={styles.mono}>{row.tag}</code>
                      <span className={styles.derivedNote}> used in generated statescript and video names</span>
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Data folder</span>
                    <span className={styles.mono}>{grid.dataFolder || <span className={styles.derivedNote}>not set — add it in Daily Setup</span>}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Statescript</span>
                    <span>
                    {row.statescript ? (
                      <GeneratedValue
                        value={p.manualStatescript || row.statescriptNaming === 'manual' ? row.statescript.entry.path ?? '' : p.statescriptDerivedName}
                        derived={row.statescriptNaming === 'generated' && !p.manualStatescript}
                        overrideLabel="Override name"
                        ariaLabel={`Epoch ${row.epoch} statescript path`}
                        onOverride={p.onStatescriptOverride}
                        onRevert={p.onStatescriptRevert}
                        onChange={p.onStatescriptChange}
                      />
                    ) : (
                      <>
                        <span className={styles.derivedNote}>No statescript file linked. Generated name: </span>
                        <code className={styles.mono}>{p.statescriptDerivedName}</code>
                        <button type="button" className="button-small" onClick={p.onAddStatescript}>+ Add statescript</button>
                      </>
                    )}
                    </span>
                  </div>
                  <div className={styles.fieldRow} data-field-path={`epoch-${row.epoch}-video`} tabIndex={-1}>
                    <span className={styles.fieldLabel}>Video</span>
                    <span>
                    {row.videoPresence === 'present' && (
                      <>
                        {row.videos.map((v, vi) => {
                          const key = `e${row.epoch}-v${v.index}`;
                          // Generated only when the STORED name matches what derivation would produce
                          // (so an imported/manual name like `run_video` reads `manual`), unless the user
                          // has clicked Rename this session (an explicit override on a derived name).
                          const isDerived =
                            isDerivedVideo(v.entry, {
                              date: grid.date,
                              subjectId: grid.subjectId,
                              epoch: row.epoch,
                              tag: row.tag,
                              index: vi + 1,
                            }) && !p.manualVideoKeys.has(key);
                          return (
                            <span key={v.index} style={{ display: 'block', marginBottom: 4 }}>
                              <GeneratedValue
                                value={v.entry.name ?? ''}
                                derived={isDerived}
                                overrideLabel="Rename"
                                ariaLabel={`Epoch ${row.epoch} video ${vi + 1} name`}
                                onOverride={() => p.onVideoOverride(key)}
                                onRevert={() => p.onVideoRevert(key, v.index)}
                                onChange={(name) => p.onVideoNameChange(v.index, name)}
                              />
                              <span className={styles.derivedNote}> · {cameraName(cameras, v.entry.camera_id)}</span>
                              <button type="button" className="button-small" onClick={() => p.onRemoveVideo(v.index)} aria-label={`Remove video ${vi + 1}`}>Remove</button>
                            </span>
                          );
                        })}
                        <button type="button" className="button-small" onClick={p.onAddVideo}>+ Add another video</button>
                      </>
                    )}
                    {row.videoPresence === 'missing' && (
                      <>
                        <span className={styles.vidMissing}>No video file linked</span>
                        <span className={styles.derivedNote}> — add the file, or mark it as no-video. </span>
                        <button type="button" className="button-small" onClick={p.onAddVideo}>+ Add video</button>
                        <button type="button" className="button-small" onClick={p.onMarkNoVideo}>Mark “no video”</button>
                      </>
                    )}
                    {row.videoPresence === 'absent' && (
                      <>
                        <span className={styles.vidNone}>No video recorded — fine for this epoch (export stays valid). </span>
                        <button type="button" className="button-small" onClick={p.onAddVideo}>+ Add video</button>
                        <button type="button" className="button-small" onClick={p.onUndoNoVideo}>Undo “no video”</button>
                      </>
                    )}
                    </span>
                  </div>
                </div>
              </details>

              {/* Optogenetics */}
              {hasOpto && (
                <div className={styles.group}>
                  <h3 className={styles.groupHeading}>Optogenetics</h3>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Power</span>
                    <span>
                      <input className={styles.optoInput} type="number" aria-label={`Epoch ${row.epoch} power`} defaultValue={row.opto?.entry.power_in_mW ?? ''} onBlur={(e) => p.onOpto('power_in_mW', e.target.value)} /> mW
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Pulse</span>
                    <span>
                      <input className={styles.optoInput} type="number" aria-label={`Epoch ${row.epoch} pulse`} defaultValue={row.opto?.entry.pulseLength ?? ''} onBlur={(e) => p.onOpto('pulseLength', e.target.value)} /> ms
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Protocol</span>
                    <span className={styles.derivedNote}>The laser DIO + FsGUI file are set in Tasks & Files.</span>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
