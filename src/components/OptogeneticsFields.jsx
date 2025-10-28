import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';
import SelectElement from '../element/SelectElement';
import RadioList from '../element/RadioList';
import CheckboxList from '../element/CheckboxList';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import ArrayItemControl from '../element/ArrayItemControl';
import {
  optoExcitationModelNames,
  opticalFiberModelNames,
  virusNames,
} from '../valueList';
import {
  formatOptoSourceLabel,
  formatOpticalFiberLabel,
  formatVirusInjectionLabel,
  formatFsGuiLabel,
} from '../utils/labelFormatters';

/**
 * OptogeneticsFields Component
 *
 * Renders all optogenetics configuration sections including light sources,
 * fiber implants, virus injections, FsGUI protocols, and software settings.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @component
 * @returns {JSX.Element} Optogenetics fields section
 */
export default function OptogeneticsFields() {
  const { model: formData, actions, selectors } = useStoreContext();
  const {
    handleChange,
    onBlur,
    itemSelected,
    updateFormData,
    updateFormArray,
    addArrayItem,
    removeArrayItem,
    duplicateArrayItem,
  } = actions;

  const taskEpochsDefined = selectors.getTaskEpochs();
  const dioEventsDefined = selectors.getDioEvents();
  const cameraIdsDefined = selectors.getCameraIds();
  return (
    <>
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
            <summary>{formatOptoSourceLabel(item)}</summary>
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
              <SelectElement
                  id={`opto_excitation_source-model_name-${index}`}
                  name="model_name"
                  title="Hardware Model Name"
                  dataItems={optoExcitationModelNames()}
                  value={item.model_name || ''}
                  placeholder="Model of the hardware"
                  onChange={(e) => {
                    handleChange('model_name', 'opto_excitation_source', index)(e);
                    itemSelected(e, {
                      key,
                      index,
                    });
                  }}
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
                value={item.power_in_W}
                onChange={handleChange('power_in_W', 'opto_excitation_source', index)}
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
      items={formData.opto_excitation_source}
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
          <summary>{formatOpticalFiberLabel(item)}</summary>
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
              placeholder="Model of the fiber hardware device"
              onChange={(e) => {
                handleChange('hardware_name', 'optical_fiber', index)(e);
                itemSelected(e, {
                  key,
                  index,
                });
              }}
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
            <summary>{formatVirusInjectionLabel(item)}</summary>
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
                  placeholder="Model of the hardware"
                  onChange={(e) => {
                    handleChange('virus_name', 'virus_injection', index)(e);
                    itemSelected(e, {
                      key,
                      index,
                    });
                  }}
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
            <summary>{formatFsGuiLabel(fsGuiYamls)}</summary>
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
      type="text"
      name="optogenetic_stimulation_software"
      title="Optogenetic Stimulation Software"
      value={formData.opto_software}
      onChange={handleChange('opto_software')}
      defaultValue="fsgui"
      placeholder="Software used for optogenetic stimulation"
      onBlur={(e) => onBlur(e)}
      validation={{ type: 'required' }}
    />
</div>
    </>
  );
}
