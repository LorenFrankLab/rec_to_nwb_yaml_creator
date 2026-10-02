/**
 * Loading a file into the legacy form must not clear references that are valid in that file.
 *
 * The import leaves out a section that fails validation, for example cameras when one is named
 * "1" (a placeholder). The reference cleanup then saw task, video and FsGUI references to cameras
 * (or task epochs) the form no longer had, and cleared them. A task's camera list may be empty, so
 * that loss was silent, and adding the cameras back did not restore the links. An import now keeps
 * those references; validation reports each one until the section is fixed, so none is ever
 * downloaded dangling.
 *
 * Editing the form still clears references to a camera or task epoch the edit removes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { useStore } from '../store';
import { importFiles } from '../../features/importExport';
import { validate, blockingIssues } from '../../validation';

const SAMPLE = path.join(__dirname, '../../__tests__/fixtures/valid/20230622_sample_metadata.yml');

/** The sample session, adjusted so it imports with nothing left out under the current rules. */
const sampleSession = () => {
  const model = YAML.parse(fs.readFileSync(SAMPLE, 'utf8'));
  model.subject.subject_id = 'sample-rat';
  model.associated_files.forEach((file, index) => {
    file.path = `/data/sample/associated${index + 1}.txt`;
  });
  return model;
};

const cameraReferences = (model) => ({
  tasks: model.tasks.map((task) => task.camera_id),
  videos: model.associated_video_files.map((video) => video.camera_id),
  fsGui: model.fs_gui_yamls.map((fsGui) => fsGui.camera_id),
});

const epochReferences = (model) => ({
  files: model.associated_files.map((file) => file.task_epochs),
  videos: model.associated_video_files.map((video) => video.task_epochs),
  fsGui: model.fs_gui_yamls.map((fsGui) => fsGui.epochs),
});

/**
 * Paths at which the download is blocked.
 *
 * @param {object} model - Form state
 * @returns {string[]} Paths of the blocking validation issues
 */
const blockedPaths = (model) => blockingIssues(validate(model)).map((issue) => issue.path);

/**
 * Import `model` the way the legacy form does: importFiles, then load what it returns.
 *
 * @param {object} hook - renderHook result for useStore
 * @param {object} model - Metadata to write to the uploaded file
 * @returns {Promise<object>} The importFiles result
 */
async function importInto(hook, model) {
  const file = new File([YAML.stringify(model)], 'session.yml', { type: 'text/yaml' });
  const result = await importFiles(file);
  await act(async () => {
    hook.result.current.actions.loadImportedFormData(result.formData);
  });
  return result;
}

const excludedSections = (result) => result.importSummary.excludedFields.map((entry) => entry.field);

describe('Store - importing a file keeps its references', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports the sample session with nothing left out', async () => {
    const hook = renderHook(() => useStore());
    const result = await importInto(hook, sampleSession());

    expect(excludedSections(result)).toEqual([]);
    expect(cameraReferences(hook.result.current.model)).toEqual(cameraReferences(sampleSession()));
  });

  it('keeps camera links when the import leaves out the cameras', async () => {
    const hook = renderHook(() => useStore());
    const file = sampleSession();
    file.cameras[0].camera_name = '1'; // a placeholder name: the import leaves the cameras out

    const result = await importInto(hook, file);
    const model = hook.result.current.model;

    expect(excludedSections(result)).toEqual(['cameras']);
    expect(model.cameras).toEqual([]);
    expect(cameraReferences(model)).toEqual(cameraReferences(file));
    // Until the cameras are fixed, every kept link blocks the download.
    expect(blockedPaths(model)).toEqual(
      expect.arrayContaining([
        'tasks[0].camera_id',
        'tasks[1].camera_id',
        'associated_video_files[0].camera_id',
        'associated_video_files[1].camera_id',
        'fs_gui_yamls[0].camera_id',
        'fs_gui_yamls[1].camera_id',
      ])
    );
  });

  it('keeps camera links when the same file is loaded again with a broken camera', async () => {
    const hook = renderHook(() => useStore());
    await importInto(hook, sampleSession());

    const edited = sampleSession();
    edited.cameras[0].camera_name = '1';
    await importInto(hook, edited);

    expect(cameraReferences(hook.result.current.model)).toEqual(cameraReferences(edited));
  });

  it('restores the links when the cameras are added back one at a time', async () => {
    const hook = renderHook(() => useStore());
    const file = sampleSession();
    file.cameras[0].camera_name = '1';
    await importInto(hook, file);

    // New cameras are numbered 0, then 1: the ids the file's references use.
    await act(async () => {
      hook.result.current.actions.addArrayItem('cameras');
    });
    await act(async () => {
      hook.result.current.actions.addArrayItem('cameras');
    });
    const model = hook.result.current.model;

    expect(model.cameras.map((camera) => camera.id)).toEqual([0, 1]);
    expect(cameraReferences(model)).toEqual(cameraReferences(file));
    expect(blockingIssues(validate(model)).filter((issue) => issue.code === 'dangling_camera_ref')).toEqual([]);
  });

  it('keeps task-epoch references when the import leaves out the tasks', async () => {
    const hook = renderHook(() => useStore());
    const file = sampleSession();
    delete file.tasks[0].task_environment; // a required field: the import leaves the tasks out

    const result = await importInto(hook, file);
    const model = hook.result.current.model;

    expect(excludedSections(result)).toEqual(['tasks']);
    expect(model.tasks).toEqual([]);
    expect(epochReferences(model)).toEqual(epochReferences(file));
    expect(blockedPaths(model)).toEqual(
      expect.arrayContaining([
        'associated_files[0].task_epochs',
        'associated_files[1].task_epochs',
        'associated_video_files[0].task_epochs',
        'associated_video_files[1].task_epochs',
        'fs_gui_yamls[0].epochs',
        'fs_gui_yamls[1].epochs',
      ])
    );

    // Adding a task (still without epochs) does not clear them either.
    await act(async () => {
      hook.result.current.actions.addArrayItem('tasks');
    });
    expect(epochReferences(hook.result.current.model)).toEqual(epochReferences(file));
  });

  it('still clears references to a camera removed after an import', async () => {
    const hook = renderHook(() => useStore());
    await importInto(hook, sampleSession());

    await act(async () => {
      hook.result.current.actions.removeArrayItem(1, 'cameras'); // the wtrack task's camera
    });
    const model = hook.result.current.model;

    expect(model.cameras.map((camera) => camera.id)).toEqual([0]);
    expect(model.tasks.map((task) => task.camera_id)).toEqual([[0], []]);
    expect(model.associated_video_files.map((video) => video.camera_id)).toEqual([0, 0]);
  });

  it('still clears references to a task removed after an import', async () => {
    const hook = renderHook(() => useStore());
    await importInto(hook, sampleSession());

    await act(async () => {
      hook.result.current.actions.removeArrayItem(1, 'tasks'); // wtrack: epochs 2 and 4
    });

    expect(epochReferences(hook.result.current.model)).toEqual({
      files: [1, ''],
      videos: [1, ''],
      fsGui: [[1], []],
    });
  });
});
