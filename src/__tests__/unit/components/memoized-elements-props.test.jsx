/**
 * Memoized form elements must use the props of their latest render.
 *
 * When an array row moves (Duplicate inserts the copy after its source, Remove
 * shifts the rows after it), its elements get handlers bound to the row's new
 * index while their value stays the same. An element that skips that render
 * keeps the old handlers, so typing edits whichever row now sits at the old
 * index and the field typed into snaps back.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InputElement from '../../../element/InputElement';
import DataListElement from '../../../element/DataListElement';
import SelectElement from '../../../element/SelectElement';
import CheckboxList from '../../../element/CheckboxList';

// Same references on every render, so only the props a test changes differ.
const dataItems = ['CA1', 'CA3'];
const noneSelected = [];

describe('Memoized form elements use their latest props', () => {
  describe('InputElement', () => {
    const props = {
      type: 'text',
      name: 'description',
      title: 'Description',
      value: 'unchanged',
    };

    it('calls the latest onChange', () => {
      const stale = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(<InputElement {...props} id="description-0" onChange={stale} />);
      rerender(<InputElement {...props} id="description-0" onChange={latest} />);

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } });

      expect(latest).toHaveBeenCalledTimes(1);
      expect(stale).not.toHaveBeenCalled();
    });

    it('calls the latest onBlur', () => {
      const stale = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(<InputElement {...props} id="description-0" onBlur={stale} />);
      rerender(<InputElement {...props} id="description-0" onBlur={latest} />);

      fireEvent.blur(screen.getByRole('textbox'));

      expect(latest).toHaveBeenCalledTimes(1);
      expect(stale).not.toHaveBeenCalled();
    });

    it('renders the latest id', () => {
      const { rerender } = render(<InputElement {...props} id="description-0" />);
      rerender(<InputElement {...props} id="description-3" />);

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'description-3');
    });
  });

  describe('DataListElement', () => {
    const props = { name: 'location', title: 'Location', dataItems, value: 'CA1' };

    it('calls the latest onChange', () => {
      const stale = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(<DataListElement {...props} id="location-0" onChange={stale} />);
      rerender(<DataListElement {...props} id="location-0" onChange={latest} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CA3' } });

      expect(latest).toHaveBeenCalledTimes(1);
      expect(stale).not.toHaveBeenCalled();
    });

    it('calls the latest onBlur', () => {
      const stale = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(<DataListElement {...props} id="location-0" onBlur={stale} />);
      rerender(<DataListElement {...props} id="location-0" onBlur={latest} />);

      fireEvent.blur(screen.getByRole('combobox'));

      expect(latest).toHaveBeenCalledTimes(1);
      expect(stale).not.toHaveBeenCalled();
    });

    it('renders the latest id', () => {
      const { rerender } = render(<DataListElement {...props} id="location-0" />);
      rerender(<DataListElement {...props} id="location-3" />);

      expect(screen.getByRole('combobox')).toHaveAttribute('id', 'location-3');
    });
  });

  describe('SelectElement', () => {
    const props = { name: 'location', title: 'Location', type: 'text', dataItems, value: 'CA1' };

    it('calls the latest onChange', () => {
      const stale = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(<SelectElement {...props} id="location-0" onChange={stale} />);
      rerender(<SelectElement {...props} id="location-0" onChange={latest} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CA3' } });

      expect(latest).toHaveBeenCalledTimes(1);
      expect(stale).not.toHaveBeenCalled();
    });

    it('renders the latest id', () => {
      const { rerender } = render(<SelectElement {...props} id="location-0" />);
      rerender(<SelectElement {...props} id="location-3" />);

      expect(screen.getByRole('combobox')).toHaveAttribute('id', 'location-3');
    });
  });

  describe('CheckboxList', () => {
    const props = {
      id: 'bad-channels',
      name: 'bad_channels',
      title: 'Bad Channels',
      dataItems: ['0', '1'],
      value: noneSelected,
    };
    const metaData = (index) => ({
      nameValue: 'bad_channels',
      keyValue: 'ntrode_electrode_group_channel_map',
      index,
    });

    it('writes through the latest updateFormArray and metaData', () => {
      const stale = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(
        <CheckboxList {...props} updateFormArray={stale} metaData={metaData(0)} />
      );
      rerender(<CheckboxList {...props} updateFormArray={latest} metaData={metaData(3)} />);

      fireEvent.click(screen.getByLabelText('1'));

      expect(latest).toHaveBeenCalledWith(
        'bad_channels',
        1,
        'ntrode_electrode_group_channel_map',
        3,
        true
      );
      expect(stale).not.toHaveBeenCalled();
    });
  });
});
