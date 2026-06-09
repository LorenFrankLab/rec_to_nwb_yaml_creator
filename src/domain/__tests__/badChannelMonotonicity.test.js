/**
 * Bad-channel monotonicity (pure) — bad channels accumulate across a study and must not
 * silently "un-fail". These helpers compute, for a day, the union of bad channels marked on
 * EARLIER same-configuration days (`priorBadChannels`) and the set of earlier-marked channels
 * this day has dropped WITHOUT an off-export acknowledgment (`badChannelRegressions`). The
 * config-version boundary is respected: a reconfiguration legitimately resets channels, so
 * days on a DIFFERENT `configurationVersion` are never compared. Both tolerate corrupt inputs.
 */
import { describe, it, expect } from 'vitest';
import { priorBadChannels, badChannelRegressions } from '../badChannelMonotonicity';

// Minimal day record factory. `state.badChannelRemovalAcks` is the off-export ack store.
const day = ({ date, version = 1, bad = undefined, acks = undefined }) => ({
  id: `a_${date.replace(/-/g, '')}`,
  animalId: 'a',
  date,
  configurationVersion: version,
  ...(bad !== undefined ? { deviceOverrides: { bad_channels: bad } } : {}),
  ...(acks !== undefined ? { state: { badChannelRemovalAcks: acks } } : {}),
});

describe('priorBadChannels', () => {
  it('unions effective bad channels over EARLIER same-config days', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0, 1] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [2] } });
    const d3 = day({ date: '2023-01-03', bad: { 1: [] } });
    const animalDays = [d1, d2, d3];
    expect(priorBadChannels({}, d3, animalDays)).toEqual({ 1: [0, 1, 2] });
  });

  it('does NOT include LATER days', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [5] } });
    const animalDays = [d1, d2];
    // d1 has no earlier days → empty prior set (d2's [5] is later).
    expect(priorBadChannels({}, d1, animalDays)).toEqual({});
  });

  it('does NOT include days on a DIFFERENT configurationVersion', () => {
    const d1 = day({ date: '2023-01-01', version: 1, bad: { 1: [0, 1] } });
    const d2 = day({ date: '2023-01-02', version: 2, bad: { 1: [9] } });
    const animalDays = [d1, d2];
    // d2 is v2; the only earlier day is v1 → no same-config prior.
    expect(priorBadChannels({}, d2, animalDays)).toEqual({});
  });

  it('keys ids per ntrode and sorts/dedupes', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [3, 1], 2: [0] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [1, 2] } });
    const d3 = day({ date: '2023-01-03' });
    expect(priorBadChannels({}, d3, [d1, d2, d3])).toEqual({ 1: [1, 2, 3], 2: [0] });
  });

  it('returns empty when there are no earlier same-config days', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0] } });
    expect(priorBadChannels({}, d1, [d1])).toEqual({});
  });

  it('tolerates corrupt/missing inputs', () => {
    const d = day({ date: '2023-01-02' });
    expect(priorBadChannels(null, d, null)).toEqual({});
    expect(priorBadChannels({}, d, 'nope')).toEqual({});
    expect(priorBadChannels({}, null, [])).toEqual({});
    // a corrupt earlier-day bad_channels container is ignored (selector → {})
    const bad = day({ date: '2023-01-01', bad: 'corrupt' });
    expect(priorBadChannels({}, d, [bad, d])).toEqual({});
  });
});

describe('badChannelRegressions', () => {
  it('reports earlier-marked channels this day has dropped (subset regression)', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0, 1, 2] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [0, 1] } });
    expect(badChannelRegressions({}, d2, [d1, d2])).toEqual({ 1: [2] });
  });

  it('is empty when the day is monotonic (keeps all prior + adds more)', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0, 1] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [0, 1, 2] } });
    expect(badChannelRegressions({}, d2, [d1, d2])).toEqual({});
  });

  it('subtracts acknowledged removals (off-export ack clears the regression)', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0, 1, 2] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [0, 1] }, acks: { 1: [2] } });
    expect(badChannelRegressions({}, d2, [d1, d2])).toEqual({});
  });

  it('reports only the UNacknowledged removed channels', () => {
    const d1 = day({ date: '2023-01-01', bad: { 1: [0, 1, 2, 3] } });
    const d2 = day({ date: '2023-01-02', bad: { 1: [0] }, acks: { 1: [1] } });
    expect(badChannelRegressions({}, d2, [d1, d2])).toEqual({ 1: [2, 3] });
  });

  it('never compares across a different configurationVersion (reconfig resets)', () => {
    const d1 = day({ date: '2023-01-01', version: 1, bad: { 1: [0, 1, 2] } });
    const d2 = day({ date: '2023-01-02', version: 2, bad: { 1: [] } });
    expect(badChannelRegressions({}, d2, [d1, d2])).toEqual({});
  });

  it('tolerates corrupt/missing inputs', () => {
    const d = day({ date: '2023-01-02' });
    expect(badChannelRegressions(null, d, null)).toEqual({});
    expect(badChannelRegressions({}, d, 'nope')).toEqual({});
    expect(badChannelRegressions({}, null, [])).toEqual({});
    // corrupt acks container is treated as no acks
    const d1 = day({ date: '2023-01-01', bad: { 1: [0, 1] } });
    const d2 = { ...day({ date: '2023-01-02', bad: { 1: [0] } }), state: 'corrupt' };
    expect(badChannelRegressions({}, d2, [d1, d2])).toEqual({ 1: [1] });
  });
});
