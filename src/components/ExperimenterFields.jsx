import PropTypes from 'prop-types';
import ListElement from '../element/ListElement';

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
    experimenter_name: PropTypes.array,
  }).isRequired,
  updateFormData: PropTypes.func.isRequired,
};

export default ExperimenterFields;
