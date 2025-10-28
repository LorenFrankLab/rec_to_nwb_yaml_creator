/**
 * Bug Report: Channel Map - Blank Value Causes All to Become 1
 *
 * Symptom: When user changes one channel map to blank, all other maps become 1
 *
 * Root Cause: <option> elements missing value attributes + uncontrolled select
 *
 * Expected: Only changed channel should update to -1 (blank)
 * Actual: All channels reset to 1 (first non-empty option after -1)
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ChannelMap from '../../../ntrode/ChannelMap';

describe('BUG: Channel Map Blank Value', () => {
  it('FIXED: option elements now have value attributes', () => {
    // ARRANGE
    const nTrodeItems = [
      {
        ntrode_id: 1,
        electrode_group_id: 1,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    // ACT
    const { container } = render(
      <ChannelMap
        nTrodeItems={nTrodeItems}
        onBlur={() => {}}
        onMapInput={() => {}}
        electrodeGroupId={1}
        updateFormArray={() => {}}
        metaData={{ index: 0 }}
      />
    );

    // ASSERT - Check that options now have value attributes
    const select = container.querySelector('select');
    const options = select.querySelectorAll('option');

    // All options should now have value attribute
    const firstOption = options[0];
    const hasValueAttr = firstOption.hasAttribute('value');

    // BUG FIXED: Options now have value attributes
    expect(hasValueAttr).toBe(true);

    // With explicit value attr, React can properly control the select
  });

  it('should have explicit value attributes on all options', () => {
    // This test verifies all options have value attributes after fix

    const nTrodeItems = [
      {
        ntrode_id: 1,
        electrode_group_id: 1,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const { container } = render(
      <ChannelMap
        nTrodeItems={nTrodeItems}
        onBlur={() => {}}
        onMapInput={() => {}}
        electrodeGroupId={1}
        updateFormArray={() => {}}
        metaData={{ index: 0 }}
      />
    );

    const select = container.querySelector('select');
    const options = Array.from(select.querySelectorAll('option'));

    // After fix: All options should have explicit value attributes
    const allHaveValueAttr = options.every(opt => opt.hasAttribute('value'));

    // BUG FIXED: All options now have value attributes
    expect(allHaveValueAttr).toBe(true);
  });
});
