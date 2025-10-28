/**
 * LegacyFormView - Original form functionality (M2 extraction from App.js)
 *
 * This component preserves 100% of the existing form functionality from App.js.
 * Extracted as part of M2 - UI Skeleton to enable AppLayout routing.
 *
 * CRITICAL: This is scientific infrastructure. Any changes must:
 * - Pass all existing tests (2149+ tests)
 * - Pass golden baseline YAML tests (byte-for-byte identical output)
 * - Preserve exact form behavior
 *
 * @module pages/LegacyFormView
 */

import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { showErrorMessage, displayErrorOnUI, setAlertCallback } from '../utils/errorDisplay';
import AlertModal from '../components/AlertModal';
import { useStoreContext } from '../state/StoreContext';
import { importFiles, exportAll } from '../features/importExport';
import SubjectFields from '../components/SubjectFields';
import DataAcqDeviceFields from '../components/DataAcqDeviceFields';
import DeviceFields from '../components/DeviceFields';
import CamerasFields from '../components/CamerasFields';
import TasksFields from '../components/TasksFields';
import BehavioralEventsFields from '../components/BehavioralEventsFields';
import ElectrodeGroupFields from '../components/ElectrodeGroupFields';
import OptogeneticsFields from '../components/OptogeneticsFields';
import AssociatedFilesFields from '../components/AssociatedFilesFields';
import SessionInfoFields from '../components/SessionInfoFields';
import ExperimenterFields from '../components/ExperimenterFields';
import LabInstitutionFields from '../components/LabInstitutionFields';
import UnitsFields from '../components/UnitsFields';
import TechnicalFields from '../components/TechnicalFields';

import JsonSchemaFile from '../nwb_schema.json';
import '../App.scss';
import {
  titleCase,
  useMount,
} from '../utils';
import { formatElectrodeGroupLabel } from '../utils/labelFormatters';
import {
  defaultYMLValues,
} from '../valueList';

/**
 * LegacyFormView Component
 *
 * Renders the original form interface for creating NWB metadata YAML files.
 * This is the default view until multi-day workflow is implemented (M3-M7).
 *
 * @returns {JSX.Element} The complete form interface
 */
export function LegacyFormView() {
  // Access shared store via Context
  const { model: formData, actions } = useStoreContext();

  /**
   * Stores JSON schema
   */
  const schema = useRef({});

  /**
   * AlertModal state (replaces window.alert for accessible error display)
   */
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: '',
    title: 'Alert',
    type: 'info',
  });

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

      // Show import summary if available
      if (result.importSummary) {
        showImportSummary(result.importSummary);
      }
    }
  };

  /**
   * Display import summary modal
   *
   * @param {object} summary Import summary with imported/excluded fields
   */
  const showImportSummary = (summary) => {
    const { importedFields, excludedFields, hasExclusions, totalFields } = summary;

    // Format field names for display (convert snake_case to Title Case)
    const formatFieldName = (field) =>
      field.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

    // Build summary message (plain text, no markdown)
    let message = '';

    // Summary header with ratio
    if (hasExclusions) {
      message += `Import completed: ${importedFields.length}/${totalFields} fields imported\n\n`;
    } else {
      message += `All ${importedFields.length} fields imported successfully\n\n`;
    }

    // Imported fields section
    if (importedFields.length > 0) {
      message += `IMPORTED (${importedFields.length}):\n`;
      message += importedFields.map(field => `  ${formatFieldName(field)}`).join('\n');
    }

    // Excluded fields section
    if (hasExclusions) {
      message += `\n\nEXCLUDED (${excludedFields.length}):\n`;
      message += excludedFields.map(({ field, reason }) =>
        `  ${formatFieldName(field)}: ${reason}`
      ).join('\n');
    }

    setAlertState({
      isOpen: true,
      message,
      title: hasExclusions ? 'Import Summary - Partial Import' : 'Import Summary - Success',
      type: hasExclusions ? 'warning' : 'success',
    });
  };

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

  /**
   * Handles keyboard file upload (Enter and Space keys)
   * Implements WCAG 2.1 Level A requirement for keyboard accessibility
   *
   * @param {object} e Keyboard event object
   */
  const handleFileUploadKeyDown = (e) => {
    // Only handle Enter and Space keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // Prevent default Space scroll behavior
      // Trigger the hidden file input's click event
      document.getElementById('importYAMLFile').click();
    }
  };

  useMount(() => {
    // Handles initial read of JSON schema
    schema.current = JsonSchemaFile; // JsonSchemaFile.properties;

    // Register AlertModal callback for accessible error display
    setAlertCallback((message) => {
      setAlertState({
        isOpen: true,
        message,
        title: 'Alert',
        type: 'error', // Default to error type for validation messages
      });
    });

    // Cleanup callback on unmount
    return () => {
      setAlertCallback(null);
    };
  });

// Note: Camera IDs, DIO events, and task epochs tracking is now handled by StoreContext selectors
// See: getCameraIds(), getDioEvents(), getTaskEpochs() in state/store.js

  return (
    <>
    <div className="page-container">
      <div id="navigation" tabIndex="-1" role="navigation" aria-label="Form section navigation" className="page-container__nav">
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
                return key !== 'electrode_groups' ? null : (
                  <ul key={fd.id}>
                    <li className="sub-nav-item">
                      <a
                        className="nav-link"
                        href={`#electrode_group_item_${fd.id}-area`}
                        data-id={`electrode_group_item_${fd.id}-area`}
                        title={formatElectrodeGroupLabel(fd)}
                        onClick={(e) => {
                          clickNav(e);
                        }}
                        onKeyDown={handleNavKeyDown}
                      >
                        {formatElectrodeGroupLabel(fd)}
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
      <div id="main-content" tabIndex="-1" role="main" aria-label="NWB metadata form" className="page-container__content">
      <h2 className="header-text">
      Rec-to-NWB YAML Creator
      <span>
        &nbsp;&nbsp;&nbsp;
      </span>
      <div className="file-upload-region">
        <button
          type="button"
          className="import-button"
          onClick={() => document.getElementById('importYAMLFile').click()}
          onKeyDown={handleFileUploadKeyDown}
          aria-label="Import YAML file to populate form fields"
        >
          <FontAwesomeIcon icon={faUpload} /> Import YAML
        </button>
        {/*
          input type="file" onClick sets e.target.value to null, so the same file can be imported multiple times.
          See - https://stackoverflow.com/a/68480263/178550
        */}
        <input
          type="file"
          id="importYAMLFile"
          accept=".yml, .yaml"
          className="visually-hidden"
          onChange={(e) => importFile(e)}
          onClick={(e) => {
            // Reset file input to allow re-uploading the same file
            // See: https://stackoverflow.com/a/68480263/178550
            if (e && e.target) {
              e.target.value = '';
            }
          }}
        />
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
      </div>
    </div>
    <AlertModal
      isOpen={alertState.isOpen}
      message={alertState.message}
      title={alertState.title}
      type={alertState.type}
      onClose={() => setAlertState({ ...alertState, isOpen: false })}
    />
    </>
  );
}

export default LegacyFormView;
