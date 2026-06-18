/**
 * @fileoverview Issue → step / repair-surface / animal-tab routing.
 *
 * The single source of truth for routing a validation issue to the editor that can fix
 * it: which Day-Editor step owns it ({@link stepIdForIssue}), which surface (day / animal /
 * none) and animal-setup tab the repair lives on ({@link repairTargetForIssue},
 * {@link animalSetupTabForFieldPath}), and the user-facing step labels ({@link STEP_LABELS}).
 * Extracted from `domain/validation.js` (Phase 9a) with no behavior change — the issue-list
 * composer ({@link module:domain/dayValidationComposer}) and the step-status computation
 * ({@link module:domain/stepStatus}) consume these helpers. Pure and dependency-free.
 */

/** The editable owner of a validation issue. */
export type RepairSurface = 'day' | 'animal' | 'none';

/** The Day-Editor data-entry steps an issue can route to (the catch-all is `validation`). */
export type RoutableStep = 'overview' | 'devices' | 'epochs' | 'behavioral' | 'validation';

/**
 * The permissive validation-issue shape the routing/status helpers READ. Issues reach these
 * helpers from heterogeneous sources — AJV schema errors (`instancePath`), app rules, and the
 * domain issue producers — so every field is optional; the helpers inspect whatever is present.
 * This is the shared "issue family" type the Phase 9a domain validation modules agree on (the
 * convergence the `validation/taskCatalogValidation.ts` note anticipated).
 */
export interface RepairableIssue {
  /** Stable app-rule code (absent on AJV schema issues). */
  code?: string;
  /** Dotted app path (e.g. `cameras[0].lens`). */
  path?: string;
  /** AJV instance path (e.g. `/cameras/0/lens`). */
  instancePath?: string;
  /** Offending field name. */
  field?: string;
  /** Day-Editor step the rule routes its repair to. */
  step?: string;
  /** Issue severity. */
  severity?: string;
  /** Repair surface set by the producing rule. */
  repairSurface?: RepairSurface;
  /** Explicit owner surface (set by a producer or the provenance pass). */
  ownerSurface?: RepairSurface;
  /** Explicit focus anchor for repair deep-linking. */
  focusPath?: string;
  /** Human-readable message. */
  message?: string;
  /** Short repair call-to-action. */
  actionLabel?: string;
  /** Structured repair command the UI dispatches. */
  repairCommand?: unknown;
}

/**
 * Determine which editor step "owns" a single validation issue, by inspecting its
 * path. This is the single source of truth for issue→step routing, used both to
 * group the validation summary ({@link groupErrorsByStep}) and to route a repair
 * action to the step that can fix it.
 *
 * Routing degrades to the catch-all `validation` step when a path matches none of
 * the data-entry steps (e.g. a bare `required` artifact whose path is just the
 * missing property name).
 *
 * @param issue - A validation issue.
 * @returns The owning step id.
 */
export function stepIdForIssue(issue: RepairableIssue): RoutableStep {
  // Prefer an explicit, valid issue.step (set by validation rules) over path routing,
  // so a rule can land its repair action on the step that actually fixes it
  // (e.g. a camera-path issue routed to 'epochs'). Fall back to path routing when
  // step is absent or not a known data-entry step.
  const ROUTABLE_STEPS = ['overview', 'devices', 'epochs', 'behavioral', 'validation'];
  if (issue?.step && ROUTABLE_STEPS.includes(issue.step)) {
    return issue.step as RoutableStep;
  }

  const path = issue?.path || issue?.instancePath || '';

  // Session-related fields → Overview
  if (path.includes('session') || path.includes('subject') || path.includes('experimenter') || path.includes('lab') || path.includes('institution') || path.includes('experiment_description')) {
    return 'overview';
  }
  // FsGUI protocols are rendered in the Epochs step — route their schema errors there
  // BEFORE the camera/device check below (a `fs_gui_yamls[].camera_id` path contains
  // "camera" and would otherwise mis-route to Devices).
  if (path.includes('fs_gui')) {
    return 'epochs';
  }
  // Device-related fields → Devices
  if (
    path.includes('electrode') ||
    path.includes('device') ||
    path.includes('camera') ||
    path.includes('ntrode') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens')
  ) {
    return 'devices';
  }
  // Behavioral-event (DIO) fields → the Behavioral Events tab (its own step). Checked before the
  // task/epoch branch so a `behavioral_events[...]` path doesn't fall through to Epochs.
  if (path.includes('behavioral')) {
    return 'behavioral';
  }
  // Task fields → Epochs
  if (path.includes('task') || path.includes('epoch') || path.includes('associated')) {
    return 'epochs';
  }
  // Everything else → Validation (catch-all)
  return 'validation';
}

