/**
 * Import & Repair screen (validation slice).
 *
 * Drives the USER-FACING flow against a LIVE store and the REAL pure spine (no mocks): pick a
 * non-conforming file, see each field flagged with a suggested fix from the shared validator, watch
 * required-missing block the import, accept/fill, then commit through the existing import path and
 * land on a success state that links to the created animal / added day. Existing-day routing is
 * proven by importing onto a workspace that already has the subject.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { decodeYaml, encodeYaml } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import ImportRepair from '../index';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

const nonconformingYaml = fs.readFileSync(
  path.join(__dirname, '../../../__tests__/fixtures/import/nonconforming-remy.yml'),
  'utf8'
);

// A clean, decompose-valid export — used to exercise an importer-only precondition (no derivable
// recording date) that the validator can't see.
const cleanYaml = fs.readFileSync(
  path.join(__dirname, '../../../__tests__/fixtures/golden/workspace-export.realistic.yml'),
  'utf8'
);

/** The live workspace, captured for assertions. */
let captured;

/**
 * Render-only probe capturing the live workspace.
 * @returns {null} Renders nothing.
 */
function StoreProbe() {
  captured = useStoreContext().model.workspace;
  return null;
}

/**
 * A File-like object whose `.text()` resolves to the given content (jsdom's File does not always
 * expose `.text()`; the parse helper only calls that).
 * @param {string} name - File name.
 * @param {string} text - File contents.
 * @returns {{ name: string, text: () => Promise<string> }} The file-like object.
 */
function makeFile(name, text) {
  return { name, text: () => Promise.resolve(text) };
}

/**
 * Build a clean YAML file whose day references catalogs absent from the supplied existing animal.
 * @returns {string} YAML text.
 */
function existingCatalogGapYaml() {
  const model = decodeYaml(cleanYaml);
  model.cameras = [
    {
      id: 3,
      camera_name: 'arena_side',
      meters_per_pixel: 0.001,
      manufacturer: 'Allied',
      model: 'Mako',
      lens: '8mm',
    },
  ];
  model.data_acq_device = [
    { name: 'ImportedRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
  ];
  model.tasks = [
    {
      task_name: 'Run',
      task_description: 'run',
      task_environment: 'maze',
      camera_id: [3],
      task_epochs: [1],
    },
  ];
  model.associated_files = [];
  model.associated_video_files = [{ name: 'run_video', camera_id: 3, task_epochs: 1 }];
  return encodeYaml(model);
}

/**
 * Render the screen against an initial workspace.
 * @param {object} [animals] - Initial workspace.animals.
 * @param {object} [days] - Initial workspace.days.
 * @returns {object} The render result.
 */
function renderScreen(animals = {}, days = {}) {
  captured = null;
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <ImportRepair />
      <StoreProbe />
    </StoreProvider>
  );
}

/**
 * Upload the non-conforming fixture and wait for the repair view.
 * @param {object} user - userEvent session.
 */
async function uploadNonconforming(user) {
  const input = screen.getByLabelText(/choose a metadata yaml file/i);
  await user.upload(input, makeFile('nonconforming-remy.yml', nonconformingYaml));
  await screen.findByRole('heading', { name: /needs attention/i });
}

describe('ImportRepair — flagging + suggested fixes', () => {
  it('flags each non-conforming field with the suggested fix from the shared validator', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    const attention = screen.getByRole('region', { name: /needs attention/i });
    expect(within(attention).getByText('Rattus norvegicus')).toBeInTheDocument();
    expect(within(attention).getByText('M')).toBeInTheDocument();
    expect(within(attention).getByText('485')).toBeInTheDocument();
    // The scalar experimenter name is preserved verbatim (it appears as both the original and the
    // list-wrapped suggestion — identical text, so there are two).
    expect(within(attention).getAllByText(/Guidera, Jennifer/).length).toBeGreaterThanOrEqual(1);
    // The empty location is a user-input row (no laundered value).
    expect(within(attention).getByLabelText(/Electrode group location/i)).toBeInTheDocument();
  });

  it('blocks import until the required-but-missing date_of_birth is supplied', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    const required = screen.getByRole('region', { name: /required, but missing/i });
    expect(within(required).getByLabelText(/Date of birth/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import as new animal/i })).toBeDisabled();
  });

  it('keeps import disabled while any flagged item is unresolved (every item must be resolved)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    // Accept every suggestion EXCEPT species, and fill the user-input fields.
    for (const btn of screen.getAllByRole('button', { name: /^accept /i })) {
      if (!/species/i.test(btn.getAttribute('aria-label') || '')) await user.click(btn);
    }
    await user.type(screen.getByLabelText(/Electrode group location/i), 'CA1');
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '2023-01-10' } });

    // One item (species) is still unresolved → import stays blocked. This is the same gate that
    // forces a (non-validator) volume-shim conflict to be reconciled before import.
    expect(screen.getByRole('button', { name: /import as new animal/i })).toBeDisabled();
  });

  it('surfaces a manual recording-date input when the importer cannot derive one', async () => {
    const user = userEvent.setup();
    renderScreen();
    // A clean, valid export but with a date-less session_id and a non-conventional filename, so the
    // importer can't derive the recording date. Validation passes, yet import stays blocked until
    // the user supplies the import-only recording date.
    const noDateYaml = cleanYaml.replace('session_id: remy_20230622', 'session_id: remy');
    const input = screen.getByLabelText(/choose a metadata yaml file/i);
    await user.upload(input, makeFile('metadata.yml', noDateYaml));

    await screen.findByText(/will create a new animal/i);
    const importBtn = screen.getByRole('button', { name: /import as new animal/i });
    expect(importBtn).toBeDisabled();
    const required = screen.getByRole('region', { name: /required, but missing/i });
    fireEvent.change(within(required).getByLabelText(/recording date/i), {
      target: { value: '2023-06-22' },
    });
    expect(importBtn).toBeEnabled();
  });
});

