import React from 'react';
import PropTypes from 'prop-types';

const ArrayUpdateMenu = (prop) => {
  const { itemsKey, items, addArrayItem, removeArrayItem } = prop;

  const add = () => {
    addArrayItem(itemsKey);
  };

  const remove = () => {
    removeArrayItem(itemsKey);
  };

  return (
    <div className="array-update-area">
      <button type="button" onClick={add}>
        Add
      </button>
      <button
        type="button"
        className={`${items === 0 ? 'hide' : ''}`}
        onClick={remove}
      >
        Remove
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

export default ArrayUpdateMenu;
