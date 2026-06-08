import PropTypes from 'prop-types';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { getConfigHistory } from '../../state/workspaceSelectors';
import { getDayWorkflowStatus } from '../../domain/workflowStatus';
import { buildPreflightSummary } from '../../domain/preflightSummary';
import { resolveRigConstant } from '../../domain/rigConstants';

/**
 * EffectiveDayReview — read-only "what THIS day actually used" review (Phase 3-5, Task 3.3a:
 * the valid-but-wrong defense).
 *
 * A recording day is pinned to the configuration version that was active when it ran, so a
 * historical day's effective setup (cameras, electrode groups, failed channels, rig constants) can
 * DIFFER from the animal's CURRENT setup tabs. This surfaces that day's actual export values —
 * sourced from the SAME helpers the export path uses ({@link mergeDayMetadata} →
 * {@link buildPreflightSummary} + {@link resolveRigConstant}), never re-derived — and labels them
 * explicitly as "what this day used", distinct from the live setup tabs, so a scientist reviewing
 * readiness can't mistake a historical day for one using the latest config.
 *
 * @param {object} props
 * @param {object} props.animal - The owning animal record.
 * @param {object} props.day - The recording day record.
 * @returns {JSX.Element}
 */
export default function EffectiveDayReview({ animal, day }) {
  let merged;
  try {
    merged = mergeDayMetadata(animal, day);
  } catch (err) {
    return (
      <p className="effective-day-review-error" role="note">
        This day&apos;s configuration could not be read, so its effective setup can&apos;t be shown.
        Open it in the Day Editor to repair it. ({err.message})
      </p>
    );
  }

  const workflow = getDayWorkflowStatus(animal, day, merged);
  const snapshot = getConfigHistory(animal).find((s) => s.version === workflow.configurationVersion);

  const summary = buildPreflightSummary(merged, {
    animalId: animal.id,
    date: day.date,
    configurationVersion: workflow.configurationVersion,
    isHistorical: workflow.isHistoricalConfiguration,
  });

  const raw = resolveRigConstant(day.technical, animal.technicalDefaults, 'raw_data_to_volts');
  const mult = resolveRigConstant(day.technical, animal.technicalDefaults, 'times_period_multiplier');

  return (
    <div className="effective-day-review" role="group" aria-label="Effective setup for this day">
      <p className="effective-day-review-caption">
        What this day used (read-only)
        {snapshot?.date ? ` — configuration from ${snapshot.date}` : ''}
        {workflow.isHistoricalConfiguration ? ' · historical, may differ from the current setup tabs' : ''}
        {snapshot?.description ? ` · ${snapshot.description}` : ''}
      </p>
      <dl className="effective-day-review-list">
        {summary.map((entry) => (
          <div key={entry.label} className="effective-day-review-row">
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
        <div className="effective-day-review-row">
          <dt>Rig constants</dt>
          <dd>
            raw_data_to_volts {raw.display}
            {raw.status === 'differs' ? ' (differs from current default)' : ''}; times_period_multiplier{' '}
            {mult.display}
            {mult.status === 'differs' ? ' (differs from current default)' : ''}
          </dd>
        </div>
      </dl>
    </div>
  );
}

EffectiveDayReview.propTypes = {
  animal: PropTypes.object.isRequired,
  day: PropTypes.object.isRequired,
};
