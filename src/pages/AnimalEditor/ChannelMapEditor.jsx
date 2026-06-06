import React, { useState, useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { getChannelCount } from '../../utils/deviceTypeUtils';
import { getProbeShanks, getProbeElectrodeIds } from '../../ntrode/probeCatalog';
import {
  isMultiShankGroup,
  asBadChannelArray,
  toggleMark,
  invalidBadChannelMarks,
  probeElectrodeIdSet,
  migrateProbeWideChannelMaps,
} from '../../domain/badChannels';
import InfoIcon from '../../element/InfoIcon';
import './ChannelMapEditor.scss';

/**
 * ChannelMapEditor - Editor for ntrode channel maps for a specific electrode group
 *
 * LEGACY LAYOUT MATCH: This component replicates the exact layout from the original
 * ChannelMap.jsx component (src/ntrode/ChannelMap.jsx) with:
 * - Fieldset with "Shank #N" legend
 * - Readonly "Ntrode Id" field with InfoIcon
 * - "Bad Channels" checkbox grid (NOT comma-separated input)
 * - "Map" section with select dropdowns (NOT number inputs)
 *
 * Per-shank grids are derived from the VERIFIED probe catalog (`getProbeShanks`),
 * matching ntrode rows to shanks BY ORDER, so an UNEVEN probe like
 * `64c-3s6mm6cm-20um-40um-sl` (21/21/22) renders its third shank's full 22
 * channels instead of a uniform 21. Falls back to the row's own map keys when the
 * device is uncatalogued or there are more rows than shanks.
 *
 * MULTI-SHANK BAD-CHANNEL CONTRACT (converter truth): trodes_to_nwb reads
 * `bad_channels` ONLY from an electrode group's FIRST ntrode row and interprets
 * them as PROBE-LOCAL electrode indices `0..N-1` spanning ALL shanks. A row-local
 * per-shank bad-channel UI therefore cannot reach (and wrongly rejects) a valid
 * first-row value like `42` on shank 3 of a 64c-3s probe. So for a MULTI-shank
 * group we present ONE probe-wide bad-channel selector over the probe's full
 * electrode-id range (`getProbeElectrodeIds`) and write the whole selection to the
 * group's FIRST ntrode row — mirroring the Day Editor's BadChannelsEditor fix.
 * Single-shank groups keep the per-row checkbox behavior (row-local == probe-local
 * for one shank). The Map dropdowns remain per-shank in both cases.
 *
 * @param {object} props Component properties
 * @param {object} props.electrodeGroup Electrode group being edited
 * @param {Array} props.channelMaps Array of ntrode channel map objects for this group
 * @param {Function} props.onSave Callback with updated channel maps when saved
 * @param {Function} props.onCancel Callback to close editor without saving
 *
 * @returns {JSX.Element} Channel map editor component
 */
const ChannelMapEditor = ({ electrodeGroup, channelMaps, onSave, onCancel }) => {
  // Stable id wiring the shared Modal's title to aria-labelledby.
  const titleId = useId();

  // Local state for editing channel maps
  const [localChannelMaps, setLocalChannelMaps] = useState(
    JSON.parse(JSON.stringify(channelMaps))
  );

  // Inline validation errors shown on save (replaces a blocking alert()).
  const [validationErrors, setValidationErrors] = useState([]);

  // Did the group LOAD with bad_channels on a LATER ntrode row? That is persisted
  // corruption the converter silently ignores (it reads bad_channels from the first
  // row only), and the multi-shank probe-wide selector HIDES the later-row controls.
  // Computed once from the INITIAL channelMaps so the consolidation notice stays
  // visible until the user edits the selector (which performs the migration). A later
  // row's value can be a non-empty ARRAY or a preserved corrupt SCALAR (non-array) —
  // both are converter-ignored corruption that still blocks export, so a hidden scalar
  // must also surface the notice (the migration clears it).
  const [hadLaterRowBadChannelsOnLoad] = useState(() =>
    channelMaps.slice(1).some((m) =>
      Array.isArray(m.bad_channels)
        ? m.bad_channels.length > 0
        : m.bad_channels != null
    )
  );

  // Per-shank electrode-id partition (converter truth), matched to ntrode rows by
  // order. The maximum map VALUE is the total probe channel count − 1.
  const probeShanks = getProbeShanks(electrodeGroup.device_type);
  const maxChannelValue = getChannelCount(electrodeGroup.device_type) - 1;

  // Multi-shank iff the verified catalog reports >1 shank AND there is >1 ntrode
  // row (so a degenerate 1-row group never collapses to a probe-wide selector).
  // In multi-shank mode bad_channels are edited probe-wide on the FIRST row only.
  const isMultiShank = isMultiShankGroup(electrodeGroup.device_type, localChannelMaps.length);
  const probeElectrodeIds = getProbeElectrodeIds(electrodeGroup.device_type); // 0 … N-1

  /**
   * Local channel keys (0 … len-1) for the ntrode row at `ntrodeIndex`.
   * Uses the catalog shank for that row; falls back to the row's own map keys
   * (uncatalogued device or excess rows) so the editor never silently drops keys.
   * @param {number} ntrodeIndex
   * @returns {number[]}
   */
  const channelKeysForRow = (ntrodeIndex) => {
    const shank = probeShanks[ntrodeIndex];
    if (shank) {
      return shank.electrodeIds.map((_, i) => i);
    }
    const map = localChannelMaps[ntrodeIndex]?.map || {};
    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b);
  };

  // Handle bad channel checkbox toggle (single-shank: row-local index).
  const handleBadChannelToggle = (ntrodeIndex, channelIndex, isChecked) => {
    // `toggleMark` guards a preserved corrupt scalar so a toggle never throws (a scalar is
    // repaired via the whole-value reset, but the user could toggle first).
    const updated = localChannelMaps.map((map, idx) =>
      idx === ntrodeIndex
        ? { ...map, bad_channels: toggleMark(map.bad_channels, channelIndex, isChecked) }
        : map
    );

    setLocalChannelMaps(updated);
  };

  // Handle probe-wide bad-channel toggle (multi-shank: probe-local id 0..N-1,
  // written to the group's FIRST ntrode row — the only row the converter honors).
  // MIGRATION: editing the probe-wide selection MIGRATES every
  // later row's marks onto the first row, then CLEARS the later rows. A group loaded
  // with later-row corruption (which the converter ignores and the export rule blocks
  // on) is otherwise a repair dead-end here, because the later-row controls are hidden.
  // A later row's bad_channels entries are KEYS into that row's `map` (row-local
  // indices); the probe-local id is `row.map[key]`. We TRANSLATE each entry to its
  // mapped id (falling back to the raw key when the map lacks it) and UNION it onto the
  // first row so multishank_bad_channels_ignored then passes. We keep ONLY values that
  // are representable probe electrode ids: an untranslatable, out-of-range mark has no
  // probe-wide checkbox (the converter ignores later-row marks anyway), so copying it
  // would fabricate an unrepairable, export-blocking first-row value — drop those.
  const handleProbeWideBadChannelToggle = (electrodeId, isChecked) => {
    // The converter meaning — union the first row's toggled selection with every later
    // row's translated marks and clear later rows (array or preserved corrupt scalar) —
    // lives in `migrateProbeWideChannelMaps`. Touching the selector therefore also repairs
    // loaded later-row corruption so `multishank_bad_channels_ignored` passes.
    setLocalChannelMaps(
      migrateProbeWideChannelMaps(localChannelMaps, electrodeId, isChecked, electrodeGroup.device_type)
    );
  };

  // Remove ONE invalid bad-channel mark from the row at `ntrodeIndex`.
  // A loaded `bad_channels` array can carry a value with NO checkbox in the grid: an
  // out-of-range index or a non-integer like 'abc'. The checkbox grid renders only
  // valid ids and the toggle handlers preserve invisible current values, so such a
  // mark can never be cleared by the user — yet it blocks export. This is the only
  // path that clears it. Strict `!==` filtering removes ONLY this value.
  const handleRemoveInvalidMark = (ntrodeIndex, value) => {
    const updated = localChannelMaps.map((map, idx) => {
      if (idx !== ntrodeIndex) return map;
      const currentBadChannels = Array.isArray(map.bad_channels) ? map.bad_channels : [];
      return { ...map, bad_channels: currentBadChannels.filter((x) => x !== value) };
    });
    setLocalChannelMaps(updated);
  };

  // Reset a row's bad_channels to [] when it loaded as a SCALAR (non-array) from
  // corrupt persisted state. The normalizer preserves such a value verbatim so
  // validation can flag it (it does not launder it), and the per-value invalid-mark
  // removal UI applies only when bad_channels IS an array — a scalar has no
  // representable entries to filter. This is the distinct whole-value reset that
  // makes the scalar REPAIRABLE in the UI; after reset + Save the row is clean.
  const handleResetCorruptBadChannels = (ntrodeIndex) => {
    const updated = localChannelMaps.map((map, idx) =>
      idx === ntrodeIndex ? { ...map, bad_channels: [] } : map
    );
    setLocalChannelMaps(updated);
  };

  // Handle channel map select change
  const handleChannelMapChange = (ntrodeIndex, channelIndex, value) => {
    const parsedValue = value === '' ? -1 : parseInt(value, 10);

    const updated = localChannelMaps.map((map, idx) =>
      idx === ntrodeIndex
        ? { ...map, map: { ...map.map, [channelIndex]: parsedValue } }
        : map
    );
    setLocalChannelMaps(updated);
  };

  // Check if channel is marked as bad (single-shank: row-local index).
  // A row's bad_channels may be a SCALAR from corrupt persisted state (the
  // normalizer preserves it verbatim); guard so a non-array never throws.
  const isChannelBad = (ntrodeIndex, channelIndex) =>
    asBadChannelArray(localChannelMaps[ntrodeIndex]?.bad_channels).includes(channelIndex);

  // Check if a probe-wide electrode id is marked bad (multi-shank: first row).
  // `asBadChannelArray` guards the first row against a preserved corrupt scalar.
  const isProbeElectrodeBad = (electrodeId) =>
    asBadChannelArray(localChannelMaps[0]?.bad_channels).includes(electrodeId);

  // Handle Save button click
  const handleSave = () => {
    // Validate channel maps before saving
    const errors = validateChannelMaps(localChannelMaps, electrodeGroup.device_type);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    onSave(localChannelMaps);
  };

  // Validate channel maps for errors. Bad-channel indices are probe-local:
  //  - MULTI-shank: the whole probe-wide range `0..N-1`, read from the FIRST row
  //    only (matching the converter), so a valid id like 42 is NOT rejected and
  //    later rows must carry no bad channels.
  //  - SINGLE-shank: the per-shank channel count (row-local == probe-local).
  const validateChannelMaps = (maps, deviceType) => {
    const errors = [];
    const maxValue = getChannelCount(deviceType) - 1;
    const shanks = getProbeShanks(deviceType);
    const multiShank = shanks.length > 1 && maps.length > 1;
    const probeChannelCount = getProbeElectrodeIds(deviceType).length;

    maps.forEach((ntrodeMap, ntrodeIndex) => {
      // Validate channel values are within range
      Object.entries(ntrodeMap.map).forEach(([chIdx, hwChannel]) => {
        if (hwChannel !== -1 && (hwChannel < 0 || hwChannel > maxValue)) {
          errors.push(
            `Ntrode ${ntrodeMap.ntrode_id}: Channel ${chIdx} maps to invalid hardware channel ${hwChannel} (valid range: 0-${maxValue})`
          );
        }
      });

      // Reject UNSET (-1) entries. The -1 sentinel is the dropdown's blank
      // option; saving it persists a converter-invalid map (the export gate catches
      // it later, but surface it at edit time). Every channel must map to a real id.
      const unsetChannels = Object.entries(ntrodeMap.map)
        .filter(([, hwChannel]) => hwChannel === -1)
        .map(([chIdx]) => chIdx);
      if (unsetChannels.length > 0) {
        errors.push(
          `Ntrode ${ntrodeMap.ntrode_id}: Channel(s) ${unsetChannels.join(', ')} are unset ` +
          `(no hardware channel selected). Select a hardware channel for every entry before saving.`
        );
      }

      // Validate no duplicate hardware channels within same ntrode
      const hwChannels = Object.values(ntrodeMap.map).filter(val => val !== -1);
      const duplicates = hwChannels.filter((val, idx) => hwChannels.indexOf(val) !== idx);
      if (duplicates.length > 0) {
        const uniqueDupes = [...new Set(duplicates)].join(', ');
        errors.push(
          `Ntrode ${ntrodeMap.ntrode_id}: Duplicate hardware channels detected: ${uniqueDupes}`
        );
      }

      // Validate bad_channels indices are probe-local and in range.
      // A loaded bad_channels may be a SCALAR (corrupt persisted state preserved
      // by the normalizer); guard the iteration so it never throws. The scalar is
      // surfaced/repaired via the whole-value reset control, not iterated here.
      const badChannels = Array.isArray(ntrodeMap.bad_channels) ? ntrodeMap.bad_channels : [];
      if (multiShank) {
        // Converter reads bad_channels from the FIRST row only, as probe-wide ids.
        if (ntrodeIndex === 0) {
          badChannels.forEach((badCh) => {
            if (!Number.isInteger(badCh) || badCh < 0 || badCh >= probeChannelCount) {
              errors.push(
                `Ntrode ${ntrodeMap.ntrode_id}: Bad channel index ${badCh} is out of range ` +
                `(valid probe-local: 0-${probeChannelCount - 1})`
              );
            }
          });
        } else if (badChannels.length > 0) {
          // A non-first row carrying bad channels would be silently ignored by the
          // converter; the probe-wide selector never produces this, but guard it.
          errors.push(
            `Ntrode ${ntrodeMap.ntrode_id}: Bad channels on a non-first ntrode row are ` +
            `ignored during conversion. Mark this group's bad channels on the first row.`
          );
        }
      } else {
        const shankLen = shanks[ntrodeIndex]
          ? shanks[ntrodeIndex].electrodeIds.length
          : Object.keys(ntrodeMap.map).length;
        badChannels.forEach((badCh) => {
          // Reject a non-integer mark (e.g. 'abc') at edit time, mirroring
          // the multi-shank branch — otherwise it silently passes save and only blocks
          // at export. Row-local index must be an in-range integer.
          if (!Number.isInteger(badCh) || badCh < 0 || badCh >= shankLen) {
            errors.push(
              `Ntrode ${ntrodeMap.ntrode_id}: Bad channel index ${badCh} is out of range (valid: 0-${shankLen - 1})`
            );
          }
        });
      }
    });

    return errors;
  };

  // Handle Cancel button click
  const handleCancel = () => {
    onCancel();
  };

  // Handle edge case: no channel maps
  if (!channelMaps || channelMaps.length === 0) {
    return (
      <Modal
        isOpen
        onClose={onCancel}
        title="Channel Map Editor"
        titleId={titleId}
        className="channel-map-editor-modal"
      >
        <div className="channel-map-editor-header">
          <div className="electrode-group-info">
            <span>Electrode Group: {electrodeGroup.id}</span>
            <span>Device Type: {electrodeGroup.device_type}</span>
            <span>Location: {electrodeGroup.location}</span>
          </div>
        </div>
        <div className="channel-map-editor-content">
          <p className="empty-message">
            No channel maps available. Please auto-generate channel maps first.
          </p>
        </div>
        <div className="channel-map-editor-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={handleCancel}
            aria-label="Cancel and close editor"
          >
            Cancel
          </button>
        </div>
      </Modal>
    );
  }

  // Probe-wide bad-channel selector (multi-shank only). Written to the FIRST row;
  // spans the probe's full electrode-id range 0..N-1, matching the converter.
  const renderProbeWideBadChannels = () => {
    const firstNtrode = localChannelMaps[0];
    // The first row's bad_channels may be a preserved corrupt SCALAR; `firstBadChannelsIsArray`
    // gates the whole-value reset control below (a scalar has no per-value marks to remove).
    const firstBadChannelsIsArray = Array.isArray(firstNtrode.bad_channels);
    // First-row marks with no probe-wide checkbox (out-of-range id or non-integer).
    // They block export but the grid can't uncheck them, so render explicit removal
    // controls (otherwise an unrepairable dead-end).
    const invalidMarks = invalidBadChannelMarks(firstNtrode.bad_channels, probeElectrodeIds);
    return (
      <fieldset className="bad-channels-fieldset probe-wide-bad-channels">
        <legend>
          Bad Channels (probe-local 0–{probeElectrodeIds.length - 1})
          <InfoIcon infoText="This multi-shank probe is mapped by a single probe-local electrode index spanning all shanks. trodes_to_nwb reads failed channels from the group's first ntrode row only. Mark all bad channels here. Only mark channels with true hardware failures, not analysis quality problems." />
        </legend>
        {hadLaterRowBadChannelsOnLoad && (
          <p className="migration-notice" role="status">
            This group has failed-channel marks on a later shank row that trodes_to_nwb
            ignores. They will be consolidated onto this probe-wide list (the first row)
            the next time you change a selection here, then saved.
          </p>
        )}
        <div
          className="checkbox-list"
          role="group"
          aria-label="Bad channels for this multi-shank probe (probe-local indices)"
          data-testid={`bad-channels-checkboxes-${firstNtrode.ntrode_id}`}
        >
          {probeElectrodeIds.map((electrodeId) => (
            <div key={electrodeId} className="checkbox-list-item">
              <input
                type="checkbox"
                id={`bad-electrode-${firstNtrode.ntrode_id}-${electrodeId}`}
                checked={isProbeElectrodeBad(electrodeId)}
                onChange={(e) => handleProbeWideBadChannelToggle(electrodeId, e.target.checked)}
                aria-label={`Mark electrode ${electrodeId} as bad for this probe`}
              />
              <label htmlFor={`bad-electrode-${firstNtrode.ntrode_id}-${electrodeId}`}>
                Electrode {electrodeId}
              </label>
            </div>
          ))}
        </div>
        {invalidMarks.map((value) => (
          <button
            key={`invalid-${String(value)}`}
            type="button"
            className="remove-invalid-mark"
            onClick={() => handleRemoveInvalidMark(0, value)}
            aria-label={`Remove invalid failed channel ${value} from ntrode ${firstNtrode.ntrode_id}`}
          >
            Remove invalid failed channel {String(value)}
          </button>
        ))}
        {!firstBadChannelsIsArray && firstNtrode.bad_channels != null && (
          <button
            type="button"
            className="remove-invalid-mark"
            onClick={() => handleResetCorruptBadChannels(0)}
            aria-label={`Remove corrupt failed-channels value from ntrode ${firstNtrode.ntrode_id}`}
          >
            Remove corrupt failed-channels value
          </button>
        )}
      </fieldset>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Channel Map Editor"
      titleId={titleId}
      className="channel-map-editor-modal"
    >
      <div data-testid="channel-map-editor" data-group-id={electrodeGroup.id}>
        {/* Header */}
        <div className="channel-map-editor-header">
          <div className="electrode-group-info">
            <span>Electrode Group: {electrodeGroup.id}</span>
            <span>Device Type: {electrodeGroup.device_type}</span>
            <span>Location: {electrodeGroup.location}</span>
            {probeShanks.length > 0 ? (
              <>
                <span data-testid="editor-shank-count">
                  {probeShanks.length} shanks
                </span>
                <span data-testid="editor-channel-count">
                  {getChannelCount(electrodeGroup.device_type)} channels
                </span>
              </>
            ) : (
              <span data-testid="editor-catalog-unavailable">
                Catalog unavailable — channel layout from saved data
              </span>
            )}
            <span data-testid="editor-channel-map-count">{localChannelMaps.length} maps</span>
          </div>
        </div>

      {/* Content */}
      <div className="channel-map-editor-content">
        {/* Multi-shank: ONE probe-wide bad-channel selector for the whole group,
            written to the first ntrode row (converter truth). */}
        {isMultiShank && renderProbeWideBadChannels()}

        {localChannelMaps.map((ntrodeMap, ntrodeIndex) => {
          const channelKeys = channelKeysForRow(ntrodeIndex);
          // A row's bad_channels may be a preserved corrupt SCALAR; guard iteration so
          // a non-array never throws. A scalar has no representable entries, so the
          // per-value invalid-mark controls stay empty and the whole-value reset
          // control (below) repairs it instead.
          const rowBadChannelsIsArray = Array.isArray(ntrodeMap.bad_channels);
          // Single-shank marks with no checkbox in this row (out-of-range index or
          // non-integer). They block export but can't be unchecked, so render explicit
          // removal controls below the grid. (Multi-shank handles this probe-wide.)
          const invalidMarks = isMultiShank
            ? []
            : invalidBadChannelMarks(ntrodeMap.bad_channels, channelKeys);
          // A row that loaded with a scalar bad_channels needs a distinct whole-value
          // reset (single-shank only; multi-shank handles the first row probe-wide).
          const showScalarReset =
            !isMultiShank && !rowBadChannelsIsArray && ntrodeMap.bad_channels != null;
          return (
          <fieldset key={ntrodeMap.ntrode_id} className="ntrode-fieldset">
            <legend>Shank #{ntrodeIndex + 1}</legend>

            <div className="form-container">
              {/* Ntrode Id - Readonly */}
              <div className="ntrode-field ntrode-id-field">
                <label htmlFor={`ntrode-id-${ntrodeMap.ntrode_id}`}>
                  Ntrode Id
                  <InfoIcon infoText="Ntrode identifier (read-only)" />
                </label>
                <input
                  id={`ntrode-id-${ntrodeMap.ntrode_id}`}
                  type="number"
                  value={ntrodeMap.ntrode_id}
                  readOnly
                  disabled
                  aria-label={`Ntrode ID ${ntrodeMap.ntrode_id} (read-only)`}
                  data-testid={`ntrode-id-${ntrodeMap.ntrode_id}`}
                />
              </div>

              {/* Bad Channels - Checkbox Grid (single-shank only; multi-shank uses
                  the probe-wide selector above). */}
              {!isMultiShank && (
                <fieldset className="bad-channels-fieldset">
                  <legend>
                    Bad Channels
                    <InfoIcon infoText="Select channels with hardware failures. Only mark channels with true hardware issues, not analysis quality problems." />
                  </legend>
                  <div className="checkbox-list" data-testid={`bad-channels-checkboxes-${ntrodeMap.ntrode_id}`}>
                    {channelKeys.map((channelIndex) => (
                      <div key={channelIndex} className="checkbox-list-item">
                        <input
                          type="checkbox"
                          id={`bad-channel-${ntrodeMap.ntrode_id}-${channelIndex}`}
                          checked={isChannelBad(ntrodeIndex, channelIndex)}
                          onChange={(e) => handleBadChannelToggle(ntrodeIndex, channelIndex, e.target.checked)}
                          aria-label={`Mark channel ${channelIndex} as bad for ntrode ${ntrodeMap.ntrode_id}`}
                        />
                        <label htmlFor={`bad-channel-${ntrodeMap.ntrode_id}-${channelIndex}`}>
                          {channelIndex}
                        </label>
                      </div>
                    ))}
                  </div>
                  {invalidMarks.map((value) => (
                    <button
                      key={`invalid-${String(value)}`}
                      type="button"
                      className="remove-invalid-mark"
                      onClick={() => handleRemoveInvalidMark(ntrodeIndex, value)}
                      aria-label={`Remove invalid failed channel ${value} from ntrode ${ntrodeMap.ntrode_id}`}
                    >
                      Remove invalid failed channel {String(value)}
                    </button>
                  ))}
                  {showScalarReset && (
                    <button
                      type="button"
                      className="remove-invalid-mark"
                      onClick={() => handleResetCorruptBadChannels(ntrodeIndex)}
                      aria-label={`Remove corrupt failed-channels value from ntrode ${ntrodeMap.ntrode_id}`}
                    >
                      Remove corrupt failed-channels value
                    </button>
                  )}
                </fieldset>
              )}

              {/* Map - Select Dropdowns */}
              <div className="map-field">
                <label>
                  Map
                  <InfoIcon infoText="Electrode Map. Right Hand Side is expected mapping. Left Hand Side is actual mapping" />
                </label>
                <div className="ntrode-maps">
                  {channelKeys.map((channelIndex) => {
                    // Generate options: -1 (empty), 0 to maxChannelValue
                    const options = [-1, ...Array.from({ length: maxChannelValue + 1 }, (_, i) => i)];
                    const currentValue = ntrodeMap.map[channelIndex] ?? channelIndex;

                    return (
                      <div key={channelIndex} className="ntrode-map">
                        <label htmlFor={`map-${ntrodeMap.ntrode_id}-${channelIndex}`}>
                          {channelIndex}
                        </label>
                        <select
                          id={`map-${ntrodeMap.ntrode_id}-${channelIndex}`}
                          value={currentValue}
                          onChange={(e) => handleChannelMapChange(ntrodeIndex, channelIndex, e.target.value)}
                          aria-label={`Hardware channel mapping for channel ${channelIndex} in ntrode ${ntrodeMap.ntrode_id}`}
                        >
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option !== -1 ? option : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </fieldset>
          );
        })}
      </div>

      {/* Validation errors (inline, replaces a blocking alert) */}
      {validationErrors.length > 0 && (
        <div className="channel-map-editor-errors" role="alert">
          <p>Cannot save — please fix the following issues:</p>
          <ul>
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="channel-map-editor-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={handleCancel}
          aria-label="Cancel and close editor"
          data-testid="editor-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          aria-label="Save channel map changes"
          data-testid="editor-save"
        >
          Save
        </button>
      </div>
      </div>
    </Modal>
  );
};

ChannelMapEditor.propTypes = {
  electrodeGroup: PropTypes.shape({
    id: PropTypes.number.isRequired,
    device_type: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    targeted_x: PropTypes.number,
    targeted_y: PropTypes.number,
    targeted_z: PropTypes.number,
    units: PropTypes.string,
  }).isRequired,
  channelMaps: PropTypes.arrayOf(
    PropTypes.shape({
      electrode_group_id: PropTypes.number.isRequired,
      ntrode_id: PropTypes.number.isRequired,
      // Tolerant union: this editor renders + repairs corrupt loaded bad_channels (a scalar,
      // or an array with out-of-range/non-integer values), so its PropType must not warn on
      // the very corruption it exists to fix. Items are validated/repaired at runtime.
      bad_channels: PropTypes.oneOfType([PropTypes.array, PropTypes.number, PropTypes.string]),
      map: PropTypes.object.isRequired,
    })
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ChannelMapEditor;
