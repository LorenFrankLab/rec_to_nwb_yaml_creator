import React, { useRef }  from 'react';
import PropTypes from 'prop-types';

/**
 * Provides a text box
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for creating an input[type="string|number"] with
 * supporting HTML tags and code
 */
const ListElement = (prop) => {
  const {
    id,
    type,
    title,
    name,
    placeholder,
    defaultValue,
    metaData,
    required,
    inputPlaceholder,
    updateFormData,
    step,
    readOnly,
  } = prop;

  const addListItem = (e, valueToAddObject) => {
   const value = valueToAddObject.current.value?.trim();

    if (value) {
      const items = structuredClone(defaultValue || []);
      items.push(value);
      updateFormData(metaData.nameValue, items, metaData.keyValue, metaData.index)
      valueToAddObject.current.value = '';
    }

    e.preventDefault();
    return false;
  };

  const addListItemViaEnterKey = (e, valueToAddObject) => {
    if (e.key !== 'Enter') {
      return;
    }

    addListItem(e, valueToAddObject)
  }

  const removeListItem = (e, value) => {
    const items = structuredClone(defaultValue || []).filter((v) => v !== value);
    updateFormData(metaData.nameValue, items, metaData.keyValue, metaData.index)
    e.stopPropagation();
  };

  const listData = useRef();

  const valueToAdd = useRef('');

  return (
    <label className="container" htmlFor={id}>
      <div className="item1" title={placeholder}>
        {title}
      </div>
      <div className="item2">
        <div className={`list-of-items base-width ${readOnly ? 'gray-out' : ''}`} ref={listData}>
          { defaultValue?.length === 0
            ? <span>{`${inputPlaceholder}`}</span>
            : defaultValue?.map((item) => <>
              <span>
                {item} <button type="button" onClick={(e)=> removeListItem(e, item)}>&#x2718;</button>
              </span>&nbsp;</>)}
          <>
            {' '}
            <input
              name={name}
              type={type}
              placeholder={`Type ${title}`}
              ref={valueToAdd}
              step={step}
              onKeyPress={e => addListItemViaEnterKey(e, valueToAdd)}
            />
            <button type="button" className="add-button" onClick={(e)=> addListItem(e, valueToAdd)}>&#43;</button>
          </>
        </div>
      </div>
    </label>
  );
};

ListElement.propType = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  readOnly: PropTypes.bool,
  inputPlaceholder: PropTypes.string,
  metaData: PropTypes.oneOf([PropTypes.object]),
  step: PropTypes.string,
  updateFormData: PropTypes.func,
  defaultValue: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
};

ListElement.defaultProps = {
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  metaData: {},
  inputPlaceholder: '',
  step: 'any',
  required: false,
};

export default ListElement;
