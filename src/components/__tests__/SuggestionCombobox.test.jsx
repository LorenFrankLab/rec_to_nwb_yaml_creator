/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestionCombobox from '../SuggestionCombobox';

/**
 * SuggestionCombobox — accessible editable combobox replacing the native <datalist>.
 * The behaviour that matters: opening (click/▾/ArrowDown) BROWSES the full list even when
 * a value is already chosen, typing FILTERS, the list re-opens after a selection, free text
 * is retained, and an optional off-list warning nudges toward the standard options.
 */
describe('SuggestionCombobox', () => {
  let user;
  const SUGGESTIONS = ['Home box camera', 'Poke', 'Light', 'Pump', 'Run Camera Ticks', 'Sleep'];

  beforeEach(() => {
    user = userEvent.setup();
  });

  /**
   * Render a controlled combobox whose value updates, so selection/typing is observable.
   * @param initial
   * @param extraProps
   */
  function renderControlled(initial = '', extraProps = {}) {
    const onChange = vi.fn();
    /**
     *
     */
    function Harness() {
      const [value, setValue] = useState(initial);
      return (
        <SuggestionCombobox
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
          suggestions={SUGGESTIONS}
          aria-label="Event name"
          {...extraProps}
        />
      );
    }
    render(<Harness />);
    return { onChange };
  }

  describe('Browse vs. filter', () => {
    it('renders closed: a combobox input, no listbox', () => {
      renderControlled();
      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('opens on click and shows ALL suggestions', async () => {
      renderControlled();
      await user.click(screen.getByRole('combobox'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(SUGGESTIONS.length);
    });

    it('shows ALL suggestions even when the field already holds a complete selection (the datalist fix)', async () => {
      renderControlled('Poke');
      await user.click(screen.getByRole('combobox'));
      // The whole list is browsable again — NOT collapsed to the single "Poke" match.
      expect(screen.getAllByRole('option')).toHaveLength(SUGGESTIONS.length);
    });

    it('typing filters the list (case-insensitive substring)', async () => {
      renderControlled();
      const input = screen.getByRole('combobox');
      await user.type(input, 'pu');
      const optionLabels = screen.getAllByRole('option').map((o) => o.textContent);
      expect(optionLabels).toEqual(['Pump']);
    });

    it('re-opens the full list after a value is selected', async () => {
      renderControlled();
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Poke' }));
      // List closed after selection.
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // Re-opening browses everything again.
      await user.click(screen.getByRole('combobox'));
      expect(screen.getAllByRole('option')).toHaveLength(SUGGESTIONS.length);
    });
  });

  describe('Selection & free text', () => {
    it('selecting an option reports the value and closes the list', async () => {
      const { onChange } = renderControlled();
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Light' }));
      expect(onChange).toHaveBeenLastCalledWith('Light');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('retains free text that is not in the suggestion list', async () => {
      const { onChange } = renderControlled();
      await user.type(screen.getByRole('combobox'), 'light1');
      expect(onChange).toHaveBeenLastCalledWith('light1');
      expect(screen.getByRole('combobox')).toHaveValue('light1');
    });

    it('routes an explicit pick through onSelect (not onChange) when onSelect is provided', async () => {
      const onChange = vi.fn();
      const onSelect = vi.fn();
      render(
        <SuggestionCombobox
          value=""
          onChange={onChange}
          onSelect={onSelect}
          suggestions={SUGGESTIONS}
          aria-label="Event name"
        />
      );
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Poke' }));
      // The pick goes to onSelect so the caller can transform it (e.g. append an index);
      // onChange is reserved for typing.
      expect(onSelect).toHaveBeenCalledWith('Poke');
      expect(onChange).not.toHaveBeenCalledWith('Poke');
    });

    it('falls back to onChange for a pick when onSelect is absent', async () => {
      const { onChange } = renderControlled();
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Poke' }));
      expect(onChange).toHaveBeenLastCalledWith('Poke');
    });

    it('routes TYPING through onChange (never onSelect), even when onSelect is provided', async () => {
      const onChange = vi.fn();
      const onSelect = vi.fn();
      render(
        <SuggestionCombobox
          value=""
          onChange={onChange}
          onSelect={onSelect}
          suggestions={SUGGESTIONS}
          aria-label="Event name"
        />
      );
      // Typing is NOT an explicit pick: keystrokes always go to onChange; onSelect is reserved
      // for click/Enter picks (this negative case is the whole point of the routing split).
      await user.type(screen.getByRole('combobox'), 'be');
      expect(onChange).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Toggle button', () => {
    it('opens and closes the list', async () => {
      renderControlled();
      const toggle = screen.getByRole('button', { name: /show suggestions/i });
      await user.click(toggle);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /hide suggestions/i }));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard', () => {
    it('ArrowDown opens the list and activates the first option', async () => {
      renderControlled();
      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-activedescendant');
      expect(screen.getByRole('option', { name: 'Home box camera' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('Enter selects the active option when the list is open', async () => {
      const { onChange } = renderControlled();
      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // 2nd option = "Poke"
      expect(onChange).toHaveBeenLastCalledWith('Poke');
    });

    it('ArrowUp moves the active option up and clamps at the first option (no wrap/negative)', async () => {
      renderControlled();
      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{ArrowDown}{ArrowDown}'); // active = 2nd option, "Poke"
      expect(screen.getByRole('option', { name: 'Poke' })).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{ArrowUp}'); // back to the 1st option
      expect(screen.getByRole('option', { name: 'Home box camera' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await user.keyboard('{ArrowUp}'); // clamps at index 0 — never negative, never wraps
      expect(screen.getByRole('option', { name: 'Home box camera' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('Escape closes an open list and is NOT passed through to onKeyDown', async () => {
      const onKeyDown = vi.fn();
      renderControlled('', { onKeyDown });
      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{ArrowDown}'); // open
      await user.keyboard('{Escape}'); // closes the list, consumed
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onKeyDown).not.toHaveBeenCalled();
    });

    it('passes Enter/Escape through to onKeyDown when the list is closed', async () => {
      const onKeyDown = vi.fn();
      renderControlled('', { onKeyDown });
      const input = screen.getByRole('combobox');
      input.focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{Escape}');
      const keys = onKeyDown.mock.calls.map((c) => c[0].key);
      expect(keys).toContain('Enter');
      expect(keys).toContain('Escape');
    });
  });

  describe('Focus behaviour', () => {
    it('does NOT open on programmatic focus (so a parent Escape-to-cancel still works)', () => {
      renderControlled();
      const input = screen.getByRole('combobox');
      input.focus();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('calls onBlur when focus leaves the control', async () => {
      const onBlur = vi.fn();
      render(
        <div>
          <SuggestionCombobox
            value=""
            onChange={() => {}}
            suggestions={SUGGESTIONS}
            aria-label="Event name"
            onBlur={onBlur}
          />
          <button type="button">outside</button>
        </div>
      );
      screen.getByRole('combobox').focus();
      await user.click(screen.getByRole('button', { name: 'outside' }));
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('Labelling', () => {
    it('renders a visible label associated with the input when `label` is given', () => {
      render(
        <SuggestionCombobox value="" onChange={() => {}} suggestions={SUGGESTIONS} label="Brain Region" />
      );
      expect(screen.getByLabelText('Brain Region')).toBe(screen.getByRole('combobox'));
    });
  });

  describe('Off-list warning (warnOffList)', () => {
    it('warns once focus leaves and the value is not a standard option', async () => {
      render(
        <div>
          <SuggestionCombobox
            value="MyCustomRegion"
            onChange={() => {}}
            suggestions={SUGGESTIONS}
            aria-label="Region"
            warnOffList
          />
          <button type="button">outside</button>
        </div>
      );
      // Off-list value shown (list closed) → the standard-option nudge is present.
      expect(screen.getByRole('status')).toHaveTextContent(/standard/i);
    });

    it('does not warn for a value that matches a standard option (case-insensitive)', () => {
      render(
        <SuggestionCombobox
          value="poke"
          onChange={() => {}}
          suggestions={SUGGESTIONS}
          aria-label="Region"
          warnOffList
        />
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not warn for an empty value', () => {
      render(
        <SuggestionCombobox
          value=""
          onChange={() => {}}
          suggestions={SUGGESTIONS}
          aria-label="Region"
          warnOffList
        />
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not warn at all when warnOffList is not set', () => {
      render(
        <SuggestionCombobox
          value="MyCustomRegion"
          onChange={() => {}}
          suggestions={SUGGESTIONS}
          aria-label="Region"
        />
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('hides the warning while the list is open (browsing/typing)', async () => {
      renderControlled('MyCustomRegion', { warnOffList: true });
      // Initially closed + off-list → warning visible.
      expect(screen.getByRole('status')).toBeInTheDocument();
      // Opening to browse hides the nudge.
      await user.click(screen.getByRole('combobox'));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('surfaces the warning only after the user types a custom value and blurs away', async () => {
      /**
       * Controlled wrapper so typing updates the value; an outside button receives the blur.
       * @returns {JSX.Element}
       */
      function Harness() {
        const [value, setValue] = useState('');
        return (
          <div>
            <SuggestionCombobox
              value={value}
              onChange={setValue}
              suggestions={SUGGESTIONS}
              aria-label="Region"
              warnOffList
            />
            <button type="button">outside</button>
          </div>
        );
      }
      render(<Harness />);

      // At rest with an empty value, no nudge.
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'MyCustomRegion'); // typing opens the list → nudge stays hidden
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      // Leaving the field closes the list and surfaces the off-list nudge.
      await user.click(screen.getByRole('button', { name: 'outside' }));
      expect(screen.getByRole('status')).toHaveTextContent(/standard/i);
    });

    it('links the off-list warning to the input via aria-describedby', () => {
      render(
        <SuggestionCombobox
          value="MyCustomRegion"
          onChange={() => {}}
          suggestions={SUGGESTIONS}
          aria-label="Region"
          warnOffList
        />
      );
      const warningId = screen.getByRole('status').getAttribute('id');
      expect(warningId).toBeTruthy();
      expect(screen.getByRole('combobox').getAttribute('aria-describedby') || '').toContain(
        warningId
      );
    });

    it('merges the off-list warning id with a caller-provided aria-describedby', () => {
      render(
        <SuggestionCombobox
          value="MyCustomRegion"
          onChange={() => {}}
          suggestions={SUGGESTIONS}
          aria-label="Region"
          warnOffList
          aria-describedby="caller-hint"
        />
      );
      const describedBy = screen.getByRole('combobox').getAttribute('aria-describedby') || '';
      const warningId = screen.getByRole('status').getAttribute('id');
      expect(describedBy).toContain('caller-hint');
      expect(describedBy).toContain(warningId);
    });
  });
});
