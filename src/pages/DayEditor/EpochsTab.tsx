import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import StatescriptPathEditor from './StatescriptPathEditor';
import { DraftTextInput } from '../../components/ui/DraftFields';
import { STATESCRIPT_DESCRIPTION } from '../../domain/associatedFiles';
import { ConfirmDialog, Modal, useDialogBehavior } from '../../components/Modal';
import { useUndoToast } from '../../components/ui/UndoToast';
import { EpochStatusPill } from '../../components/ui/StatusPill';
import GeneratedValue from '../../components/ui/GeneratedValue';
import Button from '../../components/ui/Button';
import OverflowMenu from '../../components/OverflowMenu';
import { EpochComposer, EpochVideoChoice } from './EpochEntryControls';
import type { VideoAnswer } from './EpochEntryControls';
import { changedTaskContext, restoreCopiedTaskContext } from '../../domain/copiedTaskContext';
import TaskTemplateDialog from './TaskTemplateDialog';
import StimulationProtocolEditor from './StimulationProtocolEditor';
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
  setEpochTaskContext,
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
import type { OrphanedReferences, TaskContextPatch } from '../../domain/epochOperations';
import {
  deriveEpochStatescript,
  deriveVideoName,
  isDerivedVideo,
} from '../../domain/fileNaming';
import {
  addMissingGeneratedStatescripts,
  addMissingGeneratedVideos,
  countMissingGeneratedStatescripts,
  countMissingGeneratedVideos,
  videoCameraIdFor,
} from '../../domain/epochGeneratedFiles';
import {
  getAnimalCameras,
  getAnimalTaskTypes,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayDeferredEpochs,
  getDayPendingVideoEpochs,
  getDayFsGuiYamls,
  getDayBehavioralEvents,
  getDayVideolessEpochs,
} from '../../state/workspaceSelectors';
import { preserveInlineTaskDefinitions, resolveDayCatalogView } from '../../state/dayTaskCatalog';
import { stripTaskContext } from '../../state/taskCatalog';
import { addTaskType, nextTaskTypeId } from '../../state/taskCatalogActions';
import type { TaskTypeDefinitionInput } from '../../state/taskCatalogActions';
import type { Day, TaskInstance, TaskType, Camera } from '../../state/workspaceTypes';
import styles from './EpochsTab.module.css';
import { pluralize } from '../../utils/pluralize';

/** A repair-routed focus request from the frame (`{ fieldPath, token }`). */
interface FocusRequest {
  fieldPath: string;
  token: number;
}

/** A pending instance-array edit awaiting orphan-repair confirmation. */
interface PendingOrphan extends OrphanedReferences {
  nextInstances: TaskInstance[];
}

type EpochFilter = 'all' | 'needs-video' | 'expected-statescript' | 'custom-filenames';
type FileFocusTarget = 'statescript' | 'video';

interface PendingFileFocus {
  epoch: number;
  target: FileFocusTarget;
  token: number;
}

/** Parse an `epoch-<n>-video` repair focus path → the epoch number (or null). */
function epochFromFocusPath(fieldPath: string | undefined): number | null {
  const match = /^epoch-(\d+)-/.exec(fieldPath ?? '');
  return match ? Number(match[1]) : null;
}

/** Parse an `associated_files[<n>]...` repair focus path → the associated_files index. */
function associatedFileIndexFromFocusPath(fieldPath: string | undefined): number | null {
  const match = /^associated_files\[(\d+)]/.exec(fieldPath ?? '');
  return match ? Number(match[1]) : null;
}

/** Which part of a row's task context this day recorded for itself ("environment", "cameras", …). */
function contextDifferenceLabel(row: EpochGridRow): string {
  if (row.taskEnvironmentOverridden && row.camerasOverridden) return 'environment and cameras';
  return row.taskEnvironmentOverridden ? 'environment' : 'cameras';
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
 * one row per epoch (Task/status + Camera(s) + Statescript-naming + Video-presence + Opto)
 * and a per-epoch details panel (Epoch task / Files for this epoch / Optogenetics). Every edit maps to an
 * {@link updateDay} patch over the day's EXISTING arrays via the pure {@link buildEpochGrid} join +
 * {@link module:domain/epochOperations} transforms — storage/export are unchanged. Replaces the
 * `TasksEpochsStep` bridge.
 */
export default function EpochsTab(props: DayEditorBundle & { focusRequest?: FocusRequest | null; onManageFile?: (fieldPath: string) => void }) {
  const {
    animal,
    day,
    animalDays = [],
    onFieldUpdate,
    onFieldsUpdate,
    actions = undefined,
    animalKey = undefined,
  } =
    useDayEditorContext(props);
  const ownerKey = animalKey ?? (animal as { id?: string })?.id;
  const focusRequest = props.focusRequest ?? null;

  // The frame rebuilds its `animalDays` ARRAY on every render while the day RECORDS inside it stay
  // the same objects. Hold the array identity steady across such renders so the grid memo below
  // (and the earlier-day scan behind `statescriptState`) is not redone on every keystroke.
  const animalDaysRef = useRef<Day[]>(animalDays);
  if (
    animalDaysRef.current.length !== animalDays.length
    || animalDaysRef.current.some((entry, index) => entry !== animalDays[index])
  ) {
    animalDaysRef.current = animalDays;
  }
  const siblingDays = animalDaysRef.current;

  // Both derivations join the day against the animal's task catalog; memoized so opening a menu,
  // switching a filter chip or toggling the drawer doesn't redo the join.
  const grid = useMemo(() => buildEpochGrid(animal, day, siblingDays), [animal, day, siblingDays]);
  const view = useMemo(() => resolveDayCatalogView(animal, day), [animal, day]);
  const cameras = getAnimalCameras(animal);
  const hasRecordedTaskContext = view.taskInstances.some((instance) => instance.task_environment !== undefined || instance.camera_id !== undefined);
  const unresolvedTaskCatalogDivergence = view.derived && view.divergences.length > 0;

  const [pendingTemplate, setPendingTemplate] = useState<'sleep' | 'wtrack' | null>(null);
  const [activeEpoch, setActiveEpoch] = useState<number | null>(null);
  const [protocolIndex, setProtocolIndex] = useState<number | null>(null);
  const protocols = getDayFsGuiYamls(day);
  const [pendingOrphan, setPendingOrphan] = useState<PendingOrphan | null>(null);
  const [quickAddEpoch, setQuickAddEpoch] = useState<number | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [epochFilter, setEpochFilter] = useState<EpochFilter>('all');
  const [pendingFileFocus, setPendingFileFocus] = useState<PendingFileFocus | null>(null);
  // Epochs whose statescript/video name is being manually overridden (UI mode; GeneratedValue's
  // `derived` flag is consumer-driven). A name only becomes stored-manual once the user types.
  const [manualStatescript, setManualStatescript] = useState<Set<number>>(new Set());
  const [manualVideo, setManualVideo] = useState<Set<string>>(new Set());
  const [priorVideoPlanOpen, setPriorVideoPlanOpen] = useState(false);
  const [pendingVideoAnswer, setPendingVideoAnswer] = useState<{ epoch: number; answer: 'no' | 'later' } | null>(null);
  const latestDayRef = useRef(day);
  latestDayRef.current = day;
  const [dataFolderOpen, setDataFolderOpen] = useState(focusRequest?.fieldPath === 'dataFolder');
  const focusDataFolderOnOpenRef = useRef(false);
  const { show: showToast, node: toastNode } = useUndoToast();

  useStepperShortcut(useCallback((action) => {
    if (action === 'add') (document.getElementById('next-epoch-task') ?? document.getElementById('create-first-epoch'))?.focus();
  }, []));

  // Repair landing: open the targeted epoch panel (the frame's focus effect then focuses the control).
  useEffect(() => {
    const protocolMatch = /^fs_gui_yamls\[(\d+)]/.exec(focusRequest?.fieldPath ?? '');
    if (protocolMatch) {
      setActiveEpoch(null);
      setProtocolIndex(Number(protocolMatch[1]));
      return;
    }
    const epoch = epochFromFocusPath(focusRequest?.fieldPath);
    if (epoch != null) {
      setActiveEpoch(epoch);
      return;
    }

    if (props.onManageFile && /^associated_(?:video_)?files/.test(focusRequest?.fieldPath ?? '')) {
      setActiveEpoch(null);
      return;
    }
    const fileIndex = associatedFileIndexFromFocusPath(focusRequest?.fieldPath);
    if (fileIndex != null) {
      const row = grid.rows.find((candidate) => candidate.statescript?.index === fileIndex);
      if (row) setActiveEpoch(row.epoch);
    }
  }, [focusRequest, grid.rows, props.onManageFile]);

  useEffect(() => {
    if (focusRequest?.fieldPath === 'dataFolder') setDataFolderOpen(true);
  }, [focusRequest]);

  useEffect(() => {
    if (!dataFolderOpen || !focusDataFolderOnOpenRef.current) return undefined;
    focusDataFolderOnOpenRef.current = false;
    const frame = requestAnimationFrame(() => document.getElementById('epochs-data-folder')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [dataFolderOpen]);

  const statePatch = useCallback((patch: Record<string, unknown>, sourceDay = day) => {
    const state = (sourceDay as { state?: unknown }).state;
    const base =
      state !== null && typeof state === 'object' && !Array.isArray(state)
        ? (state as Record<string, unknown>)
        : {};
    return { ...base, validationDeferred: false, ...patch };
  }, [day]);

  const writeFields = useCallback((
    changes: ReadonlyArray<readonly [fieldPath: string, value: unknown]>
  ) => {
    if (changes.length === 0) return;
    if (onFieldsUpdate) {
      onFieldsUpdate(changes);
      return;
    }
    // Isolated component tests provide only the long-standing single-field callback.
    changes.forEach(([fieldPath, value]) => onFieldUpdate(fieldPath, value));
  }, [onFieldUpdate, onFieldsUpdate]);

  const clearDeferredEpoch = useCallback((epoch: number) => {
    const current = getDayDeferredEpochs(day);
    if (!current.includes(epoch)) return;
    onFieldUpdate('state', statePatch({ deferredEpochs: current.filter((e) => e !== epoch) }));
  }, [day, onFieldUpdate, statePatch]);

  const toggle = useCallback((epoch: number) => {
    if (activeEpoch === epoch) {
      setActiveEpoch(null);
      return;
    }
    setActiveEpoch(epoch);
  }, [activeEpoch]);

  const openFileEditor = useCallback((epoch: number, target: FileFocusTarget) => {
    setEpochFilter('all');
    setActiveEpoch(epoch);
    setPendingFileFocus((prev) => ({
      epoch,
      target,
      token: (prev?.token ?? 0) + 1,
    }));
  }, []);

  /**
   * Persist a next instance array (and an optionally-extended catalog), retiring inline `day.tasks`
   * the first time a derived/legacy day is edited into the catalog. Mirrors the former
   * TasksEpochsStep write path.
   */
  const applyCommit = useCallback(
    (
      nextInstances: TaskInstance[],
      nextTaskTypes: TaskType[],
      repair: boolean | 'remove',
      allowTaskCatalogDivergence = false,
      options: {
        trackAddedEpochs?: boolean;
        additionalChanges?: ReadonlyArray<readonly [fieldPath: string, value: unknown]>;
      } = {}
    ) => {
      if (unresolvedTaskCatalogDivergence && !allowTaskCatalogDivergence) return;
      // An imported day's working view may already contain newly derived types. Compare with the
      // stored catalog so those definitions are saved before their inline source is retired.
      const taskCatalogChanged = nextTaskTypes !== getAnimalTaskTypes(animal);
      const changes: Array<readonly [string, unknown]> = [['taskInstances', nextInstances]];
      const currentEpochs = taskInstanceEpochs(view.taskInstances);
      const addedEpochs = [...taskInstanceEpochs(nextInstances)].filter((epoch) => !currentEpochs.has(epoch));
      if ((options.trackAddedEpochs ?? true) && addedEpochs.length > 0) {
        const currentDeferred = getDayDeferredEpochs(day);
        changes.push(['state', statePatch({ deferredEpochs: [...new Set([...currentDeferred, ...addedEpochs])] })]);
      }
      if (view.derived && Array.isArray((day as { tasks?: unknown[] }).tasks) && (day as { tasks: unknown[] }).tasks.length > 0) {
        changes.push(['tasks', []]);
      }
      if (repair) {
        const valid = new Set<number>();
        nextInstances.forEach((i) =>
          (Array.isArray(i.task_epochs) ? i.task_epochs : []).forEach((e) => valid.add(Number(e)))
        );
        const clear = <T extends { task_epochs?: number | string }>(entries: T[]) =>
          entries.filter((entry) => repair !== 'remove' || entry.task_epochs === '' || entry.task_epochs == null || valid.has(Number(entry.task_epochs))).map((entry) =>
            entry.task_epochs !== '' && entry.task_epochs != null && !valid.has(Number(entry.task_epochs))
              ? { ...entry, task_epochs: '' }
              : entry
          );
        changes.push(['associated_video_files', clear(getDayAssociatedVideos(day))]);
        changes.push(['associated_files', clear(getDayAssociatedFiles(day))]);
      }
      changes.push(...(options.additionalChanges ?? []));
      if (taskCatalogChanged && actions?.updateTaskCatalogAndDayFields && ownerKey) {
        actions.updateTaskCatalogAndDayFields(ownerKey, String(day.id), nextTaskTypes, changes);
        return;
      }
      // Isolated component tests and compatibility consumers can omit the composite action.
      if (taskCatalogChanged && actions?.updateAnimal && ownerKey) {
        actions.updateAnimal(ownerKey, { taskTypes: nextTaskTypes });
      }
      writeFields(changes);
    },
    [
      unresolvedTaskCatalogDivergence,
      animal,
      view.taskInstances,
      view.derived,
      actions,
      ownerKey,
      writeFields,
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
    (nextInstances: TaskInstance[], nextTaskTypes: TaskType[] = view.taskTypes, after?: () => void) => {
      if (unresolvedTaskCatalogDivergence) return;
      const { videos, files } = epochsOrphanedBy(day, nextInstances);
      if (videos.length === 0 && files.length === 0) {
        applyCommit(nextInstances, nextTaskTypes, false);
        after?.();
        return;
      }
      // The pending edit may also extend the catalog (a quick-add type); stash it for the confirm.
      pendingAfterRef.current = after ?? null;
      pendingTypesRef.current = nextTaskTypes;
      pendingAdditionalChangesRef.current = [];
      setPendingOrphan({ nextInstances, videos, files });
    },
    [unresolvedTaskCatalogDivergence, view.taskTypes, day, applyCommit]
  );
  const pendingTypesRef = useRef<TaskType[]>(view.taskTypes);
  // A callback to run AFTER a pending orphan-repair is confirmed (e.g. the delete's undo toast — it
  // must fire only once the delete is actually committed, not while the confirm dialog is still open).
  const pendingAfterRef = useRef<(() => void) | null>(null);
  const pendingAdditionalChangesRef = useRef<ReadonlyArray<readonly [string, unknown]>>([]);

  // ── Task / epoch write-backs (instance-array transforms) ──
  const reassignTask = (epoch: number, taskTypeId: string) => {
    commit(setEpochTask(view.taskInstances, epoch, taskTypeId));
  };
  const onDuplicate = (epoch: number) => commit(duplicateEpoch(view.taskInstances, epoch));
  /**
   * Record what THIS day's occurrence actually used (or clear it back to the task default). Writes
   * only the day's `taskInstances` — the shared task type, and therefore every other day, is
   * untouched.
   *
   * @param epoch - An epoch of the occurrence being edited.
   * @param context - Values to record, or `null` per field to follow the task default again.
   */
  const setTaskContext = (epoch: number, context: TaskContextPatch) => {
    commit(setEpochTaskContext(view.taskInstances, epoch, context));
  };

  // A renumber (insert / move) shifts epoch numbers, so the day's bound file/video/fs_gui refs are
  // remapped in LOCKSTEP — each follows its task content to the new epoch number instead of being
  // silently re-pointed at a different task. Because the refs follow, the edit creates no orphan
  // (no confirm needed); only the arrays that actually change are written.
  const renumberCommit = (nextInstances: TaskInstance[], remap: Map<number, number>, insertedEpoch?: number) => {
    if (unresolvedTaskCatalogDivergence) return;
    const stateUpdates: Record<string, unknown> = {};
    const stateChanges: Array<readonly [string, unknown]> = [];
    const nextActiveEpoch = activeEpoch != null && remap.has(activeEpoch)
      ? remap.get(activeEpoch) ?? activeEpoch
      : activeEpoch;
    if (remap.size > 0) {
      const refs = remapEpochRefs(day, remap);
      const videos = getDayAssociatedVideos(day);
      const files = getDayAssociatedFiles(day);
      const fsgui = getDayFsGuiYamls(day);
      if (JSON.stringify(refs.associated_video_files) !== JSON.stringify(videos)) {
        stateChanges.push(['associated_video_files', refs.associated_video_files]);
      }
      if (JSON.stringify(refs.associated_files) !== JSON.stringify(files)) {
        stateChanges.push(['associated_files', refs.associated_files]);
      }
      if (JSON.stringify(refs.fs_gui_yamls) !== JSON.stringify(fsgui)) {
        stateChanges.push(['fs_gui_yamls', refs.fs_gui_yamls]);
      }
      const videoless = getDayVideolessEpochs(day);
      const nextVideoless = remapVideolessEpochs(videoless, remap);
      const deferred = getDayDeferredEpochs(day);
      const nextDeferred = remapVideolessEpochs(deferred, remap);
      const pendingVideo = getDayPendingVideoEpochs(day);
      const nextPendingVideo = remapVideolessEpochs(pendingVideo, remap);
      if (JSON.stringify(pendingVideo) !== JSON.stringify(nextPendingVideo)) stateUpdates.videoPendingEpochs = nextPendingVideo;
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
    if (Object.keys(stateUpdates).length > 0) {
      stateChanges.push(['state', statePatch(stateUpdates)]);
    }
    applyCommit(nextInstances, view.taskTypes, false, false, {
      trackAddedEpochs: false,
      additionalChanges: stateChanges,
    });
    if (nextActiveEpoch !== activeEpoch) {
      setActiveEpoch(nextActiveEpoch);
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
    const snapPendingVideo = getDayPendingVideoEpochs(day);
    const nextPendingVideo = removeVideolessEpoch(snapPendingVideo, epoch);
    const pendingVideoChanged = JSON.stringify(nextPendingVideo) !== JSON.stringify(snapPendingVideo);
    const nextVideoless = removeVideolessEpoch(snapVideoless, epoch);
    const nextDeferred = removeVideolessEpoch(snapDeferred, epoch);
    const videolessChanged = JSON.stringify(nextVideoless) !== JSON.stringify(snapVideoless);
    const deferredChanged = JSON.stringify(nextDeferred) !== JSON.stringify(snapDeferred);
    const deletedStateChanges: Array<readonly [string, unknown]> =
      videolessChanged || deferredChanged || pendingVideoChanged
        ? [['state', statePatch({ videolessEpochs: nextVideoless, deferredEpochs: nextDeferred,
          ...(pendingVideoChanged ? { videoPendingEpochs: nextPendingVideo } : {}) })]]
        : [];
    const closeDeletedEpoch = () => {
      if (activeEpoch === epoch) setActiveEpoch(null);
    };
    const announce = () =>
      showToast(`Epoch ${epoch} deleted`, () => {
        const changes: Array<readonly [string, unknown]> = [
          ['taskInstances', snapInstances],
          ['associated_video_files', snapVideos],
          ['associated_files', snapFiles],
        ];
        if (videolessChanged || deferredChanged || pendingVideoChanged) {
          changes.push(['state', statePatch({ videolessEpochs: snapVideoless, deferredEpochs: snapDeferred,
            ...(pendingVideoChanged ? { videoPendingEpochs: snapPendingVideo } : {}) })]);
        }
        writeFields(changes);
      });
    if (videos.length === 0 && files.length === 0) {
      applyCommit(next, view.taskTypes, false, false, { additionalChanges: deletedStateChanges });
      closeDeletedEpoch();
      announce();
      return;
    }
    // Orphan: confirm first. The toast (and its full-restore Undo) fires only AFTER the user confirms.
    pendingTypesRef.current = view.taskTypes;
    pendingAfterRef.current = () => {
      closeDeletedEpoch();
      announce();
    };
    pendingAdditionalChangesRef.current = deletedStateChanges;
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
    else {
      const existing = grid.rows.some((row) => row.epoch === epoch);
      if (existing) {
        commit(setEpochTask(view.taskInstances, epoch, newId), nextTypes);
        setActiveEpoch(epoch);
      } else {
        applyCommit(addEpochToTask(view.taskInstances, newId), nextTypes, false, false, { trackAddedEpochs: false });
        setEpochFilter('all');
        showToast(`Epoch ${epoch} added: ${definition.task_name}`);
      }
    }
  };

  const openProtocol = (index?: number, epoch?: number) => {
    if (unresolvedTaskCatalogDivergence) return;
    if (epoch !== undefined) clearDeferredEpoch(epoch);
    setActiveEpoch(null);
    if (index !== undefined) setProtocolIndex(index);
    else {
      setProtocolIndex(protocols.length);
      onFieldUpdate('fs_gui_yamls', [...protocols, { name: '', epochs: epoch === undefined ? [] : [epoch] }]);
    }
  };

  // ── Statescript naming (Override / Revert) ──
  const statescriptFile = (row: EpochGridRow) => deriveEpochStatescript({
    ...grid, epoch: row.epoch, tag: row.tag,
  });
  const statescriptDerivedName = (row: EpochGridRow) => statescriptFile(row).name;
  const setStatescriptManual = (epoch: number, on: boolean) =>
    setManualStatescript((prev) => {
      const next = new Set(prev);
      if (on) next.add(epoch);
      else next.delete(epoch);
      return next;
    });
  const writeStatescriptPath = (row: EpochGridRow, path: string, generated = false) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(row.epoch);
    const files = getDayAssociatedFiles(day);
    if (!row.statescript) return;
    onFieldUpdate('associated_files', files.map((f, i) => (i === row.statescript!.index ? { ...f, path, ...(generated ? { name: statescriptFile(row).name } : {}) } : f)));
  };
  const addStatescript = (row: EpochGridRow) => {
    if (unresolvedTaskCatalogDivergence) return;
    clearDeferredEpoch(row.epoch);
    const { name, path } = statescriptFile(row);
    onFieldUpdate('associated_files', [
      ...getDayAssociatedFiles(day),
      { name, description: STATESCRIPT_DESCRIPTION, path, task_epochs: row.epoch },
    ]);
  };

  // ── Video 3-state ──
  const setVideoless = (epoch: number, on: boolean) => {
    if (unresolvedTaskCatalogDivergence) return;
    const current = getDayVideolessEpochs(day);
    const next = on ? [...new Set([...current, epoch])] : current.filter((e) => e !== epoch);
    onFieldUpdate('state', statePatch({ videolessEpochs: next,
      ...(getDayDeferredEpochs(day).includes(epoch) ? { deferredEpochs: getDayDeferredEpochs(day).filter((value) => value !== epoch) } : {}),
      ...(getDayPendingVideoEpochs(day).includes(epoch) ? { videoPendingEpochs: getDayPendingVideoEpochs(day).filter((value) => value !== epoch) } : {}) }));
  };
  const addVideo = (row: EpochGridRow) => {
    if (unresolvedTaskCatalogDivergence) return null;
    clearDeferredEpoch(row.epoch);
    const videos = getDayAssociatedVideos(day);
    const index = videos.filter((v) => Number(v.task_epochs) === row.epoch).length + 1;
    const name = deriveVideoName({ date: grid.date, subjectId: grid.subjectId, epoch: row.epoch, tag: row.tag, index });
    // The same attribution rule as the bulk generator: never mint a video for a camera the animal
    // does not have (a dangling `camera_id` validation would then have to block).
    const camId = videoCameraIdFor(row, cameras);
    if (camId === null) {
      showToast(
        row.cameras.length > 0
          ? `Epoch ${row.epoch}'s camera is no longer in this animal's cameras — fix the task's camera before adding a video.`
          : 'This animal has no cameras to attribute a video to — add one in Animal Setup first.'
      );
      return null;
    }
    onFieldUpdate('associated_video_files', [...videos, { name, camera_id: camId, task_epochs: row.epoch }]);
    setVideoless(row.epoch, false);
    return videos.length;
  };
  const removeVideo = (videoIndex: number) => {
    if (unresolvedTaskCatalogDivergence) return;
    onFieldUpdate('associated_video_files', getDayAssociatedVideos(day).filter((_, i) => i !== videoIndex));
  };
  // Change the scientific answer and its file entries in one update. Replacing a saved answer
  // with No/Later requires review if it would remove video metadata; Undo restores that metadata.
  const applyVideoAnswer = (epoch: number, answer: VideoAnswer) => {
    if (unresolvedTaskCatalogDivergence) return;
    const row = grid.rows.find((candidate) => candidate.epoch === epoch);
    if (!row) return;
    const videos = getDayAssociatedVideos(day);
    const videoless = getDayVideolessEpochs(day).filter((value) => value !== epoch);
    const deferred = getDayDeferredEpochs(day).filter((value) => value !== epoch);
    const pendingVideo = getDayPendingVideoEpochs(day).filter((value) => value !== epoch);
    let nextVideos = videos;
    if (answer === 'yes') {
      nextVideos = addMissingGeneratedVideos({ ...grid, rows: [{ ...row, videoPresence: 'missing' }] }, videos, cameras);
      if (!nextVideos.some((video) => Number(video.task_epochs) === epoch)) {
        showToast('Choose a camera for this epoch before adding video. Open Task to select or add a camera.');
        setActiveEpoch(epoch);
        return;
      }
    } else {
      nextVideos = videos.filter((video) => Number(video.task_epochs) !== epoch);
      if (answer === 'no') videoless.push(epoch);
      else pendingVideo.push(epoch);
    }
    writeFields([
      ['associated_video_files', nextVideos],
      ['state', statePatch({ videolessEpochs: videoless, deferredEpochs: deferred, videoPendingEpochs: pendingVideo })],
    ]);
    setPendingVideoAnswer(null);
    showToast(answer === 'yes' ? `Video filenames added for epoch ${epoch}. Check that they match your recording.`
      : answer === 'no' ? `Epoch ${epoch}: no video recorded` : `Epoch ${epoch}: video information left for later`, () => {
      const currentDay = latestDayRef.current;
      const restoredVideos = getDayAssociatedVideos(currentDay).filter((video) => Number(video.task_epochs) !== epoch);
      videos.forEach((video, index) => {
        if (Number(video.task_epochs) === epoch) restoredVideos.splice(Math.min(index, restoredVideos.length), 0, video);
      });
      writeFields([
        ['associated_video_files', restoredVideos],
        ['state', statePatch({
          videolessEpochs: [...getDayVideolessEpochs(currentDay).filter((value) => value !== epoch), ...getDayVideolessEpochs(day).filter((value) => value === epoch)].sort((a, b) => a - b),
          deferredEpochs: [...getDayDeferredEpochs(currentDay).filter((value) => value !== epoch), ...getDayDeferredEpochs(day).filter((value) => value === epoch)].sort((a, b) => a - b),
          videoPendingEpochs: [...getDayPendingVideoEpochs(currentDay).filter((value) => value !== epoch), ...getDayPendingVideoEpochs(day).filter((value) => value === epoch)].sort((a, b) => a - b),
        }, currentDay)],
      ]);
    });
  };
  const chooseVideoAnswer = (row: EpochGridRow, answer: VideoAnswer) => {
    if (unresolvedTaskCatalogDivergence) return;
    if (row.videos.length > 0 && answer !== 'yes') setPendingVideoAnswer({ epoch: row.epoch, answer });
    else applyVideoAnswer(row.epoch, answer);
  };
  const writeVideoName = (videoIndex: number, name: string) => {
    if (unresolvedTaskCatalogDivergence) return;
    const row = grid.rows.find((candidate) => candidate.videos.some((video) => video.index === videoIndex));
    if (row) clearDeferredEpoch(row.epoch);
    onFieldUpdate('associated_video_files', getDayAssociatedVideos(day).map((v, i) => (i === videoIndex ? { ...v, name } : v)));
  };

  const confirmOrphanRepair = (choice: 'keep' | 'remove') => {
    if (!pendingOrphan) return;
    applyCommit(
      pendingOrphan.nextInstances,
      pendingTypesRef.current,
      choice === 'remove' ? 'remove' : true,
      false,
      { additionalChanges: pendingAdditionalChangesRef.current }
    );
    pendingAdditionalChangesRef.current = [];
    setPendingOrphan(null);
    // Fire any post-commit follow-up (e.g. the delete's undo toast) now that the write has happened.
    const after = pendingAfterRef.current;
    pendingAfterRef.current = null;
    if (after) after();
  };

  const hasOpto = grid.isOpto;
  const epochCount = grid.rows.length;
  const missingVideoCount = grid.rows.filter((row) => row.videoPresence === 'missing').length;
  // Only the epochs that actually EXPECT a statescript are counted: a lab that never logs a sleep
  // statescript is not missing one. Never a blocker — the chip is a neutral filter.
  const expectedStatescriptCount = grid.rows.filter((row) => row.statescriptState === 'expected').length;
  const generatedStatescriptCount = countMissingGeneratedStatescripts(grid);
  const generatedVideoCount = countMissingGeneratedVideos(grid, cameras);
  const priorVideoPlan = useMemo(() => {
    const copiedFrom = day.provenance?.copiedFromDayId
      ? siblingDays.find((candidate) => String(candidate.id) === String(day.provenance?.copiedFromDayId))
      : undefined;
    const source = copiedFrom ?? [...siblingDays]
      .filter((candidate) => candidate.id !== day.id && String(candidate.date ?? '') < String(day.date ?? ''))
      .filter((candidate) => candidate.configurationVersion === day.configurationVersion)
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))[0];
    if (!source) return null;

    const sourceGrid = buildEpochGrid(animal, source, siblingDays);
    const sourceRows = new Map(sourceGrid.rows.map((row) => [row.epoch, row]));
    const matchingMissingRows = grid.rows.filter((row) => {
      const previous = sourceRows.get(row.epoch);
      return row.videoPresence === 'missing' && previous?.taskName === row.taskName;
    });
    const noVideoEpochs = matchingMissingRows
      .filter((row) => sourceRows.get(row.epoch)?.videoPresence === 'absent')
      .map((row) => row.epoch);
    const videoRows = matchingMissingRows
      .filter((row) => sourceRows.get(row.epoch)?.videoPresence === 'present')
      // Reuse the cameras that actually recorded video, not every camera listed on the task.
      // A changed/deleted camera makes that epoch a manual choice for this day.
      .filter((row) => sourceRows.get(row.epoch)!.videos.every(({ entry }) =>
        cameras.some((camera) => String(camera.id) === String(entry.camera_id)) &&
        row.cameras.some((id) => String(id) === String(entry.camera_id))))
      .map((row) => ({ ...row, cameras: [...new Set(sourceRows.get(row.epoch)!.videos.map(({ entry }) => entry.camera_id))] }))
      .filter((row) => countMissingGeneratedVideos({ ...grid, rows: [row] }, cameras) > 0);
    if (noVideoEpochs.length === 0 && videoRows.length === 0) return null;

    const videoEntries = countMissingGeneratedVideos({ ...grid, rows: videoRows }, cameras);
    return {
      date: String(source.date ?? ''),
      noVideoEpochs,
      videoRows,
      videoEntries,
      coveredEpochs: noVideoEpochs.length + videoRows.length,
    };
  }, [animal, cameras, day, grid, siblingDays]);
  const hasCustomFilename = (row: EpochGridRow) =>
    row.statescriptNaming === 'manual' ||
    row.videos.some((video, index) => !isDerivedVideo(video.entry, {
      date: grid.date,
      subjectId: grid.subjectId,
      epoch: row.epoch,
      tag: row.tag,
      index: index + 1,
    }));
  const customFilenameCount = grid.rows.filter(hasCustomFilename).length;
  const matchesEpochFilter = (row: EpochGridRow, filter: EpochFilter) => {
    if (filter === 'needs-video') return row.videoPresence === 'missing';
    if (filter === 'expected-statescript') return row.statescriptState === 'expected';
    if (filter === 'custom-filenames') return hasCustomFilename(row);
    return true;
  };
  const filteredRows = grid.rows.filter((row) => matchesEpochFilter(row, epochFilter));
  const activeRow = activeEpoch == null
    ? null
    : grid.rows.find((row) => row.epoch === activeEpoch) ?? null;
  const changeFilter = (filter: EpochFilter) => {
    setEpochFilter(filter);
    if (activeEpoch == null) return;
    const row = grid.rows.find((candidate) => candidate.epoch === activeEpoch);
    if (!row || !matchesEpochFilter(row, filter)) setActiveEpoch(null);
  };
  const generateMissingStatescripts = () => {
    if (unresolvedTaskCatalogDivergence || !grid.dataFolder) return;
    const current = getDayAssociatedFiles(day);
    const next = addMissingGeneratedStatescripts(grid, current);
    if (next === current) return;
    onFieldUpdate('associated_files', next);
    setEpochFilter('all');
    showToast(`Added ${next.length - current.length} StateScript metadata entries`, () => {
      onFieldUpdate('associated_files', current);
    });
  };
  const addOptionalStatescripts = () => {
    if (grid.dataFolder) {
      generateMissingStatescripts();
      return;
    }
    if (dataFolderOpen) {
      document.getElementById('epochs-data-folder')?.focus();
      return;
    }
    focusDataFolderOnOpenRef.current = true;
    setDataFolderOpen(true);
  };
  const generateMissingVideos = () => {
    if (unresolvedTaskCatalogDivergence) return;
    const current = getDayAssociatedVideos(day);
    const next = addMissingGeneratedVideos(grid, current, cameras);
    if (next === current) return;
    const pendingVideo = getDayPendingVideoEpochs(day);
    const nextPendingVideo = pendingVideo.filter((epoch) => !next.some((video) => Number(video.task_epochs) === epoch));
    writeFields([
      ['associated_video_files', next],
      ...(pendingVideo.length === nextPendingVideo.length ? [] : [['state', statePatch({ videoPendingEpochs: nextPendingVideo })] as const]),
    ]);
    setEpochFilter('all');
    showToast(`Added ${next.length - current.length} video metadata entries`, () => {
      writeFields([
        ['associated_video_files', current],
        ...(pendingVideo.length === nextPendingVideo.length ? [] : [['state', statePatch({ videoPendingEpochs: pendingVideo }, latestDayRef.current)] as const]),
      ]);
    });
  };
  const applyPriorVideoPlan = () => {
    if (!priorVideoPlan || unresolvedTaskCatalogDivergence) return;
    const currentVideos = getDayAssociatedVideos(day);
    const nextVideos = addMissingGeneratedVideos(
      { ...grid, rows: priorVideoPlan.videoRows },
      currentVideos,
      cameras
    );
    const covered = new Set([
      ...priorVideoPlan.noVideoEpochs,
      ...priorVideoPlan.videoRows.map((row) => row.epoch),
    ]);
    const nextVideoless = [
      ...getDayVideolessEpochs(day).filter((epoch) => !covered.has(epoch)),
      ...priorVideoPlan.noVideoEpochs,
    ].sort((a, b) => a - b);
    writeFields([
      ['associated_video_files', nextVideos],
      ['state', statePatch({ videolessEpochs: [...new Set(nextVideoless)], deferredEpochs: getDayDeferredEpochs(day).filter((epoch) => !covered.has(epoch)),
        videoPendingEpochs: getDayPendingVideoEpochs(day).filter((epoch) => !covered.has(epoch)) })],
    ]);
    setPriorVideoPlanOpen(false);
    setEpochFilter('all');
    showToast(`Applied the ${priorVideoPlan.date} video plan`);
  };

  return (
    <div data-field-path="epochs-workspace" id="epochs-workspace" className={`day-editor-section ${styles.root}`} tabIndex={-1}>
      {day.provenance?.taskContextReset?.length ? (
        <section className={styles.contextReview} tabIndex={-1} data-field-path="task-context-review" aria-labelledby="task-context-review-title">
          <h3 id="task-context-review-title">Check the room and cameras</h3>
          <p>The previous recording used a different room or cameras. Choose what applies to this recording.</p>
          <ul className={styles.contextComparison}>{groupCopiedContexts(day.provenance.taskContextReset).map((previous, index) => {
            const type = view.taskTypes.find((candidate) => candidate.id === previous.taskTypeId);
            return <li key={index}>
              <strong>{type?.task_name ?? previous.taskTypeId}, epochs {previous.task_epochs.join(', ')}</strong>
              <span><b>Previous:</b> {previous.task_environment ?? type?.task_environment ?? 'No room entered'} · {(previous.camera_id ?? type?.camera_id ?? []).map((id) => cameraName(cameras, id)).join(', ') || 'No cameras'}</span>
              {hasRecordedTaskContext ? view.taskInstances.filter((instance) => instance.taskTypeId === previous.taskTypeId && instance.task_epochs.some((epoch) => previous.task_epochs.includes(epoch))).map((instance, currentIndex) => (
                <span key={currentIndex}><b>Current (epochs {instance.task_epochs.filter((epoch) => previous.task_epochs.includes(epoch)).join(', ')}):</b> {instance.task_environment ?? type?.task_environment ?? 'No room entered'} · {(instance.camera_id ?? type?.camera_id ?? []).map((id) => cameraName(cameras, id)).join(', ') || 'No cameras'}</span>
              )) : <span><b>Task defaults:</b> {type?.task_environment || 'No room entered'} · {(type?.camera_id ?? []).map((id) => cameraName(cameras, id)).join(', ') || 'No cameras'}</span>}
            </li>;
          })}</ul>
          <div className="form-actions">
            <Button onClick={() => {
              commit(restoreCopiedTaskContext(view.taskInstances, day.provenance!.taskContextReset!), view.taskTypes, () => {
                onFieldUpdate('provenance', { ...day.provenance, taskContextReset: undefined });
              });
            }}>Use previous context</Button>
            <Button variant="neutral" onClick={() => onFieldUpdate('provenance', { ...day.provenance, taskContextReset: undefined })}>
              {hasRecordedTaskContext ? 'Keep current context for this recording' : 'Keep defaults for this recording'}
            </Button>
          </div>
        </section>
      ) : null}
      <div className={styles.workspaceHeader}>
        <div className={styles.workspaceLead}>
          <div>
            <h2>Recording epochs</h2>
            <p className={styles.workspaceIntro}>
              An epoch is one numbered block in the recording, such as sleep or a run.
              Add them in recording order, then enter whether video was recorded.
            </p>
          </div>
          {view.taskTypes.length > 0 && <OverflowMenu
            label="Epoch templates"
            buttonClassName={styles.templateTrigger}
            trigger={<>Use a day template ▾</>}
            items={[
              { key: 'sleep', label: 'Sleep day', description: '4 sleep epochs', onSelect: () => applyTemplate('sleep') },
              { key: 'wtrack', label: 'W-track day', description: 'sleep / run alternation', onSelect: () => applyTemplate('wtrack') },
              ...(priorDayInstances()
                ? [{ key: 'copy', label: 'Copy structure from prior day', description: 'same epochs; files re-derive', onSelect: () => applyTemplate('copy') }]
                : []),
            ]}
          />}
        </div>
        {day.provenance?.copiedFromDayId && epochCount > 0 && <p className={styles.copiedNote}>
          Sequence copied from {siblingDays.find((candidate) => candidate.id === day.provenance?.copiedFromDayId)?.date ?? 'a previous recording'}.
          {' '}Check that the tasks and their order match this recording.
        </p>}
        {priorVideoPlan && missingVideoCount > 0 && <div className={styles.previousPlan}>
          <div><strong>Similar video setup to {priorVideoPlan.date}?</strong>
            <p>Review the previous choices for matching epochs and apply them to this day.</p>
          </div>
          <Button variant="secondary" size="small" onClick={() => setPriorVideoPlanOpen(true)}>
            Review {priorVideoPlan.date} video plan
          </Button>
        </div>}
      </div>
      {epochCount > 0 && <div className={styles.sequenceBar}>
        <p aria-label="Epoch status summary">
          <strong>{epochCount} {pluralize(epochCount, 'epoch')}</strong>
          {missingVideoCount > 0 && <span> · Video information to enter for {missingVideoCount}</span>}
        </p>
        {epochCount > 1 && <label className={styles.filterLabel}>Show
          <select aria-label="Show epochs" value={epochFilter} onChange={(event) => changeFilter(event.target.value as EpochFilter)}>
            <option value="all">All epochs</option>
            <option value="needs-video">Video to enter ({missingVideoCount})</option>
            <option value="expected-statescript">Suggested StateScript logs ({expectedStatescriptCount})</option>
            <option value="custom-filenames">Custom filenames ({customFilenameCount})</option>
          </select>
        </label>}
      </div>}

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

      {grid.rows.length === 0 ? null : filteredRows.length === 0 ? (
        <div className={styles.filterEmpty} role="status">
          No recording epochs match this filter.
        </div>
      ) : (
        <>
          <div className={styles.tablePane}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.numCell}>Epoch</th>
                  <th scope="col">Task or activity</th>
                  <th scope="col" className={styles.videoCell}>Was video recorded?</th>
                  <th scope="col" className={styles.fileSummaryCell}>Files &amp; details</th>
                  {hasOpto && <th scope="col">Opto</th>}
                  <th scope="col" className={styles.menuCell}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <EpochRowBlock
                    key={row.epoch}
                    row={row}
                    isActive={activeEpoch === row.epoch}
                    panelId="epoch-details-panel"
                    hasOpto={hasOpto}
                    cameras={cameras}
                    taskTypes={view.taskTypes}
                    pendingVideo={getDayPendingVideoEpochs(day).includes(row.epoch)}
                    disabled={unresolvedTaskCatalogDivergence}
                    onTaskChange={(taskId) => reassignTask(row.epoch, taskId)}
                    onVideoAnswer={(answer) => chooseVideoAnswer(row, answer)}
                    onToggle={() => toggle(row.epoch)}
                    onInsertAfter={() => onInsertAfter(row.epoch)}
                    onDuplicate={() => onDuplicate(row.epoch)}
                    onMoveUp={() => onMove(row.epoch, 'up')}
                    onMoveDown={() => onMove(row.epoch, 'down')}
                    onDelete={() => onDelete(row.epoch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {activeRow && (
            <EpochDetailsPanel
              dayId={String(day.id)}
              cameraSetupHref={`#/animal/${encodeURIComponent(String(ownerKey))}/cameras`}
              row={activeRow}
              panelId="epoch-details-panel"
              hasOpto={hasOpto}
              cameras={cameras}
              taskTypes={view.taskTypes}
              grid={grid}
              repairFocus={focusRequest}
              fileFocus={pendingFileFocus?.epoch === activeRow.epoch ? pendingFileFocus : null}
              manualStatescript={manualStatescript.has(activeRow.epoch)}
              manualVideoKeys={manualVideo}
              onClose={() => setActiveEpoch(null)}
              onReassignTask={(taskTypeId) => reassignTask(activeRow.epoch, taskTypeId)}
              onSetTaskContext={(context) => setTaskContext(activeRow.epoch, context)}
              onNewTaskType={() => {
                setQuickAddError(null);
                setQuickAddEpoch(activeRow.epoch);
                // The task-type form is itself modal. Close this drawer while it is open so there
                // is only one focus trap / aria-modal surface at a time; restore the epoch when the
                // form closes or saves.
                setActiveEpoch(null);
              }}
              onEditProtocol={() => openProtocol(activeRow.opto?.index, activeRow.epoch)}
              statescriptDerivedName={statescriptDerivedName(activeRow)}
              onStatescriptOverride={() => setStatescriptManual(activeRow.epoch, true)}
              onStatescriptRevert={() => {
                setStatescriptManual(activeRow.epoch, false);
                writeStatescriptPath(activeRow, statescriptFile(activeRow).path, true);
              }}
              onManageFile={props.onManageFile ? (path) => { setActiveEpoch(null); props.onManageFile?.(path); } : undefined}
              onStatescriptChange={(path) => writeStatescriptPath(activeRow, path)}
              onStatescriptDescriptionChange={(description) => {
                if (!activeRow.statescript) return;
                onFieldUpdate('associated_files', getDayAssociatedFiles(day).map((file, index) =>
                  index === activeRow.statescript!.index ? { ...file, description } : file
                ));
              }}
              onAddStatescript={() => {
                openFileEditor(activeRow.epoch, 'statescript');
                addStatescript(activeRow);
              }}
              onAddManualStatescript={() => {
                setStatescriptManual(activeRow.epoch, true);
                openFileEditor(activeRow.epoch, 'statescript');
                addStatescript(activeRow);
              }}
              onAddVideo={() => {
                openFileEditor(activeRow.epoch, 'video');
                addVideo(activeRow);
              }}
              onAddManualVideo={() => {
                openFileEditor(activeRow.epoch, 'video');
                const videoIndex = addVideo(activeRow);
                if (videoIndex != null) {
                  setManualVideo((prev) => new Set(prev).add(`e${activeRow.epoch}-v${videoIndex}`));
                }
              }}
              onMarkNoVideo={() => setVideoless(activeRow.epoch, true)}
              onUndoNoVideo={() => setVideoless(activeRow.epoch, false)}
              onRemoveVideo={removeVideo}
              onVideoOverride={(key) => setManualVideo((p) => new Set(p).add(key))}
              onVideoRevert={(key, videoIndex) => {
                setManualVideo((p) => {
                  const n = new Set(p);
                  n.delete(key);
                  return n;
                });
                const vi = activeRow.videos.findIndex((v) => v.index === videoIndex);
                writeVideoName(videoIndex, deriveVideoName({
                  date: grid.date,
                  subjectId: grid.subjectId,
                  epoch: activeRow.epoch,
                  tag: activeRow.tag,
                  index: vi + 1,
                }));
              }}
              onVideoNameChange={writeVideoName}
              onVideoCameraChange={(videoIndex, cameraId) => onFieldUpdate('associated_video_files',
                getDayAssociatedVideos(day).map((video, index) => index === videoIndex ? { ...video, camera_id: cameraId } : video))}
            />
          )}
        </>
      )}

      <EpochComposer nextEpoch={nextEpochNumber(view.taskInstances)} empty={epochCount === 0}
        types={view.taskTypes} disabled={unresolvedTaskCatalogDivergence}
        onCreateTask={() => { setQuickAddError(null); setQuickAddEpoch(nextEpochNumber(view.taskInstances)); }}
        onAdd={(taskId) => {
          const epoch = nextEpochNumber(view.taskInstances);
          // Appending preserves every existing epoch/reference. Leave its video question
          // unanswered; Enter later is a deliberate choice in the row.
          applyCommit(addEpochToTask(view.taskInstances, taskId), view.taskTypes, false, false, { trackAddedEpochs: false });
          setEpochFilter('all');
          showToast(`Epoch ${epoch} added: ${view.taskTypes.find((task) => task.id === taskId)?.task_name}`);
        }}
      />
      {epochCount > 0 && <details className={styles.fileTools} open={dataFolderOpen}
        onToggle={(event) => setDataFolderOpen(event.currentTarget.open)}>
        <summary>File naming &amp; bulk entry</summary>
        <p>Add metadata for files you recorded. Suggested filenames are not checked against files on disk.</p>
        <StatescriptPathEditor key={String(day.id)} grid={grid} files={getDayAssociatedFiles(day)}
          disabled={unresolvedTaskCatalogDivergence}
          onApply={(folder, pattern, files) => {
            const before = getDayAssociatedFiles(day);
            const changes: Array<[string, unknown]> = [
              ['dataFolder', folder], ['state', statePatch({ statescriptPathTemplate: pattern })], ['associated_files', files],
            ];
            if (onFieldsUpdate) onFieldsUpdate(changes);
            else changes.forEach(([field, value]) => onFieldUpdate(field, value));
            setManualStatescript(new Set());
            showToast('StateScript naming pattern applied', () => {
              const undo: Array<[string, unknown]> = [['dataFolder', grid.dataFolder], ['state', day.state], ['associated_files', before]];
              if (onFieldsUpdate) onFieldsUpdate(undo);
              else undo.forEach(([field, value]) => onFieldUpdate(field, value));
            });
          }} />
        <div className={styles.fileToolsContent}>
          <div className={styles.folderField}><label htmlFor="epochs-data-folder">StateScript file folder</label>
            <DraftTextInput draftKey={`day:${String(day.id)}:dataFolder`} id="epochs-data-folder"
              type="text" name="dataFolder" data-field-path="dataFolder" className={styles.dataFolderInput}
              value={grid.dataFolder} onCommit={(value) => onFieldUpdate('dataFolder', value)}
              placeholder="e.g. /data/animal/20230622/" aria-describedby="epochs-data-folder-help" />
            <span id="epochs-data-folder-help" className={styles.dataFolderHelp}>
              Folder containing this recording’s files. StateScript paths are generated inside it.
            </span>
          </div>
          <div className={styles.bulkActions} aria-label="Add metadata entries">
            {generatedStatescriptCount > 0 && <Button variant="secondary" size="small" onClick={addOptionalStatescripts}>
              Add {generatedStatescriptCount} suggested StateScript {pluralize(generatedStatescriptCount, 'log')}
            </Button>}
            {generatedVideoCount > 0 && <Button variant="secondary" size="small" onClick={generateMissingVideos}>
              Add {generatedVideoCount} video {generatedVideoCount === 1 ? 'entry' : 'entries'}
            </Button>}
          </div>
        </div>
      </details>}
      <ConfirmDialog isOpen={pendingVideoAnswer != null}
        title={`Change video answer for epoch ${pendingVideoAnswer?.epoch ?? ''}?`}
        message="This removes this epoch’s video metadata entries, including any custom filenames. Files on disk are kept. You can undo the change."
        confirmLabel={pendingVideoAnswer?.answer === 'no' ? 'Remove entries and mark no video' : 'Remove entries and enter later'}
        onConfirm={() => { if (pendingVideoAnswer) applyVideoAnswer(pendingVideoAnswer.epoch, pendingVideoAnswer.answer); }}
        onCancel={() => setPendingVideoAnswer(null)} />

      {pendingTemplate && <TaskTemplateDialog
        kind={pendingTemplate}
        types={view.taskTypes}
        defaults={(animal as { taskTemplateDefaults?: { sleep?: string; run?: string } }).taskTemplateDefaults}
        onClose={() => setPendingTemplate(null)}
        onApply={(instances, defaults) => {
          commit(instances, view.taskTypes, () => {
            if (actions?.updateAnimal && ownerKey) {
              (actions.updateAnimal as (id: string, patch: Record<string, unknown>) => void)(ownerKey, { taskTemplateDefaults: defaults });
            }
          });
          setPendingTemplate(null);
        }}
      />}

      <Modal
        isOpen={priorVideoPlanOpen && priorVideoPlan != null}
        title={`Use the ${priorVideoPlan?.date ?? 'previous day'} video plan?`}
        titleId="previous-video-plan-title"
        onClose={() => setPriorVideoPlanOpen(false)}
        footer={<div className="form-actions">
          <Button variant="neutral" onClick={() => setPriorVideoPlanOpen(false)}>Cancel</Button>
          <Button onClick={applyPriorVideoPlan}>Apply previous plan</Button>
        </div>}
      >
        {priorVideoPlan && <>
        <p>
          This will mark {priorVideoPlan.noVideoEpochs.length} {pluralize(priorVideoPlan.noVideoEpochs.length, 'epoch')} as having no video and create{' '}
          {priorVideoPlan.videoEntries} camera-specific video {priorVideoPlan.videoEntries === 1 ? 'entry' : 'entries'} for matching epochs.
        </p>
        <ol className={styles.planPreview}>
          {grid.rows.filter((row) => priorVideoPlan.noVideoEpochs.includes(row.epoch) || priorVideoPlan.videoRows.some((videoRow) => videoRow.epoch === row.epoch)).map((row) => {
            const videoRow = priorVideoPlan.videoRows.find((candidate) => candidate.epoch === row.epoch);
            return <li key={row.epoch}><strong>Epoch {row.epoch}: {row.taskName}</strong>
              <span>{videoRow ? `Video: ${videoRow.cameras.map((id) => cameraName(cameras, id)).join(', ')}` : 'No video recorded'}</span>
            </li>;
          })}
        </ol>
        <p>
          {priorVideoPlan.coveredEpochs < missingVideoCount
            ? ` ${missingVideoCount - priorVideoPlan.coveredEpochs} unmatched ${pluralize(missingVideoCount - priorVideoPlan.coveredEpochs, 'epoch')} will still need review.`
            : ''}{' '}
          Confirm that these choices match this recording. Filenames will be suggested for this date; check them in Files &amp; details.
        </p>
        </>}
      </Modal>

      {quickAddEpoch !== null && (
        <TaskTypeModal
          isOpen
          mode="add"
          animal={animal}
          nameError={quickAddError}
          onSave={saveNewType}
          onCancel={() => {
            const epoch = quickAddEpoch;
            setQuickAddEpoch(null);
            setQuickAddError(null);
            if (epoch !== null && grid.rows.some((row) => row.epoch === epoch)) setActiveEpoch(epoch);
          }}
        />
      )}

      <Modal
        isOpen={pendingOrphan != null}
        title="Repair affected files?"
        titleId="orphan-files-title"
        role="alertdialog"
        describedById="orphan-files-description"
        closeOnOverlayClick={false}
        onClose={() => { setPendingOrphan(null); pendingAfterRef.current = null; pendingAdditionalChangesRef.current = []; }}
        footer={<div className="form-actions">
          <Button variant="neutral" onClick={() => { setPendingOrphan(null); pendingAfterRef.current = null; pendingAdditionalChangesRef.current = []; }}>Cancel</Button>
          <Button variant="secondary" onClick={() => confirmOrphanRepair('keep')}>Keep files unassigned</Button>
          <Button variant="danger" onClick={() => confirmOrphanRepair('remove')}>Remove affected files</Button>
        </div>}
      >
        <p id="orphan-files-description">This change removes an epoch referenced by the files below.
          Keep them unassigned to choose another epoch in Manage files, or remove their metadata entries.
          Files on disk are kept.</p>
        <ul>{[...(pendingOrphan?.videos ?? []), ...(pendingOrphan?.files ?? [])].map((file, index) =>
          <li key={index}>{file.name || '(unnamed file)'}</li>)}</ul>
      </Modal>

      {(hasOpto || protocols.length > 0) && <details className="supplemental-disclosure">
        <summary>Stimulation protocols · {protocols.length}</summary>
        {protocols.map((protocol, index) => <p key={index}>
          {protocol.name || 'Unnamed protocol'} · epochs {(protocol.epochs ?? []).join(', ') || 'not selected'}{' '}
          <Button variant="secondary" size="small" onClick={() => openProtocol(index)}>Edit protocol {index + 1}</Button>
        </p>)}
        <Button variant="secondary" onClick={() => openProtocol()}>Add stimulation protocol</Button>
      </details>}
      {protocolIndex !== null && protocols[protocolIndex] && <StimulationProtocolEditor
        draftScope={`day:${String(day.id)}:fs_gui_yamls:${protocolIndex}`}
        key={protocolIndex} index={protocolIndex} protocol={protocols[protocolIndex]} epochs={grid.rows}
        cameras={cameras} events={getDayBehavioralEvents(day)} focusRequest={focusRequest}
        onChange={(protocol) => onFieldUpdate('fs_gui_yamls', protocols.map((entry, index) => index === protocolIndex ? protocol : entry))}
        onRemove={() => {
          onFieldUpdate('fs_gui_yamls', protocols.filter((_, index) => index !== protocolIndex));
          setProtocolIndex(null);
        }}
        onClose={() => setProtocolIndex(null)}
        onEditCameras={() => { setProtocolIndex(null); window.location.hash = `#/animal/${encodeURIComponent(animal.id)}/cameras`; }}
        onEditWiring={() => {
          setProtocolIndex(null);
          window.location.hash = `#/day/${encodeURIComponent(String(day.id))}?step=behavioral&field=behavioral_events`;
        }}
      />}
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
  function applyTemplate(kind: 'sleep' | 'wtrack' | 'copy') {
    if (unresolvedTaskCatalogDivergence) return;
    if (kind === 'copy') {
      // The prior day's STRUCTURE — which tasks ran in which epochs. Its own recorded room/cameras
      // are that day's facts, so this day starts from the task-type defaults (same rule as creating
      // a day from the prior one; see stripTaskContext).
      const prior = priorDayInstances();
      if (prior) commit(stripTaskContext(prior), view.taskTypes, () => {
        onFieldUpdate('provenance', { ...day.provenance, taskContextReset: changedTaskContext(prior, view.taskTypes) });
      });
      return;
    }
    setPendingTemplate(kind);
  }
}

/** Props for one epoch overview row. */
interface EpochRowProps {
  row: EpochGridRow;
  isActive: boolean;
  panelId: string;
  hasOpto: boolean;
  cameras: Camera[];
  taskTypes: TaskType[];
  pendingVideo: boolean;
  disabled: boolean;
  onTaskChange: (taskId: string) => void;
  onVideoAnswer: (answer: VideoAnswer) => void;
  onToggle: () => void;
  onInsertAfter: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

/** Props for the focused epoch details panel. */
interface EpochDetailsPanelProps {
  dayId: string;
  cameraSetupHref: string;
  row: EpochGridRow;
  panelId: string;
  hasOpto: boolean;
  cameras: Camera[];
  taskTypes: TaskType[];
  grid: ReturnType<typeof buildEpochGrid>;
  repairFocus?: FocusRequest | null;
  fileFocus: PendingFileFocus | null;
  manualStatescript: boolean;
  manualVideoKeys: Set<string>;
  onClose: () => void;
  onReassignTask: (taskTypeId: string) => void;
  onSetTaskContext: (context: TaskContextPatch) => void;
  onNewTaskType: () => void;
  onEditProtocol: () => void;
  statescriptDerivedName: string;
  onManageFile?: (fieldPath: string) => void;
  onStatescriptOverride: () => void;
  onStatescriptRevert: () => void;
  onStatescriptChange: (path: string) => void;
  onStatescriptDescriptionChange: (description: string) => void;
  onAddStatescript: () => void;
  onAddManualStatescript: () => void;
  onAddVideo: () => void;
  onAddManualVideo: () => void;
  onMarkNoVideo: () => void;
  onUndoNoVideo: () => void;
  onRemoveVideo: (videoIndex: number) => void;
  onVideoOverride: (key: string) => void;
  onVideoRevert: (key: string, videoIndex: number) => void;
  onVideoNameChange: (videoIndex: number, name: string) => void;
  onVideoCameraChange: (videoIndex: number, cameraId: number) => void;
}

/** How a LINKED statescript got its name (the collapsed cell's label once a file is bound). */
const STATESCRIPT_NAMING_LABEL: Record<EpochGridRow['statescriptNaming'], string> = {
  generated: 'Suggested name added',
  manual: 'Custom name',
  none: '—',
};

/** The unlinked half of the three-state vocabulary — a warning at worst, never an error. */
const STATESCRIPT_UNLINKED_LABEL: Record<'expected' | 'not_expected', string> = {
  expected: 'Suggested log not added',
  not_expected: 'No log expected',
};

/**
 * A short StateScript summary for scanning the sequence; file editing lives in the details panel.
 *
 * @param row - The epoch row.
 * @returns The label and the linked file's path for the cell's tooltip.
 */
function statescriptCell(row: EpochGridRow): { label: string; title?: string } {
  if (row.statescriptState === 'linked') {
    return {
      label: STATESCRIPT_NAMING_LABEL[row.statescriptNaming],
      title: row.statescript?.entry.path || row.statescript?.entry.name || undefined,
    };
  }
  return {
    label: STATESCRIPT_UNLINKED_LABEL[row.statescriptState],
  };
}

/** One epoch row: scan-friendly state, quick missing-file fixes, and structural actions. */
function EpochRowBlock(p: EpochRowProps) {
  const { row, isActive, panelId, hasOpto, cameras } = p;
  const statescript = statescriptCell(row);
  const answer = row.videoPresence === 'present' ? 'yes' : row.videoPresence === 'absent' ? 'no' : p.pendingVideo ? 'later' : '';
  return (
    <tr className={isActive ? styles.activeRow : undefined}>
      <td className={styles.numCell}><span className={styles.epochNumber}>{String(row.epoch).padStart(2, '0')}</span></td>
      <td className={styles.taskCell}>
        <div className={styles.taskCellStack}>
          <label className="sr-only" htmlFor={`epoch-task-${row.epoch}`}>Task for epoch {row.epoch}</label>
          <select id={`epoch-task-${row.epoch}`} className={styles.taskSelect} value={row.taskTypeId}
            disabled={p.disabled} onChange={(event) => p.onTaskChange(event.target.value)}>
            {!p.taskTypes.some((task) => task.id === row.taskTypeId) && <option value={row.taskTypeId}>Choose a task…</option>}
            {p.taskTypes.map((task) => <option key={task.id} value={task.id}>{task.task_name || task.id}</option>)}
          </select>
          <span className={styles.taskEnvironment}>{row.taskEnvironment || 'Room not entered'}</span>
          <span className={styles.cameraSummary}>
            {row.cameras.length ? row.cameras.map((id) => cameraName(cameras, id)).join(' · ') : 'No cameras selected'}
          </span>
          {row.duplicate && <span className={styles.duplicateBadge}>Epoch assigned to more than one task</span>}
          {(row.taskEnvironmentOverridden || row.camerasOverridden) && <span className={styles.contextBadge}
            title={`This day recorded its own ${contextDifferenceLabel(row)} for this task`}>Room or cameras changed for this day</span>}
        </div>
      </td>
      <td className={styles.videoCell} data-label="Was video recorded?">
        <EpochVideoChoice epoch={row.epoch} value={answer} disabled={p.disabled} onChange={p.onVideoAnswer} />
        <span id={`epoch-video-help-${row.epoch}`} className={styles.answerHelp}>
          {answer === 'yes' ? `${row.videos.length} video ${pluralize(row.videos.length, 'filename')} entered`
            : answer === 'no' ? 'No video recorded'
              : answer === 'later' ? 'Saved for later · needed before export' : 'Choose an answer'}
        </span>
      </td>
      <td className={styles.fileSummaryCell} data-label="Files & details">
        <button type="button" className={styles.taskDisclosureButton}
          aria-expanded={isActive} aria-controls={panelId}
          aria-label={`${isActive ? 'Hide' : 'Show'} epoch ${row.epoch} details`} onClick={p.onToggle}>
          {isActive ? 'Close details' : 'Files & details'} <span aria-hidden="true">{isActive ? '−' : '→'}</span>
        </button>
        <span className={styles.fileSummaryText} title={statescript.title}>StateScript: {statescript.label}</span>
      </td>
      {hasOpto && <td className={styles.optoCell} data-label="Opto">
        <span className={styles.optoReadout}>{row.opto?.entry.power_in_mW != null && row.opto.entry.power_in_mW !== '' ? `${row.opto.entry.power_in_mW} mW` : '—'}</span>
      </td>}
      <td className={styles.menuCell}>
        <div className={styles.rowActionGroup} role="group" aria-label={`Epoch ${row.epoch} structure actions`}>
          <OverflowMenu label={`More actions for epoch ${row.epoch}`} buttonClassName={styles.menuButton}
            items={[
              { key: 'up', label: `Move epoch ${row.epoch} up`, description: 'Swaps epoch numbers; linked metadata follows.', onSelect: p.onMoveUp },
              { key: 'down', label: `Move epoch ${row.epoch} down`, description: 'Swaps epoch numbers; linked metadata follows.', onSelect: p.onMoveDown },
              { key: 'insert', label: 'Insert epoch after', description: 'Repeats this task and renumbers later epochs.', onSelect: p.onInsertAfter },
              { key: 'duplicate', label: 'Duplicate epoch', description: 'Adds this task at the end without copying files.', onSelect: p.onDuplicate },
              { key: 'delete', label: `Delete epoch ${row.epoch}`, onSelect: p.onDelete, separatorBefore: true },
            ]} />
        </div>
      </td>
    </tr>
  );
}

/** Focused editor panel for the currently selected epoch. */
function EpochDetailsPanel(p: EpochDetailsPanelProps) {
  const { row, panelId, hasOpto, cameras, taskTypes, grid } = p;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ownerTypeId = row.taskTypeId ?? '';
  const ownerType = taskTypes.find((t) => t?.id === ownerTypeId) ?? null;
  // "Edit for this day" is a disclosure, not a mode: the read-only context stays visible above it.
  const [editingContext, setEditingContext] = useState(false);
  // The panel is reused across epochs, so an open editor must close when the epoch changes — it
  // was prefilled from the PREVIOUS epoch and would otherwise write that day-context onto this one.
  useEffect(() => setEditingContext(false), [row.epoch]);
  const hasManualVideo = row.videos.some((v) => p.manualVideoKeys.has(`e${row.epoch}-v${v.index}`));
  const expectedStatescriptPath = deriveEpochStatescript({ ...grid, epoch: row.epoch, tag: row.tag }).path;
  const expectedVideoName = deriveVideoName({
    date: grid.date,
    subjectId: grid.subjectId,
    epoch: row.epoch,
    tag: row.tag,
    index: row.videos.length + 1,
  });
  const statescriptStateLabel =
    row.statescriptState === 'linked'
      ? STATESCRIPT_NAMING_LABEL[row.statescriptNaming]
      : STATESCRIPT_UNLINKED_LABEL[row.statescriptState];
  const statescriptStateClass =
    row.statescriptState === 'linked'
      ? (row.statescriptNaming === 'manual' ? styles.fileStateManual : styles.fileStateGenerated)
      : row.statescriptState === 'expected'
        ? styles.fileStateExpected
        : styles.fileStateAbsent;
  const videoStateLabel =
    row.videoPresence === 'absent'
      ? 'No video'
      : row.videoPresence === 'missing'
        ? 'Choose video status'
        : hasManualVideo
          ? 'Manual'
          : `${row.videos.length} ${pluralize(row.videos.length, 'video')}`;
  const videoStateClass =
    row.videoPresence === 'absent'
      ? styles.fileStateAbsent
      : row.videoPresence === 'missing'
        ? styles.fileStateMissing
        : hasManualVideo
          ? styles.fileStateManual
          : styles.fileStateGenerated;

  // This surface covers the underlying editor (full-screen on phones), so it behaves as a modal
  // drawer: announce it as a dialog, move focus inside (on the Close button, marked
  // `data-initial-focus`), contain Tab, close on Escape, and restore focus to the disclosure that
  // opened it. Without this, keyboard focus walked through controls hidden behind the drawer.
  useDialogBehavior(panelRef, { onClose: p.onClose });

  useEffect(() => {
    if (!p.repairFocus) return undefined;
    // The drawer mounts after the frame's repair request. Focus the requested field after the
    // dialog's initial focus and the frame's focus effect have both run.
    const frame = requestAnimationFrame(() => {
      const target = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-field-path]') ?? [])
        .find((element) => element.dataset.fieldPath === p.repairFocus?.fieldPath);
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [p.repairFocus, row.epoch]);

  useEffect(() => {
    if (!p.fileFocus || p.fileFocus.epoch !== row.epoch) return undefined;
    const handle = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-field-path="epoch-${row.epoch}-${p.fileFocus?.target}"]`
      );
      const focusable = target?.querySelector<HTMLElement>(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? target)?.focus();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [p.fileFocus, row.epoch]);

  return (
    <>
      <div className={styles.detailsBackdrop} aria-hidden="true" onClick={p.onClose} />
      <div
        ref={panelRef}
        id={panelId}
        className={styles.detailsPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-heading`}
      >
      <div className={styles.detailsPanelHeader}>
        <div>
          <h2 id={`${panelId}-heading`} className={styles.detailsPanelTitle}>
            Epoch {row.epoch}: {row.taskName || '(no task)'}
          </h2>
          <div className={styles.detailsPanelMeta}>
            <span className={styles.tag}>tag {row.tag}</span>
            <EpochStatusPill status={row.status} fileReminder={row.statescriptState === 'expected'} />
          </div>
        </div>
        <button
          type="button"
          className={styles.panelCloseButton}
          data-initial-focus
          aria-label={`Close epoch ${row.epoch} details`}
          onClick={p.onClose}
        >
          Close
        </button>
      </div>

      <div className={styles.detailsPanelBody}>
        <section className={styles.group} aria-labelledby={`epoch-${row.epoch}-task-heading`}>
          <div className={styles.taskEditorHeader}>
            <h3 id={`epoch-${row.epoch}-task-heading`} className={styles.groupHeading}>Task</h3>
            <span className={styles.groupNote}>Task, room and cameras for this recording.</span>
          </div>
          <div className={styles.taskEditorGrid}>
            <label className={styles.stackedField}>
              <span className={styles.fieldLabel}>Task type</span>
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
            </label>
            <Button variant="secondary" size="small" onClick={p.onNewTaskType}>
              + new task type
            </Button>
          </div>
          <dl className={styles.taskContextGrid}>
            <div>
              <dt>Environment</dt>
              <dd>
                {row.taskEnvironment || '—'}
                {row.taskEnvironmentOverridden && <span className={styles.contextBadge}>this day</span>}
              </dd>
            </div>
            <div>
              <dt>Cameras</dt>
              <dd>
                {row.cameras.length === 0
                  ? <span className={styles.derivedNote}>none</span>
                  : row.cameras.map((id) => <span key={String(id)} className={styles.cam}>{cameraName(cameras, id)}</span>)}
                {row.camerasOverridden && <span className={styles.contextBadge}>this day</span>}
              </dd>
            </div>
          </dl>
          {cameras.length === 0 && <p className={styles.groupNote}>
            Recording video? <a href={p.cameraSetupHref}>Add a camera in animal setup</a>, then return to this day.
          </p>}
          {editingContext ? (
            <TaskContextForm
              row={row}
              cameras={cameras}
              taskType={ownerType}
              onSave={(context) => {
                p.onSetTaskContext(context);
                setEditingContext(false);
              }}
              onUseTaskDefault={() => {
                p.onSetTaskContext({ task_environment: null, camera_id: null });
                setEditingContext(false);
              }}
              onCancel={() => setEditingContext(false)}
            />
          ) : (
            <div className={styles.taskContextActions}>
              <Button variant="secondary" size="small" onClick={() => setEditingContext(true)}>
                Edit for this day
              </Button>
              <span className={styles.groupNote}>
                Where this task ran and which cameras recorded it, for this recording day only.
              </span>
            </div>
          )}
        </section>


        <section
          className={`${styles.group} ${styles.genPanel}`}
          aria-labelledby={`epoch-${row.epoch}-files-heading`}
        >
          <div className={styles.panelGroupHeader}>
            <h3 id={`epoch-${row.epoch}-files-heading`} className={styles.groupHeading}>Files for this epoch</h3>

          </div>
          <p className={styles.fileHelp}>Enter the filenames used for this epoch. Suggested names are not checked against files on disk.</p>
          <div className={styles.generatedContent}>
            <div className={styles.fileCards}>
              <div className={styles.fileCard} data-field-path={`epoch-${row.epoch}-statescript`} tabIndex={-1}>
                <div className={styles.fileCardTop}>
                  <span className={styles.fileCardTitle}>StateScript log</span>
                  <span className={`${styles.fileState} ${statescriptStateClass}`}>{statescriptStateLabel}</span>
                </div>
                <div
                  className={styles.fileCardBody}
                  data-field-path={
                    row.statescript ? `associated_files[${row.statescript.index}].path` : undefined
                  }
                  tabIndex={row.statescript ? -1 : undefined}
                >
                  {row.statescript ? (
                    <>
                      <GeneratedValue
                        value={p.manualStatescript || row.statescriptNaming === 'manual' ? row.statescript.entry.path ?? '' : p.statescriptDerivedName}
                        derived={row.statescriptNaming === 'generated' && !p.manualStatescript}
                        overrideLabel="Override path"
                        ariaLabel={`Epoch ${row.epoch} statescript path`}
                        onOverride={p.onStatescriptOverride}
                        onRevert={p.onStatescriptRevert}
                        onChange={p.onStatescriptChange}
                      />
                      <label htmlFor={`epoch-${row.epoch}-statescript-description`}>StateScript description (required)</label>
                      <DraftTextInput
                        draftKey={`day:${p.dayId}:associated_file:${String(row.statescript.entry.recordId ?? row.statescript.index)}:description`}
                        id={`epoch-${row.epoch}-statescript-description`}
                        name={`associated_files[${row.statescript.index}].description`}
                        data-field-path={`associated_files[${row.statescript.index}].description`}
                        value={row.statescript.entry.description ?? ''}
                        onCommit={p.onStatescriptDescriptionChange}
                        aria-required="true"
                        aria-invalid={!row.statescript.entry.description?.trim()}
                      />
                      <small>Include “StateScript” so Spyglass can identify this log.</small>
                      {p.onManageFile && <Button variant="secondary" size="small"
                        onClick={() => p.onManageFile?.(`associated_files[${row.statescript!.index}].name`)}>
                        Edit name, epoch or remove file
                      </Button>}
                    </>
                  ) : (
                    <>
                      <code className={styles.pathValue}>Suggested name: {expectedStatescriptPath}</code>
                      <div className={styles.fileActions}>
                        <button type="button" className={row.statescriptState === 'expected' ? styles.filePrimaryAction : styles.fileAction} onClick={p.onAddStatescript}>
                          {row.statescriptState === 'expected' ? 'Add suggested StateScript log' : 'Add StateScript log'}
                        </button>
                        <button
                          type="button"
                          className={styles.fileAction}
                          aria-label={`Enter statescript manually for epoch ${row.epoch}`}
                          onClick={p.onAddManualStatescript}
                        >
                          Enter manually
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.fileCard} data-field-path={`epoch-${row.epoch}-video`} tabIndex={-1}>
                <div className={styles.fileCardTop}>
                  <span className={styles.fileCardTitle}>Video</span>
                  <span className={`${styles.fileState} ${videoStateClass}`}>{videoStateLabel}</span>
                </div>
                <div className={styles.fileCardBody}>
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
                          <span key={v.index} className={styles.videoEditorRow}>
                            <GeneratedValue
                              value={v.entry.name ?? ''}
                              derived={isDerived}
                              overrideLabel="Rename"
                              ariaLabel={`Epoch ${row.epoch} video ${vi + 1} name`}
                              onOverride={() => p.onVideoOverride(key)}
                              onRevert={() => p.onVideoRevert(key, v.index)}
                              onChange={(name) => p.onVideoNameChange(v.index, name)}
                            />
                            <label className={styles.stackedField}>
                              <span className={styles.fieldLabel}>Camera for video {vi + 1}</span>
                              <select aria-label={`Epoch ${row.epoch} video ${vi + 1} camera`} value={v.entry.camera_id}
                                onChange={(event) => p.onVideoCameraChange(v.index, Number(event.target.value))}>
                                {!cameras.some((camera) => String(camera.id) === String(v.entry.camera_id)) &&
                                  <option value={v.entry.camera_id}>Choose a camera…</option>}
                                {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.camera_name || `Camera ${camera.id}`}</option>)}
                              </select>
                            </label>
                            <button type="button" className={styles.fileAction} onClick={() => p.onRemoveVideo(v.index)} aria-label={`Remove video ${vi + 1}`}>Remove</button>
                          </span>
                        );
                      })}
                      <div className={styles.fileActions}>
                        <button type="button" className={styles.fileAction} onClick={p.onAddVideo}>Add another video</button>
                      </div>
                    </>
                  )}
                  {row.videoPresence === 'missing' && (
                    <>
                      <code className={styles.pathValue}>Suggested name: {expectedVideoName}</code>
                      <div className={styles.fileActions}>
                        <button type="button" className={styles.filePrimaryAction} onClick={p.onAddVideo}>
                          Add video entry
                        </button>
                        <button
                          type="button"
                          className={styles.fileAction}
                          aria-label={`Enter video manually for epoch ${row.epoch}`}
                          onClick={p.onAddManualVideo}
                        >
                          Enter manually
                        </button>
                        <button type="button" className={styles.fileGhostAction} onClick={p.onMarkNoVideo}>
                          Mark no video
                        </button>
                      </div>
                    </>
                  )}
                  {row.videoPresence === 'absent' && (
                    <>
                      <span className={styles.pathValue}>Declared no video for this epoch</span>
                      <div className={styles.fileActions}>
                        <button type="button" className={styles.fileAction} onClick={p.onAddVideo}>Add video after all</button>
                        <button type="button" className={styles.fileGhostAction} onClick={p.onUndoNoVideo}>Undo no video</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>


        {hasOpto && (
          <section className={styles.group} aria-labelledby={`epoch-${row.epoch}-opto-heading`}>
            <h3 id={`epoch-${row.epoch}-opto-heading`} className={styles.groupHeading}>Stimulation</h3>
            <p>{row.opto ? `${row.opto.entry.name || 'Unnamed protocol'} · ${row.opto.entry.power_in_mW ?? '—'} mW` : 'No stimulation recorded for this epoch.'}</p>
            <Button variant="secondary" onClick={p.onEditProtocol}>
              {row.opto ? 'Edit stimulation protocol' : 'Add stimulation protocol'}
            </Button>
          </section>
        )}

      </div>
      </div>
    </>
  );
}

/** Props for the per-day task-context editor ("Edit for this day"). */
interface TaskContextFormProps {
  /** The epoch row being edited (its EFFECTIVE environment / cameras). */
  row: EpochGridRow;
  /** The animal's cameras (the checklist). */
  cameras: Camera[];
  /** The owning task type, for the "task default" placeholder/hint. */
  taskType: TaskType | null;
  /** Save the day's values (only the fields that actually differ are recorded). */
  onSave: (context: TaskContextPatch) => void;
  /** Drop this day's values and follow the task type again. */
  onUseTaskDefault: () => void;
  /** Close without writing. */
  onCancel: () => void;
}

/**
 * Inline editor for what THIS day's occurrence of the task actually used — its room and its
 * cameras. Prefilled with the effective values (the day's own if it recorded any, else the task
 * type's), so the common case is confirm-or-tweak rather than retype. Saving records only what
 * genuinely differs from the task default, so a day that matches the default stays "following the
 * default" rather than silently pinning today's value forever.
 */
function TaskContextForm({ row, cameras, taskType, onSave, onUseTaskDefault, onCancel }: TaskContextFormProps) {
  const defaultEnvironment = (taskType?.task_environment as string | undefined) ?? '';
  const defaultCameras = Array.isArray(taskType?.camera_id) ? taskType.camera_id : [];
  const [environment, setEnvironment] = useState(row.taskEnvironment);
  const [selected, setSelected] = useState<string[]>(row.cameras.map((id) => String(id)));

  const toggleCamera = (id: number | string) => {
    const key = String(id);
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSave = () => {
    // Preserve the RECORDED order of the cameras that stay selected, then append newly selected ones
    // in catalog order. The converter reads the FIRST task camera's calibration for the epoch's
    // position scale, so re-sorting this list into catalog order would silently change
    // meters_per_pixel — a room-only edit must leave the references byte-identical. Ids keep their
    // ORIGINAL type (integers downstream), never the string keys the checkboxes track.
    const keptCameras = row.cameras.filter((id) => selected.includes(String(id)));
    const addedCameras = cameras
      .filter(
        (camera) =>
          selected.includes(String(camera?.id)) &&
          !row.cameras.some((id) => String(id) === String(camera?.id))
      )
      .map((c) => c.id);
    const nextCameras = [...keptCameras, ...addedCameras];
    const trimmed = environment.trim();
    onSave({
      // A BLANK environment is never a valid exported value, so an emptied field means "use the
      // task default" rather than recording `''` on the day.
      task_environment: trimmed === '' || trimmed === defaultEnvironment ? null : trimmed,
      camera_id:
        nextCameras.length === defaultCameras.length &&
        nextCameras.every((id, i) => String(id) === String(defaultCameras[i]))
          ? null
          : nextCameras,
    });
  };

  return (
    <div className={styles.taskContextForm}>
      <label className={styles.stackedField}>
        <span className={styles.fieldLabel}>Environment for this day</span>
        <input
          type="text"
          value={environment}
          placeholder={defaultEnvironment || 'e.g. HaightLeft'}
          onChange={(e) => setEnvironment(e.target.value)}
        />
      </label>
      <fieldset className={styles.stackedField}>
        <legend className={styles.fieldLabel}>Cameras used this day</legend>
        {cameras.length === 0 ? (
          <span className={styles.derivedNote}>This animal has no cameras yet.</span>
        ) : (
          <div className={styles.taskContextCameras}>
            {cameras.map((camera) => (
              <label key={String(camera.id)} className={styles.taskContextCamera}>
                <input
                  type="checkbox"
                  checked={selected.includes(String(camera.id))}
                  onChange={() => toggleCamera(camera.id)}
                />
                {camera.camera_name || `camera ${camera.id}`}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <p className={styles.groupNote}>
        Task default: {defaultEnvironment || '(none)'}
        {defaultCameras.length > 0
          ? ` · ${defaultCameras.map((id) => cameraName(cameras, id)).join(', ')}`
          : ' · no cameras'}
      </p>
      <div className={styles.taskContextActions}>
        <Button variant="primary" size="small" onClick={handleSave}>
          Save for this day
        </Button>
        <Button variant="secondary" size="small" onClick={onUseTaskDefault}>
          Use task default
        </Button>
        <Button variant="neutral" size="small" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Combine identical source contexts for a concise review without altering recorded epochs. */
function groupCopiedContexts(instances: TaskInstance[]): TaskInstance[] {
  const groups = new Map<string, TaskInstance>();
  for (const instance of instances) {
    const key = JSON.stringify([instance.taskTypeId, instance.task_environment, instance.camera_id]);
    const group = groups.get(key);
    if (group) group.task_epochs.push(...instance.task_epochs);
    else groups.set(key, { ...instance, task_epochs: [...instance.task_epochs] });
  }
  return [...groups.values()].map((group) => ({ ...group, task_epochs: group.task_epochs.sort((a, b) => a - b) }));
}
