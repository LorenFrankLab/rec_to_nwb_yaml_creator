import React, { useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Provides a means to get a file path
 * @param {object} fileProperty - Custom element's properties
 * @returns {React.ReactElement} Virtual DOM for File upload
 */
const FileUpload = (fileProperty) => {
  const {
    title,
    name,
    required,
    placeholder,
    id,
    defaultValue,
    onTextFieldInput,
    onBlur,
    metaData,
  } = fileProperty;
  const fileInputElement = useRef(null);

  const onNewFileSelected = (e) => {
    const { files } = e.target;
    const fileName =
      files && files.length > 0 ? files[0].name : '';

    fileInputElement.current.value = fileName;
    onBlur(e, fileName, metaData);

    fileInputElement.current.setCustomValidity('Only file name is shown. W3C HTML rules prohibit web applications from accessing users\'s full file path');
    fileInputElement.current.reportValidity();

    setTimeout(() => {
      fileInputElement.current.setCustomValidity('');
    }, 20000);
  };

  return (
    <div className="container">
      <label className="item1" htmlFor={title} placeholder={placeholder}>
        <span>{title} </span>
      </label>
      <div className="item2 file-upload">
        <input
          type="text"
          ref={fileInputElement}
          id={id}
          name={name}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          onBlur={(e) => onTextFieldInput(e)}
        />
        <input
          type="file"
          id={`${id}-file`}
          name={name}
          onChange={onNewFileSelected}
        />
      </div>
    </div>
  );
};

FileUpload.propTypes = {
  title: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  defaultValue: PropTypes.string,
  required: PropTypes.string,
  className: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  dataFormat: PropTypes.string,
  fileObjectId: PropTypes.string.isRequired,
  metaData: PropTypes.instanceOf(Object),
  onBlur: PropTypes.func.isRequired,
};

FileUpload.defaultProps = {
  required: false,
};

export default FileUpload;
