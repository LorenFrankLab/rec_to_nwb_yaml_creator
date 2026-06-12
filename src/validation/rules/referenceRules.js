/**
 * @fileoverview Camera / file / task-epoch / FsGUI reference-integrity rules (extracted from
 * rulesValidation.js, Phase split).
 *
 * Cross-reference rules over the day's task / video / file / FsGUI rows: cameras must exist + be
 * unique, video/file/FsGUI epochs must match a task epoch, and FsGUI protocols additionally require
 * an existing camera, a backing behavioral-event DIO output, and a complete optogenetics config.
 * These mirror exactly what trodes_to_nwb dereferences (silent drops + crashes otherwise). Pure;
 * moved verbatim.
 */

import { duplicateTaskEpochs } from '../taskEpochs';

/**
 * Rules 1 / 2: tasks / associated video files reference cameras but the cameras table is absent.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function missingCameraRules(model) {
  const issues = [];

  // Rule 1: Tasks with camera_ids require cameras to be defined
  // Only trigger if tasks have non-empty camera_id arrays
  if (!model.cameras && Array.isArray(model.tasks) && model.tasks.length > 0) {
    const tasksWithCameras = model.tasks.some(task =>
      task.camera_id && Array.isArray(task.camera_id) && task.camera_id.length > 0
    );

    if (tasksWithCameras) {
      issues.push({
        path: 'tasks',
        code: 'missing_camera',
        repairSurface: 'day',
        severity: 'error',
        message: 'Tasks have camera_ids, but no cameras are defined'
      });
    }
  }

  // Rule 2: Associated video files with camera_ids require cameras
  // Only trigger if video files have non-empty camera_id arrays
  if (!model.cameras && Array.isArray(model.associated_video_files) && model.associated_video_files.length > 0) {
    // associated_video_files[].camera_id is a SCALAR integer (schema), unlike the
    // task camera_id ARRAY — so a video referencing camera 0 with no cameras table
    // must still trip the missing-camera rule.
    const videosWithCameras = model.associated_video_files.some(video =>
      video?.camera_id !== undefined && video?.camera_id !== null && video?.camera_id !== ''
    );

    if (videosWithCameras) {
      issues.push({
        path: 'associated_video_files',
        code: 'missing_camera',
        repairSurface: 'day',
        severity: 'error',
        message: 'Associated video files have camera_ids, but no cameras are defined'
      });
    }
  }

  return issues;
}

/**
 * Rule 9: dangling camera references — every tasks[].camera_id and scalar
 * associated_video_files[].camera_id must reference an existing cameras[].id.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function danglingCameraReferences(model) {
  const issues = [];

  // Every value in each tasks[].camera_id ARRAY and each scalar
  // associated_video_files[].camera_id must reference an existing cameras[].id.
  // (Existing Rules 1/2 only catch the no-cameras-at-all case; this catches a
  // reference to a camera id that no camera defines — e.g. after a camera is
  // deleted or a CSV/copy import introduces a stale id.)
  // Only when a cameras array is present. When `cameras` is entirely absent,
  // Rules 1/2 above already report "no cameras defined" — don't double-report.
  const validCameraIds = Array.isArray(model.cameras)
    ? new Set(model.cameras.map((c) => c?.id).filter((id) => id !== undefined && id !== null))
    : null;
  if (validCameraIds) (Array.isArray(model.tasks) ? model.tasks : []).forEach((task, ti) => {
    if (!Array.isArray(task?.camera_id)) return;
    task.camera_id.forEach((cid) => {
      if (cid === undefined || cid === null) return;
      if (!validCameraIds.has(cid)) {
        issues.push({
          path: `tasks[${ti}].camera_id`,
          field: 'camera_id',
          step: 'epochs',
          actionLabel: 'Fix task camera',
          code: 'dangling_camera_ref',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Task ${ti + 1}${task.task_name ? ` ("${task.task_name}")` : ''} references ` +
            `camera id ${cid}, but no camera with that id is defined. Pick an existing ` +
            `camera or restore the missing one.`,
        });
      }
    });
  });
  // Video camera_id is a SCALAR integer, not an array (schema nwb_schema.json:892).
  if (validCameraIds) (Array.isArray(model.associated_video_files) ? model.associated_video_files : []).forEach((video, vi) => {
    const cid = video?.camera_id;
    // A blank/empty camera_id is an incomplete row; the schema's required/type
    // check owns that with a clear message — don't emit "references camera id ,".
    if (cid === undefined || cid === null || cid === '') return;
    if (!validCameraIds.has(cid)) {
      issues.push({
        path: `associated_video_files[${vi}].camera_id`,
        field: 'camera_id',
        step: 'epochs',
        actionLabel: 'Fix video camera',
        code: 'dangling_camera_ref',
        repairSurface: 'day',
        severity: 'error',
        message:
          `Video ${vi + 1}${video.name ? ` ("${video.name}")` : ''} references camera id ` +
          `${cid}, but no camera with that id is defined. Pick an existing camera or ` +
          `restore the missing one.`,
      });
    }
  });

  return issues;
}

/**
 * Rule 15: task/video/file epoch dependencies — task epochs are unique across tasks, and each
 * non-empty associated_video_files / associated_files entry's task_epochs matches some task epoch.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function taskEpochReferences(model) {
  const issues = [];

  // (a) task epochs are unique across task rows — Spyglass TaskEpoch is keyed by
  //     session + epoch, so the same epoch number in two tasks collides.
  // (b) each non-empty associated_video_files entry has a task_epochs that matches
  //     some task's task_epochs — an orphaned video silently does not import
  //     (common_behav.py:451, common_task.py:240). Scalar camera_id validity is
  //     Rule 9.
  // A task with epochs and no camera is the explicitly-allowed no-camera path (a
  // camera-less epoch is valid; only a *video* needs a backing epoch + camera).
  if (Array.isArray(model.tasks) && model.tasks.length > 0) {
    // Number-normalized via the shared helper so a corrupt mixed-type epoch (`1` vs `"1"`) is the
    // SAME epoch — it is downstream — and the inline task-table badge can never drift from this gate.
    duplicateTaskEpochs(model.tasks).forEach((epoch) => {
      issues.push({
        path: 'tasks',
        field: 'task_epochs',
        step: 'epochs',
        actionLabel: 'Fix task epochs',
        code: 'duplicate_task_epoch',
        repairSurface: 'day',
        severity: 'error',
        message:
          `Task epoch ${epoch} is used by more than one task. Each epoch belongs to a ` +
          `single task — duplicates collide on the Spyglass TaskEpoch key.`,
      });
    });
  }

  if (Array.isArray(model.associated_video_files) && model.associated_video_files.length > 0) {
    const taskEpochSet = new Set();
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task) => {
      (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((e) => {
        if (e !== undefined && e !== null) taskEpochSet.add(e);
      });
    });
    model.associated_video_files.forEach((video, vi) => {
      const epoch = video?.task_epochs;
      // Blank/empty task_epochs is an incomplete row; schema required/type owns it.
      if (epoch === undefined || epoch === null || epoch === '') return;
      if (!taskEpochSet.has(epoch)) {
        issues.push({
          path: `associated_video_files[${vi}].task_epochs`,
          field: 'task_epochs',
          step: 'epochs',
          actionLabel: 'Fix video epoch',
          code: 'orphaned_video',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Video ${vi + 1}${video.name ? ` ("${video.name}")` : ''} references task epoch ` +
            `${epoch}, which no task defines. Spyglass silently drops videos without a ` +
            `matching task epoch — point it at an existing epoch.`,
        });
      }
    });
  }

  // orphaned_file: an associated_files[].task_epochs (scalar) must match some
  // task's epochs. Preserved (never silently scrubbed) stale references surface
  // here so the user can repair them instead of losing the value (Load-Time Orphan
  // Visibility Contract).
  if (Array.isArray(model.associated_files) && model.associated_files.length > 0) {
    const taskEpochSet = new Set();
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task) => {
      (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((e) => {
        if (e !== undefined && e !== null) taskEpochSet.add(e);
      });
    });
    model.associated_files.forEach((file, fi) => {
      const epoch = file?.task_epochs;
      if (epoch === undefined || epoch === null || epoch === '') return; // schema owns empty
      if (!taskEpochSet.has(epoch)) {
        issues.push({
          path: `associated_files[${fi}].task_epochs`,
          field: 'task_epochs',
          step: 'epochs',
          actionLabel: 'Fix file epoch',
          code: 'orphaned_file',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Associated file ${fi + 1}${file.name ? ` ("${file.name}")` : ''} references task ` +
            `epoch ${epoch}, which no task defines. Point it at an existing epoch or remove it.`,
        });
      }
    });
  }

  return issues;
}

/**
 * Rule 15c: fs_gui_yamls reference integrity (optogenetics, day-level) — each FsGUI protocol's
 * camera_id / epochs / dio_output_name must resolve, and FsGUI rows require a complete optogenetics
 * configuration (otherwise conversion crashes).
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function fsGuiReferences(model) {
  const issues = [];

  // Each FsGUI protocol's `camera_id` must reference an existing camera and each of its `epochs`
  // must match a task epoch — otherwise conversion CRASHES or silently corrupts: an
  // out-of-range epoch is an IndexError into the epochs table (an in-range WRONG epoch
  // silently aliases another epoch's start/stop times), and a missing camera raises a
  // ValueError (the converter reads camera only for speed/spatial-filter protocols). The
  // editor constrains NEW edits to controlled choices, but an imported/stale value (a
  // deleted camera, a renumbered epoch) is only caught here.
  if (Array.isArray(model.fs_gui_yamls) && model.fs_gui_yamls.length > 0) {
    const validCameraIdSet = Array.isArray(model.cameras)
      ? new Set(model.cameras.map((c) => c?.id).filter((id) => id !== undefined && id !== null))
      : new Set();
    const taskEpochSet = new Set();
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task) => {
      (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((e) => {
        if (e !== undefined && e !== null) taskEpochSet.add(e);
      });
    });
    // Behavioral-event names the FsGUI dio_output_name can point at (the converter
    // indexes nwbfile...behavioral_events[dio_output_name], a KeyError on a miss).
    const behavioralEventNames = new Set(
      (Array.isArray(model.behavioral_events) ? model.behavioral_events : [])
        .map((e) => e?.name)
        .filter((n) => typeof n === 'string' && n !== '')
    );

    // FsGUI epochs make the converter call add_optogenetic_epochs, which dereferences the
    // optogenetics lab metadata that add_optogenetics only writes when the all-or-nothing
    // gate passed. So FsGUI rows REQUIRE a complete optogenetics configuration — otherwise
    // conversion crashes (KeyError on optogenetic_experiment_metadata). This also catches
    // a stale fs_gui block left behind after optogenetics was turned off.
    const optoComplete =
      model.opto_excitation_source?.length > 0 &&
      model.optical_fiber?.length > 0 &&
      model.virus_injection?.length > 0 &&
      typeof model.optogenetic_stimulation_software === 'string' &&
      model.optogenetic_stimulation_software.trim() !== '';
    if (!optoComplete) {
      issues.push({
        path: 'fs_gui_yamls',
        field: 'fs_gui_yamls',
        step: 'epochs',
        actionLabel: 'Complete or remove FsGUI',
        code: 'fs_gui_requires_optogenetics',
        repairSurface: 'day',
        severity: 'error',
        message:
          `FsGUI optogenetics protocols are present, but the animal's optogenetics ` +
          `configuration is incomplete (or off). trodes_to_nwb crashes converting FsGUI ` +
          `protocols without the full optogenetics implant metadata. Complete optogenetics ` +
          `in Animal Setup, or remove these FsGUI protocols.`,
      });
    }

    model.fs_gui_yamls.forEach((fsGui, fi) => {
      const cid = fsGui?.camera_id;
      // Blank/empty camera_id is an incomplete row owned by the schema required check.
      if (cid !== undefined && cid !== null && cid !== '' && !validCameraIdSet.has(cid)) {
        issues.push({
          path: `fs_gui_yamls[${fi}].camera_id`,
          field: 'camera_id',
          step: 'epochs',
          actionLabel: 'Fix FsGUI camera',
          code: 'dangling_camera_ref',
          repairSurface: 'day',
          severity: 'error',
          message:
            `FsGUI protocol ${fi + 1}${fsGui.name ? ` ("${fsGui.name}")` : ''} references camera id ` +
            `${cid}, but no camera with that id is defined. Pick an existing camera or restore it.`,
        });
      }

      (Array.isArray(fsGui?.epochs) ? fsGui.epochs : []).forEach((epoch) => {
        if (epoch === undefined || epoch === null || epoch === '') return;
        if (!taskEpochSet.has(epoch)) {
          issues.push({
            path: `fs_gui_yamls[${fi}].epochs`,
            field: 'epochs',
            step: 'epochs',
            actionLabel: 'Fix FsGUI epochs',
            code: 'orphaned_fs_gui_epoch',
            repairSurface: 'day',
            severity: 'error',
            message:
              `FsGUI protocol ${fi + 1}${fsGui.name ? ` ("${fsGui.name}")` : ''} references task epoch ` +
              `${epoch}, which no task defines. Point it at an existing epoch or remove it.`,
          });
        }
      });

      // dio_output_name must name an existing behavioral (DIO) event — the converter
      // indexes behavioral_events by it. A blank value is owned by the schema required check.
      const dio = fsGui?.dio_output_name;
      if (typeof dio === 'string' && dio.trim() !== '' && !behavioralEventNames.has(dio)) {
        issues.push({
          path: `fs_gui_yamls[${fi}].dio_output_name`,
          field: 'dio_output_name',
          step: 'epochs',
          actionLabel: 'Fix FsGUI DIO output',
          code: 'dangling_dio_output',
          repairSurface: 'day',
          severity: 'error',
          message:
            `FsGUI protocol ${fi + 1}${fsGui.name ? ` ("${fsGui.name}")` : ''} uses DIO output ` +
            `"${dio}", which no behavioral event defines. trodes_to_nwb looks up the behavioral ` +
            `event by this name and fails if it is missing — use an existing behavioral event name.`,
        });
      }
    });
  }

  return issues;
}

/**
 * Rule 18: camera id uniqueness — the converter names NWB camera devices `camera_device {id}` and
 * videos dereference that exact name, so duplicate cameras[].id collide downstream.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function cameraIdUniqueness(model) {
  const issues = [];

  if (Array.isArray(model.cameras) && model.cameras.length > 0) {
    const seenCam = new Set();
    const reportedCam = new Set();
    model.cameras.forEach((camera) => {
      const id = camera?.id;
      if (id === undefined || id === null) return;
      if (seenCam.has(id) && !reportedCam.has(id)) {
        reportedCam.add(id);
        issues.push({
          path: 'cameras',
          field: 'id',
          step: 'devices',
          actionLabel: 'Use a unique camera id',
          code: 'duplicate_camera_id',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Duplicate camera id "${id}". Camera ids must be unique — the converter names ` +
            `each NWB camera device "camera_device ${id}" and videos reference it by id.`,
        });
      }
      seenCam.add(id);
    });
  }

  return issues;
}
