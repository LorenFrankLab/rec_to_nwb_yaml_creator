# Fields

## Item Types

There are three type of items in `rec_to_nwb_yaml_creator`

- Key/Value Pair
- Object
- Array

### Key/Value Pair

Key value pair essentials consist of a key and a corresponding value that is either a string or number. An example is **experimenter_name**, where it's value could be "Michael Jackson" or 555.

### Object

Object consist of a key whose value is itself a grouping of key/value pairs. Values are accessed by their key. Each item in the object is related. It groups multiple key/value pairs into a single unit. An example would be-
  `**subject** with values of
  description: Best all round entertainer ever
  genotype: G1
  sex: Male
  species: Human
  subject_id: 1
  weight: 170`

To access the sample's above `subject_id`, you do- `subject[subject_id]`

### Array

Array is a numbered collection of entries; where entries can be between 0 to any number that can be stored in memory. `rec_to_nwb_yaml_creator` does not allow an array to be `null` (equivalent to `None` in Python) or `undefined` (no direct equivalent in Python but can be considered `None`.) The item can be a key/value pair, object or anther array. It serves to have store a group who may not be related. An example is `associated_files`. Each entry is an object that consisting of keys- "name", "description", "path", "task_epochs". Name, description and path are key/value pairs and task_epochs is an array whose entry are strings. The object follows the same concepts as Object described above; albeit keys are different.  

## Different Fields

The information in **Item Types** is the building blocks for the fields `rec_to_nwb_yaml_creator` supports and is the building block of `rec_to_nwb_yaml_creator`. The types are mixed and match to enable researchers construct the yml file for later use with [NWB](<https://pynwb.readthedocs.io/en/stable/index.html>)

1. **_experimenter\_name_**: The name of the experimenter conducting the experiment. It's value is a string. There can be multiple spaces. An example is _Michael Jackson_. There is currently no means to separate the first name from the last name.

2. **_lab_**: The laboratory conducting the experiment. It is a string. An example is _Jackson Laboratory_.

3. **_institution_**: The institute where the experiment is conducted. A user can select from a list of pre-determined institute or use one not in the list.

4. **_session\_description_**:  Summary of the key points of the session. It is a key/value pair whose value is a string.

5. **_session\_id_**:  Identification code for the session. It is a key/value pair whose value is a string.

6. **_subject_**: Grouping of information about the model/human the session is studying.
   Subject consist of key/value pair that information on the **_subject_**. The key/value pairs are -

   - **_description_**: Summary of the key points of the subject. It is a string a user can type in.
   - **_genotype_**: Subject's genotype, for example, _wild type_. It is currently a string.
   - **_sex_**: Subject's gender. It is a drop down menu with fixed options.
   - **_species_**: Subject's species. It can be added from a drop down list or type in by a user
   - **_subject_id_**: Subject's identification code. It is a string.
   - **_weight_**: Subject's weight. `rec_to_nwb_yaml_creator` has no means for setting a unit. So a research needs to keep note of the user used. And it is recommendation consistently be kept across all sessions.

7. **_data_acq_device_**: The Data Acquisition Device used to obtain data. It is an object. The items in **_data_acq_device_** are -

   - **_name_**: Data Acquisition Device's name.
   - **_system_**: Data Acquisition Device's specific category.
   - **_amplifier_**: Amplifier used with the Data Acquisition Device.
   - **_adc_circuit_**: Any supporting circuitry used with the Data Acquisition Device.

8. **_associated\_files_**: Files associated with the session. Is is an array. Each entry in **_associated\_files_** is an object consisting of -

   - **_name_**: Associated File's name.
   - **_description_**: Associated File's summarized details.
   - **_path_**: Path to the file.
   - **_task\_epochs_**: Associated File's epoch numbers. This is an array.
  
9. **_units_**: The units

   - **_analog_**:
   - **_behavioral_events_**:
  
10. **_times_period_multiplier_**:

11. **_raw_data_to_volts_**:

12. **_default_header_file_path_**:

13. **_cameras_**:

14. **_tasks_**:

15. **_associated_video_files_**:

16. **_behavioral_events_**:

17. **_device_**:

18. **_electrode_groups_**:

19. **_\ntrode\_electrode\_group\_channel\_map_**:

