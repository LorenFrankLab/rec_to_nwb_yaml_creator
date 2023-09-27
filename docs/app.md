# App File

The file `./../src/renderer/app.js` is the main application in `rec_to_nwb_yaml_creator`. It is so important that is deserves its own page. Literally everything in `rec_to_nwb_yaml_creator` revolves around it. It has been kept lean by moving things like `./../src/renderer/InputElement.jsx` and many others functionality into separate. Yet, it still over 1000 lines of code.

Most of the maintenance and updates to `rec_to_nwb_yaml_creator` will touch `./../src/renderer/app.js`. Therefore, keep part of it will be discussed.

## The Beginning

`rec_to_nwb_yaml_creator` is brought into the application via `./../src/renderer/App.tsx`. The details of the file is beyond the scope of this work. You can read it on more [advance React tutorials](<https://www.w3schools.com/react/react_router.asp>) and you need an understanding of [Single page applications](<https://en.wikipedia.org/wiki/Single-page_application>.) For the purposes of `rec_to_nwb_yaml_creator`, all you need to know is that it bring in `./../src/renderer/app.js`.

## Composition

`./../src/renderer/app.js` contain a function called `app`. This function consist of other functions, constants and a return markup. The markup it will is what is displayed in `rec_to_nwb_yaml_creator`. Here are a description of the main supporting functionality -

- **_formData_**:
`formData` is a [state](<https://www.w3schools.com/react/react_usestate.asp>). It is essentially an in-memory storage of the YAML to be generated for the yml file. `setFormData` is a part of [state](<https://www.w3schools.com/react/react_usestate.asp>). It is a function need to update `formData`. The Javascript object in the declaration of `formData` is the initial value minus the array-type values. The array type values are added on creation of array entry.

The power of `formData` lie in that if it is updated, it also updated the user interface. That is also one of the key powers of [React](<https://reactjs.org/>.) A simplified tutorial can be found at [https://upmostly.com/tutorials/how-to-refresh-a-page-or-component-in-react](<https://upmostly.com/tutorials/how-to-refresh-a-page-or-component-in-react>)

**_Never update form data directly_**. What you do is clone `formData`, using either with [Javascript's spread](<https://www.geeksforgeeks.org/javascript-spread-operator/>) for swallow data or [strucuturedClone](<https://developer.mozilla.org/en-US/docs/Web/API/structuredClone>) for deeply nested data. Modify this clone as need. Once done, use `setFormData` to update `formData`.

- **_cameraIdsDefined and setCameraIdsDefined_** along with **_taskEpochsDefined, setTaskEpochsDefined__** are states used to hold the current selected `camera_ids` and `task_epochs` respectively in `rec_to_nwb_yaml_creator` this is important because they are used to provide options in controls of what `camera_ids` and `task_epochs` are available to use in `rec_to_nwb_yaml_creator`. `rec_to_nwb_yaml_creator` uses **_cameraIdsDefined_** to know what to display in `tasks'` `camera id` option and this is update automatically if **_cameraIdsDefined_** is updated. A similar concept applies to `task_epochs`.

- **_schema_**: Stores an in-memory copies of the `./../assets/jsonSchema.json` file. To access the content of any [useRef](<https://www.w3schools.com/react/react_useref.asp>) type, use `.current`; like `schema.current` for `schema`.

- **_updateFormData_**: A common place for encapsulating updates to `formData`

-**_generateYMLFile_**: Where the `formData` is validated against `schema` to ensure it is valid, and then passed to `./../src/main/main.ts` to be converted to a yml file.
