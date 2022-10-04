import React, { useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * HTML tag for file upload
 *
 * @param {file properties} fileProperties
 * @returns HTML for File upload
 */
const FileUpload = (fileProperty) => {
  const {
    title,
    name,
    required,
    className,
    placeholder,
    dataFormat,
    id,
    onInput,
  } = fileProperty;
  const fileInputElement = useRef(null);
  const onNewFileSelected = (e) => {
    const { value } = e.target;
    fileInputElement.current.value = value;
    onInput(value);
  };

  return (
    <div className="container">
      <label className="item1" htmlFor={title} placeholder={placeholder}>
        <span>{title?.replaceAll('_', ' ')} &nbsp; </span>
      </label>
      <div className="item2">
        <input
          type="text"
          ref={fileInputElement}
          className={`${className}`}
          id={id}
          data-format={dataFormat}
          name={name}
          required={required}
          placeholder={placeholder}
          onInput={(e) => onNewFileSelected(e)}
        />
        <input
          type="file"
          id={`${id}-file`}
          name={title}
          onInput={onNewFileSelected}
        />
      </div>
    </div>
  );
};

FileUpload.propType = {
  title: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  defaultValue: PropTypes.string,
  required: PropTypes.string,
  className: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  dataFormat: PropTypes.string,
  fileObjectId: PropTypes.string.isRequired,
  onInput: PropTypes.func.isRequired,
};

export default FileUpload;
