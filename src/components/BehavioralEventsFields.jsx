import React from 'react';
import PropTypes from 'prop-types';
import SelectInputPairElement from '../element/SelectInputPairElement';
import DataListElement from '../element/DataListElement';
import ArrayItemControl from '../element/ArrayItemControl';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import { behavioralEventsNames, behavioralEventsDescription } from '../valueList';

export default function BehavioralEventsFields({
  formData,
  handleChange,
  onBlur,
  itemSelected,
  addArrayItem,
  removeArrayItem,
  duplicateArrayItem,
}) {
  return (
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
  );
}

BehavioralEventsFields.propTypes = {
  formData: PropTypes.shape({
    behavioral_events: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string,
        name: PropTypes.string,
      })
    ).isRequired,
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func.isRequired,
  itemSelected: PropTypes.func.isRequired,
  addArrayItem: PropTypes.func.isRequired,
  removeArrayItem: PropTypes.func.isRequired,
  duplicateArrayItem: PropTypes.func.isRequired,
};
