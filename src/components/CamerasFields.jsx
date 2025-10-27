import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import { sanitizeTitle } from '../utils';
import InputElement from '../element/InputElement';
import DataListElement from '../element/DataListElement';
import ArrayItemControl from '../element/ArrayItemControl';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import { cameraManufacturers } from '../valueList';

/**
 * CamerasFields component
 *
 * Renders the cameras section of the form, supporting multiple cameras.
 * Each camera has ID, meters per pixel, manufacturer, model, lens, and camera name fields.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The cameras fields section
 */
export default function CamerasFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur, addArrayItem, removeArrayItem, duplicateArrayItem } = actions;
  return (
    <div id="cameras-area" className="area-region">
      <details open>
        <summary>Cameras</summary>
        <div className="form-container">
          {formData?.cameras?.map((cameras, index) => {
            const key = 'cameras';
            return (
              <details
                open
                key={`cameras-${sanitizeTitle(cameras.id)}`}
                className="array-item"
              >
                <summary>Camera {cameras.id} - {cameras.camera_name || 'Unnamed'}</summary>
                <ArrayItemControl
                  index={index}
                  keyValue={key}
                  duplicateArrayItem={duplicateArrayItem}
                  removeArrayItem={removeArrayItem}
                />
                <div className="form-container">
                  <InputElement
                    id={`cameras-id-${index}`}
                    type="number"
                    name="id"
                    title="Camera Id"
                    value={cameras.id}
                    onChange={handleChange('id', 'cameras', index)}
                    placeholder="Typically a number	"
                    required
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    validation={{ type: 'numberRange', min: 0 }}
                  />
                  <InputElement
                    id={`cameras-metersperpixel-${index}`}
                    type="number"
                    name="meters_per_pixel"
                    title="Meters Per Pixel"
                    value={cameras.meters_per_pixel}
                    onChange={handleChange('meters_per_pixel', 'cameras', index)}
                    placeholder="Meters Per Pixel"
                    step="0.1"
                    required
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    validation={{ type: 'numberRange', min: 0, unit: 'm/pixel' }}
                  />
                  <DataListElement
                    id={`cameras-manufacturer-${index}`}
                    type="text"
                    name="manufacturer"
                    title="Manufacturer"
                    value={cameras.manufacturer}
                    onChange={handleChange('manufacturer', 'cameras', index)}
                    placeholder="Type to find a manufacturer"
                    required
                    dataItems={cameraManufacturers()}
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                  />
                  <InputElement
                    id={`cameras-model-${index}`}
                    type="text"
                    name="model"
                    title="model"
                    value={cameras.model}
                    onChange={handleChange('model', 'cameras', index)}
                    placeholder="Model of this camera"
                    required
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`cameras-lens-${index}`}
                    type="text"
                    name="lens"
                    title="lens"
                    value={cameras.lens}
                    onChange={handleChange('lens', 'cameras', index)}
                    placeholder="Info about lens in this camera"
                    required
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    validation={{ type: 'required' }}
                  />{' '}
                  <InputElement
                    id={`cameras-cameraname-${index}`}
                    type="text"
                    name="camera_name"
                    title="Camera Name"
                    value={cameras.camera_name}
                    onChange={handleChange('camera_name', 'cameras', index)}
                    placeholder="Name of this camera"
                    required
                    onBlur={(e) =>
                      onBlur(e, {
                        key,
                        index,
                      })
                    }
                    validation={{ type: 'required' }}
                  />
                </div>
              </details>
            );
          })}
        </div>
        <ArrayUpdateMenu
          itemsKey="cameras"
          items={formData.cameras}
          addArrayItem={addArrayItem}
        />
      </details>
    </div>
  );
}