/**
 * User-facing section names for repair-action buttons. The keys remain the underlying gate
 * substrate; the labels name the Phase 15 sections users can actually navigate to.
 */
export const STEP_LABELS: Record<string, string> = {
  overview: 'Overview',
  devices: 'Devices & Failed Channels',
  epochs: 'Tasks & Epochs',
  behavioral: 'Devices & Failed Channels',
  validation: 'Validation & Export',
  export: 'Validation & Export',
};

/** Whether a day-owned issue is fixed in the Files & Weight section. */
function isFilesWeightPath(path: string): boolean {
  const normalized = path.replace(/^\//, '').replace(/\//g, '.');
  return (
    normalized.startsWith('associated_files') ||
    normalized.includes('subject.weight') ||
    normalized.includes('session.weight')
  );
}

/**
 * The valid repair surfaces. `day` issues are editable in the Day Editor's own steps;
 * `animal` issues are only editable in the Animal Editor (device geometry, channel
 * maps, cameras, data-acq devices, subject identity); `none` issues point at a
 * read-only identity (slash ids) with no in-app editable target.
 */
export const REPAIR_SURFACES: Set<string> = new Set(['day', 'animal', 'none']);

/**
 * Explicit surface for each app rule code (Repair Routing Contract). This is the
 * authoritative map: an issue's `repairSurface` (set by the rule) is preferred, but
 * this table is the fallback for app-rule codes and the single place the contract is
 * enumerated. Codes absent here fall through to path/code derivation (notably AJV
 * schema issues, which carry no app metadata).
 */
export const SURFACE_BY_CODE: Record<string, RepairSurface> = {
  // Editable ONLY in the Animal Editor (device geometry, channel maps, probe catalog,
  // electrode-group identity/location, cameras, data-acq devices, subject identity).
  channel_value_out_of_range: 'animal',
  channel_key_out_of_range: 'animal',
  channel_partition_invalid: 'animal',
  channel_row_count_mismatch: 'animal',
  inconsistent_probe_catalog: 'animal',
  empty_location: 'animal',
  empty_targeted_location: 'animal',
  inconsistent_location_case: 'animal',
  location_typo_nudge: 'animal',
  unknown_device_type: 'animal',
  duplicate_electrode_group_id: 'animal',
  duplicate_ntrode_id: 'animal',
  dangling_electrode_group_ref: 'animal',
  duplicate_channels: 'animal',
  missing_channels: 'animal',
  duplicate_camera_id: 'animal',
  camera_meters_per_pixel_missing: 'animal',
  camera_meters_per_pixel_nonpositive: 'animal',
  camera_meters_per_pixel_implausible: 'animal',
  placeholder_camera_name: 'animal',
  divergent_camera_identity: 'animal',
  divergent_data_acq_identity: 'animal',
  // Task-type catalog (Phase 8C): a duplicate catalog task_name is an animal-catalog problem.
  duplicate_task_type_name: 'animal',
  // Editable in the Animal View profile.
  invalid_species: 'animal',
  subject_genotype_strain: 'animal',
  placeholder_subject_id: 'animal',
  experimenter_name_shape: 'animal',
  // Editable in the Day Editor (task/video/event re-picks, day bad-channel overrides,
  // session metadata, day-owned technical fields, optogenetics completeness).
  dangling_camera_ref: 'day',
  dangling_data_acq_ref: 'day',
  duplicate_behavioral_event_name: 'day',
  duplicate_behavioral_event_description: 'day',
  duplicate_task_epoch: 'day',
  orphaned_video: 'day',
  orphaned_file: 'day',
  // Phase 4: the video-declaration readiness rule — a task epoch with no video and no "no video"
  // declaration. Day-owned, repaired in the Epochs tab (the epoch drill-in's video control).
  epoch_video_undeclared: 'day',
  orphaned_fs_gui_epoch: 'day',
  // FsGUI (day opto protocol) day-surface rules: a dangling DIO output reference and an
  // FsGUI block present while the animal's opto setup is incomplete/off. Both carry an
  // explicit repairSurface:'day' (step 'epochs') at their emit sites in rulesValidation.js.
  dangling_dio_output: 'day',
  fs_gui_requires_optogenetics: 'day',
  divergent_task_identity: 'day',
  // Task-type catalog (Phase 8C): epoch/order/reference + migration-reconciliation problems are
  // day-owned (the Tasks & Epochs step); catalog DEFINITION uniqueness is animal-owned (above).
  dangling_task_type_ref: 'day',
  task_camera_not_used: 'day',
  task_definition_reconciled: 'day',
  bad_channel_out_of_range: 'day',
  multishank_bad_channels_ignored: 'day',
  bad_channel_unfailed_without_ack: 'day',
  bad_channels_on_override_row_ignored: 'day',
  stale_bad_channel_override: 'day',
  malformed_bad_channel_override: 'day',
  malformed_device_override: 'day',
  shadowed_geometry_override: 'day',
  malformed_day_collection: 'day',
  malformed_day_session: 'day',
  unpinned_configuration: 'day',
  malformed_animal_collection: 'animal',
  missing_configuration_history: 'animal',
  missing_camera: 'day',
  // Optogenetics sections live on the Animal Editor's Optogenetics step (the rule also
  // sets repairSurface:'animal' explicitly; this keeps the authoritative table in sync).
  partial_configuration: 'animal',
  multiple_excitation_sources: 'animal',
  opto_power_watts_suspicious: 'animal',
  // Optical-fiber / virus-injection coordinate reference, required by trodes_to_nwb and
  // collected only in the Animal Editor Optogenetics step (explicit repairSurface:'animal').
  missing_opto_reference: 'animal',
  // No editable in-app target — read-only identity (slash ids). The explanatory
  // message states the remedy (recreate the animal); a "Fix in …" button would
  // dead-end on a disabled control.
  subject_id_slash: 'none',
  session_id_slash: 'none',
};

/**
 * Codes whose affected field is a read-only identity with no editable in-app target.
 * Kept distinct so the path/code FALLBACK (for schema issues) can honor them even when
 * the path otherwise looks like a subject/session field.
 */
const NONE_CODES: Set<string> = new Set(['subject_id_slash', 'session_id_slash']);

/**
 * Derive the repair surface for an issue that carries no explicit `repairSurface` and
 * no app-rule code in {@link SURFACE_BY_CODE} — i.e. an AJV schema issue. Device
 * geometry, channel maps, cameras, data-acq devices, and subject identity are edited in
 * the Animal Editor; everything else (session/overview, tasks, catch-all) is edited in
 * the Day Editor. Slash-id codes have no editable target.
 *
 * @param issue
 */
function deriveSurfaceFromPath(issue: RepairableIssue): RepairSurface {
  if (issue?.code != null && NONE_CODES.has(issue.code)) return 'none';

  // Normalize an AJV instancePath ("/cameras/0/lens") so the same substring checks
  // work as for the app rules' dotted paths ("cameras[0].lens").
  const raw = issue?.path || issue?.instancePath || '';
  const path = raw.replace(/^\//, '').replace(/\//g, '.');

  // Read-only identity fields have no editable target on ANY step (subject_id is the
  // animal's identity; session_id is derived from it) — both are rendered read-only.
  // A generic SCHEMA error on them (not just the slash-specific app rules) must route
  // to 'none' (message only) rather than dead-ending on a disabled control.
  if (/(^|\.)subject_id($|\b)/.test(path) || /(^|\.)session_id($|\b)/.test(path)) {
    return 'none';
  }

  // Session/overview fields stay in the Day Editor. Animal-static SUBJECT fields route to the
  // Animal View profile; recording-day weight remains day-owned even though the exported schema
  // nests it under subject.weight.
  if (path.includes('subject.weight')) return 'day';
  if (
    path.includes('subject.species') ||
    path.includes('subject.sex') ||
    path.includes('subject.genotype') ||
    path.includes('subject.date_of_birth') ||
    path.includes('subject.description')
  ) {
    return 'animal';
  }
  if (
    path.includes('session') ||
    path.includes('experimenter') ||
    path.includes('lab') ||
    path.includes('institution') ||
    path.includes('experiment_description')
  ) {
    return 'day';
  }

  // FsGUI protocols are DAY-level (epochs + camera refs live on the day). Route their
  // schema errors to the Day Editor — and BEFORE the camera check below, since a
  // `fs_gui_yamls[].camera_id` path contains "camera".
  if (path.includes('fs_gui')) return 'day';

  // Animal-level optogenetics sections (excitation source, optical fiber, virus injection,
  // software) are edited in the Animal Editor's Optogenetics step.
  if (path.includes('opto') || path.includes('virus') || path.includes('fiber')) {
    return 'animal';
  }

  // Animal-Editor-owned domains: electrode geometry, channel maps, cameras, data-acq devices.
  if (
    path.includes('electrode') ||
    path.includes('ntrode') ||
    path.includes('camera') ||
    path.includes('data_acq') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens')
  ) {
    return 'animal';
  }

  // Everything else (tasks, behavioral events, catch-all required artifacts) → Day Editor.
  return 'day';
}

/**
 * The animal-setup TABS (tabbed-workspace-ia) a field path can own, keyed by route `:tab` segment,
 * with the user-facing label (matching {@link SECTION_GROUPS} in AnimalView's section-nav). It is
 * the single field→section attribution shared by repair routing AND the section-nav blocking dot.
 */
export const ANIMAL_SETUP_TABS: Record<string, string> = {
  days: 'Profile',
  'electrode-groups': 'Electrode Groups',
  'recording-system': 'Recording System',
  cameras: 'Cameras',
  'task-types': 'Task Types',
  optogenetics: 'Optogenetics',
};

/**
 * Resolve which animal-setup TAB owns a field path (for re-pointing a repair deep-link at the
 * tabbed Animal View and for the section-nav blocking dot): camera fields → `cameras`, data-acq →
 * `recording-system`,
 * optogenetics → `optogenetics`, and electrode geometry/identity + the channel maps + the
 * configuration history (the versioned electrode config) → `electrode-groups` (the default). AJV
 * instancePath slashes are normalized first; `fs_gui` is day-level so it never lands on an animal tab.
 *
 * @param fieldPath - Issue path (dotted app path or AJV instancePath).
 * @returns The owning tab key + label (defaults to electrode-groups).
 */
export function animalSetupTabForFieldPath(fieldPath?: string): { tab: string; label: string } {
  const path = String(fieldPath || '').replace(/^\//, '').replace(/\//g, '.');
  const result = (tab: string) => ({ tab, label: ANIMAL_SETUP_TABS[tab] });

  if (path.startsWith('subject.')) return result('days');
  // Animal-level task-type catalog (camelCase `taskTypes` path) — match before the camera check so a
  // task-type issue routes to its own tab, not Cameras. (Day-level task issues are day-owned and
  // never reach this animal resolver.)
  if (path.toLowerCase().includes('tasktype')) return result('task-types');
  if (path.includes('camera') || path.includes('meters_per_pixel') || path.includes('lens')) {
    return result('cameras');
  }
  if (path.includes('data_acq')) return result('recording-system');
  if (path.includes('opto') || path.includes('virus') || path.includes('fiber')) {
    return result('optogenetics');
  }
  // (Behavioral-event / DIO issues are day-owned — they resolve to the `day` surface, so they
  //  never reach this animal-tab resolver. There is no DIO animal tab.)
  // The channel maps (`ntrode_electrode_group_channel_map`) are auto-generated from each electrode
  // group's device_type and are no longer separately editable, so an ntrode issue routes to its
  // OWNER — the electrode-groups tab — together with electrode geometry/identity, configurationHistory
  // (the versioned electrode config), and bare keyword paths (device_type / location / targeted_*).
  return result('electrode-groups');
}

/**
 * The single source of truth for routing a repair action to the editable OWNER of a
 * problem (Repair Routing Contract). Returns the surface to navigate to, the Day-Editor
 * step (for `day` surface) or `null` (for `animal`/`none`), and the button label.
 *
 * Resolution order:
 *   1. an explicit `issue.repairSurface` (set by the app rule) wins;
 *   2. else the app-rule code's surface from {@link SURFACE_BY_CODE};
 *   3. else derive from path/code ({@link deriveSurfaceFromPath}) — the fallback for
 *      AJV schema issues, which carry no app metadata.
 *
 * For `day`, the owning step is {@link stepIdForIssue} (which itself honors an explicit
 * `issue.step`); the label is "Fix in {StepLabel}". For `animal`, the label is
 * "Fix in Animal Setup". For `none`, no button is rendered (the label is informational).
 *
 * @param issue
 */
export function repairTargetForIssue(
  issue: RepairableIssue
): { surface: RepairSurface; step: string | null; label: string } {
  // Boundary 2: an EXPLICIT ownerSurface (set by the producer or the provenance pass in
  // validateDay) wins — ownership is declared, not inferred from path. The legacy
  // repairSurface / SURFACE_BY_CODE / path-derivation chain is the fallback for issues
  // that don't yet carry explicit ownership (AJV schema issues in unambiguous domains).
  let surface: RepairSurface | undefined =
    issue?.ownerSurface && REPAIR_SURFACES.has(issue.ownerSurface)
      ? issue.ownerSurface
      : issue?.repairSurface && REPAIR_SURFACES.has(issue.repairSurface)
        ? issue.repairSurface
        : SURFACE_BY_CODE[issue?.code as string];
  if (!surface) {
    surface = deriveSurfaceFromPath(issue);
  }

  if (surface === 'animal') {
    // Tab-aware label so the user knows which animal-setup TAB the fix lives in (the tabbed IA's
    // finer granularity: cameras vs recording-system vs electrode-groups …).
    const { label: tabLabel } = animalSetupTabForFieldPath(issue?.path || issue?.instancePath);
    return { surface: 'animal', step: null, label: `Fix in Animal Setup → ${tabLabel}` };
  }
  if (surface === 'none') {
    return { surface: 'none', step: null, label: 'No in-app fix' };
  }

  // Day surface: route to the owning Day-Editor step while labeling the visible Phase 15 section.
  const step = stepIdForIssue(issue);
  const focusPath = issue.focusPath || issue.path || issue.instancePath || '';
  const stepLabel = isFilesWeightPath(focusPath) ? 'Files & Weight' : (STEP_LABELS[step] || step);
  return { surface: 'day', step, label: `Fix in ${stepLabel}` };
}
