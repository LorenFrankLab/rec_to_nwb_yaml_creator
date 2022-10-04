import React, { useRef, useState, useEffect } from 'react';
import PubSub from 'pubsub-js';
import FileUpload from './FileUpload';
import SelectElement from './SelectElement';
import InputElement from './InputElement';
import SelectInputPairElement from './SelectInputPairElement';
import ChannelMap from './ChannelMap';
import deviceTypeChannel from './deviceTypes';
import {
  ASYNC_TOPICS,
  commaSeparatedStringToNumber,
  commaSeparatedFilesDataFormats,
  stringToInteger,
} from './utils';

const Ajv = require('ajv');

const schemaValueTypes = ['string', 'number', 'integer'];

const { ipcRenderer } = window.electron;

/**
 * Checks if an object is empty
 *
 * @param {object} item
 * @returns true if empty, false otherwise
 */
const isObjectEmpty = (item) => {
  return !!item && Object.keys(item).length === 0;
};

/**
 * Main component
 *
 * @returns Virtual DOM
 */
export function YMLGenerator() {
  const [schemaFormData, setSchemaFormData] = useState([]); // part of scchema hold data to display
  const form = useRef([]); // user data for displaying generated YML
  const schema = useRef({});
  const cameraIds = useRef([]);

  /**
   * Checks where user data conforms to the schema
   *
   * @param {user data} formData
   * @param {schema} JSONchema
   * @returns true if user data conforms to the schema, false otherwise
   */
  const validateJSON = (formData, JSONchema) => {
    const ajv = new Ajv();

    // These are markers used to customize data-display, allow all characters
    ajv.addFormat('behavioral_events-description', /^.*$/);
    ajv.addFormat('selectInputPair', /^.*$/);
    ajv.addFormat('comma-separated-numbers', /^.*$/);
    ajv.addFormat('comma-separated-numbers-camera-dependent', /^.*$/);
    ajv.addFormat('data-list', /^.*$/);
    ajv.addFormat('file-upload', /^.*$/);
    ajv.addFormat('index-value', /^.*$/);
    ajv.addFormat('channel-map', /^.*$/);
    ajv.addFormat('dropdown', /^.*$/);
    ajv.addFormat('ntrode', /^.*$/);
    ajv.addFormat('camera-id-source', /^.*$/);

    const validate = ajv.compile(JSONchema);

    validate(formData);

    const validationMessages =
      validate.errors?.map((error) => {
        return `Key: ${error.instancePath.replaceAll('/', '')} \n Error: ${
          error.message
        }`;
      }) || [];

    const isValid = validate.errors === null;

    const message = isValid
      ? 'Data is valid'
      : `Data is not valid - \n ${validationMessages.join('\n \n')}`;

    return {
      isValid,
      message,
    };
  };

  /**
   * Generates YML file
   *
   * @param {event object} e
   */
  const createYMLFile = (e) => {
    e.preventDefault();
    const formData = structuredClone(form.current);
    const JSONschema = schema.current;

    const { isValid, message } = validateJSON(formData, JSONschema);

    if (isValid) {
      ipcRenderer.sendMessage('SAVE_USER_DATA', form.current);
    } else {
      window.alert(message); // eslint-disable-line no-alert
    }
  };

  /**
   * Initiates a request to node to open a file for importing into the app
   *
   * @param {event object} e event object
   */
  const uploadFile = (e) => {
    e.preventDefault();
    ipcRenderer.sendMessage('REQUEST_OPEN_TEMPLATE_FILE_BOX');
  };

  /**
   * Gets a schema and use it to populate the app. Use for when app first opens
   *
   * @param {object} schemaContent Part of schema with data
   */
  const initializeFormData = (schemaContent) => {
    const formData = {};
    schemaContent?.forEach((property) => {
      const { type, title, properties } = property;

      if (schemaValueTypes.includes(type)) {
        const defaultValue = property.default || '';
        formData[title] = ['integer', 'number'].includes(type)
          ? stringToInteger(defaultValue)
          : defaultValue;
      } else if (type === 'object') {
        const propertyKeys = Object.keys(properties);
        const defaultValue = property.default || '';
        formData[title] = {};
        propertyKeys.forEach((key) => {
          formData[title][key] = ['integer', 'number'].includes(type)
            ? stringToInteger(defaultValue)
            : defaultValue;
        });
      } else if (type === 'array') {
        formData[title] = [];
      }
    });
    form.current = formData;
    cameraIds.current = [];
  };

  /**
   * Creates DOM to be displayed on page
   *
   * @param {object} property Property, from schema
   * @param {*} rowMetaData supporting data
   * @returns Virtual DOM
   */
  const formRow = (property, rowMetaData) => {
    const onInput = (e, metaData) => {
      const { value } = e.target;
      let input;
      const formData = form.current;

      // data format, used to signal special operations to perform on data prior to saving
      if (commaSeparatedFilesDataFormats.includes(metaData.rowFormat)) {
        input = commaSeparatedStringToNumber(value);
      } else if (['number', 'integer'].includes(metaData.valueType)) {
        input = parseInt(value, 10);
      } else {
        input = value;
      }

      // save data to form object, for later inclusion in generated YML file
      if (metaData.type === 'object') {
        formData[metaData.key][metaData.title] = input;
      } else if (metaData.type === 'array') {
        const formContent = formData[metaData.title];
        const formItem = formContent[metaData.index];

        if (formItem) {
          formItem[metaData.key] = input;
        }
      } else {
        formData[metaData.title] = input;
      }

      form.current = formData;

      // TO DO - re-write to not use document.querySelector
      if (metaData.inSyncItemId) {
        const element = document.querySelector(`#${metaData.inSyncItemId}`);
        (element || {}).value = input;
      }
    };

    let rowItems = <></>;

    if (property.format === 'camera-id-source') {
      const cameraId = rowMetaData.defaultValue || 0;

      PubSub.publish(ASYNC_TOPICS.cameraIdsUpdated, {
        message: 'Camera Id added',
        cameraId,
      });
    }

    if (property.format === 'file-upload') {
      const onNewFilePath = (path) => {
        const formData = form.current;
        const { key, title, type, index } = rowMetaData;

        if (type === 'object') {
          formData[key][title] = path;
        } else if (type === 'array') {
          formData[title][index][key] = path;
        } else {
          formData[title] = path;
        }
      };

      rowItems = (
        <FileUpload
          title={property.title}
          className="file-box"
          name={property.title}
          value={rowMetaData.defaultValurowMetaDatae}
          placeholder={property?.description}
          id={property.$id.replace('#', '').replace('/', '')}
          onInput={onNewFilePath}
        />
      );
    } else if (property.format === 'channel-map') {
      const formData = form.current;
      const onMapChanged = (shankIndex, electroGroupId, key, value) => {
        const nTrodeItem =
          formData.ntrode_electrode_group_channel_map[shankIndex];

        if (!nTrodeItem) {
          return;
        }

        nTrodeItem.map[key] = value;
      };

      rowItems = (
        <ChannelMap
          property={property}
          electrodeGroupId={rowMetaData.electrodeGroupId}
          nTrode={formData.ntrode_electrode_group_channel_map}
          onMapChanged={onMapChanged}
        />
      );
    } else if (property.format === 'dropdown') {
      const ItemSelected = (e, rowMeta) => {
        const { $id, parentProperty, currentIndex } = rowMeta;

        // special case. Electrode groups contain ntrodes on the UI
        // (but not the final yml data)
        if ($id === 'device_type') {
          const { target } = e;
          const { value } = target;
          const selectedDevice = structuredClone(deviceTypeChannel[value]);
          const electrodeGroupId =
            parentProperty.dataItems[currentIndex].properties.id.default;
          const schemaData = structuredClone(schemaFormData);
          const nTrodeSchema = schemaData?.find(
            (s) => s.$id === '#root/ntrode_electrode_group_channel_map'
          );
          const nTrodeProperty = structuredClone(
            nTrodeSchema?.items?.properties || {}
          );

          if (isObjectEmpty(nTrodeProperty)) {
            return null;
          }

          nTrodeProperty.electrode_group_id.default = electrodeGroupId;
          nTrodeProperty.ntrode_id.default = currentIndex + 1;
          nTrodeProperty.map = selectedDevice;
          nTrodeSchema.dataItems = nTrodeSchema.dataItems.filter(
            (s) => s.electrode_group_id.default !== electrodeGroupId
          );
          if (value) {
            nTrodeSchema.dataItems.push(nTrodeProperty);
          } else {
            const filteredDataItems = nTrodeSchema.dataItems.filter(
              (dataItem) =>
                dataItem.electrode_group_id.default !== electrodeGroupId
            );
            nTrodeSchema.dataItems = filteredDataItems;
          }

          setSchemaFormData(schemaData);

          // update form
          const nTrodeKeys = Object.keys(nTrodeProperty).filter(
            (nTrodeKey) => nTrodeKey !== 'map'
          );

          const formData = form.current;

          const map = {};
          const selectedDeviceProperties = selectedDevice.items.properties;
          Object.keys(selectedDeviceProperties).forEach((item) => {
            map[item] = selectedDeviceProperties[item].default;
          });

          const formNTrode = {};
          // formData[nTrodeSchema.title]
          nTrodeKeys.forEach((nTrodeKey) => {
            formNTrode[nTrodeKey] = nTrodeProperty[nTrodeKey].default;
          });

          formNTrode.map = structuredClone(map);

          const shankLength = selectedDevice.items.shankCount;
          const formNTrodes = Array.from({ length: shankLength }, () =>
            structuredClone(formNTrode)
          );

          const filteedNTrodeFormData = formData[nTrodeSchema.title].filter(
            (f) => f.electrode_group_id !== electrodeGroupId
          );

          formNTrodes.forEach((n) => filteedNTrodeFormData.push(n));

          formData[nTrodeSchema.title] = [];

          filteedNTrodeFormData.forEach((n) =>
            formData[nTrodeSchema.title].push(n)
          );
        }
        return null;
      };

      return (
        <SelectElement
          id={property.$id}
          examples={property.examples}
          description={property.description}
          keyProp={property.$id}
          title={property.title}
          selected={property.default}
          itemSelectedHandler={(e) => ItemSelected(e, rowMetaData)}
        />
      );
    } else if (rowMetaData.rowFormat === 'selectInputPair') {
      const ItemSelected = (value, key, subKey, index) => {
        const formData = form.current;
        const formEntry = formData[key];
        const formItem = formEntry[index];

        if (!formItem) {
          return null;
        }

        formItem[subKey] = value;
        return null;
      };

      rowItems = (
        <SelectInputPairElement
          id={property.$id}
          dataList={property.examples}
          description={property.description}
          keyProp={property.$id}
          selected={property.default}
          title={property.title}
          itemSelectedHandler={ItemSelected}
          itemSelectedHandlerData={{
            key: rowMetaData.key,
            subKey: property.title,
            index: rowMetaData.index,
          }}
        />
      );
    } else {
      rowItems = (
        <InputElement
          title={property.title}
          type={
            ['integer', 'number'].includes(property.type) ? 'number' : 'text'
          }
          step="any"
          keyProp={property.$id}
          description={property.description}
          id={`${property.title}${
            property.format === 'data-list' ? '-datalist' : ''
          }`}
          name={property.title}
          dataFormat={property.format}
          defaultValue={rowMetaData.defaultValue}
          placeholder={property.description}
          required={schema?.current?.required.includes(property.title) || false}
          examples={property.examples}
          hasDataList={property.format === 'data-list'}
          onInput={(e) => onInput(e, rowMetaData)}
        />
      );
    }

    return (
      <div className="" key={property.$id}>
        {rowItems}
      </div>
    );
  };

  /**
   * Loads of schema with user data, used for populating the app with user data from a file
   *
   * @param {object} schemaContent  Part of schema needed for displaying data
   * @param {*} formData user data
   * @returns schema loaded with user data
   */
  const syncSchemaWithFormDaata = (schemaContent, formData) => {
    const schemaData = structuredClone(schemaContent);

    schemaData.forEach((schemaEntry) => {
      const { title, type, properties } = schemaEntry;

      if (schemaValueTypes.includes(type)) {
        schemaEntry.default = formData[title];
      } else if (type === 'object') {
        const propertyKeys = Object.keys(properties);

        propertyKeys.forEach((subTitle) => {
          schemaEntry.properties[subTitle].default = formData[title][subTitle];
        });
      } else {
        schemaEntry.dataItems = [];
        formData[title].forEach((formEntry) => {
          const formEntryKeys = Object.keys(formEntry);
          const items = structuredClone(schemaEntry.items);
          schemaEntry.dataItems = [];

          formEntryKeys.forEach((key) => {
            items.properties[key].default = formEntry[key];
          });
          schemaEntry.dataItems.push(items);
        });
      }
    });

    return schemaData;
  };

  useEffect(() => {
    ipcRenderer.sendMessage('asynchronous-message', 'async ping');
  }, []);

  useEffect(() => {
    // schema has been recieved and it is time to use it to create the DOM and initialize form data
    ipcRenderer.on(ASYNC_TOPICS.jsonFileRead, (data) => {
      const schemaData = JSON.parse(data);
      schema.current = JSON.parse(data);
      const schemaContent = [...Object.values(schemaData.properties)];

      schemaContent.forEach((schemaItem) => {
        if (schemaItem.type === 'array') {
          schemaItem.dataItems = [];
        }
      });

      setSchemaFormData(schemaContent);
      initializeFormData(schemaContent);
    });
  }, []);

  useEffect(() => {
    // user yml file has been recieved and it is time to use it to populate the app
    // schema is the same as read prior, so no need to get schema again
    ipcRenderer.on(ASYNC_TOPICS.templateFileRead, (jsonFileContent) => {
      const JSONschema = schema.current;
      const validation = validateJSON(jsonFileContent, JSONschema);
      const { isValid, message } = validation;

      if (!isValid) {
        // eslint-disable-next-line no-alert
        window.alert(
          `There were validation errors: ${(message.join || [])('')}`
        );
        return null;
      }

      form.current = jsonFileContent;
      const schemaContent = syncSchemaWithFormDaata(
        [...Object.values(schema.current.properties)],
        jsonFileContent
      );

      setSchemaFormData(schemaContent);
      return null;
    });
  }, []);

  return (
    <>
      <h2 className="header-text">
        YAML Data &nbsp;
        <button
          type="button"
          className="upload-file-text"
          onClick={(e) => uploadFile(e, ipcRenderer)}
        >
          Upload file
        </button>
      </h2>
      <form
        encType="multipart/form-data"
        className="form-control"
        name="nwbData"
        onSubmit={(e) => {
          createYMLFile(e);
        }}
      >
        {schemaFormData?.map((property) => {
          const { title, type } = property;
          const defaultValue = form.current[title] || '';

          if (schemaValueTypes.includes(type)) {
            return formRow(property, {
              type,
              valueType: type,
              title,
              defaultValue,
              cameraIds: cameraIds.current,
              inSyncItemId:
                property.format === 'file-upload'
                  ? property.$id.replace('#', '').replace('/', '')
                  : null,
            });
          }

          if (type === 'object') {
            return (
              <fieldset
                className="form-control"
                name={property.title}
                key={property.$id}
              >
                <legend>{property.title?.replaceAll('_', ' ')} &nbsp; </legend>
                {Object.keys(property?.properties)?.map((subItemKey) => {
                  const item = property.properties[subItemKey];
                  return formRow(item, {
                    type,
                    valueType: item.type,
                    title: subItemKey,
                    defaultValue: item.default,
                    key: title,
                    cameraIds: cameraIds.current,
                  });
                })}
              </fieldset>
            );
          }

          if (type === 'array') {
            const formData = form.current;
            const addOrUpdateItem = (propertyObject) => {
              const schemaItems = structuredClone(schemaFormData);
              const schemaItem = schemaItems.find(
                (s) => s.title === propertyObject.title
              );
              const propertyObjectItems = propertyObject.items;
              const idValue =
                schemaItem?.dataItems?.length > 0
                  ? Math.max(
                      ...Object.values(schemaItem?.dataItems).map(
                        (i) => i.properties?.id?.default || 0
                      )
                    ) + 1
                  : 0;

              // ensure id does not duplicate
              if (propertyObjectItems?.properties?.id) {
                propertyObjectItems.properties.id.default = idValue;
              }
              const dataItemsLength = schemaItem.dataItems.length;
              propertyObjectItems.properties.key = `${propertyObject.$id}-${dataItemsLength}-${idValue}`;
              schemaItem.dataItems.push(propertyObjectItems);

              const items = Object.values(propertyObject.items.properties);
              const formContent = {};

              items.forEach((item) => {
                formContent[item.title] = item.default;
              });
              formData[propertyObject.title]?.push(formContent);
              form.current = formData;
              setSchemaFormData(schemaItems);
            };

            const removeItem = (propertyObject) => {
              // remove item in UI
              const schemaData = structuredClone(schemaFormData);
              const schemaItem = schemaData.find(
                (item) => item.title === propertyObject.title
              );
              const dataItemsLength = schemaItem?.dataItems?.length || 0;

              if (isObjectEmpty(schemaItem) || dataItemsLength === 0) {
                return;
              }

              const formDataToUpdate = form.current;
              formDataToUpdate[propertyObject.title].pop();

              // schemaItem.dataItems.splice(itemsIndex, 1);
              schemaItem.dataItems.pop();
              setSchemaFormData(schemaData);
            };

            const getNTrode = (electrodeGroupId) => {
              const nTrodes = structuredClone(
                schemaFormData?.find(
                  (s) => s.$id === '#root/ntrode_electrode_group_channel_map'
                )
              )?.dataItems.filter(
                (n) => n.electrode_group_id.default === electrodeGroupId
              );

              return nTrodes;
            };

            if (property.$id === '#root/ntrode_electrode_group_channel_map') {
              return null;
            }

            return (
              <fieldset
                className="form-control"
                name={property.title}
                key={property.$id}
              >
                <legend>{property.title?.replaceAll('_', ' ')} &nbsp; </legend>
                <div>
                  <div className="form-control">
                    {property?.dataItems?.map((items, itemsIndex) => {
                      const properties = Object.values(items.properties);

                      return (
                        <fieldset
                          className="form-control"
                          name={property.title}
                        >
                          <legend>{`Item #${itemsIndex + 1}`}</legend>
                          {properties.map((p) => {
                            return formRow(p, {
                              type,
                              valueType: p.type,
                              title: property.title,
                              defaultValue: p.default,
                              key: p.title,
                              index: itemsIndex,
                              rowFormat: p.format,
                              $id: p.title,
                              cameraIds: cameraIds.current,
                              addInitialItem: addOrUpdateItem,
                              parentProperty: property,
                              currentIndex: itemsIndex,
                            });
                          })}
                          {property.$id === '#root/electrode_groups'
                            ? getNTrode(items.properties.id.default)?.map(
                                (nTrode) => {
                                  const nTrodeProperties =
                                    Object.values(nTrode);
                                  const nTrodeItems = nTrodeProperties.map(
                                    (nTrodeProperty) => {
                                      return formRow(nTrodeProperty, {
                                        valueType: nTrodeProperty.type,
                                        type: nTrodeProperty.Items,
                                        title: nTrodeProperty.title,
                                        defaultValue: nTrodeProperty.default,
                                        key: nTrodeProperty.title,
                                        rowFormat: nTrodeProperty.format,
                                        $id: nTrodeProperty.$id,
                                        cameraIds: cameraIds.current,
                                        electrodeGroupId:
                                          items.properties.id.default,
                                      });
                                    }
                                  );

                                  return (
                                    <fieldset
                                      className="form-control"
                                      name={property.title}
                                      key={property.$id}
                                    >
                                      <legend>{`Item #${
                                        itemsIndex + 1
                                      }`}</legend>
                                      {nTrodeItems}
                                    </fieldset>
                                  );
                                }
                              )
                            : null}
                        </fieldset>
                      );
                    })}
                  </div>
                </div>
                <div className="center-align">
                  <button
                    type="button"
                    onClick={() => addOrUpdateItem(structuredClone(property))}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(property)}
                    className={property?.dataItems.length === 0 ? 'hide' : ''}
                  >
                    Remove
                  </button>
                </div>
              </fieldset>
            );
          }
          return null;
        })}
        <div className="submit-button-parent">
          <input type="submit" value="Create YML" className="submit-button" />
        </div>
      </form>
    </>
  );
}

export default YMLGenerator;
