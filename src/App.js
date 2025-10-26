import React, { useState, useRef, useEffect } from 'react';
import YAML from 'yaml';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { encodeYaml, downloadYamlFile, formatDeterministicFilename } from './io/yaml';
import { showErrorMessage, displayErrorOnUI } from './utils/errorDisplay';
import { validate } from './validation';
import { useArrayManagement } from './hooks/useArrayManagement';
import { useFormUpdates } from './hooks/useFormUpdates';

import logo from './logo.png';
import packageJson from '../package.json';
import JsonSchemaFile from './nwb_schema.json'
import './App.scss';
import InputElement from './element/InputElement';
import SelectElement from './element/SelectElement';
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
  sanitizeTitle,
  titleCase,
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

export function App() {
  const [formData, setFormData] = useState(defaultYMLValues);

  const [cameraIdsDefined, setCameraIdsDefined] = useState([]);

  const [taskEpochsDefined, setTaskEpochsDefined] = useState([]);

  const [dioEventsDefined, setDioEventsDefined] = useState([]);

  const [appVersion, setAppVersion] = useState('');

  /**
   * Stores JSON schema
   */
  const schema = useRef({});

  /**
   * Array management functions (add, remove, duplicate)
   */
  const { addArrayItem, removeArrayItem, duplicateArrayItem } = useArrayManagement(formData, setFormData);

  /**
   * Form update functions (simple updates, array updates, blur transformations, onChange handlers)
   */
  const { updateFormData, updateFormArray, onBlur, handleChange } = useFormUpdates(formData, setFormData);

  /**
   * Initiates importing an existing YAML file
   *
   * @param {object} e Event object
   */
    const importFile = (e) => {
      e.preventDefault();
      const file = e.target.files[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.readAsText(e.target.files[0], 'UTF-8');

      // Handle file read errors
      reader.onerror = () => {
        // eslint-disable-next-line no-alert
        window.alert('Error reading file. Please try again.');
        setFormData(structuredClone(emptyFormData));
      };

      reader.onload = (evt) => {
        // Parse YAML with error handling to prevent data loss
        let jsonFileContent;
        try {
          jsonFileContent = YAML.parse(evt.target.result);
        } catch (parseError) {
          // eslint-disable-next-line no-alert
          window.alert(
            `Invalid YAML file: ${parseError.message}\n\n` +
            `The file could not be parsed. Please check the YAML syntax and try again.`
          );
          // Restore form to defaults after parse error
          setFormData(structuredClone(emptyFormData));
          return;
        }
        // Use unified validation API
        const issues = validate(jsonFileContent);

            if (issues.length === 0) {
              // No validation errors - ensure relevant keys exist and load all data
              Object.keys(emptyFormData).forEach((key) => {
                if (!Object.hasOwn(jsonFileContent, key)) {
                  jsonFileContent[key] = emptyFormData[key];
                }
              });

              setFormData(structuredClone(jsonFileContent));
              return null;
            }

            // Validation errors found - extract error IDs and messages
            // Extract top-level field IDs from paths (e.g., "cameras[0].id" → "cameras")
            const allErrorIds = [
              ...new Set(
                issues.map(issue => {
                  const topLevelField = issue.path.split('[')[0].split('.')[0];
                  return topLevelField;
                })
              )
            ];

            const allErrorMessages = [
              ...new Set(issues.map(issue => issue.message))
            ];

            const formContent = structuredClone(emptyFormData);
            const formContentKeys = Object.keys(formContent);

            // Import only fields that don't have validation errors
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

            if (allErrorMessages.length > 0) {
              // eslint-disable-next-line no-alert
              window.alert(`Entries Excluded\n\n${allErrorMessages.join('\n')}`);
            }


          setFormData(structuredClone(formContent));
      };
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

  // Use unified validation API that merges schema + rules
  const issues = validate(form);

  // If no validation issues, generate and download YAML
  if (issues.length === 0) {
    const yAMLForm = encodeYaml(form);
    const fileName = formatDeterministicFilename(form);
    downloadYamlFile(fileName, yAMLForm);
    return;
  }

  // Display validation errors to user
  // Issues with instancePath are from schema validation (AJV format)
  // Issues without instancePath are from rules validation (need ID conversion)
  issues.forEach((issue) => {
    if (issue.instancePath !== undefined) {
      // Schema validation error - use showErrorMessage (expects AJV format)
      showErrorMessage(issue);
    } else {
      // Rules validation error - use displayErrorOnUI (expects id + message)
      // Convert path to ID format (e.g., "tasks" → "tasks", "cameras[0].id" → "cameras-id-0")
      const id = issue.path.replace(/\[(\d+)\]\.(\w+)/g, '-$2-$1').replace(/\[(\d+)\]$/g, '-$1');
      displayErrorOnUI(id, issue.message);
    }
  });

  // Focus first invalid field for better accessibility
  // Wait for error messages to be displayed in DOM
  setTimeout(() => {
    // Try to find first field with custom validity error (from displayErrorOnUI)
    const firstInvalidField = document.querySelector('input:invalid, select:invalid, textarea:invalid');

    if (firstInvalidField) {
      firstInvalidField.focus();
      firstInvalidField.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, 100);
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

  // update tracked dio events
  if (formData.behavioral_events) {
    const dioEvents = formData.behavioral_events.map((dioEvent) => dioEvent.name);
    setDioEventsDefined(dioEvents);
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
          <FontAwesomeIcon icon={faDownload} className="pointer" size="2xs" title="Download a Yaml file to populate fields" />
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
          onClick={(e) => {
            // Reset file input to allow re-uploading the same file
            // See: https://stackoverflow.com/a/68480263/178550
            if (e && e.target) {
              e.target.value = '';
            }
          }}
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
            value={formData.lab}
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
            value={formData.institution}
          onChange={handleChange('institution')}  
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
          value={formData.experiment_description}
          onChange={handleChange('experiment_description')}  
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
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
          value={formData.session_description}
          onChange={handleChange('session_description')}  
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
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
          value={formData.session_id}
          onChange={handleChange('session_id')}  
          onBlur={(e) => onBlur(e)}
          validation={{
            type: 'pattern',
            pattern: /^[a-zA-Z0-9_-]+$/,
            patternMessage: 'Session ID must contain only letters, numbers, underscores, or hyphens'
          }}
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
              value={formData.subject.description}
              onChange={handleChange('description', 'subject')}  
              required
              placeholder="Summary of animal model/patient/specimen being examined"
              onBlur={(e) => onBlur(e, { key: 'subject' })}
              validation={{ type: 'required' }}
            />
            <DataListElement
              id="subject-species"
              name="species"
              title="Species"
              value={formData.subject.species}
              onChange={handleChange('species', 'subject')}  
              placeholder="Type to find a species"
              dataItems={species()}
              onBlur={(e) => itemSelected(e, { key: 'subject' })}
            />
            <DataListElement
              id="subject-genotype"
              name="genotype"
              title="Genotype"
              value={formData.subject.genotype}
              onChange={handleChange('genotype', 'subject')}  
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
              value={formData.subject.sex}
              onChange={handleChange('sex', 'subject')}
            />
            <InputElement
              id="subject-subjectId"
              type="text"
              name="subject_id"
              title="Subject Id"
              required
              value={formData.subject.subject_id}
              onChange={handleChange('subject_id', 'subject')}  
              placeholder="ID of animal/person used/participating in experiment (lab convention)"
              onBlur={(e) => onBlur(e, { key: 'subject' })}
              validation={{
                type: 'pattern',
                pattern: /^[a-zA-Z0-9_-]+$/,
                patternMessage: 'Subject ID must contain only letters, numbers, underscores, or hyphens'
              }}
            />
            <InputElement
              id="subject-dateOfBirth"
              type="date"
              name="date_of_birth"
              title="Date of Birth"
              value={formData.subject.date_of_birth ? formData.subject.date_of_birth.split('T')[0] : ''}
              onChange={handleChange('date_of_birth', 'subject')}  
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
              validation={{ type: 'required' }}
            />
            <InputElement
              id="subject-weight"
              type="number"
              name="weight"
              title="Weight (grams)"
              required
              min="0"
              value={formData.subject.weight}
              onChange={handleChange('weight', 'subject')}  
              placeholder="Weight at time of experiment, at time of surgery and at other important times (in grams)"
              onBlur={(e) => onBlur(e, { key: 'subject' })}
              validation={{ type: 'numberRange', min: 0, unit: 'g' }}
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
                  key={`data_acq_device-${index}`}
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
      <div id="tasks-area" className="area-region">
        <details open>
          <summary>Tasks</summary>
          <div id="tasks-field" className="form-container">
            {formData.tasks.map((tasks, index) => {
              const key = 'tasks';

              return (
                <details
                  open
                  key={`tasks-${index}`}
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
                      value={tasks.task_name}
                      onChange={handleChange('task_name', 'tasks', index)}  
                      placeholder="E.g. linear track, sleep"
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
                      id={`tasks-task_description-${index}`}
                      type="text"
                      name="task_description"
                      title="Task Description"
                      value={tasks.task_description}
                      onChange={handleChange('task_description', 'tasks', index)}  
                      placeholder="Task Description"
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
                      id={`tasks-task_environment-${index}`}
                      type="text"
                      name="task_environment"
                      title="Task Environment"
                      value={tasks.task_environment}
                      onChange={handleChange('task_environment', 'tasks', index)}  
                      placeholder="Where the task occurs (e.g. sleep box)"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'required' }}
                    />
                    <CheckboxList
                      id={`tasks-camera_id-${index}`}
                      type="number"
                      name="camera_id"
                      title="Camera Id"
                      objectKind="Camera"
                      value={tasks.camera_id}
                      onChange={handleChange('camera_id', 'tasks', index)}  
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
                    key={`associated_files-${index}`}
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
                        value={associatedFilesName.name}
                        onChange={handleChange('name', 'associated_files', index)}  
                        placeholder="File name"
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
                        id={`associated_files-description-${index}`}
                        type="text"
                        name="description"
                        title="Description"
                        value={associatedFilesName.description}
                        onChange={handleChange('description', 'associated_files', index)}  
                        placeholder="Description of the file"
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
                        id={`associated_files-path-${index}`}
                        title="Path"
                        name="path"
                        placeholder="path"
                        value={associatedFilesName.path}
                        onChange={handleChange('path', 'associated_files', index)}  
                        required
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                        validation={{ type: 'required' }}
                      />
                      <RadioList
                        id={`associated_files-taskEpoch-${index}`}
                        type="number"
                        name="task_epochs"
                        title="Task Epochs"
                        objectKind="Task"
                        value={associatedFilesName.task_epochs}
                        onChange={handleChange('task_epochs', 'associated_files', index)}  
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
                    key={`associated_video_files-${index}`}
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
                        value={associatedVideoFiles.name}
                      onChange={handleChange('name', 'associated_video_files', index)}  
                        placeholder="name"
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                        validation={{ type: 'required' }}
                      />
                      <RadioList
                      id={`associated_video_files-camera_id-${index}`}
                      type="number"
                      name="camera_id"
                      title="Camera Id"
                      objectKind="Camera"
                      value={associatedVideoFiles.camera_id}
                      onChange={handleChange('camera_id', 'associated_video_files', index)}  
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
                        value={associatedVideoFiles.task_epochs}
                      onChange={handleChange('task_epochs', 'associated_video_files', index)}  
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
              value={formData.units.analog}
              onChange={handleChange('analog', 'units')}  
              onBlur={(e) => onBlur(e, { key: 'units' })}
              validation={{ type: 'required' }}
            />
            <InputElement
              id="behavioralEvents"
              type="text"
              name="behavioral_events"
              title="Behavioral Events"
              placeholder="Behavioral Events"
              value={formData.units.behavioral_events}
              onChange={handleChange('behavioral_events', 'units')}  
              onBlur={(e) => onBlur(e, { key: 'units' })}
              validation={{ type: 'required' }}
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
          value={formData.times_period_multiplier}
          onChange={handleChange('times_period_multiplier')}  
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
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
          value={formData.raw_data_to_volts}
          onChange={handleChange('raw_data_to_volts')}  
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
        />
      </div>
      <div id="default_header_file_path-area" className="area-region">
      <InputElement
          id="defaultHeaderFilePath"
	        type="text"
          title="Default Header File Path"
          name="default_header_file_path"
          placeholder="Default Header File Path"
          value={formData.default_header_file_path}
          onChange={handleChange('default_header_file_path')}  
          onBlur={(e) => onBlur(e)}
          validation={{ type: 'required' }}
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
                    key={`behavioral_events-${index}`}
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
                        value={behavioralEvents.description}
                        onChange={handleChange('description', 'behavioral_events', index)}  
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
                        value={behavioralEvents.name}
                        onChange={handleChange('name', 'behavioral_events', index)}  
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
                      value={item.name}
                      onChange={handleChange('name', 'opto_excitation_source', index)}  
                      placeholder="Name of your setup"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    {/* <InputElement
                      id={`opto_excitation_source-model_name-${index}`}
                      type="text"
                      name="model_name"
                      title="Hardware Model Name"
                      value={item.model_name}
                      onChange={handleChange('model_name', 'opto_excitation_source', index)}  
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
                        value={item.model_name || ''}
                        onChange={handleChange('model_name', 'opto_excitation_source', index)}  
                        placeholder="Model of the hardware"
                        onChange={(e) =>
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
                      value={item.description}
                      onChange={handleChange('description', 'opto_excitation_source', index)}  
                      placeholder="Description of the setup"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`opto_excitation_source-wavelength_in_nm-${index}`}
                      type="number"
                      name="wavelength_in_nm"
                      title="Wavelength (nm)"
                      value={item.wavelength_in_nm}
                      onChange={handleChange('wavelength_in_nm', 'opto_excitation_source', index)}  
                      placeholder="xxx nm"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'numberRange', min: 0, unit: 'nm' }}
                    />
                    <InputElement
                      id={`opto_excitation_source-power_in_W-${index}`}
                      type="number"
                      name="power_in_W"
                      title="Source Power (W)"
                      value={item.power_in_w}
                      onChange={handleChange('power_in_w', 'opto_excitation_source', index)}  
                      placeholder="xxx W"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'numberRange', min: 0, unit: 'W' }}
                    />
                    <InputElement
                     id = {`opto_excitation_source-intensity_in_W_per_m2-${index}`}
                      type="number"
                      name="intensity_in_W_per_m2"
                      title="Intensity (W/m2)"
                      value={item.intensity_in_W_per_m2}
                      onChange={handleChange('intensity_in_W_per_m2', 'opto_excitation_source', index)}
                      placeholder="xxx W/m2"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'numberRange', min: 0, unit: 'W/m²' }}
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
                    value={item.name}
                      onChange={handleChange('name', 'optical_fiber', index)}  
                    placeholder="Name of the fiber implant"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <SelectElement
                    id = {`optical_fiber-hardware_name-${index}`}
                    name="hardware_name"
                    title="Fiber Hardware Model Name"
                    dataItems={opticalFiberModelNames()}
                    value={item.hardware_name || ''}
                      onChange={handleChange('hardware_name', 'optical_fiber', index)}
                    placeholder="Model of the fiber hardware device"
                    onChange={(e) =>
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
                    value={item.implanted_fiber_description}
                      onChange={handleChange('implanted_fiber_description', 'optical_fiber', index)}  
                    placeholder="Description of the fiber implant"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <RadioList
                   id={`optical_fiber-hemisphere-${index}`}
                    type="text"
                    name="hemisphere"
                    title="Hemisphere"
                    objectKind="Hemisphere"
                    value={item.hemisphere}
                      onChange={handleChange('hemisphere', 'optical_fiber', index)}  
                    placeholder="Hemisphere of the fiber implant"
                    dataItems={['left','right',]}
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
                    value={item.location}
                      onChange={handleChange('location', 'optical_fiber', index)}  
                    placeholder="Location of the fiber implant"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`optical_fiber-ap_in_mm-${index}`}
                    type="number"
                    name="ap_in_mm"
                    title="AP (mm)"
                    value={item.ap_in_mm}
                      onChange={handleChange('ap_in_mm', 'optical_fiber', index)}  
                    placeholder="Anterior-Posterior (AP) in mm"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`optical_fiber-ml_in_mm-${index}`}
                    type="number"
                    name="ml_in_mm"
                    title="ML (mm)"
                    value={item.ml_in_mm}
                      onChange={handleChange('ml_in_mm', 'optical_fiber', index)}  
                    placeholder="Medial-Lateral (ML) in mm"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`optical_fiber-dv_in_mm-${index}`}
                    type="number"
                    name="dv_in_mm"
                    title="DV (mm)"
                    value={item.dv_in_mm}
                      onChange={handleChange('dv_in_mm', 'optical_fiber', index)}  
                    placeholder="Dorsal-Ventral (DV) in mm"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`optical_fiber-roll_in_deg-${index}`}
                    type="number"
                    name="roll_in_deg"
                    title="Roll (degrees)"
                    value={item.roll_in_deg}
                      onChange={handleChange('roll_in_deg', 'optical_fiber', index)}  
                    placeholder="Roll in degrees"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`optical_fiber-pitch_in_deg-${index}`}
                    type="number"
                    name="pitch_in_deg"
                    title="Pitch (degrees)"
                    value={item.pitch_in_deg}
                      onChange={handleChange('pitch_in_deg', 'optical_fiber', index)}  
                    placeholder="Pitch in degrees"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
                  />
                  <InputElement
                    id={`optical_fiber-yaw_in_deg-${index}`}
                    type="number"
                    name="yaw_in_deg"
                    title="Yaw (degrees)"
                    value={item.yaw_in_deg}
                      onChange={handleChange('yaw_in_deg', 'optical_fiber', index)}  
                    placeholder="Yaw in degrees"
                    step="any"
                    required
                    onBlur={(e) =>
                      onBlur(e, { key, index })
                    }
                    validation={{ type: 'required' }}
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
                      value={item.name}
                      onChange={handleChange('name', 'virus_injection', index)}  
                      placeholder="Name of your injection (e.g. CA1 injection)"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-description-${index}`}
                      type="text"
                      name="description"
                      title="Description"
                      value={item.description}
                      onChange={handleChange('description', 'virus_injection', index)}  
                      placeholder="Description of the injection"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <SelectElement
                        id={`virus_injection-virus_name-${index}`}
                        name="virus_name"
                        title="Virus Name"
                        dataItems={virusNames()}
                        value={item.virus_name || ''}
                      onChange={handleChange('virus_name', 'virus_injection', index)}
                        placeholder="Model of the hardware"
                        onChange={(e) =>
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
                      value={item.volume_in_ul}
                      onChange={handleChange('volume_in_ul', 'virus_injection', index)}  
                      placeholder="Volume in ul"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'numberRange', min: 0, unit: 'µL' }}
                    />
                    <InputElement
                      id={`virus_injection-titer_in_vg_per_ml-${index}`}
                      type="number"
                      name="titer_in_vg_per_ml"
                      title="Titer (viral genomes/ml)"
                      value={item.titer_in_vg_per_ml}
                      onChange={handleChange('titer_in_vg_per_ml', 'virus_injection', index)}  
                      placeholder="Titer in vg/ml"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'numberRange', min: 0 }}
                    />
                    <RadioList
                      id={`virus_injection-hemisphere-${index}`}
                      type="text"
                      name="hemisphere"
                      title="Hemisphere"
                      objectKind="text"
                      defaultValue={"left"}
                      placeholder="Hemisphere of the injection"
                      dataItems={['left', 'right']}
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
                      value={item.location}
                      onChange={handleChange('location', 'virus_injection', index)}  
                      placeholder="Location of the injection"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-ap_in_mm-${index}`}
                      type="number"
                      name="ap_in_mm"
                      title="AP (mm)"
                      value={item.ap_in_mm}
                      onChange={handleChange('ap_in_mm', 'virus_injection', index)}  
                      placeholder="Anterior-Posterior (AP) in mm"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-ml_in_mm-${index}`}
                      type="number"
                      name="ml_in_mm"
                      title="ML (mm)"
                      value={item.ml_in_mm}
                      onChange={handleChange('ml_in_mm', 'virus_injection', index)}  
                      placeholder="Medial-Lateral (ML) in mm"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-dv_in_mm-${index}`}
                      type="number"
                      name="dv_in_mm"
                      title="DV (mm)"
                      value={item.dv_in_mm}
                      onChange={handleChange('dv_in_mm', 'virus_injection', index)}  
                      placeholder="Dorsal-Ventral (DV) in mm"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-roll_in_deg-${index}`}
                      type="number"
                      name="roll_in_deg"
                      title="Roll (degrees)"
                      value={item.roll_in_deg}
                      onChange={handleChange('roll_in_deg', 'virus_injection', index)}  
                      placeholder="Roll in degrees"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-pitch_in_deg-${index}`}
                      type="number"
                      name="pitch_in_deg"
                      title="Pitch (degrees)"
                      value={item.pitch_in_deg}
                      onChange={handleChange('pitch_in_deg', 'virus_injection', index)}  
                      placeholder="Pitch in degrees"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
                    />
                    <InputElement
                      id={`virus_injection-yaw_in_deg-${index}`}
                      type="number"
                      name="yaw_in_deg"
                      title="Yaw (degrees)"
                      value={item.yaw_in_deg}
                      onChange={handleChange('yaw_in_deg', 'virus_injection', index)}  
                      placeholder="Yaw in degrees"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, { key, index })
                      }
                      validation={{ type: 'required' }}
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
          <summary>FS Gui Yamls</summary>
          <div className="form-container">
            {formData.fs_gui_yamls.map((fsGuiYamls, index) => {
              const key = 'fs_gui_yamls';
              return (
                <details
                  open
                  key={`fs_gui_yamls-${index}`}
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
                      value={fsGuiYamls.name}
                      onChange={handleChange('name', 'fs_gui_yamls', index)}  
                      placeholder="path to yaml file"
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
                      id = {`fs_gui_yamls-power_in_mW-${index}`}
                      type="number"
                      name="power_in_mW"
                      title="Power in mW"
                      value={fsGuiYamls.power_in_mW}
                      onChange={handleChange('power_in_mW', 'fs_gui_yamls', index)}
                      placeholder="Power of laser in these epochs"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'numberRange', min: 0, unit: 'mW' }}
                    />
                    <CheckboxList
                        id={`fs_gui_yamls-epochs-${index}`}
                        type="number"
                        name="epochs"
                        title="Epochs"
                        objectKind="Task"
                        value={fsGuiYamls.epochs}
                      onChange={handleChange('epochs', 'fs_gui_yamls', index)}  
                        placeholder="What epochs this optogenetics is applied	"
                        dataItems={taskEpochsDefined}
                        updateFormArray={updateFormArray}
                        updateFormData={updateFormData}
                        metaData={{
                          nameValue: 'epochs',
                          keyValue: 'fs_gui_yamls',
                          index,
                        }}
                        onChange={updateFormData}
                    />
                    <RadioList
                      id={`fs_gui_yamls-dio_output_name-${index}`}
                      type="text"
                      name="dio_output_name"
                      title="DIO Output Name"
                      objectKind="DIO"
                      value={fsGuiYamls.dio_output_name}
                      onChange={handleChange('dio_output_name', 'fs_gui_yamls', index)}  
                      placeholder="Name of the dio the trigger is sent through (e.g. Light_1)"
                      dataItems={dioEventsDefined}
                      updateFormData={updateFormData}
                      metaData={{
                        nameValue: 'dio_output_name',
                        keyValue: 'fs_gui_yamls',
                        index,
                      }}
                      updateFormArray={updateFormArray}
                    />
                    <RadioList
                      id={`fs_gui_yamls-camera_id-${index}`}
                      type="number"
                      name="camera_id"
                      title="Spatial Filters Camera Id"
                      objectKind="Camera"
                      value={fsGuiYamls.camera_id}
                      onChange={handleChange('camera_id', 'fs_gui_yamls', index)}  
                      placeholder="Camera(s) used to define spatial filters"
                      dataItems={cameraIdsDefined}
                      updateFormArray={updateFormArray}
                      metaData={{
                        nameValue: 'camera_id',
                        keyValue: 'fs_gui_yamls',
                        index,
                      }}
                      updateFormData={updateFormData}
                    />
                    <div style={{ margin: '10px 0', color: '#333', fontWeight: 'bold' }}>
                      <p style={{ margin: 0 }}>Check this box to enable advanced state script parameters for this item:</p>
                    </div>
                    <input
                      type="checkbox"
                      id={`fs_gui_yamls-state_script_parameters-${index}`}
                      name="state_script_parameters"
                      checked={fsGuiYamls.state_script_parameters}
                      onChange={(e) =>
                        updateFormData(
                          e.target.name,
                          e.target.checked,
                          key,
                          index
                        )
                      }

                    />
                  <label htmlFor={`fs_gui_yamls-state_script_parameters-${index}`}>Enable Advanced Settings</label>
                  {fsGuiYamls.state_script_parameters && (
                    <>
                      <InputElement
                        id={`fs_gui_yamls-pulseLength-${index}`}
                        type="number"
                        name="pulseLength"
                        title="Length of Pulse (ms)"
                        defaultValue={NaN}
                        placeholder="Only used if protocol not generated by fsgui"
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                        validation={{ type: 'numberRange', min: 0, unit: 'ms' }}
                      />
                      <InputElement
                      id = {`fs_gui_yamls-nPulses-${index}`}
                      type="number"
                      name="nPulses"
                      title="Number of Pulses per Train"
                      defaultValue={NaN}
                      placeholder="Only used if protocol not generated by fsgui"
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'numberRange', min: 0 }}
                      />
                      <InputElement
                      id = {`fs_gui_yamls-sequencePeriod-${index}`}
                      type="number"
                      name="sequencePeriod"
                      title="Sequence Period (ms)"
                      defaultValue={NaN}
                      placeholder="Only used if protocol not generated by fsgui"
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'numberRange', min: 0, unit: 'ms' }}
                      />
                      <InputElement
                        id={`fs_gui_yamls-nOutputTrains-${index}`}
                        type="number"
                        name="nOutputTrains"
                        title="Number of Output Trains"
                        defaultValue={NaN}
                        placeholder="Only used if protocol not generated by fsgui"
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                        validation={{ type: 'numberRange', min: 0 }}
                      />
                      <InputElement
                        id={`fs_gui_yamls-train_interval-${index}`}
                        type="number"
                        name="train_interval"
                        title="Train Interval (ms)"
                        defaultValue={NaN}
                        placeholder="Only used if protocol not generated by fsgui"
                        onBlur={(e) =>
                          onBlur(e, {
                            key,
                            index,
                          })
                        }
                        validation={{ type: 'numberRange', min: 0, unit: 'ms' }}
                      />
                    </>
                  )}
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
      <div id="opto_software-area" className="area-region">
          <InputElement
            id="optogenetic_stimulation_software"
            name="optogenetic_stimulation_software"
            title="Optogenetic Stimulation Software"
            defaultValue="fsgui"
            placeholder="Software used for optogenetic stimulation"
            onBlur={(e) => onBlur(e)}
            validation={{ type: 'required' }}
          />
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
                      value={electrodeGroup.id}
                      onChange={handleChange('id', 'electrode_groups', index)}  
                      placeholder="Typically a number"
                      required
                      min={0}
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'numberRange', min: 0 }}
                    />
                    <DataListElement
                      id={`electrode_groups-location-${index}`}
                      name="location"
                      title="Location"
                      placeholder="Type to find a location"
                      value={electrodeGroup.location}
                      onChange={handleChange('location', 'electrode_groups', index)}  
                      dataItems={locations()}
                      required
                      onBlur={(e) =>
                        itemSelected(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'required' }}
                    />
                    <SelectElement
                      id={`electrode_groups-device_type-${index}`}
                      name="device_type"
                      title="Device Type"
                      addBlankOption
                      dataItems={deviceTypes()}
                      placeholder="Used to match to probe yaml data"
                      value={electrodeGroup.device_type}
                      onChange={handleChange('device_type', 'electrode_groups', index)}  
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
                      value={electrodeGroup.description}
                      onChange={handleChange('description', 'electrode_groups', index)}  
                      placeholder="Description"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'required' }}
                    />
                    <DataListElement
                      id={`electrode_groups-targeted_location-${index}`}
                      name="targeted_location"
                      title="Targeted Location"
                      dataItems={locations()}
                      value={electrodeGroup.targeted_location}
                      onChange={handleChange('targeted_location', 'electrode_groups', index)}  
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
                      value={electrodeGroup.targeted_x}
                      onChange={handleChange('targeted_x', 'electrode_groups', index)}  
                      placeholder="Medial-Lateral from Bregma (Targeted x)"
                      step="any"
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
                      id={`electrode_groups-targeted_y-${index}`}
                      type="number"
                      name="targeted_y"
                      title="AP to Bregma"
                      value={electrodeGroup.targeted_y}
                      onChange={handleChange('targeted_y', 'electrode_groups', index)}  
                      placeholder="Anterior-Posterior to Bregma (Targeted y)"
                      step="any"
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
                      id={`electrode_groups-targeted_z-${index}`}
                      type="number"
                      name="targeted_z"
                      title="DV to Cortical Surface"
                      value={electrodeGroup.targeted_z}
                      onChange={handleChange('targeted_z', 'electrode_groups', index)}  
                      placeholder="Dorsal-Ventral to Cortical Surface (Targeted z)"
                      step="any"
                      required
                      onBlur={(e) =>
                        onBlur(e, {
                          key,
                          index,
                        })
                      }
                      validation={{ type: 'required' }}
                    />
                    <DataListElement
                      id={`electrode_groups-units-${index}`}
                      name="units"
                      title="Units"
                      value={electrodeGroup.units}
                      onChange={handleChange('units', 'electrode_groups', index)}  
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