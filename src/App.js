import React, { useState, useRef, useEffect } from 'react';
import YAML from 'yaml';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import logo from './logo.png';
import packageJson from '../package.json';
import JsonSchemaFile from './nwb_schema.json'
import './App.scss';
import addFormats from 'ajv-formats';
import InputElement from './element/InputElement';
import SelectElement from './element/SelectElement';
import SelectElementHybrid from './element/SelectElementHybrid';
import DataListElement from './element/DataListElement';
import {
  deviceTypeMap,
  getShankCount,
} from './ntrode/deviceTypes';
import ChannelMap from './ntrode/ChannelMap';
import SelectInputPairElement from './element/SelectInputPairElement';
import ArrayUpdateMenu from './ArrayUpdateMenu';
import CheckboxList from './element/CheckboxList';
import RadioList from './element/RadioList';
import ListElement from './element/ListElement';
import ArrayItemControl from './element/ArrayItemControl';
import {
  commaSeparatedStringToNumber,
  formatCommaSeparatedString,
  sanitizeTitle,
  titleCase,
  showCustomValidityError,
  stringToInteger,
  isProduction,
  useMount,
} from './utils';
import {
  labs,
  genderAcronym,
  locations,
  deviceTypes,
  units,
  species,
  genotypes,
  behavioralEventsNames,
  behavioralEventsDescription,
  emptyFormData,
  defaultYMLValues,
  arrayDefaultValues,
  dataAcqDeviceName,
  dataAcqDeviceSystem,
  dataAcqDeviceAmplifier,
  dataAcqDeviceADCCircuit,
  cameraManufacturers,
  optoExcitationModelNames,
  opticalFiberModelNames,
  virusNames,
} from './valueList';

const Ajv = require('ajv');

