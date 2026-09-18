import { describe, expect, it } from 'vitest';
import {
  dayEditorFocusPath,
  dayEditorSectionForRepair,
  daySectionForPath,
  repairTargetForIssue,
} from '../repairRouting';

describe('current Day Editor repair routing', () => {
  it.each(['units.analog', 'units.behavioral_events', 'default_header_file_path'])('%s belongs to Daily log everywhere', (path) => {
    expect(daySectionForPath(path)).toBe('daily');
    expect(dayEditorSectionForRepair('validation', path)).toBe('daily');
    expect(dayEditorFocusPath(path)).toBe(`technical.${path}`);
    expect(repairTargetForIssue({ path, code: 'pattern', severity: 'error' }).label)
      .toBe('Fix in Daily log');
  });
});
