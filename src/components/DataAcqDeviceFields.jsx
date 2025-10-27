import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import DataListElement from '../element/DataListElement';
import ArrayItemControl from '../element/ArrayItemControl';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import {
  dataAcqDeviceName,
  dataAcqDeviceSystem,
  dataAcqDeviceAmplifier,
  dataAcqDeviceADCCircuit,
} from '../valueList';

/**
 * DataAcqDeviceFields component
 *
 * Renders the data acquisition device section of the form, supporting multiple devices.
 * Each device has name, system, amplifier, and ADC circuit fields.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The data acquisition device fields section
 */
export default function DataAcqDeviceFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur, addArrayItem, removeArrayItem, duplicateArrayItem } = actions;
  return (
    <div id="data_acq_device-area" className="area-region">
      <details open>
        <summary>Data Acq Device</summary>
        <div>
          {formData?.data_acq_device.map((dataAcqDevice, index) => {
            const key = 'data_acq_device';

            return (
              <details
                open
                key={`data_acq_device-${index}`}
                className="array-item"
              >
                <summary>Device: {dataAcqDevice.name || 'Unnamed'}</summary>
                <ArrayItemControl
                  index={index}
                  keyValue={key}
                  duplicateArrayItem={duplicateArrayItem}
                  removeArrayItem={removeArrayItem}
                />
                <div
                  id={`dataAcqDevice-${index + 1}`}
                  className="form-container"
                >
                  <DataListElement
                    id={`data_acq_device-name-${index}`}
                    name="name"
                    type="text"
                    title="Name"
                    required
                    value={dataAcqDevice.name}
                    onChange={handleChange('name', 'data_acq_device', index)}
                    placeholder="Typically a number"
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    dataItems={dataAcqDeviceName()}
                  />
                  <DataListElement
                    id={`data_acq_device-system-${index}`}
                    type="text"
                    name="system"
                    title="System"
                    required
                    value={dataAcqDevice.system}
                    onChange={handleChange('system', 'data_acq_device', index)}
                    placeholder="System of device"
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    dataItems={dataAcqDeviceSystem()}
                  />
                  <DataListElement
                    id={`data_acq_device-amplifier-${index}`}
                    type="text"
                    name="amplifier"
                    title="Amplifier"
                    required
                    value={dataAcqDevice.amplifier}
                    onChange={handleChange('amplifier', 'data_acq_device', index)}
                    placeholder="Type to find an amplifier"
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    dataItems={dataAcqDeviceAmplifier()}
                  />
                  <DataListElement
                    id={`data_acq_device-adc_circuit-${index}`}
                    name="adc_circuit"
                    type="text"
                    title="ADC circuit"
                    required
                    value={dataAcqDevice.adc_circuit}
                    onChange={handleChange('adc_circuit', 'data_acq_device', index)}
                    placeholder="Type to find an adc circuit"
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    dataItems={dataAcqDeviceADCCircuit()}
                  />
                </div>
              </details>
            );
          })}
        </div>
        <ArrayUpdateMenu
          itemsKey="data_acq_device"
          items={formData.data_acq_device}
          addArrayItem={addArrayItem}
        />
      </details>
    </div>
  );
}