describe('ImportRepair — commit', () => {
  it('groups multiple ready day files into one animal before committing', async () => {
    const user = userEvent.setup();
    renderScreen();

    const secondDayYaml = cleanYaml.replaceAll('20230622', '20230623');
    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', cleanYaml),
      makeFile('06232023_remy_metadata.yml', secondDayYaml),
    ]);

    const reviewButton = await screen.findByRole('button', {
      name: /review 2 ready files/i,
    });
    expect(screen.getByText('2 ready')).toBeInTheDocument();
    await user.click(reviewButton);

    expect(
      screen.getByRole('region', { name: /batch import summary/i })
    ).toHaveTextContent(/2 recording days → 1 animal/i);
    expect(screen.getByRole('heading', { name: 'remy' })).toBeInTheDocument();
    expect(screen.getByText(/1 hardware configuration/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(Object.keys(captured.animals)).toEqual(['remy']);
    expect(Object.keys(captured.days).sort()).toEqual([
      'remy-2023-06-22',
      'remy-2023-06-23',
    ]);
  });

  it('creates a new animal and shows a success link once every fix is accepted', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    // Accept every suggested fix.
    for (const btn of screen.getAllByRole('button', { name: /^accept /i })) {
      await user.click(btn);
    }
    // Supply the user-input fields.
    await user.type(screen.getByLabelText(/Electrode group location/i), 'CA1');
    // jsdom date inputs don't reliably accept segmented userEvent typing — set the value directly.
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '2023-01-10' } });

    const importBtn = screen.getByRole('button', { name: /import as new animal/i });
    expect(importBtn).toBeEnabled();
    await user.click(importBtn);

    // The animal landed in the store…
    expect(Object.keys(captured.animals)).toContain('remy');
    // …and the success state links to it.
    const success = await screen.findByRole('region', { name: /import (complete|result)/i });
    const link = within(success).getByRole('link', { name: /remy/i });
    expect(link).toHaveAttribute('href', '#/animal/remy/days');
  });

  it('adds a recording day to an existing animal (existing-day routing)', async () => {
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        configurationHistory: [{ version: 1, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
      },
    });
    await uploadNonconforming(user);

    // The decision routes to the existing animal.
    expect(screen.getAllByText(/already exists/i)[0]).toBeInTheDocument();

    for (const btn of screen.getAllByRole('button', { name: /^accept /i })) {
      await user.click(btn);
    }
    await user.type(screen.getByLabelText(/Electrode group location/i), 'CA1');
    // jsdom date inputs don't reliably accept segmented userEvent typing — set the value directly.
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '2023-01-10' } });

    await user.click(screen.getByRole('button', { name: /add recording day/i }));

    // A day was added to the existing animal (no new animal created).
    expect(Object.keys(captured.animals)).toEqual(['remy']);
    expect(Object.keys(captured.days).length).toBe(1);
  });

  it('gates existing-animal catalog gaps until the user accepts selected catalog entries', async () => {
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    const input = screen.getByLabelText(/choose a metadata yaml file/i);
    await user.upload(
      input,
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml())
    );
    await screen.findByRole('heading', { name: /needs attention/i });

    const addButton = screen.getByRole('button', { name: /add recording day/i });
    expect(addButton).toBeDisabled();
    expect(screen.getAllByText(/animal "remy" does not have it/i)).toHaveLength(2);
    expect(screen.getByText(/Recording system "ImportedRig"/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Accept Camera 3/i }));
    expect(addButton).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));
    expect(addButton).toBeEnabled();
    await user.click(addButton);

    await screen.findByRole('heading', { name: /recording day added/i });
    expect(captured.animals.remy.cameras.map((camera) => camera.id)).toEqual([0, 3]);
    expect(captured.animals.remy.devices.data_acq_device.map((device) => device.name)).toEqual([
      'ExistingRig',
      'ImportedRig',
    ]);
    expect(Object.keys(captured.days)).toEqual(['remy-2023-06-22']);
  });

  it('does not merge catalog entries from a duplicate-date file excluded at batch preview', async () => {
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    const duplicateModel = decodeYaml(existingCatalogGapYaml());
    duplicateModel.cameras[0] = {
      ...duplicateModel.cameras[0],
      id: 4,
      camera_name: 'excluded_camera',
    };
    duplicateModel.data_acq_device[0] = {
      ...duplicateModel.data_acq_device[0],
      name: 'ExcludedRig',
    };
    duplicateModel.tasks[0].camera_id = [4];
    duplicateModel.associated_video_files[0].camera_id = 4;

    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml()),
      makeFile('20230622_remy_duplicate.yml', encodeYaml(duplicateModel)),
    ]);

    await user.click(await screen.findByRole('button', { name: /Accept Camera 3/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));
    await user.selectOptions(screen.getByLabelText('Review file'), '1');
    await user.click(screen.getByRole('button', { name: /Accept Camera 4/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));

    await user.click(screen.getByRole('button', { name: /Review 2 ready files/i }));
    expect(screen.getByRole('region', { name: /batch import summary/i })).toHaveTextContent(
      /1 recording day → 1 animal/i
    );
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(captured.animals.remy.cameras.map((camera) => camera.id)).toEqual([0, 3]);
    expect(captured.animals.remy.devices.data_acq_device.map((device) => device.name)).toEqual([
      'ExistingRig',
      'ImportedRig',
    ]);
  });
  it('keeps a retained file\'s catalog entries when an excluded duplicate shares its filename', async () => {
    // Order matters: a dated file, then a DATELESS "day.yml" that duplicates its date (excluded at
    // batch preview), then another "day.yml" for a new date (retained) that brings camera 5. The
    // retained file must be matched by its own identity, not by the basename the excluded file
    // also carries — otherwise camera 5 is dropped and the pre-flight rejects the whole animal.
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    const retainedModel = decodeYaml(existingCatalogGapYaml());
    retainedModel.session_id = 'remy_20230623';
    retainedModel.cameras[0] = { ...retainedModel.cameras[0], id: 5, camera_name: 'retained_camera' };
    retainedModel.tasks[0].camera_id = [5];
    retainedModel.associated_video_files[0].camera_id = 5;

    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml()),
      makeFile('day.yml', existingCatalogGapYaml()),
      makeFile('day.yml', encodeYaml(retainedModel)),
    ]);

    await user.click(await screen.findByRole('button', { name: /Accept Camera 3/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));
    await user.selectOptions(screen.getByLabelText('Review file'), '1');
    await user.click(screen.getByRole('button', { name: /Accept Camera 3/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));
    await user.selectOptions(screen.getByLabelText('Review file'), '2');
    await user.click(screen.getByRole('button', { name: /Accept Camera 5/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));

    await user.click(screen.getByRole('button', { name: /Review 3 ready files/i }));
    expect(screen.getByRole('region', { name: /batch import summary/i })).toHaveTextContent(
      /2 recording days → 1 animal/i
    );
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(screen.queryByRole('heading', { name: /could not import/i })).not.toBeInTheDocument();
    expect(captured.animals.remy.cameras.map((camera) => camera.id)).toEqual([0, 3, 5]);
    expect(Object.keys(captured.days)).toHaveLength(2);
  });
  it('keeps each day\'s explicit camera mapping when two days map the same source id to different existing cameras', async () => {
    // Both files reference source camera 3. The user maps day 1's to existing id 0 and day 2's to
    // existing id 1. Nothing is brought; each committed day keeps the id the user chose.
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        cameras: [
          { id: 0, camera_name: 'overhead_cam' },
          { id: 1, camera_name: 'side_cam' },
        ],
        devices: {
          data_acq_device: [
            { name: 'ImportedRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    const secondModel = decodeYaml(existingCatalogGapYaml());
    secondModel.session_id = 'remy_20230623';

    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml()),
      makeFile('06232023_remy_metadata.yml', encodeYaml(secondModel)),
    ]);

    // The map row renders both an Accept button (labelled with the map text) and the number input.
    const mapInput = () => screen.getByRole('spinbutton', { name: /Map camera 3 to existing camera id/i });
    await screen.findByRole('spinbutton', { name: /Map camera 3 to existing camera id/i });
    await user.type(mapInput(), '0');
    await user.selectOptions(screen.getByLabelText('Review file'), '1');
    await user.type(mapInput(), '1');

    await user.click(screen.getByRole('button', { name: /Review 2 ready files/i }));
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(screen.queryByRole('heading', { name: /could not import/i })).not.toBeInTheDocument();
    expect(captured.animals.remy.cameras.map((c) => c.id)).toEqual([0, 1]);
    expect(captured.days['remy-2023-06-22'].associated_video_files[0].camera_id).toBe(0);
    expect(captured.days['remy-2023-06-23'].associated_video_files[0].camera_id).toBe(1);
  });

  it('brings two new cameras that share a source id under distinct ids, and each day keeps its own', async () => {
    // Day 1 brings camera 3 "arena_side"; day 2 brings a DIFFERENT camera also numbered 3. The
    // second must land under a fresh id — never id 0, the animal's existing camera — and day 2's
    // video must point at that fresh id: the additions saved and the references written are one
    // catalog.
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    const wallModel = decodeYaml(existingCatalogGapYaml());
    wallModel.session_id = 'remy_20230623';
    wallModel.cameras[0] = { ...wallModel.cameras[0], camera_name: 'wall_cam' };

    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml()),
      makeFile('06232023_remy_metadata.yml', encodeYaml(wallModel)),
    ]);

    await user.click(await screen.findByRole('button', { name: /Accept Camera 3/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));
    await user.selectOptions(screen.getByLabelText('Review file'), '1');
    await user.click(screen.getByRole('button', { name: /Accept Camera 3/i }));
    await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));

    await user.click(screen.getByRole('button', { name: /Review 2 ready files/i }));
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(screen.queryByRole('heading', { name: /could not import/i })).not.toBeInTheDocument();
    const cameras = captured.animals.remy.cameras;
    expect(cameras.map((c) => c.camera_name)).toEqual(['existing_cam', 'arena_side', 'wall_cam']);
    const wall = cameras.find((c) => c.camera_name === 'wall_cam');
    expect([0, 3]).not.toContain(wall.id);
    expect(captured.days['remy-2023-06-23'].associated_video_files[0].camera_id).toBe(wall.id);
    expect(captured.days['remy-2023-06-22'].associated_video_files[0].camera_id).toBe(3);
  });
});

