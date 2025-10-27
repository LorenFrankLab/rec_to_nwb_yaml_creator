import PropTypes from 'prop-types';
import InputElement from '../element/InputElement';

function UnitsFields({
  formData,
  handleChange,
  onBlur,
}) {
  const safeHandleChange = handleChange || (() => () => {});
  const safeOnBlur = onBlur || (() => {});
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
            onChange={safeHandleChange('analog', 'units')}
            onBlur={(e) => safeOnBlur(e, { key: 'units' })}
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
            onChange={safeHandleChange('behavioral_events', 'units')}
            onBlur={(e) => safeOnBlur(e, { key: 'units' })}
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
