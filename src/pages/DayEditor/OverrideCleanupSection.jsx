import { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { classifyDeviceOverrides } from '../../domain/deviceOverrides';

/**
 * Malformed / stale / shadowing `deviceOverrides` repair controls. The merge declines to apply any
 * malformed override shape, so each blocks export (via `dayOverrideIssues`) but has NO editor row —
 * a repair dead-end. This surfaces a focusable removal control for every such shape. The contract:
 * whatever `dayOverrideIssues` flags is repairable here. The shapes (mirroring that function): a
 * stale/corrupt-value `bad_channels` key; a scalar/array `bad_channels` container; a non-array
 * geometry override. Extracted verbatim from `pages/DayEditor/DevicesStep.jsx` (Phase 9c-3) with no
 * behavior change — it owns the same `classifyDeviceOverrides` classification (the editing-surface
 * counterpart of the validator's `dayOverrideIssues`) and the atomic removal writes. Each per-key
 * bad-channel button carries a KEY-SPECIFIC `data-field-path` so repair-focus lands on the clicked
 * ntrode's control. Renders `null` when there is nothing to clean up.
 *
 * @param {object} props
 * @param {object} props.day - The day record (its `deviceOverrides`).
 * @param {Set<string>} props.resolvedNtrodeIds - The day's resolved ntrode-id set (stale-key detection).
 * @param {Function} props.onFieldUpdate - `(fieldPath, value) => void` store writer.
 * @returns {JSX.Element|null}
 */
export default function OverrideCleanupSection({ day, resolvedNtrodeIds, onFieldUpdate }) {
  // Malformed / stale / shadowing override classification. The converter-meaning decision (which
  // shapes the merge can't honor, partitioned for distinct removal labels) lives in
  // `classifyDeviceOverrides` — the editing-surface counterpart of the validator's `dayOverrideIssues`.
  const {
    overridesRecord,
    wholeOverridesMalformed,
    badChannelContainer,
    badChannelContainerIsRecord,
    badChannelContainerMalformed,
    staleOverrideKeys,
    corruptValueKeys,
    presentGeometryKeys,
    hasOverrideCleanup,
  } = useMemo(() => classifyDeviceOverrides(day, resolvedNtrodeIds), [day, resolvedNtrodeIds]);

  /**
   * Remove a single bad-channel override key (stale or corrupt-value) via ONE atomic
   * write of the whole map minus that key. The container is a record here (guarded by
   * the callers), so spreading it is safe.
   * @param {string} key - The ntrode_id key to drop.
   */
  const handleRemoveOverrideKey = useCallback((key) => {
    const overrides = badChannelContainerIsRecord ? badChannelContainer : {};
    const next = { ...overrides };
    delete next[key];
    onFieldUpdate('deviceOverrides.bad_channels', next);
  }, [badChannelContainer, badChannelContainerIsRecord, onFieldUpdate]);

  /**
   * Remove an entire malformed override KEY off `deviceOverrides` (a scalar bad_channels
   * container, or a non-array geometry override). Rewrites the whole `deviceOverrides`
   * record without that key — `handleFieldUpdate` only SETS a path, so deleting a key
   * means writing the parent object minus it.
   * @param {string} overrideKey - 'bad_channels' | 'electrode_groups' | 'ntrode_electrode_group_channel_map'.
   */
  const handleRemoveOverride = useCallback((overrideKey) => {
    const next = { ...(overridesRecord || {}) };
    delete next[overrideKey];
    onFieldUpdate('deviceOverrides', next);
  }, [overridesRecord, onFieldUpdate]);

  if (!hasOverrideCleanup) return null;

  return (
    <section className="stale-overrides-section" aria-label="Corrupt or stale device overrides">
      <p className="field-help-text">
        This day has device overrides that need review. Corrupt or stale overrides block
        export; a shadowing override replaces the saved configuration for this day only.
        Remove any you did not intend:
      </p>

      {wholeOverridesMalformed && (
        <button
          type="button"
          className="stale-override-remove"
          data-field-path="deviceOverrides"
          onClick={() => onFieldUpdate('deviceOverrides', {})}
        >
          Remove corrupt device overrides
        </button>
      )}

      {staleOverrideKeys.map((staleKey) => (
        <button
          key={`stale-${staleKey}`}
          type="button"
          className="stale-override-remove"
          data-field-path={`deviceOverrides.bad_channels.${staleKey}`}
          onClick={() => handleRemoveOverrideKey(staleKey)}
        >
          Remove stale failed-channel override for ntrode {staleKey}
        </button>
      ))}

      {corruptValueKeys.map((key) => (
        <button
          key={`corrupt-${key}`}
          type="button"
          className="stale-override-remove"
          data-field-path={`deviceOverrides.bad_channels.${key}`}
          onClick={() => handleRemoveOverrideKey(key)}
        >
          Remove corrupt failed-channel override for ntrode {key}
        </button>
      ))}

      {badChannelContainerMalformed && (
        <button
          type="button"
          className="stale-override-remove"
          data-field-path="deviceOverrides.bad_channels"
          onClick={() => handleRemoveOverride('bad_channels')}
        >
          Remove corrupt failed-channel override
        </button>
      )}

      {presentGeometryKeys.map((key) => (
        <button
          key={`geom-${key}`}
          type="button"
          className="stale-override-remove"
          data-field-path={`deviceOverrides.${key}`}
          onClick={() => handleRemoveOverride(key)}
        >
          {Array.isArray(overridesRecord[key])
            ? `Remove ${key} override (revert to saved configuration)`
            : `Remove corrupt ${key} override`}
        </button>
      ))}
    </section>
  );
}

OverrideCleanupSection.propTypes = {
  day: PropTypes.object.isRequired,
  resolvedNtrodeIds: PropTypes.instanceOf(Set).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
