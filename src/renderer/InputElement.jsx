import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import PubSub from 'pubsub-js';
import {
  ASYNC_TOPICS,
  commaSeparatedStringToNumber,
  cameraIdsDependentDataForms,
} from './utils';

const InputElement = (property) => {
  const {
    id,
    $id,
    title,
    placeholder,
    defaultValue,
    dataMarker,
    type,
    name,
    keyProp,
    dataFormat,
    hasDataList,
    examples,
    required,
    readOnly,
    onInput,
  } = property;
  const list = hasDataList ? `${title}-datalist-options` : '';
  const elementDependsOnCameraId =
    cameraIdsDependentDataForms.includes(dataFormat);
  const cameraIds = useRef([]);
  const placeholderMessage = () => {
    const currentCameraIds = cameraIds.current;

    return `Available camera Ids - ${currentCameraIds}`;
  };
  const [placeholderState, setPlaceholderState] = useState(
    elementDependsOnCameraId ? placeholderMessage() : placeholder
  );

  const isRequired = () => {
    return required || elementDependsOnCameraId;
  };

  const onChange = (e) => {
    const { target } = e;
    const { value } = target;

    if (elementDependsOnCameraId) {
      const currentCameraIds = cameraIds.current;
      const userCameraInputs = commaSeparatedStringToNumber(value);
      const isCameraIdsValid = userCameraInputs.some((cameraId) => {
        return currentCameraIds.includes(cameraId);
      });

      target.setCustomValidity(
        isCameraIdsValid
          ? ''
          : `Camera ids - ${value}. None is availble among the camera id objects. Available options - ${
              currentCameraIds.length === 0
                ? 'N/A, create a camera object'
                : currentCameraIds
            }`
      );

      setPlaceholderState(placeholderMessage());
    }
  };

  // TODO: Fix this. structuredclone add [[prototype]] to clones objects. It needs
  // to be removed
  if (!title) {
    return null;
  }

  PubSub.subscribe(ASYNC_TOPICS.cameraIdsUpdated, (message, data) => {
    const cameraIdsList = cameraIds.current;
    cameraIdsList.push(data.cameraId);
    cameraIds.current = [...new Set(cameraIdsList)];
  });

  return (
    <div className="container" key={keyProp}>
      <label className="item1" htmlFor={id} placeholder={placeholder}>
        <span>{title?.replaceAll('_', ' ')} &nbsp; </span>
      </label>
      <div className="item2">
        <input
          type={['integer', 'number'].includes(type) ? 'number' : 'text'}
          name={name}
          list={list}
          step="any"
          id={$id}
          defaultValue={defaultValue}
          className="base-width"
          data-format={dataFormat}
          data-marker={dataMarker}
          required={() => isRequired()}
          placeholder={placeholderState}
          readOnly={readOnly}
          onChange={onChange}
          onInput={onInput}
        />
        {hasDataList ? (
          <datalist id={list}>
            {examples?.map((example) => (
              <option key={example.replaceAll(' ', '')} value={example}>
                {example}
              </option>
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  );
};

InputElement.propType = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  dataMarker: PropTypes.string,
  title: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  keyProp: PropTypes.string,
  type: PropTypes.string,
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  required: PropTypes.bool,
  dataFormat: PropTypes.string,
  examples: PropTypes.instanceOf(Array),
  readOnly: PropTypes.bool,
  onInput: PropTypes.func.isRequired,
};

InputElement.defaultProps = {
  hasDataList: false,
  name: '',
  list: '',
  dataFormat: '',
  dataMarker: 'n/a',
  readOnly: false,
  onInput: () => {},
};

export default InputElement;
