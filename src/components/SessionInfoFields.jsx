import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';
import ListElement from '../element/ListElement';

/**
 * SessionInfoFields Component
 *
 * Renders form fields for session-level metadata including descriptions,
 * session ID, and keywords.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The session info fields section
 */
function SessionInfoFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur, updateFormData } = actions;

  return (
    <>
      <div id="experiment_description-area" className="area-region">
        <InputElement
          id="experiment_description"
          type="text"
          name="experiment_description"
          title="Experiment Description"
          placeholder="Description of subject and where subject came from (e.g., breeder, if animal)"
          required
          value={formData?.experiment_description || ''}
          onChange={handleChange('experiment_description')}
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="session_description-area" className="area-region">
        <InputElement
          id="session_description"
          type="text"
          name="session_description"
          title="Session Description"
          required
          placeholder="Description of current session, e.g - w-track task"
          value={formData?.session_description || ''}
          onChange={handleChange('session_description')}
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="session_id-area" className="area-region">
        <InputElement
          id="session_id"
          type="text"
          name="session_id"
          title="Session Id"
          required
          placeholder="Session id, e.g - 1"
          value={formData?.session_id || ''}
          onChange={handleChange('session_id')}
          onBlur={(e) => onBlur(e)}
          validation={{
            type: 'pattern',
            pattern: /^[a-zA-Z0-9_-]+$/,
            patternMessage: 'Session ID must contain only letters, numbers, underscores, or hyphens'
          }}
        />
      </div>
      <div id="keywords-area" className="form-container area-region">
        <ListElement
          id="keywords"
          type="text"
          name="keywords"
          title="Keywords"
          defaultValue={formData?.keywords || []}
          required
          inputPlaceholder="No keyword"
          placeholder="Keywords"
          updateFormData={updateFormData}
          metaData={{
            nameValue: 'keywords',
          }}
        />
      </div>
    </>
  );
}

export default SessionInfoFields;
