import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';

/**
 * TechnicalFields Component
 *
 * Renders technical configuration fields for NWB file generation, including
 * timing multipliers, voltage conversion factors, and file paths.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The technical configuration fields section
 */
function TechnicalFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur } = actions;

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

export default TechnicalFields;
