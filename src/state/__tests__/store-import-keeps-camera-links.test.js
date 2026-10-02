/**
 * Loading a file must not clear camera links that are valid in that file.
 *
 * The import leaves out a section that fails validation, for example the cameras when one of them
 * is missing a required field. The camera cleanup then saw task, video and FsGUI links to cameras
 * the form no longer had, and dropped them. A task's camera list may be empty, so that loss was
 * silent, and adding the cameras back did not restore the links. An import now keeps them;
 * validation reports each one (`unknown_camera`) until the cameras are fixed, so none is ever
 * downloaded dangling.
 *
 * Editing the form still drops links to a camera the edit removes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { useStore } from '../store';
import { importFiles } from '../../features/importExport';
import { validate } from '../../validation';

const SAMPLE = path.join(__dirname, '../../__tests__/fixtures/valid/20230622_sample_metadata.yml');

const sampleSession = () => YAML.parse(fs.readFileSync(SAMPLE, 'utf8'));

const cameraLinks = (model) => ({
  tasks: model.tasks.map((task) => task.camera_id),
  videos: model.associated_video_files.map((video) => video.camera_id),
  fsGui: model.fs_gui_yamls.map((fsGui) => fsGui.camera_id),
});

/**
 * Paths at which the download is blocked.
 *
 * @param {object} model - Form state
 * @returns {string[]} Paths of the validation issues
 */
const blockedPaths = (model) => validate(model).map((issue) => issue.path);

/**
 * Import `model` the way the page does: importFiles, then load what it returns.
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

describe('Store - importing a file keeps its camera links', () => {
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
    expect(cameraLinks(hook.result.current.model)).toEqual(cameraLinks(sampleSession()));
  });

  it('keeps camera links when the import leaves out the cameras', async () => {
    const hook = renderHook(() => useStore());
    const file = sampleSession();
    delete file.cameras[0].lens; // a required field: the import leaves the cameras out

    const result = await importInto(hook, file);
    const model = hook.result.current.model;

    expect(excludedSections(result)).toEqual(['cameras']);
    expect(model.cameras).toEqual([]);
    expect(cameraLinks(model)).toEqual(cameraLinks(file));
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
    delete edited.cameras[0].lens;
    await importInto(hook, edited);

    expect(cameraLinks(hook.result.current.model)).toEqual(cameraLinks(edited));
  });

  it('restores the links when the cameras are added back one at a time', async () => {
    const hook = renderHook(() => useStore());
    const file = sampleSession();
    delete file.cameras[0].lens;
    await importInto(hook, file);

    // New cameras are numbered 0, then 1: the ids the file's links use.
    await act(async () => {
      hook.result.current.actions.addArrayItem('cameras');
    });
    await act(async () => {
      hook.result.current.actions.addArrayItem('cameras');
    });
    const model = hook.result.current.model;

    expect(model.cameras.map((camera) => camera.id)).toEqual([0, 1]);
    expect(cameraLinks(model)).toEqual(cameraLinks(file));
    expect(validate(model).filter((issue) => issue.code === 'unknown_camera')).toEqual([]);
  });

  it('still drops links to a camera removed after an import', async () => {
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

  // Task-epoch references are still cleared when the import leaves out the tasks (no rule here
  // reports a dangling one), but the download is blocked at each cleared field, so the loss is
  // never silent.
  it('blocks the download at every epoch reference when the import leaves out the tasks', async () => {
    const hook = renderHook(() => useStore());
    const file = sampleSession();
    delete file.tasks[0].task_environment; // a required field: the import leaves the tasks out

    const result = await importInto(hook, file);

    expect(excludedSections(result)).toEqual(['tasks']);
    expect(blockedPaths(hook.result.current.model)).toEqual(
      expect.arrayContaining([
        'associated_files[0].task_epochs',
        'associated_files[1].task_epochs',
        'associated_video_files[0].task_epochs',
        'associated_video_files[1].task_epochs',
        'fs_gui_yamls[0].epochs',
        'fs_gui_yamls[1].epochs',
      ])
    );
  });
});
