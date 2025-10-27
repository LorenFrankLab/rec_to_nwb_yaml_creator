import { useStoreContext } from '../state/StoreContext';
import ListElement from '../element/ListElement';

/**
 * ExperimenterFields Component
 *
 * Renders the experimenter name list field for entering multiple experimenters
 * in "LastName, FirstName" format. Uses ListElement for dynamic list management.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The experimenter fields section
 */
function ExperimenterFields() {
  const { model: formData, actions } = useStoreContext();
  const { updateFormData } = actions;

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

export default ExperimenterFields;
