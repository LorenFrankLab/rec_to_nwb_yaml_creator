import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';
import CheckboxList from '../element/CheckboxList';
import ListElement from '../element/ListElement';
import ArrayItemControl from '../element/ArrayItemControl';
import ArrayUpdateMenu from '../ArrayUpdateMenu';
import { formatTaskLabel } from '../utils/labelFormatters';

/**
 * TasksFields component
 *
 * Renders the tasks section of the form, supporting multiple tasks.
 * Each task has name, description, environment, camera IDs, and task epochs.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @returns {JSX.Element} The tasks fields section
 */
export default function TasksFields() {
  const { model: formData, actions, selectors } = useStoreContext();
  const { handleChange, onBlur, updateFormData, updateFormArray, addArrayItem, removeArrayItem, duplicateArrayItem } = actions;
  const cameraIdsDefined = selectors.getCameraIds();
  return (
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
                <summary>{formatTaskLabel(tasks)}</summary>
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
                  />
                  <ListElement
                    id={`tasks-task_epochs-${index}`}
                    type="number"
                    step="1"
                    name="task_epochs"
                    title="Task Epochs"
                    defaultValue={tasks.task_epochs}
                    placeholder="What epochs this task is applied"
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
  );
}
