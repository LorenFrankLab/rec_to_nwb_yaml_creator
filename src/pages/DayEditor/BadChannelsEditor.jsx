import { useState } from 'react';
import PropTypes from 'prop-types';
import { getProbeShanks, getProbeElectrodeIds } from '../../ntrode/probeCatalog';
import './DayEditor.scss';

/**
 * BadChannelsEditor - Edit failed channels for electrode groups
 *
 * Allows users to mark which hardware channels have failed on a specific
 * recording day. This is the only day-level device configuration that changes
 * over time (channels fail due to hardware degradation, tissue reactions, etc.).
 *
 * MULTI-SHANK CONTRACT (converter truth): trodes_to_nwb reads `bad_channels` ONLY
 * from an electrode group's FIRST ntrode row and interprets them as PROBE-LOCAL
 * electrode indices `0..N-1` spanning ALL shanks (convert_yaml.add_electrode_groups).
 * A row-local per-shank UI therefore cannot reach a valid bad channel like `42` on
 * shank 3 of a 64c-3s probe. So for a MULTI-shank group we present ONE selector over
 * the probe's full electrode-id range (`getProbeElectrodeIds`) and write the whole
 * selection to the FIRST ntrode row's id — exactly what the converter honors, and the
 * shape the `multishank_bad_channels_ignored` rule expects. Single-shank groups keep
 * the per-row checkbox behavior (row-local == probe-local for one shank).
 *
 * LATER-ROW CORRUPTION MIGRATION (HIGH review finding): a day/animal LOADED from disk
 * may already carry `bad_channels` on a LATER ntrode row (persisted corruption). The
 * converter silently ignores those, so the `multishank_bad_channels_ignored` rule
 * fires and BLOCKS export — but the probe-wide selector HIDES the later-row controls,
 * leaving the user with no way to clear them (a repair DEAD-END). So whenever the user
 * edits the probe-wide selection, we MIGRATE the group to a clean state: TRANSLATE each
 * later row's marks (which are KEYS into that row's `map`, i.e. row-local indices) to
 * the probe-local electrode id `row.map[key]` (falling back to the raw key if the map
 * lacks it), UNION those onto the FIRST row's selection, then CLEAR every later row.
 * The translated ids are never silently dropped. Touching the selector therefore also
 * repairs the corruption, and the rule then passes.
 *
 * ATOMIC BATCHED WRITE (HIGH review finding): the Day Editor's save path rebuilds the
 * whole `deviceOverrides` from a stale render closure and REPLACES it, so firing N
 * separate per-ntrode `onUpdate` calls in one handler RACES and clobbers earlier
 * writes (losing the first-row selection or reintroducing a later-row value). The
 * multi-shank migration therefore emits the ENTIRE new `bad_channels` map in ONE call
 * via `onBatchUpdate(badChannelsObject)`. Single-shank editing stays per-ntrode (one
 * `onUpdate` per change is already atomic). On load, if any later row carries bad
 * channels we surface a brief notice so the user understands the upcoming consolidation.
 *
 * REPAIR-FOCUS ANCHORS: the bad-channel control carries `data-field-path` set to
 * `ntrode_electrode_group_channel_map[<ntrode_id>]`, the exact path the
 * `bad_channel_out_of_range` / `multishank_bad_channels_ignored` validation issues
 * emit. The Day Editor stepper's focus search uses this to land a repair click on
 * the offending bad-channel control instead of the broad Devices step. For a
 * multi-shank group the probe-wide control anchors the FIRST row's id, and additional
 * focusable anchors cover the other ntrode ids in the group (since either rule may
 * key the issue by a non-first row) — all landing inside the same probe-wide control.
 *
 * @param {object} props
 * @param {Array} props.ntrodes - Ntrode channel maps for this electrode group
 * @param {object} props.badChannels - Current bad channels: { [ntrodeId]: [channelNumbers] }
 *   (the FULL map across all groups, so a batched write can rewrite the whole object).
 * @param {Function} props.onUpdate - Callback: (ntrodeId, badChannelArray) => void
 *   (single-shank, per-ntrode atomic write).
 * @param {Function} [props.onBatchUpdate] - Callback: (badChannelsObject) => void —
 *   atomic write of the WHOLE bad_channels map, used by the multi-shank probe-wide
 *   migration so concurrent per-ntrode writes can't race/clobber.
 * @param {string} [props.deviceType] - The electrode group's device type; enables the
 *   probe-wide selector for multi-shank probes (via the verified probe catalog).
 * @param {object} props.errors - Validation errors: { [ntrodeId]: errorMessage }
 * @param {object} props.warnings - Validation warnings: { [ntrodeId]: warningMessage }
 * @returns {JSX.Element}
 */
