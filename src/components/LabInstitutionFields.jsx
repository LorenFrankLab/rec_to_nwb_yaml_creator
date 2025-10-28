import { useStoreContext } from '../state/StoreContext';
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
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The lab and institution fields section
 */
function LabInstitutionFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur, itemSelected } = actions;

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

export default LabInstitutionFields;
