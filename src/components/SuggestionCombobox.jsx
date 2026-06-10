import { useState, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useStableId } from '../hooks/useStableId';
import './SuggestionCombobox.scss';

/**
 * SuggestionCombobox — an accessible editable combobox (the WAI-ARIA APG "combobox with
 * list autocomplete, manual selection" pattern). A text input paired with a popup listbox
 * of suggestions, used where a field needs BOTH curated suggestions AND free-text entry
 * (e.g. behavioral-event names, brain regions). It replaces the native `<datalist>`, whose
 * suggestions collapse to the single exact match once a value is chosen.
 *
 * Behaviour:
 * - **Browse vs. filter.** Opening via click / the ▾ toggle / ArrowDown shows ALL
 *   suggestions — even when the field already holds a complete prior selection (this is the
 *   fix for the datalist "can't see the other options again" problem). TYPING filters the
 *   list (case-insensitive substring). The two are tracked separately by `filtering`.
 * - **Re-openable.** After a value is chosen the list closes; clicking/▾ re-opens the full
 *   list.
 * - **Free text is authoritative.** The typed value is always kept; suggestions are hints.
 * - **Does NOT open on bare (programmatic) focus**, so a parent's Escape-to-cancel keeps
 *   working when the field is auto-focused on mount.
 *
 * Keyboard: ArrowDown/ArrowUp move the active option (ArrowDown opens a closed list to ALL
 * options); Enter selects the active option when the list is open, otherwise falls through
 * to `onKeyDown`; Escape closes an open list (consumed), otherwise falls through to
 * `onKeyDown`. `onBlur` fires when focus leaves the whole control (used by callers to e.g.
 * canonicalize the value).
 *
 * @param {object} props
 * @param {string} props.value - Current value (controlled).
 * @param {(value: string) => void} props.onChange - Called with the new string value.
 * @param {string[]} props.suggestions - Suggestion strings.
 * @param {string} [props.id] - Optional input id (else auto-generated).
 * @param {string} [props.label] - Visible label text; omit for a label-less field (pass
 *   `aria-label` instead).
 * @param {string} [props.name] - Input name.
 * @param {boolean} [props.required] - Input required.
 * @param {string} [props.placeholder] - Input placeholder.
 * @param {string} [props.className] - Class applied to the input (e.g. validation state).
 * @param {(e: KeyboardEvent) => void} [props.onKeyDown] - Passthrough for keys the combobox
 *   does not consume (e.g. Enter/Escape when the list is closed).
 * @param {(e: FocusEvent) => void} [props.onBlur] - Called when focus leaves the control.
 * @param {(option: string) => void} [props.onSelect] - Called instead of `onChange` when a
 *   suggestion is explicitly picked (click/Enter), so the caller can transform it (e.g. append a
 *   DIO index). Falls back to `onChange` when omitted.
 * @param {object} [props.inputRef] - Ref forwarded to the input.
 * @param {boolean} [props.warnOffList] - When true, show a gentle nudge while the list is
 *   closed and the value matches no suggestion (case-insensitive).
 * @param {string} [props.offListMessage] - Custom text for the off-list nudge.
 * @returns {JSX.Element}
 */
