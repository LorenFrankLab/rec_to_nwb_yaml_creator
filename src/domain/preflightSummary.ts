/**
 * buildPreflightSummary — the read-only "what will THIS day actually export?" row set.
 *
 * Extracted from the Day Editor's Export step so the per-animal Validation & Export tab's
 * effective-setup-for-this-day review (Phase 3-5, Task 3.3a) renders the SAME summary the single-day
 * export preflight shows — one derivation, never re-computed two ways. Rows always read the MERGED
 * day (the same object that will be encoded) plus the workflow context the caller resolves from the
 * domain helpers, so the summary can't disagree with the export.
 *
 * @module domain/preflightSummary
 */
import { describeDayOptoState } from './optoStatus';
import type { ValidationModel } from '../validation/issueTypes';

// How many cameras to spell out inline before collapsing the rest into "+K more".
const MAX_CAMERAS_INLINE = 4;

/** Workflow context for {@link buildPreflightSummary}. */
interface PreflightContext {
  /** The owning animal id. */
  animalId?: string;
  /** The recording day's date. */
  date?: string;
  /** The version of the snapshot resolved into `merged`. */
  configurationVersion?: number;
  /** Whether that version is historical (not the latest). */
  isHistorical?: boolean;
  /** Count of non-blocking warnings still to review. */
  warningCount?: number;
}

/** A single labelled preflight row. */
interface PreflightRow {
  /** Row label. */
  label: string;
  /** Row value (human-readable). */
  value: string;
}

/**
 * Pluralize a count noun (no inflection of the count itself).
 *
 * @param count - The quantity.
 * @param noun - The singular noun (e.g. "electrode group").
 * @returns The noun, pluralized when count !== 1.
 */
function pluralize(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

/**
 * Render the camera-calibration row value: each day-used camera's name + meters_per_pixel, so a
 * recalibration is visible at the download gate. Falls back to a plain count when there are no
 * cameras, and truncates to the first few when there are many.
 *
 * @param cameras - The day-used camera objects (already the export's subset).
 * @returns The row value.
 */
function describeCameras(cameras: unknown): string {
  const list = Array.isArray(cameras) ? cameras : [];
  if (list.length === 0) {
    return '0 cameras';
  }

  const describe = (
    camera: { camera_name?: string | number; id?: number | string; meters_per_pixel?: number } | null | undefined
  ) => {
    const name = camera?.camera_name || `camera ${camera?.id ?? '?'}`;
    const mpp = camera?.meters_per_pixel;
    return mpp == null ? name : `${name} (${mpp} m/px)`;
  };

  const shown = list.slice(0, MAX_CAMERAS_INLINE).map(describe).join(', ');
  const remaining = list.length - MAX_CAMERAS_INLINE;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

/**
 * Build the labelled preflight rows for a merged day.
 *
 * @param merged - The merged day metadata about to be encoded.
 * @param ctx - Workflow context for the summary.
 * @param ctx.animalId - The owning animal id.
 * @param ctx.date - The recording day's date.
 * @param ctx.configurationVersion - The version of the snapshot resolved into `merged`.
 * @param ctx.isHistorical - Whether that version is historical (not the latest).
 * @param ctx.warningCount - Count of non-blocking warnings still to review.
 * @returns
 */
export function buildPreflightSummary(
  merged: ValidationModel,
  // `warningCount` defaults to 0 (was undefined when omitted): `0 > 0` is false exactly as
  // `undefined > 0` was, and the only places it is read with a value are reachable solely when
  // it is > 0 — so this is behavior-equivalent and lets the relational compare typecheck.
  { animalId, date, configurationVersion, isHistorical, warningCount = 0 }: PreflightContext = {}
): PreflightRow[] {
  const subjectId = merged.subject?.subject_id || '—';
  const sessionId = merged.session_id || '—';

  const ntrodeMap = merged.ntrode_electrode_group_channel_map || [];
  const failedChannelCount = ntrodeMap.reduce(
    // `ntrodeMap` is the permissive `any` merged read, so the reduce callback has no contextual
    // type — annotate the params (structurally) to satisfy noImplicitAny.
    (total: number, ntrode: { bad_channels?: unknown[] }) => total + (ntrode.bad_channels?.length || 0),
    0
  );

  // Day-protocol opto state (Task 10): the honest three-state read — "No optogenetics" /
  // "Implanted, no stimulation this day" / "Stimulation on epoch(s) …" — not a binary On/Off
  // derived only from the implant. Shared with the Validation summary so the two never disagree.
  const opto = describeDayOptoState(merged);

  const electrodeGroupCount = (merged.electrode_groups || []).length;

  // The merged day's `cameras` IS the day-used set the export emits (workspaceUtils resolves it via
  // resolveDayCameraUsage before encoding), so the preflight reads exactly what downloads. Show each
  // camera's name + calibration so a meters_per_pixel/zoom change is visible at the download gate.
  const cameras = merged.cameras || [];

  const dataAcq = merged.data_acq_device || [];
  const dataAcqValue = dataAcq.length
    ? `${dataAcq.length} device${dataAcq.length === 1 ? '' : 's'} (${
        dataAcq.map((d: { name?: string }) => d?.name).filter(Boolean).join(', ') || 'unnamed'
      })`
    : 'None';

  // Row order follows how a scientist confirms export readiness: identify the day, then the
  // highly-consequential configuration version (critical for historical-day exports — surfaced near
  // the top, not buried after subject/session), then the hardware/recording facts (probes, cameras,
  // data-acq), then the session content (tasks, opto), with the rarely-changing subject identity and
  // the non-blocking warnings at the end. DISPLAY ORDER ONLY — row content/values are unchanged, and
  // the preflight is not exported, so YAML bytes are unaffected.
  return [
    { label: 'Animal & day', value: `${animalId || '—'} — ${date || '—'}` },
    {
      label: 'Configuration version',
      value:
        configurationVersion != null
          ? `Version ${configurationVersion} (${isHistorical ? 'historical' : 'current'})`
          : '—',
    },
    {
      label: 'Probes & failed channels',
      value: `${electrodeGroupCount} ${pluralize(electrodeGroupCount, 'electrode group')}, ${failedChannelCount} ${pluralize(failedChannelCount, 'failed channel')}`,
    },
    { label: 'Cameras / calibration', value: describeCameras(cameras) },
    { label: 'Data acquisition', value: dataAcqValue },
    {
      label: 'Tasks & videos',
      value: `${(merged.tasks || []).length} tasks, ${(merged.associated_video_files || []).length} videos`,
    },
    { label: 'Optogenetics', value: opto.label },
    { label: 'Subject & session', value: `${subjectId} — session ${sessionId}` },
    {
      label: 'Non-blocking warnings',
      value:
        warningCount > 0
          ? `${warningCount} warning${warningCount === 1 ? '' : 's'} to review (does not block export)`
          : 'None',
    },
  ];
}

export default buildPreflightSummary;