describe('ImportRepair — honest reporting of files that never made it', () => {
  it('names every unreadable file even when exactly one file decodes', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', cleanYaml),
      makeFile('broken-a.yml', 'not: [valid'),
      makeFile('broken-b.yml', 'also: [broken'),
    ]);

    // Only one file decoded, so the screen runs its single-file flow — the two unreadable files
    // must still be named, not silently dropped.
    await screen.findByText(/will create a new animal/i);
    const unreadable = screen.getByRole('region', { name: /could not be read/i });
    expect(within(unreadable).getByText(/broken-a\.yml/)).toBeInTheDocument();
    expect(within(unreadable).getByText(/broken-b\.yml/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /import as new animal/i }));

    // …and they are still named on the result screen, so "success" never overstates what happened.
    const notImported = await screen.findByRole('region', { name: /not imported/i });
    expect(within(notImported).getByText(/broken-a\.yml/)).toBeInTheDocument();
    expect(within(notImported).getByText(/broken-b\.yml/)).toBeInTheDocument();
  });

  it('does not link to an animal when the single-file import failed', async () => {
    const user = userEvent.setup();
    // The day this file imports already exists, so the executor pre-flight fails the animal.
    renderScreen(
      {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          days: ['remy-2023-06-22'],
          cameras: decodeYaml(cleanYaml).cameras,
          devices: {
            data_acq_device: [
              { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
            ],
            device: { name: ['Trodes'] },
            electrode_groups: [],
            ntrode_electrode_group_channel_map: [],
          },
          configurationHistory: [
            {
              version: 1,
              devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
              appliedToDays: [],
            },
          ],
        },
      },
      { 'remy-2023-06-22': { id: 'remy-2023-06-22', animalId: 'remy', date: '2023-06-22' } }
    );

    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06222023_remy_metadata.yml', cleanYaml)
    );
    await screen.findAllByText(/already exists/i);
    await user.click(screen.getByRole('button', { name: /add recording day/i }));

    await screen.findByRole('heading', { name: /import failed/i });
    expect(screen.queryByRole('link', { name: /^remy$/i })).not.toBeInTheDocument();
  });

  it('links a replaced animal to the id it was recreated under', async () => {
    const user = userEvent.setup();
    // The existing animal is a case variant of the imported subject_id, so `replace` deletes
    // "Remy" and recreates the animal under "remy".
    renderScreen({
      Remy: {
        id: 'Remy',
        subject: { subject_id: 'Remy' },
        days: [],
        cameras: decodeYaml(cleanYaml).cameras,
        devices: {
          data_acq_device: [
            { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    const secondDayYaml = cleanYaml.replaceAll('20230622', '20230623');
    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', cleanYaml),
      makeFile('06232023_remy_metadata.yml', secondDayYaml),
    ]);

    await user.click(await screen.findByRole('button', { name: /review 2 ready files/i }));
    await user.click(screen.getByRole('radio', { name: /replace the existing animal/i }));
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(Object.keys(captured.animals)).toEqual(['remy']);
    const success = screen.getByRole('region', { name: /import complete/i });
    expect(within(success).getByRole('link', { name: 'remy' })).toHaveAttribute(
      'href',
      '#/animal/remy/days'
    );
  });
});

describe('ImportRepair — repair rows and catalog additions', () => {
  it('keeps BOTH calibrations when two day files carry the same camera id recalibrated between them', async () => {
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
        configurationHistory: [
          {
            version: 1,
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
            appliedToDays: [],
          },
        ],
      },
    });

    // Two recording days that bring the SAME camera id / name, recalibrated between them. The
    // calibration IS the position scale, so the two days did not use one camera: each keeps its own
    // row (finding F1) — and the rows must not collide at commit time.
    const firstDay = decodeYaml(existingCatalogGapYaml());
    const secondDay = structuredClone(firstDay);
    secondDay.cameras[0].meters_per_pixel = 0.002;
    secondDay.session_id = 'remy_20230623';

    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', encodeYaml(firstDay)),
      makeFile('06232023_remy_metadata.yml', encodeYaml(secondDay)),
    ]);

    await screen.findByRole('heading', { name: /needs attention/i });
    for (const index of ['0', '1']) {
      await user.selectOptions(screen.getByLabelText('Review file'), index);
      await user.click(screen.getByRole('button', { name: /Accept Camera 3/i }));
      await user.click(screen.getByRole('button', { name: /Accept Recording system/i }));
    }

    await user.click(screen.getByRole('button', { name: /review 2 ready files/i }));
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    // One row per calibration, each with a distinct id and name — never two rows that collide.
    const cameras = captured.animals.remy.cameras;
    expect(cameras.map((camera) => [camera.camera_name, camera.meters_per_pixel])).toEqual([
      ['existing_cam', undefined],
      ['arena_side', 0.001],
      ['arena_side_20230623', 0.002],
    ]);
    expect(new Set(cameras.map((camera) => camera.id)).size).toBe(3);
    expect(captured.animals.remy.devices.data_acq_device.map((device) => device.name)).toEqual([
      'ExistingRig',
      'ImportedRig',
    ]);
    expect(Object.keys(captured.days).sort()).toEqual(['remy-2023-06-22', 'remy-2023-06-23']);
    // Each day exports the calibration that was true on it.
    const cameraIdOf = (name) => cameras.find((camera) => camera.camera_name === name).id;
    expect(captured.days['remy-2023-06-22'].associated_video_files[0].camera_id).toBe(
      cameraIdOf('arena_side')
    );
    expect(captured.days['remy-2023-06-23'].associated_video_files[0].camera_id).toBe(
      cameraIdOf('arena_side_20230623')
    );
  });

  it('leaves a required-input row empty rather than pre-filling the rejected value', async () => {
    const user = userEvent.setup();
    renderScreen();

    // A species the suggestion table cannot map, so the row is a free-text input: the value the
    // validator rejected must not be offered back as the answer.
    const model = decodeYaml(cleanYaml);
    model.subject.species = 'unidentified rodent';
    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06222023_remy_metadata.yml', encodeYaml(model))
    );

    await screen.findByRole('heading', { name: /needs attention/i });
    const speciesInput = screen.getByLabelText(/subject — species/i);
    expect(speciesInput).toHaveValue('');
    // The empty row and the gate agree: the file is not importable yet.
    expect(screen.getByRole('button', { name: /import as new animal/i })).toBeDisabled();
  });
});

