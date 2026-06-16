/**
 * Tests for the per-epoch filename derivation (Phase 4 — epoch grid).
 *
 * The convention is `{YYYYMMDD}_{subjectId}_{epoch:02d}_{tag}{ext}` inside the day's data folder.
 * The token order/case is PINNED empirically against the golden `associated_video_files[].name`
 * (`20230622_sample_01_a1.1.h264`) — the one convention-following derivation target in the fixtures.
 * The golden `associated_files` are placeholders (`path/`) that do NOT follow the convention, so they
 * must classify `manual` (and round-trip verbatim); statescript derivation is verified against a
 * synthetic convention-following fixture instead.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveStatescriptName,
  deriveVideoName,
  deriveStatescriptPath,
  isDerivedStatescript,
  isDerivedVideo,
} from '../fileNaming';

describe('deriveVideoName — pinned against the golden video name', () => {
  it('reproduces the golden associated_video_files[].name token-for-token', () => {
    // golden 20230622_sample_metadata.yml → associated_video_files[0].name
    expect(deriveVideoName({ date: '20230622', subjectId: 'sample', epoch: 1, tag: 'a1' })).toBe(
      '20230622_sample_01_a1.1.h264'
    );
    expect(deriveVideoName({ date: '20230622', subjectId: 'sample', epoch: 2, tag: 'a1' })).toBe(
      '20230622_sample_02_a1.1.h264'
    );
  });

  it('zero-pads the epoch to two digits and keeps three digits past 99', () => {
    expect(deriveVideoName({ date: '20230622', subjectId: 'remy', epoch: 9, tag: 's1' })).toBe(
      '20230622_remy_09_s1.1.h264'
    );
    expect(deriveVideoName({ date: '20230622', subjectId: 'remy', epoch: 100, tag: 's1' })).toBe(
      '20230622_remy_100_s1.1.h264'
    );
  });

  it('uses the 1-based video index in the `.N.h264` segment (default 1)', () => {
    expect(deriveVideoName({ date: '20230622', subjectId: 'remy', epoch: 2, tag: 'w1', index: 2 })).toBe(
      '20230622_remy_02_w1.2.h264'
    );
  });
});

describe('deriveStatescriptName — synthetic convention-following fixture', () => {
  it('uses the .stateScriptLog extension with the same token order', () => {
    expect(deriveStatescriptName({ date: '20230622', subjectId: 'remy', epoch: 1, tag: 's1' })).toBe(
      '20230622_remy_01_s1.stateScriptLog'
    );
    expect(deriveStatescriptName({ date: '20230622', subjectId: 'remy', epoch: 12, tag: 'w2' })).toBe(
      '20230622_remy_12_w2.stateScriptLog'
    );
  });
});

describe('deriveStatescriptPath — join folder + name', () => {
  it('joins a folder and a derived name with a single separator', () => {
    expect(deriveStatescriptPath('/stelmo/remy/20230622', '20230622_remy_01_s1.stateScriptLog')).toBe(
      '/stelmo/remy/20230622/20230622_remy_01_s1.stateScriptLog'
    );
  });

  it('does not double the separator when the folder has a trailing slash', () => {
    expect(deriveStatescriptPath('/stelmo/remy/20230622/', '20230622_remy_01_s1.stateScriptLog')).toBe(
      '/stelmo/remy/20230622/20230622_remy_01_s1.stateScriptLog'
    );
  });

  it('returns the bare name when there is no folder', () => {
    expect(deriveStatescriptPath('', '20230622_remy_01_s1.stateScriptLog')).toBe(
      '20230622_remy_01_s1.stateScriptLog'
    );
  });
});

describe('isDerivedVideo — generated vs manual classification', () => {
  it('classifies a stored name that matches the derived value as generated', () => {
    expect(
      isDerivedVideo(
        { name: '20230622_sample_01_a1.1.h264' },
        { date: '20230622', subjectId: 'sample', epoch: 1, tag: 'a1' }
      )
    ).toBe(true);
  });

  it('classifies a divergent / hand-authored name as manual', () => {
    expect(
      isDerivedVideo(
        { name: 'overhead_video_epoch2' },
        { date: '20230622', subjectId: 'remy', epoch: 2, tag: 'w1' }
      )
    ).toBe(false);
  });

  it('honors the index when checking a same-epoch second video', () => {
    expect(
      isDerivedVideo(
        { name: '20230622_remy_02_w1.2.h264' },
        { date: '20230622', subjectId: 'remy', epoch: 2, tag: 'w1', index: 2 }
      )
    ).toBe(true);
  });
});

describe('isDerivedStatescript — generated vs manual classification', () => {
  it('classifies a stored path that matches the derived full path as generated', () => {
    expect(
      isDerivedStatescript(
        { path: '/stelmo/remy/20230622/20230622_remy_01_s1.stateScriptLog' },
        { dataFolder: '/stelmo/remy/20230622', date: '20230622', subjectId: 'remy', epoch: 1, tag: 's1' }
      )
    ).toBe(true);
  });

  it('classifies the golden placeholder associated_files path as manual', () => {
    // golden associated_files[0]: { path: 'path/' } — never follows the convention, and the golden
    // day has no dataFolder, so it is always manual (round-trips verbatim, baselines stay green).
    expect(
      isDerivedStatescript(
        { path: 'path/' },
        { dataFolder: undefined, date: '20230622', subjectId: 'sample', epoch: 1, tag: 'a1' }
      )
    ).toBe(false);
  });

  it('is manual when there is no data folder to derive a path against', () => {
    expect(
      isDerivedStatescript(
        { path: '20230622_remy_01_s1.stateScriptLog' },
        { dataFolder: '', date: '20230622', subjectId: 'remy', epoch: 1, tag: 's1' }
      )
    ).toBe(false);
  });
});
