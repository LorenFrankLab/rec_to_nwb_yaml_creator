import PropTypes from 'prop-types';
import InputElement from '../element/InputElement';

/**
 * UnitsFields Component
 *
 * Renders the units configuration fields in a collapsible details section.
 * Defines the measurement units for analog signals and behavioral events.
 *
 * @param {Object} props - Component props
 * @param {Object} props.formData - Current form data
 * @param {Object} props.formData.units - Units configuration object
 * @param {string} props.formData.units.analog - Units for analog signals
 * @param {string} props.formData.units.behavioral_events - Units for behavioral events
 * @param {Function} props.handleChange - Handler for input changes
 * @param {Function} props.onBlur - Handler for blur events
 * @returns {JSX.Element} The units fields section wrapped in a details element
 */
function UnitsFields({
  formData,
  handleChange,
  onBlur,
}) {
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

UnitsFields.propTypes = {
  formData: PropTypes.shape({
    units: PropTypes.shape({
      analog: PropTypes.string,
      behavioral_events: PropTypes.string,
    }),
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func.isRequired,
};

export default UnitsFields;
