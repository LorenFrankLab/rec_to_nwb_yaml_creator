import React from 'react';
import { useStoreContext } from '../state/StoreContext';
import InputElement from '../element/InputElement';
import RadioList from '../element/RadioList';
import ArrayItemControl from '../element/ArrayItemControl';
import ArrayUpdateMenu from '../ArrayUpdateMenu';

/**
 * AssociatedFilesFields Component
 *
 * Renders form fields for associated files and associated video files.
 * Both sections have dependencies on task epochs, and video files also depend on camera IDs.
 *
 * Uses the shared store context to access form data and actions, eliminating
 * the need for prop drilling from App.js.
 *
 * @component
 * @returns {JSX.Element} Associated files fields section
 */
function AssociatedFilesFields() {
  const { model: formData, actions, selectors } = useStoreContext();
  const {
    handleChange,
    onBlur,
    updateFormData,
    addArrayItem,
    removeArrayItem,
    duplicateArrayItem,
  } = actions;

  const taskEpochsDefined = selectors.getTaskEpochs();
  const cameraIdsDefined = selectors.getCameraIds();
  return (
    <>
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
    </>
  );
}

export default AssociatedFilesFields;
