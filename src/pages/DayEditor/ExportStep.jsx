import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { encodeYaml, formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { mergeDayMetadata, resolveDayConfig } from '../../state/workspaceUtils';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { computeStepStatus, validateDay, STEP_LABELS } from '../../domain/validation';
import { getDayWorkflowStatus } from '../../domain/workflowStatus';
import { isExportEnabled } from './stepGate';
import { isFeatureEnabled } from '../../featureFlags';
import { checkShadowExport } from '../../domain/shadowExport';
import RepairActions from './RepairActions';
import './DayEditor.scss';

/**
 * ExportStep - per-day YAML export (Step 5 of Day Editor).
 *
 * Builds the flat metadata model from the workspace via {@link mergeDayMetadata},
 * shows the resolved download filename and an optional YAML preview, and lets the
 * user download the file.
 *
 * Export fails closed. The step is normally only reachable once the day is fully
 * valid (the StepNavigation export gate and the keyboard gate both consult the same
 * authoritative status), but this component re-checks that SAME authoritative gate
 * itself as defense in depth: it both re-validates the merged day (per-error repair
 * actions) AND consults isExportEnabled(computeStepStatus(...)), which folds in
 * step-level failures a flat validate() pass misses — e.g. a Devices "all channels
 * bad" status. If any error-severity issue exists OR the authoritative gate is
 * closed it surfaces the blocking reason and refuses to download. Only when the day
 * is clean does it run the encoder-stability pre-download check
 * ({@link checkShadowExport}) — a distinct guard (encoder determinism, not schema
 * validity) that still hard-stops the download in strict mode (the default).
 *
 * @param {object} props
 * @param {object} props.animal - Animal record providing shared metadata.
 * @param {object} props.day - Recording day providing session-specific data.
 * @param {(stepId: string, fieldPath?: string) => void} [props.onNavigate] - Routes a
 *   repair action to the step that owns the fix (and an optional field target).
 * @param {(issue: object) => void} [props.onRepair] - Executes an issue's `repairCommand`
 *   in place (threaded from DayEditorStepper) so a commandable corruption in the blocked
 *   list resets without leaving the Export step.
 * @param {string} [props.animalKey] - The resolved store owner key; used for the preflight
 *   display, the recovered-day re-link links, and animal-surface repair routing instead of the
 *   possibly-stale `animal.id` record field.
 * @returns {JSX.Element}
 */
export default function ExportStep({ animal, day, onNavigate, onRepair, animalKey = undefined }) {
  // The store OWNER KEY (resolved by DayEditorStepper); a stale/missing `animal.id` record field
  // must not misroute a recovered animal's re-link/repair links. Falls back to `animal.id` for
  // isolated renders that don't pass it.
  const ownerKey = animalKey ?? animal?.id;
  const [showPreview, setShowPreview] = useState(false);
  const [blockingError, setBlockingError] = useState(null);
  const [overrideWarning, setOverrideWarning] = useState(null);
  const [downloadedFile, setDownloadedFile] = useState(null);

  // Merge once; preview YAML, filename, validation, and the preflight summary are
  // all derived from this single merged object (the same one that will be encoded),
  // never from duplicate component state.
  const { merged, yaml, fileName, mergeError } = useMemo(() => {
    try {
      const mergedDay = mergeDayMetadata(animal, day);
      return {
        merged: mergedDay,
        yaml: encodeYaml(mergedDay),
        // mergeDayMetadata does not carry EXPERIMENT_DATE_in_format_mmddYYYY (it is
        // a filename-only key); inject it from the day so the filename does not
        // degrade to the literal placeholder. Filename only — never the YAML body.
        fileName: formatDeterministicFilename({
          ...mergedDay,
          EXPERIMENT_DATE_in_format_mmddYYYY: day.experimentDate,
        }),
        mergeError: null,
      };
    } catch (err) {
      // mergeDayMetadata throws BY DESIGN on a malformed animal (e.g. missing/non-array
      // configurationHistory). Tolerate it: render with an empty stub so the raw-shape
      // animal validation surfaces the blocking, repairable issue instead of crashing the
      // whole Export step. Export stays closed (an empty merged fails validation). Log WHY so a
      // "won't export" report carries the underlying reason instead of only the UI banner text.
      // eslint-disable-next-line no-console
      console.error(`[export-step] could not merge day "${day?.id}" with its animal config:`, err);
      return { merged: {}, yaml: '', fileName: '', mergeError: err };
    }
  }, [animal, day]);

  // Authoritative export gate, re-checked here (defense in depth): the day may not
  // be downloaded while any error-severity validation issue remains. Pass `animal` so
  // raw animal-shape corruption (e.g. `cameras: "nope"`) is part of the gate.
  const validationErrors = useMemo(
    () => validateDay(day, merged, animal).filter((issue) => issue.severity === 'error'),
    [day, merged, animal]
  );
  // The authoritative export gate the stepper uses (isExportEnabled over the full
  // computeStepStatus map): it folds in step-level statuses — notably
  // computeDevicesStatus's "all channels bad" → 'error' — that a flat
  // validate(merged) pass alone does NOT surface (it is not a schema/rule error).
  // Consulting it here keeps the directly-mounted ExportStep's gate exactly as
  // strict as the stepper's, so a directly-mounted ExportStep cannot download a day
  // the stepper would refuse to reach.
  const stepStatus = useMemo(() => computeStepStatus(day, merged, animal), [day, merged, animal]);
  const exportGateOpen = useMemo(() => isExportEnabled(stepStatus), [stepStatus]);
  // Recovery policy (same as the batch path): a day must be part of its animal's recording-day
  // index to export. The Day Editor resolves `animal` BY `day.animalId`, so this animal is the
  // day's owner by construction (no wrong-owner case here, and no dependency on the possibly-stale
  // `animal.id` field — membership is read straight off the resolved animal's index). A
  // recovered-unlinked day (record present, not in the index) is blocked here too, so the
  // single-day path can't bypass the policy the batch path enforces.
  const dayExportable = useMemo(
    () => getAnimalDayIds(animal).includes(day.id),
    [animal, day]
  );
  const exportBlocked = validationErrors.length > 0 || !exportGateOpen || !dayExportable;

  // Step-status blockers (a prerequisite step not 'valid' — e.g. Devices 'error' for
  // all-channels-bad, or 'incomplete' for missing maps) that NO error-severity
  // validate() issue surfaces. Without these, ExportStep would block with generic text
  // and no repair button (a dead-end). Route the user to the EDITABLE OWNER: Devices
  // 'incomplete' (no electrode groups / missing channel maps) is an Animal-Editor fix
  // (geometry lives at the animal level), not a day-Devices edit; everything else stays
  // on its day step.
  const blockingSteps = useMemo(() => {
    if (validationErrors.length > 0) return [];
    const groups = merged.electrode_groups || [];
    return ['overview', 'devices', 'epochs', 'validation']
      .filter((s) => stepStatus[s] !== 'valid')
      .map((step) => {
        if (step === 'devices' && stepStatus.devices === 'incomplete') {
          // Geometry is animal-owned. Route to the Animal-Editor step that owns the gap:
          // no electrode groups → Electrode Groups (the default step 0, no field hint);
          // groups present but a group has no channel map → Channel Maps (field hint so the
          // deep-link lands there instead of dropping the user on step 0).
          const field = groups.length === 0 ? undefined : 'ntrode_electrode_group_channel_map';
          return { step, owner: 'animal', field };
        }
        return { step, owner: 'day', field: undefined };
      });
  }, [validationErrors.length, stepStatus, merged]);

  const preflight = useMemo(() => {
    if (exportBlocked) return null;
    // Use the version of the snapshot actually resolved into `merged` (which may
    // differ from the day's pin when stale), so preflight matches the encoded YAML.
    const { configurationVersion } = resolveDayConfig(animal, day);
    // Historical/current status + any non-blocking warnings come from the same domain helpers
    // the rest of the workflow uses, so preflight reads as a confidence check
    // (conversion/DANDI/Spyglass), not only a schema summary. (An unpinned configuration in a
    // multi-version animal is now export-BLOCKING, so it never reaches preflight — it surfaces
    // in the blocked repair list instead.)
    const { isHistoricalConfiguration } = getDayWorkflowStatus(animal, day, merged);
    const warningCount = validateDay(day, merged, animal).filter(
      (issue) => issue.severity === 'warning'
    ).length;
    return buildPreflightSummary(merged, {
      animalId: ownerKey,
      date: day?.date,
      configurationVersion,
      isHistorical: isHistoricalConfiguration,
      warningCount,
    });
  }, [animal, day, merged, exportBlocked, ownerKey]);

  const handleDownload = () => {
    // Defense in depth: validation gates the download before the encoder check.
    if (exportBlocked) {
      return;
    }

    const result = checkShadowExport(animal, day);

    if (!result.ok && isFeatureEnabled('shadowExportStrict')) {
      // BLOCKING: never download when the encoder-stability check fails in strict mode.
      setOverrideWarning(null);
      setDownloadedFile(null);
      setBlockingError({
        message: 'Export blocked: encoder-stability check failed.',
        diff: result.diff,
      });
      return;
    }

    if (!result.ok) {
      // shadowExportStrict === false: debug-only override; warn loudly but proceed.
      setOverrideWarning({
        message: 'Encoder-stability mismatch overridden (strict mode off).',
        diff: result.diff,
      });
    } else {
      setOverrideWarning(null);
    }

    setBlockingError(null);
    downloadYamlFile(fileName, result.yaml);
    setDownloadedFile(fileName);
  };

  return (
    <div className="day-editor-section export-step">
      <h2>Export YAML</h2>

      <p className="export-filename-line">
        File name: <code className="export-filename">{fileName}</code>
      </p>

      {exportBlocked && (
        <div className="export-validation-blocked" role="alert">
          {mergeError && (
            <p className="export-merge-error">
              This day&apos;s metadata could not be assembled — its animal&apos;s device
              configuration is missing or corrupt. Repair it in the Animal Editor, then return.
            </p>
          )}
          {!dayExportable && (
            <p className="export-merge-error">
              This recording day is not in {ownerKey}&apos;s day list (it was recovered but not
              re-linked), so it can&apos;t be exported yet. Re-link it with the &quot;Add to day
              list&quot; action on the <a href="#/validation">validation summary</a>, then return.
            </p>
          )}
          <p className="export-validation-blocked-reason">
            {validationErrors.length > 0
              ? `Resolve ${validationErrors.length} validation ${
                  validationErrors.length === 1 ? 'error' : 'errors'
                } before exporting.`
              : 'Resolve the blocking device/step issue before exporting.'}
          </p>
          {validationErrors.length > 0 && (
            <RepairActions
              issues={validationErrors}
              onNavigate={onNavigate}
              animalId={ownerKey}
              onRepair={onRepair}
              groupByCategory
            />
          )}
          {validationErrors.length === 0 && blockingSteps.length > 0 && (
            <div className="export-step-blockers">
              {blockingSteps.map(({ step, owner, field }) => (
                <button
                  key={step}
                  type="button"
                  className="repair-action-button"
                  data-repair-surface={owner}
                  onClick={() => onNavigate?.(owner === 'animal' ? 'animal' : step, field)}
                >
                  {owner === 'animal' ? 'Fix in Animal Setup' : `Fix in ${STEP_LABELS[step] || step}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!exportBlocked && preflight && (
        <section className="export-preflight" aria-label="Export preflight summary">
          <h3>Preflight summary</h3>
          <dl className="export-preflight-list">
            {preflight.map(({ label, value }) => (
              <div key={label} className="export-preflight-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {blockingError && (
        <div className="export-blocking-error" role="alert">
          <p>{blockingError.message}</p>
          {blockingError.diff && <pre className="export-diff">{blockingError.diff}</pre>}
          <button
            type="button"
            className="export-retry-button"
            onClick={() => setBlockingError(null)}
          >
            Dismiss and try again
          </button>
        </div>
      )}

      {overrideWarning && (
        <div className="export-override-warning" role="alert">
          <p>{overrideWarning.message}</p>
          {overrideWarning.diff && <pre className="export-diff">{overrideWarning.diff}</pre>}
        </div>
      )}

      <div className="export-actions">
        <button
          type="button"
          className="export-download-button"
          onClick={handleDownload}
          disabled={!!blockingError || exportBlocked}
        >
          Download YAML
        </button>
        <button
          type="button"
          className="export-preview-toggle"
          onClick={() => setShowPreview((prev) => !prev)}
          aria-expanded={showPreview}
          aria-controls="export-yaml-preview"
        >
          {showPreview ? 'Hide preview' : 'Show preview'}
        </button>
      </div>

      {downloadedFile && (
        <p className="export-success" role="status">
          Downloaded {downloadedFile}.
        </p>
      )}

      {showPreview && (
        <pre id="export-yaml-preview" className="export-preview" aria-label="YAML preview">
          {yaml}
        </pre>
      )}
    </div>
  );
}

/**
 * Build the read-only preflight summary rows from the merged day that will be
 * encoded. This is the user's final confidence check before download — phrased as the
 * setup-checklist / Day Devices context, not a schema dump: which animal/day/session, which
 * configuration version (and whether it is current or historical), probes & failed channels,
 * cameras/calibration, data-acquisition device, tasks/videos, optogenetics state, and any
 * unresolved (non-blocking) review risk.
 *
 * Rows always read the merged day (the same object that will be encoded) plus the workflow
 * context the caller resolves from the domain helpers — never duplicate component state.
 *
 * @param {object} merged - The merged day metadata about to be encoded.
 * @param {object} ctx - Workflow context for the summary.
 * @param {string} [ctx.animalId] - The owning animal id.
 * @param {string} [ctx.date] - The recording day's date.
 * @param {number} [ctx.configurationVersion] - The version of the snapshot resolved into
 *   `merged` (from {@link resolveDayConfig}).
 * @param {boolean} [ctx.isHistorical] - Whether that version is historical (not the latest).
 * @param {number} [ctx.warningCount] - Count of non-blocking warnings still to review.
 * @returns {Array<{label: string, value: string}>}
 */
function buildPreflightSummary(
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

  const optoOn =
    (merged.opto_excitation_source?.length || 0) > 0 ||
    (merged.optical_fiber?.length || 0) > 0 ||
    (merged.virus_injection?.length || 0) > 0;

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
    { label: 'Optogenetics', value: optoOn ? 'On' : 'Off' },
    {
      label: 'Non-blocking warnings',
      value:
        warningCount > 0
          ? `${warningCount} warning${warningCount === 1 ? '' : 's'} to review (does not block export)`
          : 'None',
    },
  ];
}

ExportStep.propTypes = {
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
  onNavigate: PropTypes.func,
  onRepair: PropTypes.func,
  animalKey: PropTypes.string,
};

ExportStep.defaultProps = {
  onNavigate: () => {},
  onRepair: undefined,
};
