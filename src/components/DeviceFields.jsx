import React from 'react';
import ListElement from '../element/ListElement';

/**
 * DeviceFields component
 *
 * Renders the device section of the form with a list of device names.
 *
 * @param {Object} props - Component props
 * @param {Object} props.formData - Current form data
 * @param {Function} props.updateFormData - Handler for updating form data
 * @returns {JSX.Element} The device fields section
 */
export default function DeviceFields({ formData, updateFormData }) {
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
