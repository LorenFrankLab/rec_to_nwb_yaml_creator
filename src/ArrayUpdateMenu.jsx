import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { showCustomValidityError } from './utils';

/**
 *  Encapsulates buttons for updating an array entry for the formData
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for updating an array entry of the resultant YML File
 */
const ArrayUpdateMenu = (prop) => {
  const { itemsKey, items, addArrayItem, removeArrayItem, allowMultiple } =
    prop;

  const itemCountRef = useRef();

  const add = (count) => {
    if (count < 1) {
      showCustomValidityError(
        itemCountRef.current,
        `${itemsKey} must be 1 or higher`
      );
      return;
    }

    addArrayItem(itemsKey, count);

    if (itemCountRef?.current?.value) {
      itemCountRef.current.value = 1;
    }
  };

  const remove = () => {
    removeArrayItem(itemsKey);
  };

  const displayStatus = items?.length === 0 || !items ? 'hide' : '';

  return (
    <div className="array-update-area">
      {!allowMultiple ? (
        <button type="button" title={`Add ${itemsKey}`} onClick={add}>
          <span className="bold">&#65291;</span>
        </button>
      ) : (
        <div className="multi-area">
          <input
            type="number"
            step="1"
            min={1}
            defaultValue={1}
            ref={itemCountRef}
          />
          <button
            type="button"
            title={`Add ${itemsKey}`}
            onClick={() => add(parseInt(itemCountRef.current.value, 10))}
          >
            <span className="bold">&#65291;</span>
          </button>
        </div>
      )}
      <button
        type="button"
        className={displayStatus}
        title={`Remove ${itemsKey}`}
        onClick={remove}
      >
        <span className="bold">&#65293;</span>
      </button>
    </div>
  );
};

ArrayUpdateMenu.propType = {
  addArrayItem: PropTypes.func,
  removeArrayItem: PropTypes.func,
  items: PropTypes.instanceOf(Array),
  itemsKey: PropTypes.string,
};

ArrayUpdateMenu.defaultProps = {
  allowMultiple: false,
};

export default ArrayUpdateMenu;
