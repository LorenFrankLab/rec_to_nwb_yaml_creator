import React, {
} from 'react';
import PropTypes from 'prop-types';

/**
 * Array item control buttons (duplicate and remove)
 *
 * @param {object} prop Custom element's properties
 *
 * @returns Virtual DOM for array item controls (duplicate/remove buttons)
 */
const ArrayItemControl = (prop) => {
  const {
    index,
    keyValue,
    duplicateArrayItem,
    removeArrayItem,
  } = prop;

  return (
    <div className="array-item__controls">
    <div className="duplicate-item">
      <button
        type="button"
        onClick={() => duplicateArrayItem(index, keyValue)}
      >
        Duplicate
      </button>
    </div>
    <div>
    <button
        className="button-danger"
        type="button"
        onClick={() => removeArrayItem(index, keyValue)}
      >
        Remove
      </button>
    </div>
  </div>
  );
};

ArrayItemControl.propTypes = {
  index: PropTypes.number.isRequired,
  keyValue: PropTypes.string.isRequired,
  duplicateArrayItem: PropTypes.func,
  removeArrayItem: PropTypes.func,
};

ArrayItemControl.defaultProps = {
  duplicateArrayItem: () => {},
  removeArrayItem: () => {},
};

export default ArrayItemControl;
