import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import SelectInputPairElement from '../element/SelectInputPairElement';
import DataListElement from '../element/DataListElement';
import ArrayItemControl from '../element/ArrayItemControl';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import { behavioralEventsNames, behavioralEventsDescription } from '../valueList';

/**
 * BehavioralEventsFields component
 *
 * Renders the behavioral events section of the form, supporting multiple events.
 * Each event has description (DIO) and name fields.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The behavioral events fields section
 */
export default function BehavioralEventsFields() {
  const { model: formData, actions } = useStoreContext();
  const { handleChange, onBlur, itemSelected, addArrayItem, removeArrayItem, duplicateArrayItem } = actions;
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
