import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { encodeYaml, formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { isFeatureEnabled } from '../../featureFlags';
import { checkShadowExport } from './shadowExport';
import './DayEditor.scss';

/**
 * ExportStep - per-day YAML export (Step 5 of Day Editor).
 *
 * Builds the flat metadata model from the workspace via {@link mergeDayMetadata},
 * shows the resolved download filename and an optional YAML preview, and lets the
 * user download the file. Every download first runs an encoder-stability
 * pre-download check ({@link checkShadowExport}); when that check fails it blocks
 * the download and shows a diff in strict mode (the default), or warns and
 * proceeds when the strict flag is disabled for debugging.
 *
 * The step itself is only reachable once every prerequisite step is valid (the
 * existing StepNavigation export gate); this component does not re-implement that
 * gate but still hard-stops on the shadow check.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record providing shared metadata.
 * @param {object} props.day - Recording day providing session-specific data.
 * @returns {JSX.Element}
 */
export default function ExportStep({ animal, day }) {
  const [showPreview, setShowPreview] = useState(false);
  const [blockingError, setBlockingError] = useState(null);
  const [overrideWarning, setOverrideWarning] = useState(null);
  const [downloadedFile, setDownloadedFile] = useState(null);

  // Preview YAML + filename, recomputed when the inputs change.
  const { yaml, fileName } = useMemo(() => {
    const merged = mergeDayMetadata(animal, day);
    return {
      yaml: encodeYaml(merged),
      // mergeDayMetadata does not carry EXPERIMENT_DATE_in_format_mmddYYYY (it is
      // a filename-only key); inject it from the day so the filename does not
      // degrade to the literal placeholder. Filename only — never the YAML body.
      fileName: formatDeterministicFilename({
        ...merged,
        EXPERIMENT_DATE_in_format_mmddYYYY: day.experimentDate,
      }),
    };
  }, [animal, day]);

  const handleDownload = () => {
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
          disabled={!!blockingError}
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

ExportStep.propTypes = {
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
};
