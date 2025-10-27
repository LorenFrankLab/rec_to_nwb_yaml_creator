import PropTypes from 'prop-types';
import InputElement from '../element/InputElement';
import DataListElement from '../element/DataListElement';
import { labs } from '../valueList';

/**
 * LabInstitutionFields Component
 *
 * Renders the lab and institution fields for entering laboratory and
 * institution information. Institution field includes autocomplete from
 * a predefined list of universities and research centers.
 *
 * @param {Object} props - Component props
 * @param {Object} props.formData - Current form data
 * @param {string} props.formData.lab - Laboratory name
 * @param {string} props.formData.institution - Institution name
 * @param {Function} props.handleChange - Handler for input changes
 * @param {Function} props.onBlur - Handler for blur events
 * @param {Function} props.itemSelected - Handler for datalist selection
 * @returns {JSX.Element} The lab and institution fields section
 */
function LabInstitutionFields({
  formData,
  handleChange,
  onBlur,
  itemSelected,
}) {
  return (
    <>
      <div id="lab-area" className="area-region">
        <InputElement
          id="lab"
          type="text"
          name="lab"
          title="Lab"
          value={formData?.lab || ''}
          onChange={handleChange('lab')}
          placeholder="Laboratory where the experiment is conducted"
          required
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="institution-area" className="area-region">
        <DataListElement
          id="institution"
          name="institution"
          title="Institution"
          value={formData?.institution || ''}
          onChange={handleChange('institution')}
          placeholder="Type to find an affiliated University or Research center"
          required
          dataItems={labs()}
          onBlur={(e) => itemSelected(e)}
        />
      </div>
    </>
  );
}

LabInstitutionFields.propTypes = {
  formData: PropTypes.shape({
    lab: PropTypes.string,
    institution: PropTypes.string,
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func.isRequired,
  itemSelected: PropTypes.func.isRequired,
};

export default LabInstitutionFields;