describe('ImportRepair — camera calibration conflicts (F1)', () => {
  /**
   * A clean remy day file whose `overhead_camera` carries the given calibration.
   *
   * @param {string} dateDigits - The recording date as `YYYYMMDD`.
   * @param {number} metersPerPixel - The calibration recorded for `overhead_camera`.
   * @returns {string} YAML text.
   */
  function recalibratedYaml(dateDigits, metersPerPixel) {
    const model = decodeYaml(cleanYaml);
    model.session_id = `remy_${dateDigits}`;
    model.cameras = model.cameras.map((camera) =>
      camera.camera_name === 'overhead_camera'
        ? { ...camera, meters_per_pixel: metersPerPixel }
        : camera
    );
    return encodeYaml(model);
  }

  /**
   * Upload two remy days whose overhead camera was recalibrated between them and open the preview.
   *
   * @param {object} user - userEvent session.
   * @returns {Promise<HTMLElement>} The conflict fieldset.
   */
  async function openConflictPreview(user) {
    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', recalibratedYaml('20230622', 0.001)),
      makeFile('06232023_remy_metadata.yml', recalibratedYaml('20230623', 0.002)),
    ]);
    await user.click(await screen.findByRole('button', { name: /review 2 ready files/i }));
    return screen.getByRole('group', { name: /overhead_camera.*2 calibrations/i });
  }

  it('shows both calibrations with their source files and dates before anything is written', async () => {
    const user = userEvent.setup();
    renderScreen();
    const fieldset = await openConflictPreview(user);

    expect(within(fieldset).getByText('meters_per_pixel 0.001')).toBeInTheDocument();
    expect(within(fieldset).getByText('meters_per_pixel 0.002')).toBeInTheDocument();
    expect(within(fieldset).getByText('06222023_remy_metadata.yml')).toBeInTheDocument();
    expect(within(fieldset).getByText('06232023_remy_metadata.yml')).toBeInTheDocument();
    expect(within(fieldset).getByText('2023-06-22')).toBeInTheDocument();
    expect(within(fieldset).getByText('2023-06-23')).toBeInTheDocument();
    // Splitting is the default, and the name each calibration will take is shown.
    const keepBoth = within(fieldset).getByRole('radio', { name: /keep as separate cameras/i });
    expect(keepBoth).toBeChecked();
    expect(within(fieldset).getAllByText(/overhead_camera_20230623/).length).toBeGreaterThan(0);
    // Nothing is written by previewing.
    expect(captured.animals).toEqual({});
  });

  it('warns which calibration will NOT be imported when one is chosen for every day', async () => {
    const user = userEvent.setup();
    renderScreen();
    const fieldset = await openConflictPreview(user);

    await user.click(
      within(fieldset).getByRole('radio', { name: /meters_per_pixel 0\.002 for every day/i })
    );

    const warning = within(fieldset).getByRole('status');
    expect(warning).toHaveTextContent(/not imported/i);
    expect(warning).toHaveTextContent('meters_per_pixel 0.001');
    expect(warning).toHaveTextContent('06222023_remy_metadata.yml');
  });

  it('imports each day under the calibration its own file recorded (default)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await openConflictPreview(user);
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    const cameras = captured.animals.remy.cameras;
    expect(cameras.map((camera) => [camera.camera_name, camera.meters_per_pixel])).toEqual([
      ['overhead_camera', 0.001],
      ['side_camera', 0.0009],
      ['overhead_camera_20230623', 0.002],
    ]);
    const idOf = (name) => cameras.find((camera) => camera.camera_name === name).id;
    const overheadOf = (dayId) =>
      captured.days[dayId].associated_video_files.find((video) =>
        video.name.startsWith('overhead')
      ).camera_id;
    expect(overheadOf('remy-2023-06-22')).toBe(idOf('overhead_camera'));
    expect(overheadOf('remy-2023-06-23')).toBe(idOf('overhead_camera_20230623'));

    // The result reports the camera the split created, with its calibration and dates.
    const success = screen.getByRole('region', { name: /import complete/i });
    const cameraSummary = within(success).getByRole('region', { name: /camera calibrations/i });
    expect(cameraSummary).toHaveTextContent('overhead_camera_20230623');
    expect(cameraSummary).toHaveTextContent('meters_per_pixel 0.002');
    expect(cameraSummary).toHaveTextContent('2023-06-23');
  });

  it('applies the chosen single calibration to every day, and reports the discarded value', async () => {
    const user = userEvent.setup();
    renderScreen();
    const fieldset = await openConflictPreview(user);
    await user.click(
      within(fieldset).getByRole('radio', { name: /meters_per_pixel 0\.002 for every day/i })
    );
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    const cameras = captured.animals.remy.cameras;
    expect(cameras.map((camera) => [camera.camera_name, camera.meters_per_pixel])).toEqual([
      ['overhead_camera', 0.002],
      ['side_camera', 0.0009],
    ]);
    const overheadId = cameras[0].id;
    for (const dayId of ['remy-2023-06-22', 'remy-2023-06-23']) {
      expect(
        captured.days[dayId].associated_video_files.find((video) =>
          video.name.startsWith('overhead')
        ).camera_id
      ).toBe(overheadId);
    }

    const success = screen.getByRole('region', { name: /import complete/i });
    const cameraSummary = within(success).getByRole('region', { name: /camera calibrations/i });
    expect(cameraSummary).toHaveTextContent(/not imported/i);
    expect(cameraSummary).toHaveTextContent('meters_per_pixel 0.001');
    expect(cameraSummary).toHaveTextContent('06222023_remy_metadata.yml');
  });
});

