import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { encodeYaml, formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { mergeDayMetadata, resolveDayConfig } from '../../state/workspaceUtils';
import { validate } from '../../validation';
import { computeStepStatus } from './validation';
import { isExportEnabled } from './stepGate';
import { isFeatureEnabled } from '../../featureFlags';
import { checkShadowExport } from './shadowExport';
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
 * @returns {JSX.Element}
 */
export default function ExportStep({ animal, day, onNavigate }) {
  const [showPreview, setShowPreview] = useState(false);
  const [blockingError, setBlockingError] = useState(null);
  const [overrideWarning, setOverrideWarning] = useState(null);
  const [downloadedFile, setDownloadedFile] = useState(null);

  // Merge once; preview YAML, filename, validation, and the preflight summary are
  // all derived from this single merged object (the same one that will be encoded),
  // never from duplicate component state.
  const { merged, yaml, fileName } = useMemo(() => {
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
    };
  }, [animal, day]);

  // Authoritative export gate, re-checked here (defense in depth): the day may not
  // be downloaded while any error-severity validation issue remains.
  const validationErrors = useMemo(
    () => validate(merged).filter((issue) => issue.severity === 'error'),
    [merged]
  );
  // The authoritative export gate the stepper uses (isExportEnabled over the full
  // computeStepStatus map): it folds in step-level statuses — notably
  // computeDevicesStatus's "all channels bad" → 'error' — that a flat
  // validate(merged) pass alone does NOT surface (it is not a schema/rule error).
  // Consulting it here keeps the directly-mounted ExportStep's gate exactly as
  // strict as the stepper's, so a directly-mounted ExportStep cannot download a day
  // the stepper would refuse to reach.
  const exportGateOpen = useMemo(
    () => isExportEnabled(computeStepStatus(day, merged)),
    [day, merged]
  );
  const exportBlocked = validationErrors.length > 0 || !exportGateOpen;

  const preflight = useMemo(() => {
    if (exportBlocked) return null;
    // Use the version of the snapshot actually resolved into `merged` (which may
    // differ from the day's pin when stale), so preflight matches the encoded YAML.
    const { configurationVersion } = resolveDayConfig(animal, day);
    return buildPreflightSummary(merged, configurationVersion);
  }, [animal, day, merged, exportBlocked]);

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
              animalId={animal?.id}
            />
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
 * encoded. This is the user's final confidence check before download: which
 * subject/session, configuration version, cameras, probes/bad channels,
 * tasks/videos, and whether optogenetics is on.
 *
 * Scaffold: rows are derived from whatever the merged day already carries today.
 * Later phases enrich the underlying data (configuration version, camera
 * calibration, optogenetics state, downstream identity warnings) without changing
 * this derivation — it always reads the merged day, never duplicate state.
 *
 * @param {object} merged - The merged day metadata about to be encoded.
 * @param {number|undefined} configurationVersion - The version of the snapshot
 *   actually resolved into `merged` (from {@link resolveDayConfig}).
 * @returns {Array<{label: string, value: string}>}
 */
function buildPreflightSummary(merged, configurationVersion) {
  const subjectId = merged.subject?.subject_id || '—';
  const sessionId = merged.session_id || '—';

  const ntrodeMap = merged.ntrode_electrode_group_channel_map || [];
  const badChannelCount = ntrodeMap.reduce(
    (total, ntrode) => total + (ntrode.bad_channels?.length || 0),
    0
  );

  const optoOn =
    (merged.opto_excitation_source?.length || 0) > 0 ||
    (merged.optical_fiber?.length || 0) > 0 ||
    (merged.virus_injection?.length || 0) > 0;

  return [
    { label: 'Subject & session', value: `${subjectId} — session ${sessionId}` },
    {
      label: 'Configuration version',
      value: configurationVersion != null ? `Version ${configurationVersion}` : '—',
    },
    { label: 'Cameras', value: `${(merged.cameras || []).length} cameras` },
    {
      label: 'Probes & bad channels',
      value: `${(merged.electrode_groups || []).length} electrode groups, ${badChannelCount} bad channels`,
    },
    {
      label: 'Tasks & videos',
      value: `${(merged.tasks || []).length} tasks, ${(merged.associated_video_files || []).length} videos`,
    },
    { label: 'Optogenetics', value: optoOn ? 'On' : 'Off' },
  ];
}

ExportStep.propTypes = {
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
  onNavigate: PropTypes.func,
};

ExportStep.defaultProps = {
  onNavigate: () => {},
};
