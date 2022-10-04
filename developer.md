# Developer Notes

## Design Goal

This application has the following goals in mind

- use JSON Schema (jsonSchema.json file) to have a means to validate generated yml file
- use JSON Schema (jsonSchema.json file) to have a means to validate recieved yml file
- use JSON Schema to create the UI (ymlGenerator.jsx and supporting file)

Everyone in th application supports one of more of the goals.

## Division

'''ymlGenerator.jsx''' is the main workhorse of the application.

Large components are separated into their own files FileUpload.jsx (used to building file upload UI)

Large boilerplate code is seperated to its own file to avoid clustering ymlGenerator.jsx. An example is
deviceType.js (holds code needed for building ntrode map)
