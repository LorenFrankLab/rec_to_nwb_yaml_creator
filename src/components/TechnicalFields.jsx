import PropTypes from 'prop-types';
import InputElement from '../element/InputElement';

/**
 * TechnicalFields Component
 *
 * Renders technical configuration fields for NWB file generation, including
 * timing multipliers, voltage conversion factors, and file paths.
 *
 * @param {Object} props - Component props
 * @param {Object} props.formData - Current form data
 * @param {number|string} props.formData.times_period_multiplier - Multiplier for timing periods
 * @param {number|string} props.formData.raw_data_to_volts - Conversion factor from raw data to volts
 * @param {string} props.formData.default_header_file_path - Path to default header file
 * @param {Function} props.handleChange - Handler for input changes
 * @param {Function} props.onBlur - Handler for blur events
 * @returns {JSX.Element} The technical configuration fields section
 */
function TechnicalFields({
  formData,
  handleChange,
  onBlur,
}) {
  return (
    <>
      <div id="times_period_multiplier-area" className="area-region">
        <InputElement
          id="times_period_multiplier"
          type="number"
          name="times_period_multiplier"
          title="Times Period Multiplier"
          placeholder="Times Period Multiplier"
          step="any"
          required
          value={formData?.times_period_multiplier || ''}
          onChange={handleChange('times_period_multiplier')}
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="raw_data_to_volts-area" className="area-region">
        <InputElement
          id="raw_data_to_volts"
          type="number"
          name="raw_data_to_volts"
          title="Ephys-to-Volt Conversion Factor"
          placeholder="Scalar to multiply each element in data to convert it to the specified 'unit'. If the data are stored in acquisition system units or other units that require a conversion to be interpretable, multiply the data by 'conversion' to convert the data to the specified 'unit'."
          step="any"
          required
          value={formData?.raw_data_to_volts || ''}
          onChange={handleChange('raw_data_to_volts')}
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="default_header_file_path-area" className="area-region">
        <InputElement
          id="defaultHeaderFilePath"
          type="text"
          title="Default Header File Path"
          name="default_header_file_path"
          placeholder="Default Header File Path"
          required
          value={formData?.default_header_file_path || ''}
          onChange={handleChange('default_header_file_path')}
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
    </>
  );
}

TechnicalFields.propTypes = {
  formData: PropTypes.shape({
    times_period_multiplier: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    raw_data_to_volts: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    default_header_file_path: PropTypes.string,
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func.isRequired,
};

export default TechnicalFields;
