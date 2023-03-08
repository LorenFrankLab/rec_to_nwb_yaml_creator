# File

## Folders

`rec_to_nwb_yaml_creator` has two folders where the most important code files are stored -

- `main`
- `renderer`

`main` has code for mostly [boilerplate code](<https://en.wikipedia.org/wiki/Boilerplate_code>) for [Electron](<https://www.electronjs.org/>) created by [Electron React Boilerplate](<https://github.com/electron-react-boilerplate/>.) However, it does contain function doing things like accessing files from a user's computer. For example, `main.ts`, the function - `ipcMain.on('SAVE_USER_DATA', async (event, userData)` is used to save a yml file to a computer running  `rec_to_nwb_yaml_creator`.

`renderer` also has some [boilerplate code](<https://en.wikipedia.org/wiki/Boilerplate_code>) created by created by [Electron React Boilerplate](<https://github.com/electron-react-boilerplate/>.) However, it contain nearly all of `rec_to_nwb_yaml_creator`'s core functionality.

## Important Files

This sub-section will focus only on `renderer` and only files of importance to adding new features to `rec_to_nwb_yaml_creator` or fixing issues.

- **_App.css_**: Contains [CSS](<https://en.wikipedia.org/wiki/CSS>) for the entire `rec_to_nwb_yaml_creator`.


-**_ArrayUpdateMenu.jsx_**: Custom tag code for add and remove buttons for arrays. It was created to help reduce [code duplication](<https://en.wikipedia.org/wiki/Duplicate_code>.)

-**_ChannelMap.jsx_**: Custom tag code for painting (term used to describe displaying HTML) maps of `ntrode\_electrode\_group\_channel\_map`.

-**_CheckboxList.jsx_**: Custom tag code for creating check box list. HTML [select with multiple as an attribute](<https://www.w3schools.com/TAGS/tryit.asp?filename=tryhtml_select_multiple>) has a look-and-feel that a web search hinted it not being using freely. For example see - [https://ux.stackexchange.com/questions/6122/does-the-average-user-understand-the-standard-html-multiple-select-box](<https://ux.stackexchange.com/questions/6122/does-the-average-user-understand-the-standard-html-multiple-select-box>.) So a custom tag with check boxes was made.

-**_DataListElement.jsx_**: Wrapper around HTML [datalist](<https://developer.mozilla.org/en-US/docs/Web/HTML/Element/datalist>). `rec_to_nwb_yaml_creator` need [datalist](<https://developer.mozilla.org/en-US/docs/Web/HTML/Element/datalist>) with supporting HTML tags and CSS (<https://en.wikipedia.org/wiki/CSS>) many times. This custom tag was made so this can be done multiple times without [code duplication](<https://en.wikipedia.org/wiki/Duplicate_code>.)

-**_deviceTypes.js_**: JSON schema for `ntrode\_electrode\_group\_channel\_map`. This is the only part of `rec_to_nwb_yaml_creator` not in jsonSchema.json (./../assets/jsonSchema.json). Details why will be provided in a different section.

-**_FileUpload.jsx_**: File upload custom tag. HTML [input with type=file](<https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file>) is commonly used for uploading files. But it did not have features `rec_to_nwb_yaml_creator` needed. So a wrapper around HTML [input with type=file](<https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file>) was created to extend it.

-**_index.ejs_**: Contains the [HTML skeleton](<https://www.w3schools.com/w3css/w3css_web_html.asp>) for `rec_to_nwb_yaml_creator`. Most of the non-fundamental aspects are moved to other files, to keep this lightweight and very focused.

-**_InputElement.jsx_**: Wrapper around [HTML input with type being string or number] (<https://www.w3schools.com/tags/tag_input.asp>.) [HTML input with type being string or number] (<https://www.w3schools.com/tags/tag_input.asp>) did not satisfy all of `rec_to_nwb_yaml_creator`'s needs, so this custom tag to extend it was made. Use only string or number with it. It is recommended you make a new custom tag if you need any other option [HTML input with type being string or number](<https://www.w3schools.com/tags/tag_input.asp>) supports, as illustrate with **_FileUpload.jsx_**. This helps keeps this custom tag focused on text or numbers.

-**_valueList.js_**: Data to be used by drop downs like _DataListElement.jsx and any other item that needs a data set.

-**_SelectElement.jsx_**: Wrapper around [HTML select](<https://developer.mozilla.org/en-US/docs/web/html/element/select>.) The attribute `multiple`(<https://www.w3schools.com/TAGS/att_select_multiple.asp#:~:text=HTML%20%3Cselect%3E%20multiple%20Attribute%201%20Definition%20and%20Usage,3%20Syntax%20%3Cselect%20multiple%3E%20%E2%9D%AE%20HTML%20%3Cselect%3E%20tag>) is not supported. This custom tag extends the functionality of [HTML select](<https://developer.mozilla.org/en-US/docs/web/html/element/select>) to suit `rec_to_nwb_yaml_creator`'s needs and help reduce [code duplication](<https://en.wikipedia.org/wiki/Duplicate_code>.)

-**_SelectInputPairElement_**: Combines [HTML select](<https://developer.mozilla.org/en-US/docs/web/html/element/select>) and [HTML input with type = number](<https://www.w3schools.com/tags/tag_input.asp>),so that both can act as a unit. This was needed for **Behavioral Events**. However, it can be used for other things that needs it's functionality.

-**_utils.js_**: Repository of miscellaneous functionality of value across all other files.

-**_ymlGenerator.js_**: This is the primary file in the application. It drives everything in `rec_to_nwb_yaml_creator`. More detail will be provided in a different section.
