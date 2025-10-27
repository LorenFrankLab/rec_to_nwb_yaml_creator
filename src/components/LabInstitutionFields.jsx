import PropTypes from 'prop-types';
import InputElement from '../element/InputElement';
import DataListElement from '../element/DataListElement';
import { labs } from '../valueList';

function LabInstitutionFields({
  formData,
  handleChange,
  onBlur,
  itemSelected,
}) {
  const safeHandleChange = handleChange || (() => () => {});
  const safeOnBlur = onBlur || (() => {});
  const safeItemSelected = itemSelected || (() => {});

  return (
    <>
      <div id="lab-area" className="area-region">
        <InputElement
          id="lab"
          type="text"
          name="lab"
          title="Lab"
          value={formData?.lab || ''}
          onChange={safeHandleChange('lab')}
          placeholder="Laboratory where the experiment is conducted"
          required
          onBlur={(e) => safeOnBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="institution-area" className="area-region">
        <DataListElement
          id="institution"
          name="institution"
          title="Institution"
          value={formData?.institution || ''}
          onChange={safeHandleChange('institution')}
          placeholder="Type to find an affiliated University or Research center"
          required
          dataItems={labs()}
          onBlur={(e) => safeItemSelected(e)}
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
