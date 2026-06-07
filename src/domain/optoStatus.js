/**
 * Day-protocol optogenetics state for status/preflight summaries (Phase 8.7 Task 10).
 *
 * Optogenetics is a TWO-LAYER model (see Task 7): the animal's IMPLANTED setup (excitation source /
 * optical fiber / virus injection) vs. what was actually STIMULATED on a given recording day
 * (`day.fs_gui_yamls`, epoch-scoped). Summaries previously reported a binary "On/Off" derived only
 * from the implant — so an opto-implanted animal that ran no stimulation on a day read as "On",
 * contradicting the editor's "no stimulation this day is a normal, valid state". This helper is the
 * single source for the honest three-state read, so every summary agrees.
 */

/**
 * The three day-protocol opto states (the batch-row scan contract's "opto state").
 *
 * @type {Readonly<{NONE: string, IMPLANTED_NO_STIM: string, STIMULATED: string}>}
 */
export const OPTO_STATE = Object.freeze({
  NONE: 'none',
  IMPLANTED_NO_STIM: 'implanted_no_stim',
  STIMULATED: 'stimulated',
});

/**
 * Array, or [] for any non-array (tolerates a malformed/missing merged section).
 * @param value
 */
const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Describe the optogenetics state of a MERGED day (the shape summaries already hold — it carries
 * both the animal implant sections and the day's `fs_gui_yamls`). The state is decided by what was
 * actually run, then the implant:
 *   - any `fs_gui_yamls` → STIMULATED (named with the epochs it ran, if known);
 *   - else an implant present (excitation source / fiber / virus) → IMPLANTED_NO_STIM;
 *   - else → NONE.
 * Stimulation is checked first so a (separately-flagged-invalid) fs_gui-without-implant day still
 * reads as stimulation rather than under-reporting the day's own protocol.
 *
 * @param {object} [mergedDay] - The merged day metadata (from `mergeDayMetadata`).
 * @returns {{state: string, label: string}} The opto state and a short summary label.
 */
export function describeDayOptoState(mergedDay) {
  const day = mergedDay || {};
  const fsGui = asArray(day.fs_gui_yamls);

  if (fsGui.length > 0) {
    // Numeric-coercing sort so a corrupt import with string epochs ("2") still orders
    // deterministically — the helper runs on unvalidated workspace state, so it can't assume the
    // schema's integer epochs. (The validator flags such data separately; this is display-only.)
    const epochs = [
      ...new Set(fsGui.flatMap((protocol) => asArray(protocol?.epochs))),
    ].sort((a, b) => Number(a) - Number(b));
    const label =
      epochs.length > 0
        ? `Stimulation on epoch${epochs.length === 1 ? '' : 's'} ${epochs.join(', ')}`
        : 'Stimulation this day';
    return { state: OPTO_STATE.STIMULATED, label };
  }

  const hasImplant =
    asArray(day.opto_excitation_source).length > 0 ||
    asArray(day.optical_fiber).length > 0 ||
    asArray(day.virus_injection).length > 0;
  if (hasImplant) {
    return { state: OPTO_STATE.IMPLANTED_NO_STIM, label: 'Implanted, no stimulation this day' };
  }

  return { state: OPTO_STATE.NONE, label: 'No optogenetics' };
}
