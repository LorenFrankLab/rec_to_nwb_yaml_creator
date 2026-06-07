/**
 * describeDayOptoState (Phase 8.7 Task 10). Status/preflight summaries must report opto state per
 * DAY PROTOCOL — a three-state read (no opto / implanted but no stimulation this day / stimulation
 * on selected epochs) — instead of a binary On/Off derived only from the animal IMPLANT metadata.
 * The single shared helper keeps every summary in agreement (and matches the Task 7 editor copy:
 * an opto-implanted animal with an opto-free day is a normal, valid state, not "opto on").
 */
import { describe, it, expect } from 'vitest';
import { describeDayOptoState, OPTO_STATE } from '../optoStatus';

describe('describeDayOptoState', () => {
  it('reports "no optogenetics" when the animal has no implant', () => {
    const merged = { opto_excitation_source: [], optical_fiber: [], virus_injection: [], fs_gui_yamls: [] };
    const result = describeDayOptoState(merged);
    expect(result.state).toBe(OPTO_STATE.NONE);
    expect(result.label).toMatch(/no optogenetics/i);
  });

  it('reports "implanted, no stimulation this day" when the implant exists but the day ran none', () => {
    // The Task 7 invariant in summary form: an opto-implanted animal with an opto-free day.
    const merged = {
      opto_excitation_source: [{ name: 'LED' }],
      optical_fiber: [{ name: 'F' }],
      virus_injection: [{ name: 'V' }],
      fs_gui_yamls: [], // no stimulation run this day
    };
    const result = describeDayOptoState(merged);
    expect(result.state).toBe(OPTO_STATE.IMPLANTED_NO_STIM);
    expect(result.label).toMatch(/implanted.*no stimulation this day/i);
  });

  it('reports stimulation with the epochs it ran when the day has fs_gui protocols', () => {
    const merged = {
      opto_excitation_source: [{ name: 'LED' }],
      optical_fiber: [{ name: 'F' }],
      virus_injection: [{ name: 'V' }],
      fs_gui_yamls: [
        { name: 'p1.yaml', epochs: [2, 1] },
        { name: 'p2.yaml', epochs: [1, 4] },
      ],
    };
    const result = describeDayOptoState(merged);
    expect(result.state).toBe(OPTO_STATE.STIMULATED);
    // Epochs are de-duplicated and sorted across all protocols.
    expect(result.label).toMatch(/stimulation on epochs 1, 2, 4/i);
  });

  it('uses singular "epoch" for a single stimulated epoch', () => {
    const merged = {
      opto_excitation_source: [{ name: 'LED' }],
      fs_gui_yamls: [{ name: 'p.yaml', epochs: [3] }],
    };
    const result = describeDayOptoState(merged);
    expect(result.state).toBe(OPTO_STATE.STIMULATED);
    expect(result.label).toMatch(/stimulation on epoch 3\b/i);
  });

  it('orders epochs numerically even for corrupt string epochs (deterministic display)', () => {
    // The helper runs on unvalidated state; a bad import can carry string epochs. The order must
    // still be deterministic (numeric), not the NaN-driven order of a string subtraction.
    const merged = {
      opto_excitation_source: [{ name: 'LED' }],
      fs_gui_yamls: [{ name: 'p.yaml', epochs: ['10', '2', '1'] }],
    };
    expect(describeDayOptoState(merged).label).toMatch(/stimulation on epochs 1, 2, 10\b/i);
  });

  it('reports generic stimulation when fs_gui protocols carry no epoch list', () => {
    const merged = { opto_excitation_source: [{ name: 'LED' }], fs_gui_yamls: [{ name: 'p.yaml' }] };
    const result = describeDayOptoState(merged);
    expect(result.state).toBe(OPTO_STATE.STIMULATED);
    expect(result.label).toMatch(/stimulation this day/i);
  });

  it('treats fs_gui presence as stimulation even without a (separately-flagged) implant', () => {
    // fs_gui-without-implant is an invalid state the validator flags separately; the summary should
    // still read "stimulation" so it never under-reports what the day's protocol claims.
    const merged = { opto_excitation_source: [], fs_gui_yamls: [{ name: 'p.yaml', epochs: [1] }] };
    expect(describeDayOptoState(merged).state).toBe(OPTO_STATE.STIMULATED);
  });

  it('is robust to a null/empty merged day (reads as no optogenetics)', () => {
    expect(describeDayOptoState(null).state).toBe(OPTO_STATE.NONE);
    expect(describeDayOptoState({}).state).toBe(OPTO_STATE.NONE);
  });
});
