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

  const dataAcq = merged.data_acq_device || [];
  const dataAcqValue = dataAcq.length
    ? `${dataAcq.length} device${dataAcq.length === 1 ? '' : 's'} (${
        dataAcq.map((d) => d?.name).filter(Boolean).join(', ') || 'unnamed'
      })`
    : 'None';

  return [
    { label: 'Animal & day', value: `${animalId || '—'} — ${date || '—'}` },
    { label: 'Subject & session', value: `${subjectId} — session ${sessionId}` },
    {
      label: 'Configuration version',
      value:
        configurationVersion != null
          ? `Version ${configurationVersion} (${isHistorical ? 'historical' : 'current'})`
          : '—',
    },
    {
      label: 'Probes & failed channels',
      value: `${(merged.electrode_groups || []).length} electrode groups, ${failedChannelCount} failed channels`,
    },
    { label: 'Cameras / calibration', value: `${(merged.cameras || []).length} cameras` },
    { label: 'Data acquisition', value: dataAcqValue },
    {
      label: 'Tasks & videos',
      value: `${(merged.tasks || []).length} tasks, ${(merged.associated_video_files || []).length} videos`,
    },
    { label: 'Optogenetics', value: opto.label },
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