describe('ImportRepair — a recalibrated camera on an EXISTING animal (F1)', () => {
  /** The animal already holds `arena_side`, calibrated at 0.002, and the imported rig. */
  const existingRemyWithArenaSide = () => ({
    remy: {
      id: 'remy',
      subject: { subject_id: 'remy' },
      days: [],
      cameras: [
        {
          id: 0,
          camera_name: 'arena_side',
          meters_per_pixel: 0.002,
          manufacturer: 'Allied',
          model: 'Mako',
          lens: '8mm',
        },
      ],
      devices: {
        data_acq_device: [
          { name: 'ImportedRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
        ],
        device: { name: ['Trodes'] },
        electrode_groups: [],
        ntrode_electrode_group_channel_map: [],
      },
      configurationHistory: [
        {
          version: 1,
          devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
          appliedToDays: [],
        },
      ],
    },
  });

  it('asks before the day is written, and never offers to rewrite the animal’s own calibration', async () => {
    const user = userEvent.setup();
    renderScreen(existingRemyWithArenaSide());

    // The file records `arena_side` at 0.001 — the animal's row says 0.002.
    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml())
    );
    // The disagreement is a calibration question, not an identity mapping: the file needs no
    // repair answer to reach it (R3).
    const addDay = await screen.findByRole('button', { name: /add recording day/i });
    expect(addDay).toBeEnabled();
    expect(screen.queryByLabelText(/Map camera 3 to existing camera id/i)).not.toBeInTheDocument();

    // Import does not commit while a calibration disagreement is unresolved: it asks first.
    await user.click(addDay);
    const fieldset = await screen.findByRole('group', { name: /arena_side.*2 calibrations/i });
    expect(captured.days).toEqual({});
    expect(within(fieldset).getByText('meters_per_pixel 0.002')).toBeInTheDocument();
    expect(within(fieldset).getByText('meters_per_pixel 0.001')).toBeInTheDocument();
    expect(within(fieldset).getByText('Already on this animal')).toBeInTheDocument();

    // The only single-calibration option is the animal's OWN row — an import adds a camera, it
    // never re-calibrates one the animal's earlier days already export.
    const unifyOptions = within(fieldset)
      .getAllByRole('radio')
      .filter((radio) => /for every day/i.test(radio.parentElement.textContent));
    expect(unifyOptions).toHaveLength(1);
    expect(unifyOptions[0].parentElement).toHaveTextContent('meters_per_pixel 0.002');

    await user.click(screen.getByRole('button', { name: /confirm import/i }));
    await screen.findByRole('heading', { name: /import complete/i });
    expect(captured.animals.remy.cameras.map((c) => [c.camera_name, c.meters_per_pixel])).toEqual([
      ['arena_side', 0.002],
      ['arena_side_20230622', 0.001],
    ]);
    const day = captured.days['remy-2023-06-22'];
    expect(day.associated_video_files[0].camera_id).toBe(
      captured.animals.remy.cameras[1].id
    );
  });

  it('keeps every day on the animal’s own camera when that calibration is chosen', async () => {
    const user = userEvent.setup();
    renderScreen(existingRemyWithArenaSide());

    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06222023_remy_metadata.yml', existingCatalogGapYaml())
    );
    await user.click(await screen.findByRole('button', { name: /add recording day/i }));

    const fieldset = await screen.findByRole('group', { name: /arena_side.*2 calibrations/i });
    await user.click(
      within(fieldset).getByRole('radio', { name: /meters_per_pixel 0\.002 for every day/i })
    );
    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    await screen.findByRole('heading', { name: /import complete/i });
    expect(captured.animals.remy.cameras.map((c) => c.camera_name)).toEqual(['arena_side']);
    expect(captured.days['remy-2023-06-22'].associated_video_files[0].camera_id).toBe(0);
  });
});

