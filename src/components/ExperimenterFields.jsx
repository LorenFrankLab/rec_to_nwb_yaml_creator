import PropTypes from 'prop-types';
import ListElement from '../element/ListElement';

/**
 * ExperimenterFields Component
 *
 * Renders the experimenter name list field for entering multiple experimenters
 * in "LastName, FirstName" format. Uses ListElement for dynamic list management.
 *
 * @param {Object} props - Component props
 * @param {Object} props.formData - Current form data
 * @param {string[]} props.formData.experimenter_name - Array of experimenter names
 * @param {Function} props.updateFormData - Handler for list updates
 * @returns {JSX.Element} The experimenter fields section
 */
function ExperimenterFields({
  formData,
  updateFormData,
}) {
  return (
    <div id="experimenter_name-area" className="area-region">
      <ListElement
        id="experimenter_name"
        type="text"
        name="experimenter_name"
        inputPlaceholder="No experimenter"
        defaultValue={formData?.experimenter_name || []}
        title="Experimenter Name"
        placeholder="LastName, FirstName"
        listPlaceHolder="LastName, FirstName"
        updateFormData={updateFormData}
        metaData={{
          nameValue: 'experimenter_name',
        }}
      />
    </div>
  );
}

ExperimenterFields.propTypes = {
  formData: PropTypes.shape({
    experimenter_name: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  updateFormData: PropTypes.func.isRequired,
};

export default ExperimenterFields;
