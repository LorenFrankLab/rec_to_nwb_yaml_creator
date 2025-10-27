import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';
import DataListElement from '../element/DataListElement';
import SelectElement from '../element/SelectElement';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import ArrayItemControl from '../element/ArrayItemControl';
import ChannelMap from '../ntrode/ChannelMap';
import { locations, deviceTypes, units } from '../valueList';

/**
 * ElectrodeGroupFields Component
 *
 * Renders the electrode groups form section with dynamic ntrode channel mapping.
 * Each electrode group has targeting coordinates, device type selection, and
 * associated ntrode channel maps that are generated based on device type.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @component
 * @returns {JSX.Element} Electrode groups form section
 */
export default function ElectrodeGroupFields() {
  const { model: formData, actions } = useStoreContext();
  const {
    handleChange,
    onBlur,
    itemSelected,
    nTrodeMapSelected,
    addArrayItem,
    removeElectrodeGroupItem,
    duplicateElectrodeGroupItem,
    updateFormArray,
    onMapInput,
  } = actions;
  return (
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
                <summary>Electrode Group {electrodeGroup.id} - {electrodeGroup.location || 'Unnamed'}</summary>
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
                    min="0"
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
                    onChange={(e) => {
                      handleChange('device_type', 'electrode_groups', index)(e);
                      nTrodeMapSelected(e, {
                        key,
                        index,
                      });
                    }}
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
  );
}