describe('ImportRepair — a LATER calibration of a camera the animal already has (R3)', () => {
  // Importing a history one day at a time must reach the same split/unify decision a whole-batch
  // import reaches. The old identity-mapping repair stood in front of it, so a scientist adding the
  // next day was asked to map the camera onto an existing id (or edit the YAML) before the app
  // would even show the choice — and a calibration the animal ALREADY holds under its split name
  // was asked about too.

  /**
   * A clean remy day file whose `overhead_camera` carries the given calibration.
   * @param {string} dateDigits - The recording date as `YYYYMMDD`.
   * @param {number} metersPerPixel - The calibration recorded for `overhead_camera`.
   * @returns {string} YAML text.
   */
  function dayYaml(dateDigits, metersPerPixel) {
    const model = decodeYaml(cleanYaml);
    model.session_id = `remy_${dateDigits}`;
    model.cameras = model.cameras.map((camera) =>
      camera.camera_name === 'overhead_camera'
        ? { ...camera, meters_per_pixel: metersPerPixel }
        : camera
    );
    return encodeYaml(model);
  }

  /**
   * Import June 22 (0.001) and June 23 (0.002) as one batch, accepting the default split, and
   * return to the file picker — the animal now holds `overhead_camera` AND
   * `overhead_camera_20230623`.
   * @param {object} user - userEvent session.
   */
  async function importSplitHistory(user) {
    await user.upload(screen.getByLabelText(/choose a metadata yaml file/i), [
      makeFile('06222023_remy_metadata.yml', dayYaml('20230622', 0.001)),
      makeFile('06232023_remy_metadata.yml', dayYaml('20230623', 0.002)),
    ]);
    await user.click(await screen.findByRole('button', { name: /review 2 ready files/i }));
    await user.click(screen.getByRole('button', { name: /confirm import/i }));
    await screen.findByRole('heading', { name: /import complete/i });
    expect(captured.animals.remy.cameras.map((c) => c.camera_name)).toEqual([
      'overhead_camera',
      'side_camera',
      'overhead_camera_20230623',
    ]);
    await user.click(screen.getByRole('button', { name: /import more files/i }));
  }

  /**
   * The camera id the animal's catalog holds a given camera under.
   * @param {string} name - The camera name.
   * @returns {number} Its catalog id.
   */
  const cameraIdOf = (name) =>
    captured.animals.remy.cameras.find((camera) => camera.camera_name === name).id;

  /**
   * A day's overhead video camera reference.
   * @param {string} dayId - The workspace day id.
   * @returns {number} The referenced camera id.
   */
  const overheadRefOf = (dayId) =>
    captured.days[dayId].associated_video_files.find((video) => video.name.startsWith('overhead'))
      .camera_id;

  it('goes straight to the split choice for a third calibration, with no mapping repair', async () => {
    const user = userEvent.setup();
    renderScreen();
    await importSplitHistory(user);

    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06242023_remy_metadata.yml', dayYaml('20230624', 0.003))
    );

    // No identity mapping stands in the way: the file is ready, and the camera question is the
    // calibration one.
    const add = await screen.findByRole('button', { name: /add recording day/i });
    expect(add).toBeEnabled();
    expect(screen.queryByLabelText(/Map camera 0 to existing camera id/i)).not.toBeInTheDocument();

    await user.click(add);
    const fieldset = await screen.findByRole('group', { name: /overhead_camera.*calibrations/i });
    expect(within(fieldset).getByText('meters_per_pixel 0.001')).toBeInTheDocument();
    expect(within(fieldset).getByText('meters_per_pixel 0.003')).toBeInTheDocument();
    expect(within(fieldset).getByRole('radio', { name: /keep as separate cameras/i })).toBeChecked();

    await user.click(screen.getByRole('button', { name: /confirm import/i }));
    await screen.findByRole('heading', { name: /import complete/i });

    // The new calibration is its own camera, and the new day's videos are on it.
    expect(
      captured.animals.remy.cameras.map((c) => [c.camera_name, c.meters_per_pixel])
    ).toEqual([
      ['overhead_camera', 0.001],
      ['side_camera', 0.0009],
      ['overhead_camera_20230623', 0.002],
      ['overhead_camera_20230624', 0.003],
    ]);
    expect(overheadRefOf('remy-2023-06-24')).toBe(cameraIdOf('overhead_camera_20230624'));
    // The earlier days are untouched.
    expect(overheadRefOf('remy-2023-06-22')).toBe(cameraIdOf('overhead_camera'));
    expect(overheadRefOf('remy-2023-06-23')).toBe(cameraIdOf('overhead_camera_20230623'));
  });

  it('asks nothing about a calibration the animal already holds under its split name', async () => {
    const user = userEvent.setup();
    renderScreen();
    await importSplitHistory(user);
    const camerasBefore = structuredClone(captured.animals.remy.cameras);

    // The very same June 23 file again: its 0.002 overhead camera IS `overhead_camera_20230623`.
    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06232023_remy_metadata.yml', dayYaml('20230623', 0.002))
    );

    const add = await screen.findByRole('button', { name: /add recording day/i });
    expect(add).toBeEnabled();
    expect(screen.queryByLabelText(/Map camera 0 to existing camera id/i)).not.toBeInTheDocument();

    // No calibration question either — the row IS `overhead_camera_20230623`, so the file commits
    // straight through to the existing duplicate-day answer rather than a camera decision.
    await user.click(add);
    expect(
      screen.queryByRole('group', { name: /overhead_camera.*calibrations/i })
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);

    // Nothing new was invented, and the day still points at the camera it was imported under.
    expect(captured.animals.remy.cameras).toEqual(camerasBefore);
    expect(overheadRefOf('remy-2023-06-23')).toBe(cameraIdOf('overhead_camera_20230623'));
  });

  it('routes a NEW day onto the camera the animal already holds that calibration under', async () => {
    // The reroute's real job: a later day recorded under the bare `overhead_camera` name at the
    // calibration the animal already stores as `overhead_camera_20230623` IS that camera. It must
    // commit — no repair, no second split, no duplicate CameraDevice — with the new day's task and
    // video references landing on that existing camera's id.
    const user = userEvent.setup();
    renderScreen();
    await importSplitHistory(user);
    const camerasBefore = structuredClone(captured.animals.remy.cameras);

    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06252023_remy_metadata.yml', dayYaml('20230625', 0.002))
    );

    const add = await screen.findByRole('button', { name: /add recording day/i });
    expect(add).toBeEnabled();
    expect(screen.queryByLabelText(/Map camera 0 to existing camera id/i)).not.toBeInTheDocument();

    await user.click(add);
    expect(
      screen.queryByRole('group', { name: /overhead_camera.*calibrations/i })
    ).not.toBeInTheDocument();
    // The single-day success state (the region is labelled "Import complete").
    await screen.findByRole('heading', { name: /recording day added/i });
    expect(screen.getByRole('region', { name: /import complete/i })).toBeInTheDocument();

    // The catalog is untouched — the calibration was recognised, not re-split.
    expect(captured.animals.remy.cameras).toEqual(camerasBefore);

    // …and the new day's references were remapped onto that camera, in the stored record AND in
    // what the day would export.
    const splitId = cameraIdOf('overhead_camera_20230623');
    const day = captured.days['remy-2023-06-25'];
    expect(overheadRefOf('remy-2023-06-25')).toBe(splitId);
    const merged = mergeDayMetadata(captured.animals.remy, day);
    const overheadTask = merged.tasks.find((task) => (task.camera_id || []).includes(splitId));
    expect(overheadTask).toBeDefined();
    expect(
      merged.cameras.find((camera) => camera.id === splitId)
    ).toMatchObject({ camera_name: 'overhead_camera_20230623', meters_per_pixel: 0.002 });
    expect(
      merged.cameras.some((camera) => camera.camera_name === 'overhead_camera')
    ).toBe(false);
  });

  it('still asks about a camera the animal cannot explain at all', async () => {
    const user = userEvent.setup();
    renderScreen();
    await importSplitHistory(user);

    // A camera whose name this animal has never had: the calibration analysis has nothing to
    // reroute or split it onto, so the catalog repair still has to be answered.
    const model = decodeYaml(dayYaml('20230624', 0.003));
    model.cameras = model.cameras.map((camera) =>
      camera.camera_name === 'overhead_camera'
        ? { ...camera, id: 7, camera_name: 'ceiling_camera' }
        : camera
    );
    model.tasks = model.tasks.map((task) => ({
      ...task,
      camera_id: (task.camera_id || []).map((id) => (id === 0 ? 7 : id)),
    }));
    model.associated_video_files = model.associated_video_files.map((video) =>
      video.camera_id === 0 ? { ...video, camera_id: 7 } : video
    );
    await user.upload(
      screen.getByLabelText(/choose a metadata yaml file/i),
      makeFile('06242023_remy_metadata.yml', encodeYaml(model))
    );

    await screen.findByRole('heading', { name: /needs attention/i });
    expect(screen.getByRole('button', { name: /add recording day/i })).toBeDisabled();
    expect(
      screen.getByRole('spinbutton', { name: /Map camera 7 to existing camera id/i })
    ).toBeInTheDocument();
  });
});
