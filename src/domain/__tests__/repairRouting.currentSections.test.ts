import { describe, expect, it } from 'vitest';
import {
  dayEditorFocusPath,
  dayEditorSectionForRepair,
  daySectionForPath,
  repairTargetForIssue,
} from '../repairRouting';

describe('current Day Editor repair routing', () => {
  it.each(['units.analog', 'units.behavioral_events'])('%s belongs to Recording Setup everywhere', (path) => {
    expect(daySectionForPath(path)).toBe('recording');
    expect(dayEditorSectionForRepair('validation', path)).toBe('recording');
    expect(dayEditorFocusPath(path)).toBe(`technical.${path}`);
    expect(repairTargetForIssue({ path, code: 'pattern', severity: 'error' }).label)
      .toBe('Fix in Recording Setup');
  });
});
