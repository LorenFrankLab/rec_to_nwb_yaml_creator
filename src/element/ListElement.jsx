import React, { useRef }  from 'react';
import PropTypes from 'prop-types';
import { stringToInteger } from './..//utils';
import InfoIcon from './InfoIcon';
import { useStableId } from '../hooks/useStableId';


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
    id: providedId,
    type,
    title,
    name,
    placeholder,
    defaultValue,
    metaData,
    inputPlaceholder,
    listPlaceHolder,
    updateFormData,
    step,
    readOnly,
  } = prop;

  const id = useStableId(providedId, 'list');

  const addListItem = (e, valueToAddObject) => {
    let value = valueToAddObject.current.value?.trim();

    if (type === 'number') {
      value = stringToInteger(value);
    }

    if (value) {
      let items = structuredClone(defaultValue || []);
      items.push(value); // add value to items
      items = [...new Set(items)]; // remove duplicates
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
  const textPlaceHolder = listPlaceHolder ? listPlaceHolder : `Type ${title}`;

  const inputId = `${id}-input`;

  return (
    <label className="container" htmlFor={inputId}>
      <div className="item1" title={placeholder}>
      {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <div className={`list-of-items base-width ${readOnly ? 'gray-out' : ''}`} ref={listData}>
          { defaultValue?.length === 0
            ? <span>{`${inputPlaceholder}`}</span>
            : defaultValue?.map((item, itemIndex) => (
              <React.Fragment key={`${id}-list-item-${itemIndex}`}>
                <span>
                  {item} <button type="button" onClick={(e)=> removeListItem(e, item)}>&#x2718;</button>
                </span>&nbsp;
              </React.Fragment>
            ))}
          <>
            {' '}
            <input
              id={inputId}
              name={name}
              type={type}
              placeholder={textPlaceHolder}
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

ListElement.propTypes = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  listPlaceHolder: PropTypes.string,
  required: PropTypes.bool,
  readOnly: PropTypes.bool,
  inputPlaceholder: PropTypes.string,
  metaData: PropTypes.object,
  step: PropTypes.string,
  updateFormData: PropTypes.func,
  defaultValue: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
};

ListElement.defaultProps = {
  placeholder: '',
  defaultValue: [],
  readOnly: false,
  metaData: {},
  inputPlaceholder: '',
  listPlaceHolder: null,
  step: 'any',
  required: false,
};

export default ListElement;
