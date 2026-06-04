import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * KeywordsEditor - add/remove searchable keyword tags for a recording day.
 *
 * Keywords are optional in the NWB schema, but when present they must be a
 * non-empty list of unique, non-blank strings. This editor enforces those
 * constraints at entry (trimming, de-duplicating, ignoring blanks) so the
 * exported metadata stays schema-valid.
 *
 * @param {object} props
 * @param {string[]} [props.value] - Current keywords (treated as [] when absent).
 * @param {Function} props.onChange - Called with the new keyword array on change.
 * @returns {JSX.Element}
 */
export default function KeywordsEditor({ value, onChange }) {
  const keywords = value || [];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const addKeyword = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft('');
      return;
    }
    if (keywords.includes(trimmed)) {
      // Keep the draft so the user can see/edit what was rejected.
      setError(`"${trimmed}" is already added.`);
      return;
    }
    setError('');
    setDraft('');
    onChange([...keywords, trimmed]);
  };

  const removeKeyword = (keyword) => {
    onChange(keywords.filter((k) => k !== keyword));
  };

  return (
    <div className="form-field keywords-editor">
      <label htmlFor="day-keyword-input">Keywords (optional)</label>
      <span className="field-help-text">
        Searchable tags saved in the NWB file (e.g. spatial, w-track).
      </span>

      {keywords.length > 0 && (
        <ul className="keywords-list">
          {keywords.map((keyword) => (
            <li key={keyword} className="keyword-chip">
              <span className="keyword-chip-label">{keyword}</span>
              <button
                type="button"
                className="keyword-remove-button"
                aria-label={`Remove keyword ${keyword}`}
                onClick={() => removeKeyword(keyword)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="keyword-add-row">
        <input
          id="day-keyword-input"
          type="text"
          value={draft}
          placeholder="Add a keyword"
          aria-describedby={error ? 'day-keyword-error' : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addKeyword();
            }
          }}
        />
        <button type="button" className="keyword-add-button" onClick={addKeyword}>
          Add keyword
        </button>
      </div>

      {error && (
        <span id="day-keyword-error" role="alert" className="keyword-input-error">
          {error}
        </span>
      )}
    </div>
  );
}

KeywordsEditor.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
};
