import { useState } from 'react';
import { useDraftField } from '../../hooks/useDraftField';

interface KeywordsEditorProps {
  value?: string[];
  onChange: (keywords: string[]) => void;
  draftKey?: string;
  suggestions?: string[];
}

/** Whole-list editing keeps the last typed keyword visible to autosave and export. */
export default function KeywordsEditor({ value, onChange, draftKey, suggestions = [] }: KeywordsEditorProps) {
  const keywords = Array.isArray(value) ? value : [];
  // Preserve line breaks/caret while autosave normalizes the stored list.
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const draft = useDraftField({
    value: focusedValue ?? keywords.join('\n'),
    onCommit: (text) => onChange([...new Set(text.split('\n').map((word) => word.trim()).filter(Boolean))]),
    draftKey,
    label: 'keywords',
  });
  const entered = draft.value.split('\n').map((word) => word.trim());
  const choices = [...new Set(suggestions)].filter((word) => word.trim() && !entered.includes(word));
  return (
    <div className="form-field keywords-editor">
      <label htmlFor="day-keyword-input">Keywords (optional)</label>
      <textarea id="day-keyword-input" data-field-path="keywords" rows={3}
        value={draft.value} onChange={(event) => draft.setValue(event.target.value)}
        onFocus={() => setFocusedValue(keywords.join('\n'))}
        onBlur={() => { setFocusedValue(null); draft.flush(); }}
        aria-describedby="day-keyword-help" placeholder={'opto\nhippocampus\nmPFC'} />
      <span id="day-keyword-help" className="field-help-text">
        One keyword per line. Saved automatically in the metadata YAML; blank lines and duplicates are removed.
      </span>
      {choices.length > 0 && <div aria-label="Previously used keywords">
        {choices.map((word) => <button type="button" key={word} onClick={() => {
          draft.setValue([...entered.filter(Boolean), word].join('\n'));
          draft.flush();
        }}>Add {word}</button>)}
      </div>}
      {draft.commitError && <span role="alert">{draft.commitError}</span>}
    </div>
  );
}
