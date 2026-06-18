import { describe, expect, it } from 'vitest';
import {
  getIndexedStatescriptFiles,
  getIndexedSupplementalFiles,
  isStatescriptAssociatedFile,
} from '../associatedFiles';
import type { AssociatedFile } from '../../state/workspaceTypes';

describe('associatedFiles classifiers', () => {
  it('classifies StateScript/stateScriptLog rows as epoch statescripts', () => {
    expect(isStatescriptAssociatedFile({
      name: 'Statescript Run dark',
      description: 'Statescript Log',
      path: '/data/20240608_L14_08_r4.stateScriptLog',
    })).toBe(true);

    expect(isStatescriptAssociatedFile({
      name: 'statescript_r1',
      description: 'statescript',
      path: '/data/day_02_r1.stateScriptLog',
    })).toBe(true);
  });

  it('keeps common non-statescript associated files supplemental', () => {
    expect(isStatescriptAssociatedFile({
      name: 'stim1',
      description: 'Psychopy stim generation script for stim 1',
      path: '/data/stim/stim1.py',
    })).toBe(false);

    expect(isStatescriptAssociatedFile({
      name: 'realtime_output_r1',
      description: 'realtime_decoding_outputfile',
      path: '/data/text_output/day_1.txt',
    })).toBe(false);

    expect(isStatescriptAssociatedFile({
      name: 'Behavior timeline',
      description: 'Behavior timeline',
      path: '/data/behavior_timeline.csv',
    })).toBe(false);
  });

  it('returns indexed statescript and supplemental rows without reshaping them', () => {
    const files: AssociatedFile[] = [
      { name: 'statescript_r1', description: 'statescript', path: 'r1.stateScriptLog', task_epochs: 1 },
      { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
      { name: 'realtime_output_r1', description: 'realtime_decoding_outputfile', path: 'out.txt', task_epochs: 1 },
    ];

    expect(getIndexedStatescriptFiles(files)).toEqual([{ entry: files[0], index: 0 }]);
    expect(getIndexedSupplementalFiles(files)).toEqual([
      { entry: files[1], index: 1 },
      { entry: files[2], index: 2 },
    ]);
  });
});