export function App() {
  const [formData, setFormData] = useState(defaultYMLValues);

  const [cameraIdsDefined, setCameraIdsDefined] = useState([]);

  const [taskEpochsDefined, setTaskEpochsDefined] = useState([]);

  const [appVersion, setAppVersion] = useState('');

  /**
   * Stores JSON schema
   */
  const schema = useRef({});

  /**
   * Initiates importing an existing YAML file
   *
   * @param {object} e Event object
   */
    const importFile = (e) => {
      e.preventDefault();
      setFormData(structuredClone(emptyFormData)); // clear out form
      const file = e.target.files[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.readAsText(e.target.files[0], 'UTF-8');
      reader.onload = (evt) => {
        const jsonFileContent = YAML.parse(evt.target.result);
        const JSONschema = schema.current;
        const validation = jsonschemaValidation(jsonFileContent, JSONschema);
        const {
              isValid,
              jsonSchemaErrorMessages,
              jsonSchemaErrors,
              jsonSchemaErrorIds,
            } = validation;
          const { isFormValid, formErrorMessages, formErrors, formErrorIds } =
              rulesValidation(jsonFileContent);

            if (isValid && isFormValid) {
              // ensure relevant keys exist
              Object.keys(emptyFormData).forEach((key) => {
                if (!Object.hasOwn(jsonFileContent, key)) {
                  jsonFileContent[key] = emptyFormData[key];
                }
              });

              setFormData(structuredClone(jsonFileContent));
              return null;
            }

            const allErrorIds = [...jsonSchemaErrorIds, ...formErrorIds];
            const formContent = structuredClone(emptyFormData);
            const formContentKeys = Object.keys(formContent);

            formContentKeys.forEach((key) => {
              if (
                !allErrorIds.includes(key) &&
                Object.hasOwn(jsonFileContent, key) &&
                (typeof formContent[key]) === (typeof jsonFileContent[key])
              ) {
                formContent[key] = structuredClone(
                  jsonFileContent[key]
                );
              }
            });

            // sex needs to be populated
            if (!formContent.subject) {
              formContent.subject = structuredClone(emptyFormData.subject);
            }

            const genders = genderAcronym();
            if (!genders.includes(formContent.subject.sex)) {
              formContent.subject.sex = 'U';
            }

            const allErrorMessages = [
              ...new Set([...formErrorMessages, ...jsonSchemaErrorMessages]),
            ];

            if (allErrorMessages.length > 0) {
              // eslint-disable-next-line no-alert
              window.alert(`Entries Excluded\n\n${allErrorMessages.join('\n')}`);
            }


          setFormData(structuredClone(formContent));
      };
    };

    /**
   * Wrapper for updating internal representation of form on the page. This only works on single item
   *
   * @param {string} name input form name
   * @param {string} value input form value
   * @param {string} key key for identifying object to update
   * @param {integer} index index for identifying position to update
   */
    const updateFormData = (name, value, key, index) => {
      const form = structuredClone(formData);
      if (key === undefined) {
        form[name] = value; // key value pair
      } else if (index === undefined) {
        form[key][name] = value; // object (as defined in json schema)
      } else {
        form[key][index] = form[key][index] || {};
        form[key][index][name] = value; // array (as defined in json schema)
      }
      setFormData(form);
    };

  /**
   * Wrapper for updating internal representation of form on the page. This is meant for updating a collection
   *
   * @param {string} name input form name
   * @param {string} value input form value
   * @param {string} key key for identifying object to update
   * @param {integer} index index for identifying position to update
   * @param {boolean} checked whether or not field is checked
   * @returns null
   */
  const updateFormArray = (name, value, key, index, checked = true) => {
    if (!name || !key) {
      return null;
    }

    const form = structuredClone(formData);

    form[key][index] = form[key][index] || {};
    form[key][index][name] = form[key][index][name] || [];
    if (checked) {
      form[key][index][name].push(value);
    } else {
      form[key][index][name] = form[key][index][name].filter(
        (v) => v !== value
      );
    }

    form[key][index][name] = [...new Set(form[key][index][name])];
    form[key][index][name].sort();

    setFormData(form);
    return null;
  };

  /**
   * Updates a form field as use leaves element
   *
   * @param {object} e Event object
   * @param {object} metaData Supporting data
   */
  const onBlur = (e, metaData) => {
    const { target } = e;
    const { name, value, type } = target;
    const {
      key,
      index,
      isCommaSeparatedStringToNumber,
      isCommaSeparatedString,
    } = metaData || {};
    let inputValue = '';

    if (isCommaSeparatedString) {
      inputValue = formatCommaSeparatedString(value);
    } else if (isCommaSeparatedStringToNumber) {
      inputValue = commaSeparatedStringToNumber(value);
    } else {
      inputValue = type === 'number' ? parseFloat(value, 10) : value;
    }

    updateFormData(name, inputValue, key, index);
  };

  /**
   * Used by ntrode to map shank to value
   *
   * @param {object} e Event object
   * @param {object} metaData Supporting Data
   * @returns null
   */
  const onMapInput = (e, metaData) => {
    const { key, index, shankNumber, electrodeGroupId, emptyOption } = metaData;
    const { target } = e;
    let { value } = target;

    if ([emptyOption, -1, ''].includes(value?.trim())) {
      value = -1;
    }

    const form = structuredClone(formData);
    const nTrodes = form[key].filter(
      (item) => item.electrode_group_id === electrodeGroupId
    );

    if (nTrodes.length === 0) {
      return null;
    }

    nTrodes[shankNumber].map[index] = stringToInteger(value);
    setFormData(form);
    return null;
  };

  /**
   * Updates an item after selection.
   *
   * @param {object} e Event object
   * @param {object} metaData Supporting Data
   */
  const itemSelected = (e, metaData) => {
    const { target } = e;
    const { name, value } = target;
    const { key, index, type } = metaData || {};
    const inputValue = type === 'number' ? parseInt(value, 10) : value;

    updateFormData(name, inputValue, key, index);
  };


/**
   * Controls selection of ntrode
   *
   * @param {object} e Event object
   * @param {object} metaData Supporting Data
   * @returns null
   */
const nTrodeMapSelected = (e, metaData) => {
  const form = structuredClone(formData);
  const { value } = e.target;
  const { key, index } = metaData;
  const electrodeGroupId = form.electrode_groups[index].id;
  const deviceTypeValues = deviceTypeMap(value);
  const shankCount = getShankCount(value);
  const map = {};

  form[key][index].device_type = value;

  // set map with default values
  deviceTypeValues.forEach(
    (deviceTypeValue) => {
      map[deviceTypeValue] = deviceTypeValue;
    }
  );

  const nTrodes = [];

  // set nTrodes data except for bad_channel as the default suffices for now
  for (let nIndex = 0; nIndex < shankCount; nIndex += 1) {
    const nTrodeBase = structuredClone(
      arrayDefaultValues.ntrode_electrode_group_channel_map
    );

    const nTrodeMap = { ...map };
    const nTrodeMapKeys = Object.keys(nTrodeMap).map((k) => parseInt(k, 10));
    const nTrodeMapLength = nTrodeMapKeys.length;

    nTrodeMapKeys.forEach((nKey) => {
      nTrodeMap[nKey] += nTrodeMapLength * nIndex;
    });

    nTrodeBase.electrode_group_id = electrodeGroupId;
    nTrodeBase.map = nTrodeMap;

    nTrodes.push(nTrodeBase);
  }

  const nTrodeMapFormData = form?.ntrode_electrode_group_channel_map?.filter(
    (n) => n.electrode_group_id !== electrodeGroupId
  );

  form.ntrode_electrode_group_channel_map =
    structuredClone(nTrodeMapFormData);

  nTrodes.forEach((n) => {
    form?.ntrode_electrode_group_channel_map?.push(n);
  });

  // ntrode_id should be in increments of 1 starting at 1. This code resets
  // ntrode_id if necessary to ensure this this.
  //
  // sorted by electrode_group so the UI is sorted by electrode_group and ntrode is displayed under electrode_group
  form?.ntrode_electrode_group_channel_map
    // ?.sort((a, b) => (a.electrode_group_id > b.electrode_group_id ? 1 : -1))
    ?.forEach((n, nIndex) => {
      n.ntrode_id = nIndex + 1;
    });

  setFormData(form);

  return null;
};

/**
 * addArrayItem
 *
 * @param {string} key key
 * @param {inter} count count
 */
const addArrayItem = (key, count = 1) => {
  const form = structuredClone(formData);
  const arrayDefaultValue = arrayDefaultValues[key];
  const items = Array(count).fill({ ...arrayDefaultValue });
  const formItems = form[key];
  const idValues = formItems
    .map((formItem) => formItem.id)
    .filter((formItem) => formItem !== undefined);
  // -1 means no id field, else there it exist and get max
  let maxId = -1;

  if (arrayDefaultValue?.id !== undefined) {
    maxId = idValues.length > 0 ? Math.max(...idValues) + 1 : 0;
  }

  items.forEach((item) => {
    const selectedItem = { ...item }; // best never to directly alter iterator

    // if id exist, increment to avoid duplicates
    if (maxId !== -1) {
      maxId += 1;
      selectedItem.id = maxId - 1; // -1 makes this start from 0
    }

    formItems.push(selectedItem);
  });

  setFormData(form);
};

const removeArrayItem = (index, key) => {
  // eslint-disable-next-line no-restricted-globals
  if (window.confirm(`Remove index ${index} from ${key}?`)) {
    const form = structuredClone(formData);
    const items = structuredClone(form[key]);

    if (!items || items.length === 0) {
      return null;
    }

    items.splice(index, 1);
    form[key] = items
    setFormData(form);
  }
};

const removeElectrodeGroupItem = (index, key) => {
  if (window.confirm(`Remove index ${index} from ${key}?`)) {
    const form = structuredClone(formData);
    const items = structuredClone(form[key]);

    if (!items || items.length === 0) {
      return null;
    }

    const item = structuredClone(items[index]);

    if (!item) {
      return null;
    }

    // remove ntrode related to electrode_groups
    form.ntrode_electrode_group_channel_map =
      form.ntrode_electrode_group_channel_map.filter(
        (nTrode) => nTrode.electrode_group_id !== item.id
      );

    // remove electrode_groups item
    items.splice(index, 1);
    form[key] = items
    setFormData(form);
  }
};

/**
 * Converts an object to YAML
 *
 * @param {object} content
 * @returns YAML as a string
 */
const convertObjectToYAMLString = (content) => {
  const doc = new YAML.Document();
  doc.contents = content || {};

  return doc.toString();
};

const createYAMLFile = (fileName, content) => {
  var textFileAsBlob = new Blob([content], {type: 'text/plain'});
  const downloadLink = document.createElement("a");
  downloadLink.download = fileName;
  downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
  downloadLink.click();
};

/**
 * Displays an error message to the user if Ajv fails validation
 *
 * @param {object} error Ajv's error object
 * @returns
 */
const showErrorMessage = (error) => {
  const { message, instancePath } = error;
  const idComponents = error.instancePath.split('/').filter((e) => e !== '');
  let id = '';

  if (idComponents.length === 1) {
    // eslint-disable-next-line prefer-destructuring
    id = idComponents[0];
  } else if (idComponents.length === 2) {
    id = `${idComponents[0]}-${idComponents[1]}`;
  } else {
    id = `${idComponents[0]}-${idComponents[2]}-${idComponents[1]}`;
  }

  const element = document.querySelector(`#${id}`);
  const sanitizeMessage = (validateMessage) => {
    if (validateMessage === 'must match pattern "^.+$"') {
      return `${id} cannot be empty nor all whitespace`;
    }
    return validateMessage;
  };

  const userFriendlyMessage = sanitizeMessage(message);

  // setCustomValidity is only supported on input tags
  if (element?.tagName === 'INPUT') {
    showCustomValidityError(element, userFriendlyMessage);
    return;
  }

  if (element?.focus) {
    element.focus();
  }

  // If here, element not found or cannot show validation message with
  // setCustomValidity/reportValidity; so show a pop-up message
  const itemName = titleCase(
    instancePath.replaceAll('/', ' ').replaceAll('_', ' ')
  );

  let errorMessage = userFriendlyMessage;

  if (instancePath === '/subject/date_of_birth') {
    errorMessage = 'Date of birth needs to comply with ISO 8061 format (https://en.wikipedia.org/wiki/ISO_8601)';
  }

  // eslint-disable-next-line no-alert
  window.alert(`${itemName} - ${errorMessage}`);
};

/**
 * Display HTML custom validity errors on input tags
 * @param {string} id id of input tag
 * @param {string} message error-text to pop up
 * @returns null
 */
const displayErrorOnUI = (id, message) => {
  const element = document.querySelector(`#${id}`);

  if (element?.focus) {
    element.focus();
  }

  // setCustomValidity is only supported on input tags
  if (element?.tagName === 'INPUT') {
    showCustomValidityError(element, message);
    return;
  }

  // eslint-disable-next-line no-alert
  window.alert(message);
};

/**
 * Validates form data based on YAML JSON schema rules
 *
 * @param {object} formContent Form object
 * @returns Validation information
 */
const jsonschemaValidation = (formContent) => {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema.current);

  validate(formContent);

  const validationMessages =
    validate.errors?.map((error) => {
      return `Key: ${error.instancePath
        .split('/')
        .filter((x) => x !== '')
        .join(', ')}. | Error: ${error.message}`;
    }) || [];

  const errorIds = [
    ...new Set(
      validate.errors?.map((v) => {
        const validationEntries = v.instancePath
          .split('/')
          .filter((x) => x !== '');

        return validationEntries[0];
      })
    ),
  ];

  const isValid = validate.errors === null;

  const message = isValid
    ? 'Data is valid'
    : `Data is not valid - \n ${validationMessages.join('\n \n')}`;

  return {
    isValid,
    jsonSchemaErrorMessages: validationMessages,
    jsonSchemaErrors: validate.errors,
    jsonSchemaErrorIds: errorIds,
  };
};

/**
 * Validates rules based on rules internal to this file. These rules are not easy to encode in JSON schema
 *
 * @param {object} jsonFileContent form data
 * @returns Validation information
 */
const rulesValidation = (jsonFileContent) => {
  const errorIds = [];
  const errorMessages = [];
  let isFormValid = true;
  const errors = [];

  // check if tasks have a camera but no camera is set
  if (!jsonFileContent.cameras && jsonFileContent.tasks?.length > 0) {
    errorMessages.push(
      'Key: task.camera | Error: There is tasks camera_id, but no camera object with ids. No data is loaded'
    );
    errorIds.push('tasks');
    isFormValid = false;
  }

  // check if associated_video_files have a camera but no camera is set
  if (
    !jsonFileContent.cameras &&
    jsonFileContent.associated_video_files?.length > 0
  ) {
    errorMessages.push(
      `Key: associated_video_files.camera_id. | Error: There is associated_video_files camera_id, but no camera object with ids. No data is loaded`
    );
    errorIds.push('associated_video_files');
    isFormValid = false;
  }

  return {
    isFormValid,
    formErrorMessages: errorMessages,
    formErrors: errorMessages,
    formErrorIds: errorIds,
  };
};

/**
 * Open all Detail elements
 */
const openDetailsElement = () => {
  const details = document.querySelectorAll('details');

  details.forEach((detail) => {
    detail.open = true;
  });
}

/**
 * submit form. This is this way as there is no official beforeSubmit method
 *
 * @param {object} e Javascript object
 */
const submitForm = (e) => {
  openDetailsElement();
  document.querySelector('form').requestSubmit();
}

/**
 * Create the YML file
 *
 * @param {object} e event parameter
 */
const generateYMLFile = (e) => {
  e.preventDefault();
  const form = structuredClone(formData);
  const validation = jsonschemaValidation(form);
  const { isValid, jsonSchemaErrors } = validation;
  const { isFormValid, formErrors } = rulesValidation(form);

  if (isValid && isFormValid) {
    const yAMLForm = convertObjectToYAMLString(form);
    const subjectId = formData.subject.subject_id.toLocaleLowerCase();
    const fileName = `{EXPERIMENT_DATE_in_format_mmddYYYY}_${subjectId}_metadata.yml`;
    createYAMLFile(fileName, yAMLForm);
    return;
  }

  if (!isValid) {
    jsonSchemaErrors?.forEach((error) => {
      showErrorMessage(error);
    });
  }

  if (isFormValid) {
    formErrors?.forEach((error) => {
      displayErrorOnUI(error.id, error.message);
    });
  }
};

const duplicateArrayItem = (index, key) => {
  const form = structuredClone(formData);
  const item = structuredClone(form[key][index]);

  // no item identified. Do nothing
  if (!item) {
    return;
  }

  // increment id by 1 if it exist
  const keys = Object.keys(item);
  keys.forEach((keyItem) => {
    const keyLowerCase = keyItem.toLowerCase(); // remove case difference
    if (['id', ' id'].includes(keyLowerCase)) {
      const ids = form[key].map((formKey) => {
        return formKey[keyLowerCase];
      });

      const maxId = Math.max(...ids);
      item[keyItem] = maxId + 1;
    }
  });

  form[key].splice(index + 1, 0, item);
  setFormData(form);
};

const duplicateElectrodeGroupItem = (index, key) => {
  const form = structuredClone(formData);
  const electrodeGroups = form.electrode_groups;
  const electrodeGroup = form[key][index];
  const clonedElectrodeGroup = structuredClone(electrodeGroup);

  // do not proceed if something is wrong with electrode group.
  // You cannot clone a falsey object
  if (!electrodeGroups || !electrodeGroup || !clonedElectrodeGroup) {
    return;
  }

  // get the new electrode's id
  const clonedElectrodeGroupId =
    Math.max(...electrodeGroups.map((f) => f.id)) + 1;

  // id has to be set anew to avoid collision
  clonedElectrodeGroup.id = clonedElectrodeGroupId;

  const ntrodeElectrodeGroupChannelMap =
    form.ntrode_electrode_group_channel_map;

  // get ntrode_electrode_group_channel_map that matches the electrodeGroup to clone
  const nTrodes = structuredClone(
    ntrodeElectrodeGroupChannelMap.filter((nTrode) => {
      return nTrode.electrode_group_id === electrodeGroup.id;
    })
  );

  // ntrode_id increments; find largest one and use that as a base for new nTrodes
  let largestNtrodeElectrodeGroupId =
    ntrodeElectrodeGroupChannelMap.length === 0
      ? 0
      : Math.max(...ntrodeElectrodeGroupChannelMap.map((n) => n.ntrode_id));

  nTrodes.forEach((n) => {
    largestNtrodeElectrodeGroupId += 1;
    n.electrode_group_id = clonedElectrodeGroup.id;
    n.ntrode_id = largestNtrodeElectrodeGroupId;
  });

  form.ntrode_electrode_group_channel_map.push(...nTrodes);

  // place the new cloned item in from of the item just cloned
  const electrodeGroupIndex = form[key].findIndex(
    (eg) => eg.id === electrodeGroup.id
  );
  form[key].splice(electrodeGroupIndex + 1, 0, clonedElectrodeGroup);
  setFormData(form);
};

/**
 * Reset YML file
 *
 * @param {object} e event parameter
 */
const clearYMLFile = (e) => {
  e.preventDefault();

  // eslint-disable-next-line no-alert
  const shouldReset = window.confirm('Are you sure you want to reset?');

  if (shouldReset) {
    setFormData(structuredClone(defaultYMLValues)); // clear out form
  }
};

/**
 * Processes clicking on a nav item
 *
 * @param {object} e Event object
 */
const clickNav = (e) => {
  const activeScrollSpies = document.querySelectorAll('.active-nav-link');

  activeScrollSpies.forEach((spy) => {
    spy.classList.remove('active-nav-link');
  });

  const { target } = e;
  const id = target.getAttribute('data-id');

  const { parentNode } = e.target;
  parentNode.classList.add('active-nav-link');
  const element = document.querySelector(`#${id}`);

  if (!element) {
    parentNode?.classList.remove('active-nav-link');
    return;
  }

  element.classList.add('highlight-region');

  setTimeout(() => {
    element?.classList.remove('highlight-region');
    parentNode?.classList.remove('active-nav-link');
  }, 1000);
};

useMount(() => {
  // set app version
  const { version } = packageJson;
  setAppVersion(version);

  // Handles initial read of JSON schema
  schema.current = JsonSchemaFile; // JsonSchemaFile.properties;
});

/**
 * Tracks camera and epoch additions
 */
useEffect(() => {
  // updated tracked camera ids
  if (formData.cameras) {
    const cameraIds = formData.cameras.map((camera) => camera.id);
    setCameraIdsDefined([...[...new Set(cameraIds)]].filter((c) => !Number.isNaN(c)));
  }

  // update tracked task epochs
  const taskEpochs = [
    ...[
      ...new Set(
        (formData.tasks.map((tasks) => tasks.task_epochs) || []).flat().sort()
      ),
    ],
  ];

  // remove deleted task epochs
  let i = 0;

  for (i = 0; i < formData.associated_files.length; i += 1) {
    if (!taskEpochs.includes(formData.associated_files[i].task_epochs)) {
      formData.associated_files[i].task_epochs = '';
    }
  }

  for (i = 0; i < formData.associated_video_files.length; i += 1) {
    if (!taskEpochs.includes(formData.associated_video_files[i].task_epochs)) {
      formData.associated_video_files[i].task_epochs = '';
    }
  }

  setFormData(formData);

  setTaskEpochsDefined(taskEpochs);
}, [formData]);

   return <>
    <div className="home-region">
      <a href={isProduction() ? '/rec_to_nwb_yaml_creator' : '/'}>
        <img src={logo} alt="Loren Frank Lab logo"/>
      </a>
    </div>
    <div className="page-container">
      <div className="page-container__nav">
        <div className="page-container__nav__content">
        <p className="page-container__nav--content__header">Navigation</p>
        <ul>
        {Object.keys(defaultYMLValues)
          .filter((key) => key !== 'ntrode_electrode_group_channel_map')
          .map((key) => (
            <li className="nav-item" key={key}>
              <a
                className="nav-link"
                href={`#${key}-area`}
                data-id={`${key}-area`}
                onClick={(e) => {
                  clickNav(e);
                }}
              >
                {titleCase(key.replaceAll('_', ' '))}
              </a>
              {formData.electrode_groups?.map((fd, fdIndex) => {
                return key !== 'electrode_groups' ? (
                  <></>
                ) : (
                  <ul>
                    <li className="sub-nav-item">
                      <a
                        className="nav-link"
                        href={`#electrode_group_item_${fd.id}-area`}
                        data-id={`electrode_group_item_${fd.id}-area`}
                        onClick={(e) => {
                          clickNav(e);
                        }}
                      >
                        {`item #${fdIndex + 1}`}
                      </a>
                    </li>
                  </ul>
                );
              })}
            </li>
          ))}
      </ul>
      </div>
      </div>
      <div className="page-container__content">
      <h2 className="header-text">
      Rec-to-NWB YAML Creator
      <span>
        &nbsp;&nbsp;&nbsp;
      </span>
      <div className="file-upload-region">
        <label htmlFor="importYAMLFile">
          &nbsp;&nbsp;
          <FontAwesomeIcon icon="download" className="pointer" size="2xs" title="Download a Yaml file to populate fields" />
        </label>
        {/*
          input type="file" onClick sets e.target.value to null, so the same file can be imported multiple times.
          See - https://stackoverflow.com/a/68480263/178550
        */}
        <input
          type="file"
          id="importYAMLFile"
          accept=".yml, .yaml"
          className="download-existing-file"
          placeholder="Download a Yaml file to populate fields"
          onChange={(e) => importFile(e)}
          onClick={(e) => e.target.value = null}
        >
        </input>
      </div>
      <span>
        &nbsp;&nbsp;&nbsp;
      </span>
      <span>
      |
      </span>
      <span className="sample-link">
        <a
          href="https://raw.githubusercontent.com/LorenFrankLab/franklabnwb/master/yaml/yaml-generator-sample-file.yml"
          target="_blank"
          title="Click to get sample Yaml file"
          rel="noreferrer">
            Sample YAML
        </a>
      </span>
    </h2>
    <form
      encType="multipart/form-data"
      className="form-control"
      name="js-nwbData"
      onReset={(e) => clearYMLFile(e)}
      onSubmit={(e) => {
        generateYMLFile(e);
      }}
    >
      <div className="form-container">
        <div id="experimenter_name-area" className="area-region">
        <ListElement
          id="experimenter_name"
          type="text"
          name="experimenter_name"
          inputPlaceholder="No experimenter"
          defaultValue={formData.experimenter_name}
          title="Experimenter Name"
          placeholder="LastName, FirstName"
          listPlaceHolder="LastName, FirstName"
          updateFormData={updateFormData}
          metaData={{
            nameValue: 'experimenter_name',
          }}
    />
        </div>
        <div id="lab-area" className="area-region">
          <InputElement
            id="lab"
            type="text"
            name="lab"
            title="Lab"
            defaultValue={formData.lab}
            placeholder="Laboratory where the experiment is conducted"
            required
            onBlur={(e) => onBlur(e)}
          />
        </div>
        <div id="institution-area" className="area-region">
          <DataListElement
            id="institution"
            name="institution"
            title="Institution"
            defaultValue={formData.institution}
            placeholder="Type to find an affiliated University or Research center"
            required
            dataItems={labs()}
            onBlur={(e) => itemSelected(e)}
          />
        </div>
      </div>
      <div id="experiment_description-area" className="area-region">
        <InputElement
          id="experiment_description"
          type="text"
          name="experiment_description"
          title="Experiment Description"
          placeholder="Description of subject and where subject came from (e.g., breeder, if animal)"
          required
          defaultValue={formData.experiment_description}
          onBlur={(e) => onBlur(e)}
        />
      </div>
      <div id="session_description-area" className="area-region">
        <InputElement
          id="session_description"
          type="text"
          name="session_description"
          title="Session Description"
          required
          placeholder="Description of current session, e.g - w-track task"
          defaultValue={formData.session_description}
          onBlur={(e) => onBlur(e)}
        />
      </div>
      <div id="session_id-area" className="area-region">
        <InputElement
          id="session_id"
          type="text"
          name="session_id"
          title="Session Id"
          required
          placeholder="Session id, e.g - 1"
          defaultValue={formData.session_id}
          onBlur={(e) => onBlur(e)}
        />
      </div>
      <div id="keywords-area" className="form-container area-region">
        <ListElement
          id="keywords"
          type="text"
          name="keywords"
          title="Keywords"
          defaultValue={formData.keywords}
          required
          inputPlaceholder="No keyword"
          placeholder="Keywords"
          updateFormData={updateFormData}
          metaData={{
            nameValue: 'keywords',
          }}
        />
      </div>
      <div id="subject-area" className="area-region">
        <details open>
          <summary>Subject</summary>
          <div id="subject-field" className="form-container">
            <InputElement
              id="subject-description"
              type="text"
              name="description"
              title="Description"
              defaultValue={formData.subject.description}
              required
              placeholder="Summary of animal model/patient/specimen being examined"
              onBlur={(e) => onBlur(e, { key: 'subject' })}
            />
            <DataListElement
              id="subject-species"
              name="species"
              title="Species"
              defaultValue={formData.subject.species}
              placeholder="Type to find a species"
              dataItems={species()}
              onBlur={(e) => itemSelected(e, { key: 'subject' })}
            />
            <DataListElement
              id="subject-genotype"
              name="genotype"
              title="Genotype"
              defaultValue={formData.subject.genotype}
              required
              placeholder="Genetic strain. If absent, assume Wild Type (WT)"
              dataItems={genotypes()}
              onBlur={(e) => itemSelected(e, { key: 'subject' })}
            />
            <SelectElement
              id="subject-sex"
              name="sex"
              title="Sex"
              placeholder="Sex of subject, single letter identifier	"
              dataItems={genderAcronym()}
              defaultValue={formData.subject.sex}
              onChange={(e) => itemSelected(e, { key: 'subject' })}
            />
            <InputElement
              id="subject-subjectId"
              type="text"
              name="subject_id"
              title="Subject Id"
              required
              defaultValue={formData.subject.subject_id}
              placeholder="ID of animal/person used/participating in experiment (lab convention)"
              onBlur={(e) => onBlur(e, { key: 'subject' })}
            />
            <InputElement
              id="subject-dateOfBirth"
              type="date"
              name="date_of_birth"
              title="Date of Birth"
              defaultValue={formData.subject.date_of_birth}
              placeholder="Date of birth of subject"
              required
              onBlur={(e) => {
                const { value, name, type } = e.target;
                const date = !value ? '' : new Date(value).toISOString();
                const target = {
                  name,
                  value: date,
                  type,
                };
                onBlur({ target }, { key: 'subject' });
              }}
            />
            <InputElement
              id="subject-weight"
              type="number"
              name="weight"
              title="Weight (grams)"
              required
              min="0"
              defaultValue={formData.subject.weight}
              placeholder="Weight at time of experiment, at time of surgery and at other important times (in grams)"
              onBlur={(e) => onBlur(e, { key: 'subject' })}
            />
          </div>
        </details>
      </div>
      <div id="data_acq_device-area" className="area-region">
        <details open>
          <summary>Data Acq Device</summary>
          <div>
            {formData?.data_acq_device.map((dataAcqDevice, index) => {
              const key = 'data_acq_device';

              return (
                <details open
                  key={sanitizeTitle(
                    `${dataAcqDevice.name}-dad-${index}`
                  )}
                  className="array-item"
                >
                  <summary> Item #{index + 1} </summary>
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
                      defaultValue={dataAcqDevice.name}
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
                      defaultValue={dataAcqDevice.system}
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
                      defaultValue={dataAcqDevice.amplifier}
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
                      defaultValue={dataAcqDevice.adc_circuit}
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
                  <summary> Item #{index + 1} </summary>
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
                      defaultValue={cameras.id}
                      placeholder="Typically a number	"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`cameras-metersperpixel-${index}`}
                      type="number"
                      name="meters_per_pixel"
                      title="Meters Per Pixel"
                      defaultValue={cameras.meters_per_pixel}
                      placeholder="Meters Per Pixel"
                      step="0.1"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <DataListElement
                      id={`cameras-manufacturer-${index}`}
                      type="text"
                      name="manufacturer"
                      title="Manufacturer"
                      defaultValue={cameras.manufacturer}
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
                      defaultValue={cameras.model}
                      placeholder="Model of this camera"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`cameras-lens-${index}`}
                      type="text"
                      name="lens"
                      title="lens"
                      defaultValue={cameras.lens}
                      placeholder="Info about lens in this camera"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />{' '}
                    <InputElement
                      id={`cameras-cameraname-${index}`}
                      type="text"
                      name="camera_name"
                      title="Camera Name"
                      defaultValue={cameras.camera_name}
                      placeholder="Name of this camera"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
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
      <div id="tasks-area" className="area-region">
        <details open>
          <summary>Tasks</summary>
          <div id="tasks-field" className="form-container">
            {formData.tasks.map((tasks, index) => {
              const key = 'tasks';

              return (
                <details
                  open
                  key={sanitizeTitle(`${tasks.task_name}-ts-${index}`)}
                  className="array-item"
                >
                  <summary> Item #{index + 1} </summary>
                  <ArrayItemControl
                    index={index}
                    keyValue={key}
                    duplicateArrayItem={duplicateArrayItem}
                    removeArrayItem={removeArrayItem}
                  />
                  <div className="form-container">
                    <InputElement
                      id={`tasks-task_name-${index}`}
                      type="text"
                      name="task_name"
                      title="Task Name"
                      defaultValue={tasks.task_name}
                      placeholder="E.g. linear track, sleep"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`tasks-task_description-${index}`}
                      type="text"
                      name="task_description"
                      title="Task Description"
                      defaultValue={tasks.task_description}
                      placeholder="Task Description"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`tasks-task_environment-${index}`}
                      type="text"
                      name="task_environment"
                      title="Task Environment"
                      defaultValue={tasks.task_environment}
                      placeholder="Where the task occurs (e.g. sleep box)"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <CheckboxList
                      id={`tasks-camera_id-${index}`}
                      type="number"
                      name="camera_id"
                      title="Camera Id"
                      objectKind="Camera"
                      defaultValue={tasks.camera_id}
                      placeholder="Camera(s) recording this task"
                      dataItems={cameraIdsDefined}
                      updateFormArray={updateFormArray}
                      metaData={{
                        nameValue: 'camera_id',
                        keyValue: 'tasks',
                        index,
                      }}
                      onChange={updateFormData}
                    />
                    <ListElement
                      id={`tasks-task_epochs-${index}`}
                      type="number"
                      step="1"
                      name="task_epochs"
                      title="Task Epochs"
                      defaultValue={tasks.task_epochs}
                      placeholder="What epochs this task is applied	"
                      inputPlaceholder="No task epoch"
                      updateFormData={updateFormData}
                      metaData={{
                        nameValue: 'task_epochs',
                        keyValue: key,
                        index: index,
                      }}
                  />
                  </div>
                </details>
              );
            })}
          </div>
          <ArrayUpdateMenu
            itemsKey="tasks"
            items={formData.tasks}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>
      <div id="associated_files-area" className="area-region">
        <details open>
          <summary>Associated Files</summary>
          <div className="form-container">
            {formData.associated_files.map(
              (associatedFilesName, index) => {
                const key = 'associated_files';

                return (
                  <details
                    open
                    key={sanitizeTitle(
                      `${associatedFilesName.name}-afn-${index}`
                    )}
                    className="array-item"
                  >
                    <summary> Item #{index + 1} </summary>
                    <ArrayItemControl
                      index={index}
                      keyValue={key}
                      duplicateArrayItem={duplicateArrayItem}
                      removeArrayItem={removeArrayItem}
                    />
                    <div className="form-container">
                      <InputElement
                        id={`associated_files-name-${index}`}
                        type="text"
                        name="name"
                        title="Name"
                        defaultValue={associatedFilesName.name}
                        placeholder="File name"
                        required
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`associated_files-description-${index}`}
                        type="text"
                        name="description"
                        title="Description"
                        defaultValue={associatedFilesName.description}
                        placeholder="Description of the file"
                        required
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`associated_files-path-${index}`}
                        title="Path"
                        name="path"
                        placeholder="path"
                        defaultValue={associatedFilesName.path}
                        required
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <RadioList
                        id={`associated_files-taskEpoch-${index}`}
                        type="number"
                        name="task_epochs"
                        title="Task Epochs"
                        objectKind="Task"
                        defaultValue={associatedFilesName.task_epochs}
                        placeholder="What tasks/epochs was this code run for"
                        dataItems={taskEpochsDefined}
                        updateFormData={updateFormData}
                        metaData={{
                          nameValue: 'task_epochs',
                          keyValue: 'associated_files',
                          index,
                        }}
                        onChange={updateFormData}
                      />
                    </div>
                  </details>
                );
              }
            )}
          </div>
          <ArrayUpdateMenu
            itemsKey="associated_files"
            items={formData.associated_files}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>
      <div id="associated_video_files-area" className="area-region">
        <details open>
          <summary>Associated Video Files</summary>
          <div
            id="associated_video_files-field"
            className="form-container"
          >
            {formData?.associated_video_files?.map(
              (associatedVideoFiles, index) => {
                const key = 'associated_video_files';
                return (
                  <details
                    open
                    key={sanitizeTitle(
                      `${associatedVideoFiles.name}-avf-${index}`
                    )}
                    className="array-item"
                  >
                    <summary> Item #{index + 1} </summary>
                    <ArrayItemControl
                      index={index}
                      keyValue={key}
                      duplicateArrayItem={duplicateArrayItem}
                      removeArrayItem={removeArrayItem}
                    />
                    <div className="form-container">
                      <InputElement
                        id={`associated_video_files-name-${index}`}
                        type="text"
                        name="name"
                        required
                        title="Name"
                        defaultValue={associatedVideoFiles.name}
                        placeholder="name"
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <RadioList
                      id={`associated_video_files-camera_id-${index}`}
                      type="number"
                      name="camera_id"
                      title="Camera Id"
                      objectKind="Camera"
                      defaultValue={associatedVideoFiles.camera_id}
                      placeholder="What camera recorded this video	"
                      dataItems={cameraIdsDefined}
                      updateFormData={updateFormData}
                      metaData={{
                        nameValue: 'camera_id',
                        keyValue: 'associated_video_files',
                        index,
                      }}
                      onChange={updateFormData}
                    />
                      <RadioList
                        id={`associated_video_files-taskEpochs-${index}`}
                        type="number"
                        name="task_epochs"
                        title="Task Epochs"
                        objectKind="Task"
                        defaultValue={associatedVideoFiles.task_epochs}
                        placeholder="What epoch was recorded in this video"
                        dataItems={taskEpochsDefined}
                        updateFormData={updateFormData}
                        metaData={{
                          nameValue: 'task_epochs',
                          keyValue: 'associated_video_files',
                          index,
                        }}
                        onChange={updateFormData}
                      />
                    </div>
                  </details>
                );
              }
            )}
          </div>
          <ArrayUpdateMenu
            itemsKey="associated_video_files"
            items={formData.associated_video_files}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>
      <div id="units-area" className="area-region">
        <details open>
          <summary>Units</summary>
          <div className="form-container">
            <InputElement
              id="analog"
              type="text"
              name="analog"
              title="Analog"
              placeholder="Analog"
              required
              defaultValue={formData.units.analog}
              onBlur={(e) => onBlur(e, { key: 'units' })}
            />
            <InputElement
              id="behavioralEvents"
              type="text"
              name="behavioral_events"
              title="Behavioral Events"
              placeholder="Behavioral Events"
              defaultValue={formData.units.behavioral_events}
              onBlur={(e) => onBlur(e, { key: 'units' })}
            />
          </div>
        </details>
      </div>
      <div id="times_period_multiplier-area" className="area-region">
        <InputElement
          id="times_period_multiplier"
          type="number"
          name="times_period_multiplier"
          title="Times Period Multiplier"
          placeholder="Times Period Multiplier"
          step="any"
          required
          defaultValue={formData.times_period_multiplier}
          onBlur={(e) => onBlur(e)}
        />
      </div>
      <div id="raw_data_to_volts-area" className="area-region">
        <InputElement
          id="raw_data_to_volts"
          type="number"
          name="raw_data_to_volts"
          title="Ephys-to-Volt Conversion Factor"
          placeholder="Scalar to multiply each element in data to convert it to the specified 'unit'. If the data are stored in acquisition system units or other units that require a conversion to be interpretable, multiply the data by 'conversion' to convert the data to the specified 'unit'."
          step="any"
          defaultValue={formData.raw_data_to_volts}
          onBlur={(e) => onBlur(e)}
        />
      </div>
      <div id="default_header_file_path-area" className="area-region">
      <InputElement
          id="defaultHeaderFilePath"
	        type="text"
          title="Default Header File Path"
          name="default_header_file_path"
          placeholder="Default Header File Path"
          defaultValue={formData.default_header_file_path}
          onBlur={(e) => onBlur(e)}
        />
      </div>
      <div id="behavioral_events-area" className="area-region">
        <details open>
          <summary>Behavioral Events</summary>
          <div className="form-container">
            {formData?.behavioral_events.map(
              (behavioralEvents, index) => {
                const key = 'behavioral_events';

                return (
                  <details
                    open
                    key={sanitizeTitle(
                      `${behavioralEvents.description}-be-${index}`
                    )}
                    className="array-item"
                  >
                    <summary> Item #{index + 1} </summary>
                    <ArrayItemControl
                      index={index}
                      keyValue={key}
                      duplicateArrayItem={duplicateArrayItem}
                      removeArrayItem={removeArrayItem}
                    />
                    <div className="form-container">
                        <SelectInputPairElement
                          id={`behavioral_events-description-${index}`}
                        type="number"
                        name="description"
                        title="Description"
                        step="1"
                        min="0"
                        items={behavioralEventsDescription()}
                        defaultValue={behavioralEvents.description}
                        placeholder="DIO info (eg. Din01)"
                        metaData={{
                          key,
                          index,
                        }}
                          onBlur={onBlur}
                        />
                      <DataListElement
                        id={`behavioral_events-name-${index}`}
                        name="name"
                        title="Name"
                        dataItems={behavioralEventsNames()}
                        defaultValue={behavioralEvents.name}
                        placeholder="E.g. light1"
                        onBlur={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                    </div>
                  </details>
                );
              }
            )}
          </div>
          <ArrayUpdateMenu
            itemsKey="behavioral_events"
            items={formData.behavioral_events}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>
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



      <div id="opto_excitation_source-area" className="area-region">
        <details open>
          <summary>Opto Excitation Source</summary>
          <div className="form-container">
            {formData.opto_excitation_source.map((item, index) => {
              const key = 'opto_excitation_source';
              return (
                <details
                  open
                  key={`OptoExcitationSource-${index}`}
                  className="array-item"
                >
                  <summary>Source #{index + 1}</summary>
                  <ArrayItemControl
                    index={index}
                    keyValue={key}
                    duplicateArrayItem={duplicateArrayItem}
                    removeArrayItem={removeArrayItem}
                  />
                  <div className="form-container">
                    <InputElement
                      id={`opto_excitation_source-name-${index}`}
                      type="text"
                      name="name"
                      title="Setup Name"
                      defaultValue={item.name}
                      placeholder="Name of your setup"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    {/* <InputElement
                      id={`opto_excitation_source-model_name-${index}`}
                      type="text"
                      name="model_name"
                      title="Hardware Model Name"
                      defaultValue={item.model_name}
                      placeholder="Model of the hardware"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    /> */}
                    <SelectElement
                        id={`opto_excitation_source-model_name-${index}`}
                        name="model_name"
                        title="Hardware Model Name"
                        dataItems={optoExcitationModelNames()}
                        defaultValue={'model 1'}
                        placeholder="Model of the hardware"
                        onBlur={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                    <InputElement
                      id={`opto_excitation_source-description-${index}`}
                      type="text"
                      name="description"
                      title="Description"
                      defaultValue={item.description}
                      placeholder="Description of the setup"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`opto_excitation_source-wavelength_in_nm-${index}`}
                      type="number"
                      name="wavelength_in_nm"
                      title="Wavelength (nm)"
                      defaultValue={item.wavelength_in_nm}
                      placeholder="xxx nm"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`opto_excitation_source-power_in_W-${index}`}
                      type="number"
                      name="power_in_W"
                      title="Source Power (W)"
                      defaultValue={item.power_in_w}
                      placeholder="xxx W"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                     id = {`opto_excitation_source-intensity_in_W_per_m2-${index}`}
                      type="number"
                      name="intensity_in_W_per_m2"
                      title="Intensity (W/m2)"
                      defaultValue={item.intensity_in_W_per_m2}
                      placeholder="xxx W/m2"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                  </div>
                </details>
              );
            })}
          </div>
          <ArrayUpdateMenu
            itemsKey="opto_excitation_source"
            items={formData.optogenetics_source}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>

      <div id="optical_fiber-area" className="area-region">
        <details open>
          <summary>Optical Fiber</summary>
          <div className="form-container">
          {formData.optical_fiber.map((item, index) => {
            const key = 'optical_fiber';
            return (
              <details
                open
                key={`optical_fiber-${index}`}
                className="array-item"
              >
                <summary>Fiber Implant #{index + 1}</summary>
                <ArrayItemControl
                  index={index}
                  keyValue={key}
                  duplicateArrayItem={duplicateArrayItem}
                  removeArrayItem={removeArrayItem}
                />
                <div className="form-container">
                  <InputElement
                    id={`optical_fiber-name-${index}`}
                    name="name"
                    type="text"
                    title="Fiber Implant Name"
                    defaultValue={item.name}
                    placeholder="Name of the fiber implant"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <SelectElement
                    id = {`optical_fiber-hardware_name-${index}`}
                    name="hardware_name"
                    title="Fiber Hardware Model Name"
                    dataItems={opticalFiberModelNames()}
                    defaultValue={''}
                    placeholder="Model of the fiber hardware device"
                    onBlur={(e) =>
                      itemSelected(e, {
                        key,
                        index,
                      })
                    }
                  />

                  <InputElement
                    id={`optical_fiber-implanted_fiber_description-${index}`}
                    type="text"
                    name="implanted_fiber_description"
                    title="Implant Description"
                    defaultValue={item.implanted_fiber_description}
                    placeholder="Description of the fiber implant"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <RadioList
                   id={`optical_fiber-hemisphere-${index}`}
                    type="text"
                    name="hemisphere"
                    title="Hemisphere"
                    objectKind="Hemisphere"
                    defaultValue={item.hemisphere}
                    placeholder="Hemisphere of the fiber implant"
                    dataItems={[
                      ...[
                        'left',
                        'right',
                      ],
                    ]}
                    updateFormData={updateFormData}
                    metaData={{
                      nameValue: 'hemisphere',
                      keyValue: 'optical_fiber',
                      index,
                    }}
                    onChange={updateFormData}
                  />
                  <InputElement
                   id = {`optical_fiber-location-${index}`}
                    type="text"
                    name="location"
                    title="Location"
                    defaultValue={item.location}
                    placeholder="Location of the fiber implant"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <InputElement
                    id={`optical_fiber-ap_in_mm-${index}`}
                    type="number"
                    name="ap_in_mm"
                    title="AP (mm)"
                    defaultValue={item.ap_in_mm}
                    placeholder="Anterior-Posterior (AP) in mm"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <InputElement
                    id={`optical_fiber-ml_in_mm-${index}`}
                    type="number"
                    name="ml_in_mm"
                    title="ML (mm)"
                    defaultValue={item.ml_in_mm}
                    placeholder="Medial-Lateral (ML) in mm"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <InputElement
                    id={`optical_fiber-dv_in_mm-${index}`}
                    type="number"
                    name="dv_in_mm"
                    title="DV (mm)"
                    defaultValue={item.dv_in_mm}
                    placeholder="Dorsal-Ventral (DV) in mm"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <InputElement
                    id={`optical_fiber-roll_in_deg-${index}`}
                    type="number"
                    name="roll_in_deg"
                    title="Roll (degrees)"
                    defaultValue={item.roll_in_deg}
                    placeholder="Roll in degrees"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <InputElement
                    id={`optical_fiber-pitch_in_deg-${index}`}
                    type="number"
                    name="pitch_in_deg"
                    title="Pitch (degrees)"
                    defaultValue={item.pitch_in_deg}
                    placeholder="Pitch in degrees"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />
                  <InputElement
                    id={`optical_fiber-yaw_in_deg-${index}`}
                    type="number"
                    name="yaw_in_deg"
                    title="Yaw (degrees)"
                    defaultValue={item.yaw_in_deg}
                    placeholder="Yaw in degrees"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                  />




                </div>
                </details>
             );
            })}
          </div>
          <ArrayUpdateMenu
            itemsKey="optical_fiber"
            items={formData.optical_fiber}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>

      <div id="virus_injection-area" className="area-region">
        <details open>
          <summary>Virus Injection</summary>
          <div className="form-container">
            {formData.virus_injection.map((item, index) => {
              const key = 'virus_injection';
              return (
                <details
                  open
                  key={`virus_injection-${index}`}
                  className="array-item"
                >
                  <summary>Injection #{index + 1}</summary>
                  <ArrayItemControl
                    index={index}
                    keyValue={key}
                    duplicateArrayItem={duplicateArrayItem}
                    removeArrayItem={removeArrayItem}
                  />
                  <div className="form-container">
                    <InputElement
                      id={`virus_injection-name-${index}`}
                      type="text"
                      name="name"
                      title="Injection Name"
                      defaultValue={item.name}
                      placeholder="Name of your injection (e.g. CA1 injection)"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-description-${index}`}
                      type="text"
                      name="description"
                      title="Description"
                      defaultValue={item.description}
                      placeholder="Description of the injection"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <SelectElement
                        id={`virus_injection-virus_name-${index}`}
                        name="virus_name"
                        title="Virus Name"
                        dataItems={virusNames()}
                        defaultValue={''}
                        placeholder="Model of the hardware"
                        onBlur={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                     <InputElement
                      id={`virus_injection-volume_in_ul-${index}`}
                      type="number"
                      name="volume_in_ul"
                      title="Volume (ul)"
                      defaultValue={item.volume_in_ul}
                      placeholder="Volume in ul"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-titer_in_vg_per_ml-${index}`}
                      type="number"
                      name="titer_in_vg_per_ml"
                      title="Titer (viral genomes/ml)"
                      defaultValue={item.titer_in_vg_per_ml}
                      placeholder="Titer in vg/ml"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    {/* # TODO: Hemisphere from list */}
                    <RadioList
                      id={`virus_injection-hemisphere-${index}`}
                      type="text"
                      name="hemisphere"
                      title="Hemisphere"
                      objectKind="Hemisphere"
                      defaultValue={item.hemisphere}
                      placeholder="Hemisphere of the injection"
                      dataItems={[
                        ...[
                          'left',
                          'right',
                        ],
                      ]
                    }
                      updateFormData={updateFormData}
                      metaData={{
                        nameValue: 'hemisphere',
                        keyValue: 'virus_injection',
                        index,
                      }}
                      onChange={updateFormData}
                    />

                    <InputElement
                      id={`virus_injection-location-${index}`}
                      type="text"
                      name="location"
                      title="Location"
                      defaultValue={item.location}
                      placeholder="Location of the injection"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-ap_in_mm-${index}`}
                      type="number"
                      name="ap_in_mm"
                      title="AP (mm)"
                      defaultValue={item.ap_in_mm}
                      placeholder="Anterior-Posterior (AP) in mm"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-ml_in_mm-${index}`}
                      type="number"
                      name="ml_in_mm"
                      title="ML (mm)"
                      defaultValue={item.ml_in_mm}
                      placeholder="Medial-Lateral (ML) in mm"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-dv_in_mm-${index}`}
                      type="number"
                      name="dv_in_mm"
                      title="DV (mm)"
                      defaultValue={item.dv_in_mm}
                      placeholder="Dorsal-Ventral (DV) in mm"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-roll_in_deg-${index}`}
                      type="number"
                      name="roll_in_deg"
                      title="Roll (degrees)"
                      defaultValue={item.roll_in_deg}
                      placeholder="Roll in degrees"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-pitch_in_deg-${index}`}
                      type="number"
                      name="pitch_in_deg"
                      title="Pitch (degrees)"
                      defaultValue={item.pitch_in_deg}
                      placeholder="Pitch in degrees"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />
                    <InputElement
                      id={`virus_injection-yaw_in_deg-${index}`}
                      type="number"
                      name="yaw_in_deg"
                      title="Yaw (degrees)"
                      defaultValue={item.yaw_in_deg}
                      placeholder="Yaw in degrees"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                    />


                  </div>
                </details>
              );
            })}
          </div>
          <ArrayUpdateMenu
            itemsKey="virus_injection"
            items={formData.virus_injection}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>
      <div id="fs_gui_yamls" className="area-region">
        <details open>
          <summary>FS Gui Yaml Files</summary>
          <div className="form-container">
            {formData.fs_gui_yamls.map((fsGuiYamls, index) => {
              const key = 'fs_gui_yamls';
              return (
                <details
                  open
                  key={sanitizeTitle(
                    `${fsGuiYamls.name}-fsg-${index}`
                  )}
                  className="array-item"
                >
                  <summary> Item #{index + 1} </summary>
                  <ArrayItemControl
                    index={index}
                    keyValue={key}
                    duplicateArrayItem={duplicateArrayItem}
                    removeArrayItem={removeArrayItem}
                  />
                  <div className="form-container">
                    <InputElement
                      id={`fs_gui_yamls-name-${index}`}
                      type="text"
                      name="name"
                      title="Name"
                      defaultValue={fsGuiYamls.name}
                      placeholder="path to yaml file"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id = {`fs_gui_yamls-power_in_mW-${index}`}
                      type="float"
                      name="power_in_mW"
                      title="Power in mW"
                      defaultValue={fsGuiYamls.power_in_mW}
                      placeholder="Power of laser in these epochs"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <ListElement
                      id={`fs_gui_yamls-epochs-${index}`}
                      type="number"
                      step="1"
                      name="epochs"
                      title="Epochs"
                      defaultValue={fsGuiYamls.epochs}
                      placeholder="What epochs this optogenetics is applied	"
                      inputPlaceholder="No task epoch"
                      updateFormData={updateFormData}
                      metaData={{
                        nameValue: 'epochs',
                        keyValue: key,
                        index: index,
                      }}
                  />
                  </div>
                </details>
              );
            })}
          </div>
          <ArrayUpdateMenu
            itemsKey="fs_gui_yamls"
            items={formData.fs_gui_yamls}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>









      <div id="electrode_groups-area" className="area-region">
        <details open>
          <summary>Electrode Groups</summary>
          <div className="form-container">
            {formData?.electrode_groups?.map((electrodeGroup, index) => {
              const electrodeGroupId = electrodeGroup.id;
              const nTrodeItems =
                formData?.ntrode_electrode_group_channel_map?.filter(
                  (n) => n.electrode_group_id === electrodeGroupId
                ) || [];
              const key = 'electrode_groups';

              return (
                <details
                  open
                  id={`electrode_group_item_${electrodeGroupId}-area`}
                  key={electrodeGroupId}
                  className="array-item"
                >
                  <summary> Item #{index + 1} </summary>
                  <ArrayItemControl
                    index={index}
                    keyValue={key}
                    duplicateArrayItem={duplicateElectrodeGroupItem}
                    removeArrayItem={removeElectrodeGroupItem}
                  />
                  <div className="form-container">
                    <InputElement
                      id={`electrode_groups-id-${index}`}
                      type="number"
                      name="id"
                      title="Id"
                      defaultValue={electrodeGroup.id}
                      placeholder="Typically a number"
                      required
                      min={0}
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <DataListElement
                      id={`electrode_groups-location-${index}`}
                      name="location"
                      title="Location"
                      placeholder="Type to find a location"
                      defaultValue={electrodeGroup.location}
                      dataItems={locations()}
                      onBlur={(e) =>
                        itemSelected(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <SelectElement
                      id={`electrode_groups-device_type-${index}`}
                      name="device_type"
                      title="Device Type"
                      addBlankOption
                      dataItems={deviceTypes()}
                      placeholder="Used to match to probe yaml data"
                      defaultValue={electrodeGroup.device_type}
                      onChange={(e) =>
                        nTrodeMapSelected(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`electrode_groups-description-${index}`}
                      type="text"
                      name="description"
                      title="Description"
                      defaultValue={electrodeGroup.description}
                      placeholder="Description"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <DataListElement
                      id={`electrode_groups-targeted_location-${index}`}
                      name="targeted_location"
                      title="Targeted Location"
                      dataItems={locations()}
                      defaultValue={electrodeGroup.targeted_location}
                      placeholder="Where device is implanted"
                      onBlur={(e) =>
                        itemSelected(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`electrode_groups-targeted_x-${index}`}
                      type="number"
                      name="targeted_x"
                      title="ML from Bregma"
                      defaultValue={electrodeGroup.targeted_x}
                      placeholder="Medial-Lateral from Bregma (Targeted x)"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`electrode_groups-targeted_y-${index}`}
                      type="number"
                      name="targeted_y"
                      title="AP to Bregma"
                      defaultValue={electrodeGroup.targeted_y}
                      placeholder="Anterior-Posterior to Bregma (Targeted y)"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <InputElement
                      id={`electrode_groups-targeted_z-${index}`}
                      type="number"
                      name="targeted_z"
                      title="DV to Cortical Surface"
                      defaultValue={electrodeGroup.targeted_z}
                      placeholder="Dorsal-Ventral to Cortical Surface (Targeted z)"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <DataListElement
                      id={`electrode_groups-units-${index}`}
                      name="units"
                      title="Units"
                      defaultValue={electrodeGroup.units}
                      placeholder="Distance units defining positioning"
                      dataItems={units()}
                      onBlur={(e) =>
                        itemSelected(e, {
                          key,
                          index,
                        })
                      }
                    />
                    <div
                      className={`${
                        nTrodeItems.length > 0 ? '' : 'hide'
                      }`}
                    >
                      <ChannelMap
                        title="Ntrode"
                        electrodeGroupId={electrodeGroupId}
                        nTrodeItems={nTrodeItems}
                        updateFormArray={updateFormArray}
                        onBlur={(e) =>
                          onBlur(e, {
                            key: 'ntrode_electrode_group_channel_map',
                            name: 'map',
                            index,
                          })
                        }
                        metaData={{
                          index,
                        }}
                        onMapInput={onMapInput}
                      />
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
          <ArrayUpdateMenu
            itemsKey="electrode_groups"
            allowMultiple
            items={formData.electrode_groups}
            addArrayItem={addArrayItem}
          />
        </details>
      </div>
      <div className="submit-button-parent">
        <button
          type="button"
          className="submit-button generate-button"
          title="Generate a YML file based on values in fields"
          onClick={(e) => submitForm(e)}
        >
          <span>Generate YML File</span>
        </button>
        <button
          type="reset"
          className="submit-button reset-button"
          title="Generate a YML file based on values in fields"
        >
          <span>Reset</span>
        </button>
      </div>
    </form>
    <div>

    </div>
    <div className="footer">
      Copyright © {new Date().getFullYear()} <a href="https://franklab.ucsf.edu/">Loren Frank Lab</a> <br />
      <a href="http://www.ucsf.edu">The University of California at San Francisco</a><br />
      Version - {appVersion}<br />
      </div>
      </div>
    </div>
  </>;
}
export default App;
