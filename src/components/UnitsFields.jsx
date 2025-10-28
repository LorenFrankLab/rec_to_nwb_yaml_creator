import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';

/**
 * UnitsFields Component
 *
 * Renders the units configuration fields in a collapsible details section.
 * Defines the measurement units for analog signals and behavioral events.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The units fields section wrapped in a details element
 */
function UnitsFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur } = actions;
  const units = formData?.units || {};

  return (
    <div id="units-area" className="area-region">
      <details open>
        <summary>Units</summary>
        <div className="form-container">
          <InputElement
            id="analog"
            type="text"
            name="analog"
            title="Analog"
            placeholder="Analog"
            required
            value={units.analog || ''}
            onChange={handleChange('analog', 'units')}
            onBlur={(e) => onBlur(e, { key: 'units' })}
            validation={{ type: 'required' }}
          />
          <InputElement
            id="behavioralEvents"
            type="text"
            name="behavioral_events"
            title="Behavioral Events"
            placeholder="Behavioral Events"
            required
            value={units.behavioral_events || ''}
            onChange={handleChange('behavioral_events', 'units')}
            onBlur={(e) => onBlur(e, { key: 'units' })}
            validation={{ type: 'required' }}
          />
        </div>
      </details>
    </div>
  );
}

export default UnitsFields;
