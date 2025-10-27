import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { showErrorMessage, displayErrorOnUI } from './utils/errorDisplay';
import { useStoreContext } from './state/StoreContext';
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
import ExperimenterFields from './components/ExperimenterFields';
import LabInstitutionFields from './components/LabInstitutionFields';
import UnitsFields from './components/UnitsFields';
import TechnicalFields from './components/TechnicalFields';

import logo from './logo.png';
import packageJson from '../package.json';
import JsonSchemaFile from './nwb_schema.json'
import './App.scss';
import {
  titleCase,
  isProduction,
  useMount,
} from './utils';
import {
  defaultYMLValues,
} from './valueList';

export function App() {
  // Access shared store via Context
  const { model: formData, actions } = useStoreContext();

  /**
   * Stores JSON schema
   */
  const schema = useRef({});

  /**
   * App version (local state, not part of form data)
   */
  const [appVersion, setAppVersion] = useState('');

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
      // Import updates entire form state at once
      actions.setFormData(result.formData);
    }
  };

  /**
   * Used by ntrode to map shank to value
   *
   * @param {object} e Event object
   * @param {object} metaData Supporting Data
   * @returns null
   */
  /**
   * Open all Detail elements
   */
  const openDetailsElement = () => {
    const details = document.querySelectorAll('details');

    details.forEach((detail) => {
      detail.open = true;
    });
  };

  /**
   * submit form. This is this way as there is no official beforeSubmit method
   *
   * @param {object} e Javascript object
   */
  const submitForm = (e) => {
    openDetailsElement();
    document.querySelector('form').requestSubmit();
  };

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
          // scrollIntoView may not exist in test environments (JSDOM)
          if (firstInvalidField.scrollIntoView) {
            firstInvalidField.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
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
      actions.setFormData(structuredClone(defaultYMLValues)); // clear out form
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

  /**
   * Handles keyboard navigation (Enter and Space keys)
   * Implements WCAG 2.1 Level A requirement for keyboard accessibility
   *
   * @param {object} e Keyboard event object
   */
  const handleNavKeyDown = (e) => {
    // Only handle Enter and Space keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // Prevent default Space scroll behavior
      clickNav(e);
    }
  };

  useMount(() => {
    // set app version
    const { version } = packageJson;
    setAppVersion(version);

    // Handles initial read of JSON schema
    schema.current = JsonSchemaFile; // JsonSchemaFile.properties;
  });

// Note: Camera IDs, DIO events, and task epochs tracking is now handled by StoreContext selectors
// See: getCameraIds(), getDioEvents(), getTaskEpochs() in state/store.js

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
                onKeyDown={handleNavKeyDown}
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
                        onKeyDown={handleNavKeyDown}
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
        <ExperimenterFields />
        <LabInstitutionFields />
        <SessionInfoFields />
      <SubjectFields />
      <DataAcqDeviceFields />
      <CamerasFields />
      <TasksFields />
      <AssociatedFilesFields />
      <UnitsFields />
      <TechnicalFields />
      </div>
      <BehavioralEventsFields />
      <DeviceFields />



      <OptogeneticsFields />
      <ElectrodeGroupFields />
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