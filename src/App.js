import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { showErrorMessage, displayErrorOnUI } from './utils/errorDisplay';
import { useArrayManagement } from './hooks/useArrayManagement';
import { useFormUpdates } from './hooks/useFormUpdates';
import { useElectrodeGroups } from './hooks/useElectrodeGroups';
import { importFiles, exportAll } from './features/importExport';
import SubjectFields from './components/SubjectFields';
import DataAcqDeviceFields from './components/DataAcqDeviceFields';
import DeviceFields from './components/DeviceFields';
import CamerasFields from './components/CamerasFields';
import TasksFields from './components/TasksFields';
import BehavioralEventsFields from './components/BehavioralEventsFields';
import ElectrodeGroupFields from './components/ElectrodeGroupFields';
import OptogeneticsFields from './components/OptogeneticsFields';
import AssociatedFilesFields from './components/AssociatedFilesFields';
import SessionInfoFields from './components/SessionInfoFields';

import logo from './logo.png';
import packageJson from '../package.json';
import JsonSchemaFile from './nwb_schema.json'
import './App.scss';
import InputElement from './element/InputElement';
import SelectElement from './element/SelectElement';
import DataListElement from './element/DataListElement';
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
   * Electrode group management functions (ntrode map generation, electrode group remove/duplicate)
   */
  const { nTrodeMapSelected, removeElectrodeGroupItem, duplicateElectrodeGroupItem } = useElectrodeGroups(formData, setFormData);

  /**
   * Initiates importing an existing YAML file
   *
   * @param {object} e Event object
   */
  const importFile = async (e) => {
    e.preventDefault();
    const file = e.target.files[0];

    // Use extracted import logic
    const result = await importFiles(file);

    if (result.formData) {
      setFormData(result.formData);
    }
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

  // Use extracted export logic
  const result = exportAll(formData);

  // If export failed, display validation errors
  if (!result.success && result.validationIssues) {
    // Display validation errors to user
    // Issues with instancePath are from schema validation (AJV format)
    // Issues without instancePath are from rules validation (need ID conversion)
    result.validationIssues.forEach((issue) => {
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
  }
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
      <SessionInfoFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        updateFormData={updateFormData}
      />
      <SubjectFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        itemSelected={itemSelected}
      />
      <DataAcqDeviceFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
        duplicateArrayItem={duplicateArrayItem}
      />
      <CamerasFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
        duplicateArrayItem={duplicateArrayItem}
        sanitizeTitle={sanitizeTitle}
      />
      <TasksFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        updateFormData={updateFormData}
        updateFormArray={updateFormArray}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
        duplicateArrayItem={duplicateArrayItem}
        cameraIdsDefined={cameraIdsDefined}
      />
      <AssociatedFilesFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        updateFormData={updateFormData}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
        duplicateArrayItem={duplicateArrayItem}
        taskEpochsDefined={taskEpochsDefined}
        cameraIdsDefined={cameraIdsDefined}
      />
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
      </div>
      <BehavioralEventsFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        itemSelected={itemSelected}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
        duplicateArrayItem={duplicateArrayItem}
      />
      <DeviceFields
        formData={formData}
        updateFormData={updateFormData}
      />



      <OptogeneticsFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        itemSelected={itemSelected}
        updateFormData={updateFormData}
        updateFormArray={updateFormArray}
        addArrayItem={addArrayItem}
        removeArrayItem={removeArrayItem}
        duplicateArrayItem={duplicateArrayItem}
        taskEpochsDefined={taskEpochsDefined}
        dioEventsDefined={dioEventsDefined}
        cameraIdsDefined={cameraIdsDefined}
      />
      <ElectrodeGroupFields
        formData={formData}
        handleChange={handleChange}
        onBlur={onBlur}
        itemSelected={itemSelected}
        nTrodeMapSelected={nTrodeMapSelected}
        addArrayItem={addArrayItem}
        removeElectrodeGroupItem={removeElectrodeGroupItem}
        duplicateElectrodeGroupItem={duplicateElectrodeGroupItem}
        updateFormArray={updateFormArray}
        onMapInput={onMapInput}
      />
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