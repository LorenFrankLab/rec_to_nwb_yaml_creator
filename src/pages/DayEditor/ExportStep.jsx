import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { encodeYaml, formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { mergeDayMetadata, resolveDayConfig } from '../../state/workspaceUtils';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { computeStepStatus, validateDay, STEP_LABELS } from '../../domain/validation';
import { getDayWorkflowStatus } from '../../domain/workflowStatus';
import { DAY_LIFECYCLE_LABEL, lifecycleForValidDay } from '../../domain/dayLifecycle';
import { buildPreflightSummary } from '../../domain/preflightSummary';
import { isExportEnabled } from './stepGate';
import { isFeatureEnabled } from '../../featureFlags';
import { checkShadowExport } from '../../domain/shadowExport';
import RepairActions from './RepairActions';
import { useDayEditorContext } from './DayEditorContext';
import './DayEditor.scss';

/**
 * ExportStep - per-day YAML export (Step 5 of Day Editor).
 *
 * Builds the flat metadata model from the workspace via {@link mergeDayMetadata},
 * shows the resolved download filename and an optional YAML preview, and lets the
 * user download the file.
 *
 * Export fails closed. The Export section is freely reachable in the tabbed Day Editor
 * (navigation no longer gates it), so this component is the SOLE authoritative gate: it
 * both re-validates the merged day (per-error repair actions) AND consults
 * isExportEnabled(computeStepStatus(...)), which folds in
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
 * @param {Array} [props.animalDays] - The animal's recording-day records (threaded from
 *   {@link DayEditorStepper}). Required by the cross-day bad-channel monotonicity export-block:
 *   without it that rule is a no-op, so a day that silently un-fails an earlier same-config bad
 *   channel would download clean. Defaults to `[]` for isolated single-day renders (back-compat).
 * @returns {JSX.Element}
 */
export default function ExportStep(props) {
  // The shared day bundle comes from DayEditorContext in the Day Editor (an isolated render
  // passes the same fields as props). `onNavigate`/`onRepair` are section-specific, so they stay
  // direct props.
  const { animal, day, animalKey = undefined, animalDays = [] } = useDayEditorContext(props);
  const { onNavigate, onRepair } = props;
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
  // raw animal-shape corruption (e.g. `cameras: "nope"`) is part of the gate, and
  // `animalDays` so the cross-day bad-channel monotonicity block (a day that silently
  // un-fails an earlier same-config bad channel) is enforced here, not just in display paths.
  const validationErrors = useMemo(
    () => validateDay(day, merged, animal, animalDays).filter((issue) => issue.severity === 'error'),
    [day, merged, animal, animalDays]
  );
  // The authoritative export gate the stepper uses (isExportEnabled over the full
  // computeStepStatus map): it folds in step-level statuses — notably
  // computeDevicesStatus's "all channels bad" → 'error' — that a flat
  // validate(merged) pass alone does NOT surface (it is not a schema/rule error).
  // Consulting it here keeps the directly-mounted ExportStep's gate exactly as
  // strict as the stepper's, so a directly-mounted ExportStep cannot download a day
  // the stepper would refuse to reach.
  const stepStatus = useMemo(
    () => computeStepStatus(day, merged, animal, animalDays),
    [day, merged, animal, animalDays]
  );
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
          // Geometry is animal-owned. Both gaps route to the Electrode Groups tab — channel maps are
          // auto-generated from each group's device_type, so a missing map is fixed by fixing the group:
          // no electrode groups → Electrode Groups (no field hint);
          // groups present but a group has no channel map → Electrode Groups with the electrode_groups
          // field hint so the deep-link highlights the groups instead of dropping the user at the top.
          const field = groups.length === 0 ? undefined : 'electrode_groups';
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
    const { isHistoricalConfiguration } = getDayWorkflowStatus(animal, day, merged, animalDays);
    const warningCount = validateDay(day, merged, animal, animalDays).filter(
      (issue) => issue.severity === 'warning'
    ).length;
    return buildPreflightSummary(merged, {
      animalId: ownerKey,
      date: day?.date,
      configurationVersion,
      isHistorical: isHistoricalConfiguration,
      warningCount,
    });
  }, [animal, day, merged, exportBlocked, ownerKey, animalDays]);

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

      {/* When the day is exportable, name its lifecycle state from the SHARED vocabulary so the
          Export step agrees with Animal Days / Day Validation / Validation Summary: a saved day
          reads "Validated" (or "Exported"), an unsaved-but-passing day "Ready to export". */}
      {!exportBlocked && (
        <p className="export-lifecycle-status" data-testid="export-lifecycle-status">
          Status: <strong>{DAY_LIFECYCLE_LABEL[lifecycleForValidDay(day?.state)]}</strong>
        </p>
      )}

      {exportBlocked && (
        <div className="export-validation-blocked" role="alert">
          {mergeError && (
            <p className="export-merge-error">
              This day&apos;s metadata could not be assembled — its animal&apos;s device
              configuration is missing or corrupt. Repair it in Animal Setup, then return.
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
              : // 0 error-severity validation issues, but export is gated by an incomplete
                // prerequisite step (or a raw-shape repair shown above). Don't imply validation
                // errors exist when none do — point the user to the required setup below.
                'Complete the required setup shown below before exporting.'}
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

// animal/day/animalKey/animalDays come from DayEditorContext in the Day Editor; these propTypes
// describe the isolated-render fallback, so animal/day are not `.isRequired`.
ExportStep.propTypes = {
  animal: PropTypes.object,
  day: PropTypes.object,
  onNavigate: PropTypes.func,
  onRepair: PropTypes.func,
  animalKey: PropTypes.string,
  // eslint-disable-next-line react/forbid-prop-types
  animalDays: PropTypes.array,
};

ExportStep.defaultProps = {
  onNavigate: () => {},
  onRepair: undefined,
  animalDays: [],
};
