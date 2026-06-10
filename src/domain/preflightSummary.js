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

// How many cameras to spell out inline before collapsing the rest into "+K more".
const MAX_CAMERAS_INLINE = 4;

/**
 * Pluralize a count noun (no inflection of the count itself).
 *
 * @param {number} count - The quantity.
 * @param {string} noun - The singular noun (e.g. "electrode group").
 * @returns {string} The noun, pluralized when count !== 1.
 */
function pluralize(count, noun) {
  return count === 1 ? noun : `${noun}s`;
}

/**
 * Render the camera-calibration row value: each day-used camera's name + meters_per_pixel, so a
 * recalibration is visible at the download gate. Falls back to a plain count when there are no
 * cameras, and truncates to the first few when there are many.
 *
 * @param {Array<object>} cameras - The day-used camera objects (already the export's subset).
 * @returns {string} The row value.
 */
function describeCameras(cameras) {
  const list = Array.isArray(cameras) ? cameras : [];
  if (list.length === 0) {
    return '0 cameras';
  }

  const describe = (camera) => {
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
 * @param {object} merged - The merged day metadata about to be encoded.
 * @param {object} ctx - Workflow context for the summary.
 * @param {string} [ctx.animalId] - The owning animal id.
 * @param {string} [ctx.date] - The recording day's date.
 * @param {number} [ctx.configurationVersion] - The version of the snapshot resolved into `merged`.
 * @param {boolean} [ctx.isHistorical] - Whether that version is historical (not the latest).
 * @param {number} [ctx.warningCount] - Count of non-blocking warnings still to review.
 * @returns {Array<{label: string, value: string}>}
 */
export function buildPreflightSummary(
  merged,
  { animalId, date, configurationVersion, isHistorical, warningCount } = {}
) {
  const subjectId = merged.subject?.subject_id || '—';
  const sessionId = merged.session_id || '—';

  const ntrodeMap = merged.ntrode_electrode_group_channel_map || [];
  const failedChannelCount = ntrodeMap.reduce(
    (total, ntrode) => total + (ntrode.bad_channels?.length || 0),
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
        dataAcq.map((d) => d?.name).filter(Boolean).join(', ') || 'unnamed'
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
