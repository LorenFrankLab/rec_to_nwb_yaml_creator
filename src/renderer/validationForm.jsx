import React, { useState } from 'react';

const Ajv = require('ajv');

let schema;

export function ValidationForm() {
  const [formData, setFormData] = useState([]);

  // Async message handler
  window.electron.ipcRenderer.on('asynchronous-reply', (data) => {
    schema = JSON.parse(data);
    const schemaData = JSON.parse(data);
    setFormData([...Object.values(schemaData.properties)]);
  });

  // Async message sender
  if (!schema) {
    window.electron.ipcRenderer.sendMessage(
      'asynchronous-message',
      'async ping'
    );
  }

  const JsonValidationMessages = (jsonData) => {
    if (!jsonData) {
      return false;
    }

    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    validate(jsonData);
    const validationMesssages = validate.errors?.map((error) => {
      return `Key: ${error.instancePath.replaceAll('/', '')} \n Error: ${
        error.message
      }`;
    });

    return validationMesssages;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { target } = e;
    const jsonData = {}; // formData not used because it is not good with nested data

    // all key value pairs not part of a collection or an object with sub key-value pairs
    const items = target.querySelectorAll('.js-parent-container-item input');

    items.forEach((item) => {
      const value = item.value?.trim();
      jsonData[item.name?.toLowerCase() || 'unknown'] =
        item.type === 'number' ? Number(value) : value;
    });

    // objectsinteger
    const objectItems = target.querySelectorAll('.js-parent-container-object');

    objectItems.forEach((objectItem) => {
      jsonData[objectItem.name?.toLowerCase()] = {};

      objectItem.querySelectorAll('input').forEach((item) => {
        const value = item.value?.trim();
        jsonData[objectItem.name?.toLowerCase()][item.name?.toLowerCase()] =
          item.type === 'number' ? Number(value) : value;
      });
    });

    // collections
    const collections = target.querySelectorAll('.js-parent-container-array');

    collections.forEach((collection) => {
      jsonData[collection.name?.toLowerCase()] = [];

      const collectionItems = collection.querySelectorAll(
        '.js-parent-container-array-item'
      );

      collectionItems.forEach((collectionItem) => {
        const dataItems = collectionItem.querySelectorAll('input');

        const item = {};
        dataItems.forEach((dataItem) => {
          const value = dataItem.value?.trim();
          item[dataItem.name?.toLowerCase()] =
            dataItem.type === 'number' ? Number(value) : value;
        });
        jsonData[collection.name?.toLowerCase()].push(item);
      });
    });

    const validationMessages = JsonValidationMessages(jsonData);
    const message =
      validationMessages && validationMessages?.length !== 0
        ? `Data is not valid - \n ${validationMessages.join('\n \n')}`
        : 'Data is valid';

    if (!validationMessages || validationMessages.length === 0) {
      console.log(message);
      window.electron.ipcRenderer.sendMessage('SAVE_USER_DATA', jsonData);
    } else {
      console.error(message);
      window.alert(message); // eslint-disable-line no-alert
    }
  };

  const addDataItem = (e, title, dataItem, formDataSet) => {
    const properties = dataItem.property;
    const titleObject = formDataSet.find((d) => d.title === title) || {};
    titleObject.DataItems = titleObject.DataItems || {};
    titleObject.DataItems.properties = titleObject.DataItems.properties || [];
    titleObject.DataItems.properties.push(Object.values(properties));
    setFormData(formDataSet);
  };

  const removeLastDataItem = (e, title, formDataSet) => {
    const titleObject = formDataSet.find((d) => d.title === title) || {};

    if (
      !titleObject.DataItems ||
      !titleObject.DataItems.properties ||
      titleObject.DataItems.properties.length === 0
    ) {
      return;
    }

    titleObject.DataItems.properties.pop();
    setFormData(formDataSet);
  };

  return (
    <form
      encType="multipart/form-data"
      className="form-control"
      name="nwbData"
      onSubmit={(e) => {
        handleSubmit(e);
      }}
    >
      {formData?.map((property) => {
        const parentProperyTitle = property.title.toLowerCase();
        if (['string', 'number'].includes(property.type)) {
          if (property.examples && property.examples.length <= 1) {
            return (
              <React.Fragment key={property.id}>
                <label
                  htmlFor={property.title}
                  className="js-parent-container-item"
                >
                  <span>{property.title.replaceAll('_', ' ')}: &nbsp; </span>
                  <input
                    type={
                      ['integer', 'number'].includes(property.type)
                        ? 'number'
                        : 'text'
                    }
                    id={property.title}
                    name={property.title}
                    defaultValue={property?.examples[0]}
                    required={schema.required?.includes(parentProperyTitle)}
                  />
                </label>
                <br />
                <br />
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={property.id}>
              <label
                htmlFor={property.title}
                className="js-parent-container-item"
              >
                <span>{property.title.replaceAll('_', ' ')}: &nbsp; </span>
                <input
                  className=""
                  list="datalistOptions"
                  id="exampleDataList"
                  name={property.title}
                  placeholder={`Type to search for ${property.title} ...`}
                />
                <datalist id="datalistOptions">
                  {property.examples.map((example) => (
                    <option value={example}>{example}</option>
                  ))}
                </datalist>
              </label>
              <br />
              <br />
            </React.Fragment>
          );
        }
        if (property.type === 'object') {
          return (
            <React.Fragment key={property.id}>
              <fieldset
                className="js-parent-container-object form-control"
                name={property.title}
              >
                <legend>{property.title.replaceAll('_', ' ')}: &nbsp; </legend>
                {Object.values(property?.properties)?.map((p) => {
                  if (p.examples && p.examples.length > 1) {
                    const options = p.examples;
                    return (
                      <React.Fragment key={p.key}>
                        <label htmlFor={p?.title}>
                          <span>{p.title?.replaceAll('_', ' ')}: &nbsp; </span>
                          <input
                            className=""
                            list="datalistOptions2"
                            id="exampleDataList2"
                            name={p.title}
                            placeholder={`Type to search for ${p.title} ...`}
                            required={property?.required?.includes(
                              p.title.toLowerCase()
                            )}
                          />
                          <datalist id="datalistOptions2">
                            {options.map((example) => (
                              <option value={example}>{example}</option>
                            ))}
                          </datalist>
                        </label>
                        <br />
                        <br />
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={p.key}>
                      <label htmlFor={p?.title}>
                        <span>{p.title?.replaceAll('_', ' ')}: &nbsp; </span>
                        <input
                          type={
                            ['integer', 'number'].includes(p.type)
                              ? 'number'
                              : 'text'
                          }
                          id={p?.title}
                          name={p?.title}
                          required={property?.required?.includes(
                            p.title.toLowerCase()
                          )}
                        />
                      </label>
                      <br />
                      <br />
                    </React.Fragment>
                  );
                })}
              </fieldset>
              <br />
            </React.Fragment>
          );
        }
        if (property.type === 'array') {
          const { title } = property;
          return (
            <React.Fragment key={property.key}>
              <fieldset
                className="js-parent-container-array form-control"
                name={property.title}
              >
                <legend>{property.title.replaceAll('_', ' ')}: &nbsp; </legend>
                {property?.DataItems?.properties?.map((py, pyIndex) => {
                  return (
                    <>
                      <fieldset
                        className="js-parent-container-array-item form-control"
                        key={property.key}
                      >
                        {' '}
                        <legend>Item #{pyIndex + 1}</legend>
                        {py.map((p) => {
                          return (
                            <React.Fragment key={`${property.key}-${p.title}`}>
                              <label htmlFor={p?.title}>
                                <span>
                                  {p.title?.replaceAll('_', ' ')}: &nbsp;{' '}
                                </span>
                                <input
                                  type={
                                    ['integer', 'number'].includes(p.type)
                                      ? 'number'
                                      : 'text'
                                  }
                                  id={p?.title}
                                  name={p?.title}
                                  required1
                                />
                              </label>
                              <br />
                              <br />
                            </React.Fragment>
                          );
                        })}
                      </fieldset>
                      <br />
                    </>
                  );
                })}
                <div>
                  <button
                    type="button"
                    onClick={(e) =>
                      addDataItem(
                        e,
                        title,
                        {
                          property: property.items.properties,
                          required: property.items.required1,
                        },
                        [...formData]
                      )
                    }
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={(e) => removeLastDataItem(e, title, [...formData])}
                    className={
                      property?.DataItems?.properties.length > 0 ? '' : 'hide'
                    }
                  >
                    Remove
                  </button>
                </div>
              </fieldset>
              <br />
              <br />
            </React.Fragment>
          );
        }
        return <></>;
      })}
      <br />
      <div className="submit-button-parent">
        <input type="submit" value="Submit" className="submit-button" />
      </div>
    </form>
  );
}

export default ValidationForm;