export default function BadChannelsEditor({ ntrodes, badChannels, onUpdate, onBatchUpdate, deviceType, errors, warnings }) {
  const [expandedMaps, setExpandedMaps] = useState({});

  if (!ntrodes || ntrodes.length === 0) {
    return null;
  }

  // Multi-shank iff the verified catalog reports >1 shank for this device. We also
  // require >1 ntrode row so a 1-row group never collapses to a degenerate selector.
  const probeShanks = getProbeShanks(deviceType);
  const isMultiShank = probeShanks.length > 1 && ntrodes.length > 1;

  /**
   * Handle checkbox change for a channel
   * @param {number|string} ntrodeId - Ntrode ID
   * @param {number} channelNum - Channel number
   * @param {boolean} isChecked - Whether checkbox is checked
   */
  const handleChannelToggle = (ntrodeId, channelNum, isChecked) => {
    const key = String(ntrodeId);
    const currentBadChannels = badChannels[key] || [];
    let updatedBadChannels;

    if (isChecked) {
      // Add channel to bad channels
      updatedBadChannels = [...currentBadChannels, channelNum].sort((a, b) => a - b);
    } else {
      // Remove channel from bad channels
      updatedBadChannels = currentBadChannels.filter(ch => ch !== channelNum);
    }

    onUpdate(key, updatedBadChannels);
  };

  /**
   * Remove ONE invalid bad-channel mark (single-shank).
   *
   * A loaded/persisted `bad_channels` array can carry a value with NO corresponding
   * checkbox: an out-of-range probe-local id (99 on a tetrode) or a non-integer
   * ('abc'). The checkbox grid renders only valid ids and `handleChannelToggle`
   * carries `currentBadChannels` forward unchanged, so such a value can never be
   * cleared by the user — yet it blocks export (`bad_channel_out_of_range`). This is
   * the only path that can clear it. Strict `!==` filtering removes ONLY this value,
   * leaving valid numeric marks intact.
   * @param {number|string} ntrodeId - Ntrode ID
   * @param {*} value - The invalid bad-channel value to remove.
   */
  const handleRemoveInvalidMark = (ntrodeId, value) => {
    const key = String(ntrodeId);
    const currentBadChannels = badChannels[key] || [];
    onUpdate(key, currentBadChannels.filter((x) => x !== value));
  };

  /**
   * Toggle channel map visibility
   * @param {number|string} ntrodeId - Ntrode ID
   */
  const toggleChannelMap = (ntrodeId) => {
    const key = String(ntrodeId);
    setExpandedMaps(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // ── Multi-shank: ONE probe-wide selector written to the FIRST ntrode row. ──
  if (isMultiShank) {
    const firstNtrode = ntrodes[0];
    const firstKey = String(firstNtrode.ntrode_id);
    const electrodeIds = getProbeElectrodeIds(deviceType); // 0 … N-1
    const currentBadChannels = badChannels[firstKey] || [];
    const error = errors?.[firstKey];
    const warning = warnings?.[firstKey];
    // Either validation rule may key the issue by a non-first ntrode id; anchor
    // those to the same probe-wide control so a repair click still lands here.
    const laterNtrodes = ntrodes.slice(1);
    const otherNtrodeIds = laterNtrodes.map((n) => n.ntrode_id);

    // Later rows that currently carry bad_channels — persisted corruption the
    // converter ignores. We consolidate these onto the first row whenever the
    // probe-wide selection is edited (migration); flag it on load so the user knows.
    const laterRowsWithBad = laterNtrodes.filter(
      (n) => (badChannels[String(n.ntrode_id)] || []).length > 0
    );
    const hasLaterRowCorruption = laterRowsWithBad.length > 0;

    // The set of ids the probe-wide selector can actually render/uncheck. A migrated
    // value MUST be one of these, or it becomes an unrepairable export blocker (no
    // checkbox to clear it).
    const probeIdSet = new Set(electrodeIds);

    /**
     * Translate a later row's stored bad-channel entries (row-local map KEYS) to
     * probe-local electrode ids via `row.map[key]`. The probe-wide selector and the
     * converter both speak probe-local ids, so a later row's marks must be carried
     * over by their mapped id, never by their raw row-local index. When the row's map
     * lacks the key we fall back to the raw key, but ONLY keep values that are
     * representable probe electrode ids: an untranslatable, out-of-range mark cannot
     * correspond to any real electrode, has no probe-wide checkbox, and is ignored by
     * the converter anyway, so copying it would fabricate an unrepairable first-row
     * value. We drop those rather than block export on a value the user can't clear.
     * @param {object} ntrode - A later ntrode row from `ntrodes`.
     * @returns {number[]} Representable probe-local electrode ids for this row's marks.
     */
    const translateLaterRowMarks = (ntrode) => {
      const stored = badChannels[String(ntrode.ntrode_id)] || [];
      const map = ntrode.map || {};
      return stored
        .map((key) => {
          const mapped = map[key];
          return mapped === undefined || mapped === null ? key : mapped;
        })
        .filter((id) => probeIdSet.has(id));
    };

    /**
     * Probe-wide toggle: compute the ENTIRE new bad_channels map and write it in ONE
     * atomic `onBatchUpdate` call (the Day Editor replaces deviceOverrides wholesale,
     * so separate per-ntrode writes would race/clobber). The first row becomes the
     * UNION of (its toggled selection) and (every later row's TRANSLATED marks), and
     * every later row is cleared to `[]`. This both edits the selection and repairs
     * loaded later-row corruption so `multishank_bad_channels_ignored` passes.
     * @param {number} electrodeId - Probe-local electrode id.
     * @param {boolean} isChecked - Whether the box was checked.
     */
    const handleProbeWideToggle = (electrodeId, isChecked) => {
      // 1. First-row selection after toggling this electrode.
      const firstSelection = isChecked
        ? [...currentBadChannels, electrodeId]
        : currentBadChannels.filter((ch) => ch !== electrodeId);

      // 2. Union with translated later-row marks (never dropped).
      const translated = laterNtrodes.flatMap((n) => translateLaterRowMarks(n));
      const firstUnion = Array.from(new Set([...firstSelection, ...translated])).sort(
        (a, b) => a - b
      );

      // 3. Build the WHOLE new bad_channels map: first row = union, later rows = [].
      const next = { ...badChannels };
      next[firstKey] = firstUnion;
      laterNtrodes.forEach((n) => {
        next[String(n.ntrode_id)] = [];
      });

      onBatchUpdate(next);
    };

    // First-row marks with NO probe-wide checkbox (out-of-range id or non-integer).
    // These have no checkbox to uncheck and block export via bad_channel_out_of_range,
    // so they are an unrepairable dead-end without an explicit removal control.
    const invalidMarks = currentBadChannels.filter((v) => !probeIdSet.has(v));

    /**
     * Remove ONE invalid first-row mark via the ATOMIC batch path. The Day Editor
     * rebuilds deviceOverrides wholesale, so a lone `onUpdate` would race; mirror
     * `handleProbeWideToggle` and emit the WHOLE next map in one `onBatchUpdate`.
     * @param {*} value - The invalid bad-channel value to remove.
     */
    const handleRemoveInvalidMark = (value) => {
      const next = { ...badChannels };
      next[firstKey] = currentBadChannels.filter((x) => x !== value);
      onBatchUpdate(next);
    };

    return (
      <div className="bad-channels-editor">
        <p className="field-help-text">
          Only mark channels with hardware failures. Analysis quality issues should be handled during spike sorting.
        </p>
        <p className="field-help-text">
          This multi-shank probe is mapped by a single probe-local electrode index spanning
          all shanks. trodes_to_nwb reads failed channels from one list for the whole group.
        </p>

        {hasLaterRowCorruption && (
          <p className="field-help-text migration-notice" role="status">
            This group has failed-channel marks on a later shank row that trodes_to_nwb
            ignores. They will be consolidated onto this probe-wide list (the first row)
            the next time you change a selection here.
          </p>
        )}

        <fieldset className="ntrode-fieldset">
          <legend>Failed Electrodes (probe-local 0–{electrodeIds.length - 1})</legend>

          <div className="failed-channels-section">
            <div
              id={`failed-channels-${firstKey}`}
              className="bad-channels-checkboxes"
              role="group"
              aria-label="Failed electrodes for this multi-shank probe"
              tabIndex={-1}
              /* Repair-focus anchor: matches the bad-channel issue path keyed by the
                 FIRST ntrode row — the row the converter honors. */
              data-field-path={`ntrode_electrode_group_channel_map[${firstNtrode.ntrode_id}]`}
            >
              {electrodeIds.map((electrodeId) => (
                <div key={electrodeId} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`electrode-${firstKey}-${electrodeId}`}
                    checked={currentBadChannels.includes(electrodeId)}
                    onChange={(e) => handleProbeWideToggle(electrodeId, e.target.checked)}
                  />
                  <label htmlFor={`electrode-${firstKey}-${electrodeId}`}>
                    Electrode {electrodeId}
                  </label>
                </div>
              ))}
            </div>

            {/* Additional repair-focus anchors for the group's other ntrode ids:
                the bad_channel_out_of_range / multishank_bad_channels_ignored rules
                can key the issue by a non-first row, but the repair always happens
                in this one probe-wide control. These land focus inside it. */}
            {otherNtrodeIds.map((ntrodeId) => (
              <span
                key={`anchor-${ntrodeId}`}
                tabIndex={-1}
                aria-hidden="true"
                className="repair-focus-anchor"
                data-field-path={`ntrode_electrode_group_channel_map[${ntrodeId}]`}
              />
            ))}

            {/* Removal controls for loaded first-row marks that have no checkbox
                (out-of-range/corrupt). Without these the value can never be cleared
                and permanently blocks export. */}
            {invalidMarks.map((value) => (
              <button
                key={`invalid-${String(value)}`}
                type="button"
                className="remove-invalid-mark"
                onClick={() => handleRemoveInvalidMark(value)}
                aria-label={`Remove invalid failed channel ${value} from ntrode ${firstNtrode.ntrode_id}`}
                data-field-path={`ntrode_electrode_group_channel_map[${firstNtrode.ntrode_id}]`}
              >
                Remove invalid failed channel {String(value)}
              </button>
            ))}

            {error && (
              <span className="validation-error" role="alert">
                {error}
              </span>
            )}

            {warning && (
              <span className="validation-warning" role="alert">
                {warning}
              </span>
            )}
          </div>
        </fieldset>
      </div>
    );
  }

  return (
    <div className="bad-channels-editor">
      <p className="field-help-text">
        Only mark channels with hardware failures. Analysis quality issues should be handled during spike sorting.
      </p>

      {ntrodes.map((ntrode, index) => {
        const ntrodeId = ntrode.ntrode_id;
        const ntrodeKey = String(ntrodeId);
        const currentBadChannels = badChannels[ntrodeKey] || [];
        const channels = Object.keys(ntrode.map).map(Number).sort((a, b) => a - b);
        // Marks with no checkbox in this row (out-of-range id or non-integer like
        // 'abc'). They block export but the grid can't render/uncheck them, so we
        // surface an explicit removal control below.
        const invalidMarks = currentBadChannels.filter((v) => !channels.includes(v));
        const error = errors?.[ntrodeKey];
        const warning = warnings?.[ntrodeKey];

        return (
          <fieldset key={ntrodeKey} className="ntrode-fieldset">
            <legend>Shank #{index + 1} (Ntrode ID: {ntrodeId})</legend>

            <div className="failed-channels-section">
              <label htmlFor={`failed-channels-${ntrodeKey}`}>Failed Channels</label>

              <div
                id={`failed-channels-${ntrodeKey}`}
                className="bad-channels-checkboxes"
                role="group"
                aria-label={`Failed channels for Shank ${index + 1}`}
                tabIndex={-1}
                /* Repair-focus anchor: matches the bad-channel issue path for this
                   ntrode row so a repair click lands on this control. */
                data-field-path={`ntrode_electrode_group_channel_map[${ntrodeId}]`}
              >
                {channels.map(channelNum => (
                  <div key={channelNum} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`channel-${ntrodeKey}-${channelNum}`}
                      checked={currentBadChannels.includes(channelNum)}
                      onChange={(e) => handleChannelToggle(ntrodeId, channelNum, e.target.checked)}
                    />
                    <label htmlFor={`channel-${ntrodeKey}-${channelNum}`}>
                      Channel {channelNum}
                    </label>
                  </div>
                ))}
              </div>

              {/* Removal controls for loaded marks with no checkbox (out-of-range or
                  non-integer). Without these the value can never be cleared and
                  permanently blocks export. */}
              {invalidMarks.map((value) => (
                <button
                  key={`invalid-${String(value)}`}
                  type="button"
                  className="remove-invalid-mark"
                  onClick={() => handleRemoveInvalidMark(ntrodeId, value)}
                  aria-label={`Remove invalid failed channel ${value} from ntrode ${ntrodeId}`}
                  data-field-path={`ntrode_electrode_group_channel_map[${ntrodeId}]`}
                >
                  Remove invalid failed channel {String(value)}
                </button>
              ))}

              {error && (
                <span className="validation-error" role="alert">
                  {error}
                </span>
              )}

              {warning && (
                <span className="validation-warning" role="alert">
                  {warning}
                </span>
              )}
            </div>

            {/* Collapsible channel map for reference */}
            <div className="channel-map-reference">
              <button
                type="button"
                className="channel-map-toggle"
                onClick={() => toggleChannelMap(ntrodeId)}
                aria-expanded={expandedMaps[ntrodeKey] || false}
                aria-controls={`channel-map-${ntrodeKey}`}
              >
                <span className="toggle-icon" aria-hidden="true">
                  {expandedMaps[ntrodeKey] ? '▼' : '▶'}
                </span>
                View Channel Map
              </button>

              {expandedMaps[ntrodeKey] && (
                <div id={`channel-map-${ntrodeKey}`} className="channel-map-content">
                  <table className="channel-map-table">
                    <thead>
                      <tr>
                        <th>Electrode</th>
                        <th>Hardware Channel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map(channelNum => (
                        <tr key={channelNum}>
                          <td>{channelNum}</td>
                          <td>{ntrode.map[channelNum]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

BadChannelsEditor.propTypes = {
  ntrodes: PropTypes.arrayOf(
    PropTypes.shape({
      ntrode_id: PropTypes.number.isRequired,
      electrode_group_id: PropTypes.number.isRequired,
      bad_channels: PropTypes.arrayOf(PropTypes.number),
      map: PropTypes.objectOf(PropTypes.number).isRequired,
    })
  ).isRequired,
  badChannels: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  onUpdate: PropTypes.func.isRequired,
  onBatchUpdate: PropTypes.func,
  deviceType: PropTypes.string,
  errors: PropTypes.object,
  warnings: PropTypes.object,
};

BadChannelsEditor.defaultProps = {
  onBatchUpdate: undefined,
  deviceType: undefined,
  errors: {},
  warnings: {},
};
