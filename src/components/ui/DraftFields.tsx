import type { InputHTMLAttributes, TextareaHTMLAttributes, FocusEvent } from 'react';
import { useDraftField } from '../../hooks/useDraftField';

/**
 * Draft-tracked text controls. Each renders a controlled input whose value is committed to the
 * store on a debounce while typing and on blur, and is visible to persistence while pending (see
 * `state/draftRegistry`). Use these for every free-text field whose committed home is the
 * workspace store; a plain `defaultValue`/`onBlur` input leaves the typed text invisible to
 * autosave, Ctrl/Cmd+S and the unload guard.
 */

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'>;
type NativeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'defaultValue'>;

interface DraftTextInputProps extends NativeInputProps {
  /** The committed value. */
  value: string;
  /** Commit a value (called on the debounce, on blur, and on unmount when dirty). */
  onCommit: (value: string) => void;
  /** Optional blur hook that receives the FINAL value (after the commit) — e.g. validation. */
  onBlurValue?: (value: string) => void;
  /** Debounce before a typed value is committed (ms). */
  debounceMs?: number;
}

/** A draft-tracked single-line text input. */
export function DraftTextInput({ value, onCommit, onBlurValue, debounceMs, onBlur, ...rest }: DraftTextInputProps) {
  const field = useDraftField<string>({ value, onCommit, debounceMs, label: rest.id ?? rest.name });
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    field.flush();
    onBlurValue?.(e.target.value);
    onBlur?.(e);
  };
  return (
    <input
      {...rest}
      value={field.value}
      onChange={(e) => field.setValue(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

interface DraftTextAreaProps extends NativeTextareaProps {
  value: string;
  onCommit: (value: string) => void;
  onBlurValue?: (value: string) => void;
  debounceMs?: number;
}

/** A draft-tracked textarea. */
export function DraftTextArea({ value, onCommit, onBlurValue, debounceMs, onBlur, ...rest }: DraftTextAreaProps) {
  const field = useDraftField<string>({ value, onCommit, debounceMs, label: rest.id ?? rest.name });
  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    field.flush();
    onBlurValue?.(e.target.value);
    onBlur?.(e);
  };
  return (
    <textarea
      {...rest}
      value={field.value}
      onChange={(e) => field.setValue(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

interface DraftNumberInputProps extends NativeInputProps {
  /** The committed value (`undefined` = not entered). */
  value: number | undefined;
  /** Commit a value; `undefined` when the field is cleared or not a finite number. */
  onCommit: (value: number | undefined) => void;
  onBlurValue?: (value: number | undefined) => void;
  debounceMs?: number;
}

/**
 * Parse a number input's text the way the old `valueAsNumber` blur handler did: a finite number, or
 * `undefined` for blank / unparsable text.
 */
function parseNumber(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A draft-tracked number input. The draft is kept as TEXT so partial entries ("4.", "-") are not
 * clobbered mid-typing; the committed value is the parsed number (or `undefined`).
 */
export function DraftNumberInput({ value, onCommit, onBlurValue, debounceMs, onBlur, ...rest }: DraftNumberInputProps) {
  const committedText = value === undefined ? '' : String(value);
  const field = useDraftField<string>({
    value: committedText,
    onCommit: (text) => onCommit(parseNumber(text)),
    debounceMs,
    // Two spellings of the same number ("450" vs "450.0") are not a pending draft.
    isEqual: (a, b) => a === b || (parseNumber(a) !== undefined && parseNumber(a) === parseNumber(b)),
    label: rest.id ?? rest.name,
  });
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    field.flush();
    onBlurValue?.(parseNumber(e.target.value));
    onBlur?.(e);
  };
  return (
    <input
      {...rest}
      type="number"
      value={field.value}
      onChange={(e) => field.setValue(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
