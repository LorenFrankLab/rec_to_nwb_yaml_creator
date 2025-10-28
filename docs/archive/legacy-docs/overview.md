# Overview

## Lab Needs

YML files are needed in building Frank Lab pipeline of data processing. There wer many issues that occurred frequently in this endeavor. Like, there was a lack of a consistent way to add key value pairs in some cases. Someone may put "UCSF" as the institution. Another may write "University of California at San Francisco". The was no mechanism to instruct researchers of an missing property. There was no system that provided validation of the YML file.A system that created a "pit of success" could potentially remedy or alleviate these and many other issues. That application was built to address this need.

## Break down

At a high level, the application does two things -

- Eases creation of a YML file
- Reads in an existing YML file for modification

All data is processed as a Javascript object (essentially JSON, key/value pair.) Any YAML data is made to confirm to JSON. But the Javascript object is converted to YAML prior to file creation.

### File Creation

In the case of creation, user inputs values to keys. The user then click on the button to generate the YML file that are based on the inputted values. The system `rec_to_nwb_yaml_creator` performs validation once on clicking the button to generate the yml file (like ensures required keys have values) and against a JSON schema (to ensure the result file confirms to standards.) Validation failures means the file is not created and a user is giving information on what to address. Successful validation opens a save dialog box to save the file.

### File Update

For reading in an existing file, the `rec_to_nwb_yaml_creator` first reads in a yml file. The YAML is then convert to Javascript object as Javascript has many tools for process Javascript. The data is validated against a JSON schema file. The user is given a warning if validation fails and not giving an option to modify the file. But the user has the data read into `rec_to_nwb_yaml_creator` and can proceed as definition in the file creation steps earlier described.

## JSON schema

The JSON schema (<https://json-schema.org/>) validation file is jsonSchema.json (./../assets/jsonSchema.json). It has rules dictating particulars for every part of the yml file. TutorialPoint (<https://www.tutorialspoint.com/json/json_schema.htm>) has a basic tutorial on the topic.

A detailed discussion of the JSON schema (<https://json-schema.org/>) is beyond the scope of this over. YouTube (<http:www.youtube.com>) has many videos on the topic like _An Introduction to JSON Schema_ (<https://www.youtube.com/watch?v=dtLl37W68g8>) and or you can do a Google search (<https://www.google.com/search?q=json_schema>). This overview will focus on the essentials.

In jsonSchema.json (./../assets/jsonSchema.json), look for the very first "properties"-text. It has a children. Each child is an item you can modify in this application. The fields correspond to what can be updated in this application. See the **Fields** page for more details.
