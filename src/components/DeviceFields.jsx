import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import ListElement from '../element/ListElement';

/**
 * DeviceFields component
 *
 * Renders the device section of the form with a list of device names.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The device fields section
 */
export default function DeviceFields() {
  const { model: formData, actions } = useStoreContext();
  const { updateFormData } = actions;

  return (
    <div id="device-area" className="area-region">
      <details open>
        <summary>Device</summary>
        <div className="form-container">
          <ListElement
            id="device-name"
            type="text"
            name="name"
            title="Name"
            inputPlaceholder="No Device"
            defaultValue={formData?.device?.name}
            placeholder="Device names"
            updateFormData={updateFormData}
            metaData={{
              nameValue: 'name',
              keyValue: 'device',
            }}
          />
        </div>
      </details>
    </div>
  );
}