export default function SuggestionCombobox({
  value,
  onChange,
  suggestions,
  id: providedId,
  label,
  name,
  required,
  placeholder,
  className,
  onKeyDown,
  onBlur,
  onSelect,
  inputRef,
  warnOffList,
  offListMessage,
  ...inputProps
}) {
  const id = useStableId(providedId, 'combobox');
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  // The input element ref, used to anchor the portaled listbox. Merge with any forwarded
  // `inputRef` so callers can still reach the input.
  const innerInputRef = useRef(null);
  const setInputRef = useCallback(
    (node) => {
      innerInputRef.current = node;
      if (typeof inputRef === 'function') inputRef(node);
      else if (inputRef) inputRef.current = node;
    },
    [inputRef]
  );

  // The listbox is rendered in a PORTAL on document.body so no ancestor's `overflow` (the
  // rounded-corner table clip, a scrolling modal) can crop it. Position it (fixed) under the
  // input, tracking scroll/resize while open.
  const [menuPosition, setMenuPosition] = useState(null);

  const query = (value ?? '').trim().toLowerCase();
  const options = useMemo(() => {
    // Browse mode (opened by click/▾/Arrow) shows everything; only typing filters.
    if (!filtering || query === '') return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(query));
  }, [suggestions, query, filtering]);

  const listOpen = open && options.length > 0;

  // Measure the input and place the (fixed-position) portaled listbox under it; keep it aligned
  // on scroll/resize while open. useLayoutEffect runs before paint, so there is no flicker.
  useLayoutEffect(() => {
    if (!listOpen) return undefined;
    const reposition = () => {
      const el = innerInputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [listOpen]);

  // Off-list nudge: the trimmed value is non-empty and matches no suggestion (case-insensitive,
  // so a value that will canonicalize — e.g. "ca1" → "CA1" — is treated as on-list). Shown only
  // when the list is CLOSED, so it appears after the user has settled on a value rather than
  // flickering on every keystroke while they browse/type.
  const trimmedValue = (value ?? '').trim();
  const isOffList =
    trimmedValue !== '' &&
    !suggestions.some((s) => s.toLowerCase() === trimmedValue.toLowerCase());
  const showOffListWarning = warnOffList && !open && isOffList;

  const closeList = useCallback(() => {
    setOpen(false);
    setFiltering(false);
    setActiveIndex(-1);
  }, []);

  const openAll = useCallback(() => {
    setOpen(true);
    setFiltering(false);
  }, []);

  const selectOption = useCallback(
    (option) => {
      // An explicit pick routes through onSelect when provided (so the caller can transform it,
      // e.g. append a DIO index), otherwise falls back to onChange. Typing always uses onChange.
      if (onSelect) onSelect(option);
      else onChange(option);
      closeList();
    },
    [onSelect, onChange, closeList]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        openAll();
        setActiveIndex(0);
      } else {
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
      }
      return;
    }
    if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open && activeIndex >= 0 && activeIndex < options.length) {
      e.preventDefault();
      selectOption(options[activeIndex]);
      return;
    }
    if (e.key === 'Escape' && open) {
      // Consume so the list closes WITHOUT also triggering a parent's Escape handler
      // (e.g. cancel-edit); a second Escape, with the list closed, reaches the parent.
      e.preventDefault();
      e.stopPropagation();
      closeList();
      return;
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleContainerBlur = (e) => {
    // Focus left the whole control (not just moved between input/toggle/options).
    if (!containerRef.current?.contains(e.relatedTarget)) {
      closeList();
      if (onBlur) onBlur(e);
    }
  };

  return (
    <div className="suggestion-combobox" ref={containerRef} onBlur={handleContainerBlur}>
      {label != null && (
        <label htmlFor={id} className="suggestion-combobox__label">
          {label}
        </label>
      )}
      <div className="suggestion-combobox__field">
        <input
          {...inputProps}
          id={id}
          ref={setInputRef}
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          name={name}
          required={required}
          className={className}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setFiltering(true);
            setActiveIndex(-1);
          }}
          onClick={openAll}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="suggestion-combobox__toggle"
          tabIndex={-1}
          // Track the visible list (listOpen), not raw `open`: when a typed filter matches
          // nothing the list is hidden, and clicking ▾ should re-browse the full list.
          aria-label={listOpen ? 'Hide suggestions' : 'Show suggestions'}
          // Keep focus on the input so toggling does not blur-close the control.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (listOpen ? closeList() : openAll())}
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {listOpen &&
        menuPosition &&
        createPortal(
          <ul
            className="suggestion-combobox__list"
            role="listbox"
            id={listboxId}
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
          >
            {options.map((option, i) => (
              <li
                key={option}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={
                  i === activeIndex
                    ? 'suggestion-combobox__option suggestion-combobox__option--active'
                    : 'suggestion-combobox__option'
                }
                // mousedown fires before the input's blur, and preventDefault keeps focus on
                // the input, so the click reliably selects instead of being lost to a close.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option}
              </li>
            ))}
          </ul>,
          document.body
        )}
      {showOffListWarning && (
        <p className="suggestion-combobox__offlist-warning" role="status">
          {offListMessage ??
            'Not one of the standard options. You can pick a standard option from the ' +
              'suggestions — use a custom value only if you have a specific reason.'}
        </p>
      )}
    </div>
  );
}

SuggestionCombobox.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  id: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  onKeyDown: PropTypes.func,
  onBlur: PropTypes.func,
  onSelect: PropTypes.func,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  warnOffList: PropTypes.bool,
  offListMessage: PropTypes.string,
};

SuggestionCombobox.defaultProps = {
  value: '',
  suggestions: [],
  id: undefined,
  label: undefined,
  name: undefined,
  required: false,
  placeholder: undefined,
  className: undefined,
  onKeyDown: undefined,
  onBlur: undefined,
  onSelect: undefined,
  inputRef: undefined,
  warnOffList: false,
  offListMessage: undefined,
};
