import React, { useState } from 'react';

const Ajv = require('ajv');

let schema;

export function ValidationForm() {
  const [formData, setFormData] = useState([]);
  const arrayValuesData = {};

  // Async message handler
  window.electron.ipcRenderer.on('asynchronous-reply', (data) => {
    schema = JSON.parse(data);
    setFormData(Object.values(schema.properties));
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
    const jsonData = {};

    schema.properties?.forEach((property) => {
      const { title } = property;
      jsonData[title.toLowerCase()] = e.target[title].value?.trim();
    });

    const validationMessages = JsonValidationMessages(jsonData);
    const message =
      validationMessages && validationMessages?.length !== 0
        ? `Data is not valid - \n ${validationMessages.join('\n \n')}`
        : 'Data is valid';

    window.alert(message); // eslint-disable-line no-alert

    if (!validationMessages || validationMessages.length === 0) {
      window.electron.ipcRenderer.sendMessage('SAVE_USER_DATA', jsonData);
    }
  };

  const addDataItem = (e, title, dataItem, formDataSet) => {
    const properties = dataItem.property;
    const titleObject = formDataSet.find((d) => d.title === title) || {};
    titleObject.DataItems = titleObject.DataItems || {};
    titleObject.DataItems.properties = titleObject.DataItems.properties || [];
    titleObject.DataItems.properties = titleObject?.DataItems.properties.concat(
      Object.values(properties)
    );
    setFormData(formDataSet);
  };

  return (
    <form
      onSubmit={(e) => {
        handleSubmit(e);
      }}
    >
      {formData?.map((property) => {
        if (['string', 'number'].includes(property.type)) {
          return (
            <>
              <label htmlFor={property.title}>
                <span>{property.title.replaceAll('_', ' ')}: &nbsp; </span>
                <input
                  type={property.type === 'string' ? 'text' : 'number'}
                  id={property.title}
                  name={property.title}
                  value={property?.examples[0]}
                  required1
                />
              </label>
              <br />
              <br />
            </>
          );
        }
        if (property.type === 'object') {
          return (
            <>
              <fieldset>
                <legend>{property.title.replaceAll('_', ' ')}: &nbsp; </legend>
                {Object.values(property?.properties)?.map((p) => {
                  return (
                    <>
                      <label htmlFor={p?.title}>
                        <span>{p.title?.replaceAll('_', ' ')}: &nbsp; </span>
                        <input
                          type="text"
                          id={p?.title}
                          name={p?.title}
                          required1
                        />
                      </label>
                      <br />
                      <br />
                    </>
                  );
                })}
              </fieldset>
              <br />
            </>
          );
        }
        if (property.type === 'array') {
          const { title } = property;
          return (
            <>
              <fieldset>
                <legend>{property.title.replaceAll('_', ' ')}: &nbsp; </legend>
                {property?.DataItems?.properties?.map((p) => {
                  return (
                    <>
                      <label htmlFor={p?.title}>
                        <span>{p.title?.replaceAll('_', ' ')}: &nbsp; </span>
                        <input
                          type="text"
                          id={p?.title}
                          name={p?.title}
                          required1
                        />
                      </label>
                      <br />
                      <br />
                    </>
                  );
                })}
                <button
                  type="button"
                  onClick={(e) =>
                    addDataItem(
                      e,
                      title,
                      {
                        property: property.items.properties,
                        required: property.items.required,
                      },
                      [...formData]
                    )
                  }
                >
                  Add
                </button>
              </fieldset>
              <br />
              <br />
            </>
          );
        }
      })}
      <br />
      <input type="submit" value="Submit" />
    </form>
  );
}

export default ValidationForm;
