import React, { useState, useRef, useEffect } from 'react';
import InputElement from './InputElement';
import SelectElement from './SelectElement';
import FileUpload from './FileUpload';
import DataListElement from './DataListElement';
import arrayDefaultValues from './arrayDefaultValues';
import deviceTypeMap from './deviceTypes';
import ChannelMap from './ChannelMap';
import SelectInputPairElement from './SelectInputPairElement';
import ArrayUpdateMenu from './ArrayUpdateMenu';
import CheckboxList from './CheckboxList';
import {
  ASYNC_TOPICS,
  commaSeparatedStringToNumber,
  sanitizeTitle,
} from './utils';
import {
  labs,
  genders,
  device,
  locations,
  deviceTypes,
  units,
  species,
  behavioralEventsNames,
  behavioralEventsDescription,
} from './list';

const Ajv = require('ajv');

const { ipcRenderer } = window.electron;

/**
 * Main component
 *
 * @returns Virtual DOM
 */
export function YMLGenerator() {
  const [formData, setFormData] = useState({
    experimenter_name: '',
    lab: 'Frank Lab',
    institution: 'University of California, San Francisco',
    experiment_description: '',
    session_description: '',
    subject: {
      description: '',
      genotype: '',
      sex: 'Male',
      species: 'Long-Evans Rat',
      subject_id: '',
      weight: 0,
    },
    data_acq_device: [],
    associated_files: [],
    units: {
      analog: '',
      behavioral_events: '',
    },
    times_period_multiplier: 0,
    raw_data_to_volts: 0,
    default_header_file_path: '',
    cameras: [],
    tasks: [],
    behavioral_events: [],
    associated_video_files: [],
    device: 'Tetrode',
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
  });

  const [cameraIdsDefined, setCameraIdsDefined] = useState([]);

  const [taskEpochsDefined, setTaskEpochsDefined] = useState([]);

  const schema = useRef({});

  const uploadFile = (e) => {
    e.preventDefault();
    ipcRenderer.sendMessage('REQUEST_OPEN_TEMPLATE_FILE_BOX');
  };

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

  const onInput = (e, metaData) => {
    const { target } = e;
    const { name, value, type } = target;
    const { key, index, isCommaSeparatedStringToNumber } = metaData || {};
    let inputValue = '';

    if (!isCommaSeparatedStringToNumber) {
      inputValue = type === 'number' ? parseInt(value, 10) : value;
    } else {
      inputValue = commaSeparatedStringToNumber(value);
    }

    updateFormData(name, inputValue, key, index);
  };

  const onMapInput = (e, metaData) => {
    const { target } = e;
    const { value } = target;
    const { key, index, shankNumber, electrodeGroupId } = metaData;
    const form = structuredClone(formData);
    const nTrodes = form[key].filter(
      (item) => item.electrode_group_id === electrodeGroupId
    );

    if (nTrodes.length === 0) {
      return null;
    }

    nTrodes[shankNumber].map[parseInt(index, 10)] = parseInt(value, 10);
    setFormData(form);
    return null;
  };

  const itemSelected = (e, metaData) => {
    const { target } = e;
    const { name, value } = target;
    const { key, index } = metaData || {};

    updateFormData(name, value, key, index);
  };

  const itemFileUpload = (e, value, metaData) => {
    const { name } = e.target;
    const { key, index } = metaData || {};

    updateFormData(name, value, key, index);
  };

  const nTrodeMapSelected = (e, metaData) => {
    const form = structuredClone(formData);
    const { value } = e.target;
    const { key, index } = metaData;
    const electrodeGroupId = form.electrode_groups[index].id;
    const deviceTypeMapping = structuredClone(deviceTypeMap[value]);
    const nTrode = {
      ...arrayDefaultValues.ntrode_electrode_group_channel_map,
    };
    const shankCount = deviceTypeMapping?.items?.shankCount || 0;
    const nTrodes = structuredClone(Array(shankCount).fill(nTrode));
    const map = {};

    form[key][index].device_type = value;

    // set map with default values
    Object.values(deviceTypeMapping?.items?.properties || []).forEach(
      (property) => {
        map[parseInt(property.title, 10)] = property.default;
      }
    );

    nTrodes.forEach((n, nIndex) => {
      n.ntrode_id = nIndex + 1;
      n.electrode_group_id = electrodeGroupId;
      n.map = { ...map };
    });

    const nTrodeMapFormData = form.ntrode_electrode_group_channel_map.filter(
      (n) => n.electrode_group_id !== electrodeGroupId
    );

    form.ntrode_electrode_group_channel_map =
      structuredClone(nTrodeMapFormData);

    nTrodes.forEach((n) => {
      form.ntrode_electrode_group_channel_map.push(n);
    });

    setFormData(form);

    return null;
  };

  const addArrayItem = (key) => {
    const form = structuredClone(formData);
    const items = { ...arrayDefaultValues[key] };
    const formItems = form[key];
    const idValues = formItems
      .map((formItem) => formItem.id)
      .filter((formItem) => formItem !== undefined);

    // prevent duplicate ids
    if (idValues.length > 0) {
      items.id = Math.max(...idValues) + 1;
    }

    formItems.push(items);
    setFormData(form);
  };

  const removeArrayItem = (key) => {
    const form = structuredClone(formData);
    const items = form[key].pop();

    setFormData(form);
  };

  const validateJSON = (formContent) => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema.current);

    validate(formContent);

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

  const generateYMLFile = (e) => {
    e.preventDefault();
    const form = structuredClone(formData);

    const validation = validateJSON(form);
    const { isValid, message } = validation;

    if (isValid) {
      ipcRenderer.sendMessage('SAVE_USER_DATA', form);
    } else {
      window.alert(message); // eslint-disable-line no-alert
    }
  };

  useEffect(() => {
    ipcRenderer.sendMessage('asynchronous-message', 'async ping');
  }, []);

  useEffect(() => {
    ipcRenderer.on(ASYNC_TOPICS.jsonFileRead, (data) => {
      schema.current = JSON.parse(data);
    });
  }, []);

  useEffect(() => {
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

      setFormData(jsonFileContent);
      return null;
    });
  }, []);

  useEffect(() => {
    // updated tracked camera ids
    const cameraIds = formData.cameras.map((camera) => camera.id);
    setCameraIdsDefined([...[...new Set(cameraIds)]]);

    // update tracked task epochs
    const taskEpochs = [
      ...[
        ...new Set(
          (formData.tasks.map((tasks) => tasks.task_epochs) || []).flat().sort()
        ),
      ],
    ];
    setTaskEpochsDefined(taskEpochs);
  }, [formData]);

  return (
    <>
      <h2 className="header-text">
        YAML Data &nbsp;
        <button type="button" className="upload-file-text" onClick={uploadFile}>
          Upload file
        </button>
      </h2>
      <form
        encType="multipart/form-data"
        className="form-control"
        name="nwbData"
        onSubmit={(e) => {
          generateYMLFile(e);
        }}
      >
        <div className="form-container">
          <InputElement
            id="experimenter_name"
            type="text"
            name="experimenter_name"
            defaultValue={formData.experimenter_name}
            title="Experimenter Name"
            placeholder="Name of experimenter performing current session"
            required
            onInput={(e) => onInput(e)}
          />
          <InputElement
            id="lab"
            type="text"
            name="lab"
            title="Lab"
            defaultValue={formData.lab}
            placeholder="Laboratory where the experiment is conducted"
            required
            onInput={(e) => onInput(e)}
          />
          <DataListElement
            id="institution"
            name="institution"
            title="Institution"
            defaultValue={formData.institution}
            dataItems={labs()}
            onChange={(e) => itemSelected(e)}
          />
        </div>
        <InputElement
          id="experiment_description"
          type="text"
          name="experiment_description"
          title="Experiment Description"
          placeholder="Desscription of experiment"
          defaultValue={formData.experiment_description}
          onInput={(e) => onInput(e)}
        />
        <InputElement
          id="session_description"
          type="text"
          name="session_description"
          title="Session Description"
          placeholder="Desscription of current session"
          defaultValue={formData.session_description}
          onInput={(e) => onInput(e)}
        />

        <div>
          <fieldset>
            <legend>Subject</legend>
            <div className="form-container">
              <InputElement
                id="subject-description"
                type="text"
                name="description"
                title="Description"
                defaultValue={formData.subject.description}
                required
                placeholder="Summary of animal model/patient/specimen being examined"
                onInput={(e) => onInput(e, { key: 'subject' })}
              />
              <InputElement
                id="subject-genotype"
                type="text"
                name="genotype"
                title="Genotype"
                required
                defaultValue={formData.subject.genotype}
                placeholder="Genetic summary of animal model/patient/specimen"
                onInput={(e) => onInput(e, { key: 'subject' })}
              />
              <SelectElement
                id="subject-sex"
                name="sex"
                title="Sex"
                dataItems={genders()}
                defaultValue={formData.subject.sex}
                onChange={(e) => itemSelected(e, { key: 'subject' })}
              />
              <DataListElement
                id="subject-species"
                name="species"
                title="Species"
                defaultValue={formData.subject.species}
                dataItems={species()}
                onChange={(e) => itemSelected(e, { key: 'subject' })}
              />
              <InputElement
                id="subject-subjectId"
                type="text"
                name="subject_id"
                title="Subject Id"
                required
                defaultValue={formData.subject.subject_id}
                placeholder="Identification code/number of animal model/patient"
                onInput={(e) => onInput(e, { key: 'subject' })}
              />
              <InputElement
                id="subject-weight"
                type="number"
                name="weight"
                title="weight"
                required
                defaultValue={formData.subject.weight}
                placeholder="Mass of animal model/patient in grams"
                onInput={(e) => onInput(e, { key: 'subject' })}
              />
            </div>
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend>Data Acq Device</legend>
            <div>
              {formData.data_acq_device.map((dataAcqDevice, index) => {
                const key = 'data_acq_device';

                return (
                  <fieldset
                    key={sanitizeTitle(`${dataAcqDevice.name}-dad-${index}`)}
                    className="array-item"
                  >
                    <legend> Item #{index + 1} </legend>
                    <div
                      id={`dataAcqDevice-${index + 1}`}
                      className="form-container"
                    >
                      <InputElement
                        id={`data_acq_device-name-${index}`}
                        type="string"
                        name="name"
                        title="Name"
                        required
                        defaultValue={dataAcqDevice.name}
                        placeholder="name"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`data_acq_device-system-${index}`}
                        type="string"
                        name="system"
                        title="System"
                        required
                        defaultValue={dataAcqDevice.system}
                        placeholder="system"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`data_acq_device-amplifier-${index}`}
                        type="string"
                        name="amplifier"
                        title="Amplifier"
                        required
                        defaultValue={dataAcqDevice.amplifier}
                        placeholder="amplifier"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`data_acq_device-adc_circuit-${index}`}
                        type="string"
                        name="adc_circuit"
                        title="ADC circuit"
                        required
                        defaultValue={dataAcqDevice.adc_circuit}
                        placeholder="adc circuit"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <ArrayUpdateMenu
              itemsKey="data_acq_device"
              items={formData.data_acq_device}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend>Associated Files</legend>
            <div className="form-container">
              {formData.associated_files.map((associatedFilesName, index) => {
                const key = 'associated_files';

                return (
                  <fieldset
                    key={sanitizeTitle(
                      `${associatedFilesName.name}-afn-${index}`
                    )}
                    className="array-item"
                  >
                    <legend> Item #{index + 1} </legend>
                    <div className="form-container">
                      <InputElement
                        id={`associated_files-name-${index}`}
                        type="text"
                        name="name"
                        title="Name"
                        required
                        defaultValue={associatedFilesName.name}
                        placeholder="File name"
                        onInput={(e) =>
                          onInput(e, {
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
                        required
                        defaultValue={associatedFilesName.description}
                        placeholder="description"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <FileUpload
                        id={`associated_files-path-${index}`}
                        title="Path"
                        name="path"
                        placeholder="path"
                        defaultValue={associatedFilesName.path}
                        metaData={{
                          key,
                          index,
                        }}
                        onTextFieldInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                        onInput={itemFileUpload}
                      />
                      <CheckboxList
                        id={`associated_files-taskEpochs-${index}`}
                        type="number"
                        name="task_epochs"
                        title="Task Epochs"
                        objectKind="Task"
                        required
                        defaultValue={associatedFilesName.task_epochs}
                        placeholder="Task Epochs"
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
                  </fieldset>
                );
              })}
            </div>
            <ArrayUpdateMenu
              itemsKey="associated_files"
              items={formData.associated_files}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend>Units</legend>
            <div className="form-container">
              <InputElement
                id="analog"
                type="text"
                name="analog"
                title="Analog"
                placeholder="Analog"
                defaultValue={formData.units.analog}
                onInput={(e) => onInput(e, { key: 'units' })}
              />
              <InputElement
                id="behavioralEvents"
                type="text"
                name="behavioral_events"
                title="Behavioral Events"
                placeholder="Behavioral Events"
                defaultValue={formData.units.behavioral_events}
                onInput={(e) => onInput(e, { key: 'units' })}
              />
            </div>
          </fieldset>
        </div>

        <InputElement
          id="times_period_multiplier"
          type="number"
          name="times_period_multiplier"
          title="Times Period Multiplier"
          placeholder="Times Period Multiplier"
          defaultValue={formData.times_period_multiplier}
          onInput={(e) => onInput(e)}
        />

        <InputElement
          id="raw_data_to_volts"
          type="number"
          name="raw_data_to_volts"
          title="Raw Data to Volts"
          placeholder="raw data to volts"
          defaultValue={formData.raw_data_to_volts}
          onInput={(e) => onInput(e)}
        />

        <FileUpload
          id="defaultHeaderFilePath"
          title="Default Header File Path"
          name="default_header_file_path"
          placeholder="Default Header File Path"
          onTextFieldInput={(e) => onInput(e)}
          defaultValue={formData.default_header_file_path}
          onInput={itemFileUpload}
        />

        <div>
          <fieldset>
            <legend>Cameras</legend>
            <div className="form-container">
              {formData.cameras.map((cameras, index) => {
                const key = 'cameras';
                return (
                  <fieldset
                    key={sanitizeTitle(cameras.id)}
                    className="array-item"
                  >
                    <legend> Item #{index + 1} </legend>
                    <div className="form-container">
                      <InputElement
                        id={`cameras-id-${index}`}
                        type="string"
                        name="id"
                        title="Id"
                        required
                        defaultValue={cameras.id}
                        placeholder="Id"
                        onInput={(e) =>
                          onInput(e, {
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
                        required
                        placeholder="Meters Per Pixel"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            indexCount: index,
                          })
                        }
                      />
                      <InputElement
                        id={`cameras-manufacturer-${index}`}
                        type="string"
                        name="manufacturer"
                        title="Manufacturer"
                        defaultValue={cameras.manufacturer}
                        required
                        placeholder="Manufacturer"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`cameras-model-${index}`}
                        type="string"
                        name="model"
                        title="model"
                        defaultValue={cameras.model}
                        required
                        placeholder="model"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`cameras-lens-${index}`}
                        type="string"
                        name="lens"
                        title="lens"
                        defaultValue={cameras.lens}
                        required
                        placeholder="Lens"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />{' '}
                      <InputElement
                        id={`cameras-cameraname-${index}`}
                        type="string"
                        name="camera_name"
                        title="Camera Name"
                        required
                        defaultValue={cameras.camera_name}
                        placeholder="Camera Name"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <ArrayUpdateMenu
              itemsKey="cameras"
              items={formData.cameras}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend>Tasks</legend>
            <div className="form-container">
              {formData.tasks.map((tasks, index) => {
                const key = 'tasks';

                return (
                  <fieldset
                    key={sanitizeTitle(`${tasks.task_name}-ts-${index}`)}
                    className="array-item"
                  >
                    <legend> Item #{index + 1} </legend>
                    <div className="form-container">
                      <InputElement
                        id={`tasks-taskname-${index}`}
                        type="string"
                        name="task_name"
                        title="Task Name"
                        required
                        defaultValue={tasks.task_name}
                        placeholder="Task Name"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`tasks-taskdescription-${index}`}
                        type="string"
                        name="task_description"
                        title="Task Description"
                        required
                        defaultValue={tasks.task_description}
                        placeholder="Task Description"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`tasks-taskenvironment-${index}`}
                        type="string"
                        name="task_environment"
                        title="Task Environment"
                        required
                        defaultValue={tasks.task_environment}
                        placeholder="Task Environment"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <CheckboxList
                        id={`tasks-cameraid-${index}`}
                        type="number"
                        name="camera_id"
                        title="Camera Id"
                        objectKind="Camera"
                        required
                        defaultValue={tasks.camera_id}
                        placeholder="Camera ids"
                        dataItems={cameraIdsDefined}
                        updateFormData={updateFormData}
                        metaData={{
                          nameValue: 'camera_id',
                          keyValue: 'tasks',
                          index,
                        }}
                        onChange={updateFormData}
                      />

                      <InputElement
                        id={`task-taskEpochs-${index}`}
                        type="string"
                        name="task_epochs"
                        title="Task Epochs"
                        required
                        defaultValue={tasks.task_epochs}
                        placeholder="Task Epochs"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                            isCommaSeparatedStringToNumber: true,
                          })
                        }
                      />
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <ArrayUpdateMenu
              itemsKey="tasks"
              items={formData.tasks}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend>Associated Video Files</legend>
            <div className="form-container">
              {formData.associated_video_files.map(
                (associatedVideoFiles, index) => {
                  const key = 'associated_video_files';
                  return (
                    <fieldset
                      key={sanitizeTitle(
                        `${associatedVideoFiles.name}-avf-${index}`
                      )}
                      className="array-item"
                    >
                      <legend> Item #{index + 1} </legend>
                      <div className="form-container">
                        <InputElement
                          id={`associated_video_files-name-${index}`}
                          type="string"
                          name="name"
                          title="Name"
                          required
                          defaultValue={associatedVideoFiles.name}
                          placeholder="name"
                          onInput={(e) =>
                            onInput(e, {
                              key,
                              index,
                            })
                          }
                        />
                        <SelectElement
                          type="number"
                          name="camera_id"
                          title="Camera Id"
                          required
                          placeholder="Camera Id"
                          defaultValue={associatedVideoFiles.camera_id}
                          dataItems={cameraIdsDefined}
                          onChange={(e) => itemSelected(e)}
                        />
                      </div>
                    </fieldset>
                  );
                }
              )}
            </div>
            <ArrayUpdateMenu
              itemsKey="associated_video_files"
              items={formData.associated_video_filestasks}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend>Behavioral Events</legend>
            <div className="form-container">
              {formData.behavioral_events.map((behavioralEvents, index) => {
                const key = 'behavioral_events';

                return (
                  <fieldset
                    key={sanitizeTitle(
                      `${behavioralEvents.description}-be-${index}`
                    )}
                    className="array-item"
                  >
                    <legend> Item #{index + 1} </legend>
                    <div className="form-container">
                      <SelectInputPairElement
                        id={`behavioral_events-description-${index}`}
                        type="number"
                        name="description"
                        title="Description"
                        items={behavioralEventsDescription()}
                        required
                        defaultValue={behavioralEvents.description}
                        placeholder="description"
                        metaData={{
                          key,
                          index,
                        }}
                        onInput={onInput}
                      />
                      <DataListElement
                        id={`behavioral_events-name-${index}`}
                        name="name"
                        title="Name"
                        dataItems={behavioralEventsNames()}
                        defaultValue={behavioralEvents.name}
                        onChange={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <ArrayUpdateMenu
              itemsKey="behavioral_events"
              items={formData.behavioral_events}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <SelectElement
          id="device"
          name="device"
          title="Device"
          dataItems={device()}
          defaultValue={formData.device}
          onChange={(e) => itemSelected(e)}
        />

        <div>
          <fieldset>
            <legend>Electrode Groups</legend>
            <div className="form-container">
              {formData.electrode_groups.map((electrodeGroup, index) => {
                const electrodeGroupId = electrodeGroup.id;
                const nTrodeItems =
                  formData?.ntrode_electrode_group_channel_map?.filter(
                    (n) => n.electrode_group_id === electrodeGroupId
                  ) || [];
                const key = 'electrode_groups';

                return (
                  <fieldset key={electrodeGroupId} className="array-item">
                    <legend> Item #{index + 1} </legend>
                    <div className="form-container">
                      <InputElement
                        id={`electrode_groups-id-${index}`}
                        type="number"
                        name="id"
                        title="Id"
                        required
                        defaultValue={electrodeGroup.id}
                        placeholder="Id"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <DataListElement
                        id={`electrode_groups-location-${index}`}
                        name="location"
                        title="Location"
                        defaultValue={electrodeGroup.location}
                        dataItems={locations()}
                        onChange={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <SelectElement
                        id={`electrode_groups-devicetype-${index}`}
                        name="device_type"
                        title="Device Type"
                        dataItems={deviceTypes()}
                        defaultValue={electrodeGroup.deviceType}
                        onChange={(e) =>
                          nTrodeMapSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`electrode_groups-description-${index}`}
                        type="string"
                        name="description"
                        title="Description"
                        required
                        defaultValue={electrodeGroup.description}
                        placeholder="Description"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <DataListElement
                        id={`targetedLocation-${index}`}
                        name={`targeted_location-${index}`}
                        title="Targeted Location"
                        dataItems={locations()}
                        defaultValue={electrodeGroup.targeted_location}
                        onChange={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`electrode_groups-targetedx-${index}`}
                        type="number"
                        name="targeted_x"
                        title="Targeted x"
                        required
                        defaultValue={electrodeGroup.targeted_x}
                        placeholder="Targeted x"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`electrode_groups-targetedy-${index}`}
                        type="number"
                        name="targeted_y"
                        title="Targeted y"
                        required
                        defaultValue={electrodeGroup.targeted_y}
                        placeholder="Targeted y"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <InputElement
                        id={`electrode_groups-targetedz-${index}`}
                        type="number"
                        name="targeted_z"
                        title="Targeted z"
                        required
                        defaultValue={electrodeGroup.targeted_z}
                        placeholder="Targeted z"
                        onInput={(e) =>
                          onInput(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <SelectElement
                        id={`electrode_groups-unit-${index}`}
                        name="units"
                        title="Units"
                        defaultValue={electrodeGroup.units}
                        dataItems={units()}
                        onChange={(e) =>
                          itemSelected(e, {
                            key,
                            index,
                          })
                        }
                      />
                      <div
                        className={`${nTrodeItems.length > 0 ? '' : 'hide'}`}
                      >
                        <ChannelMap
                          title="Ntrode"
                          electrodeGroupId={electrodeGroupId}
                          nTrodeItems={nTrodeItems}
                          updateFormData={updateFormData}
                          onInput={(e) =>
                            onInput(e, {
                              key: 'ntrode_electrode_group_channel_map',
                              name: 'map',
                              index,
                            })
                          }
                          onMapInput={onMapInput}
                        />
                      </div>
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <ArrayUpdateMenu
              itemsKey="electrode_groups"
              items={formData.electrode_groups}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </fieldset>
        </div>

        <div className="submit-button-parent">
          <input type="submit" value="Create YML" className="submit-button" />
        </div>
      </form>
    </>
  );
}

export default YMLGenerator;
